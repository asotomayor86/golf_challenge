"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import type { Collider } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { RADIO_BOLA } from "@/lib/tipos";
import type { Celda, DireccionCorriente, Pelota } from "@/lib/tipos";
import { restitucionPelota, aceleracionCorriente, amortiguacionRodadura, embocaria } from "@/lib/fisica";
import { obtenerTexturaHoyuelosPelota } from "@/lib/texturas";
import { useJuego } from "@/lib/store";
import { bolaRef } from "@/lib/refs";

const UMBRAL_DETENIDA = 0.05; // u/s — por debajo se considera "parada" para el HUD
const Y_CAIDA_LIMITE = -5; // TODO(Fase 3): sustituir por la regla real (agua/fuera de límites ⇒ +1 y vuelve a la última posición seca)

// Animación de embocado: la bola no se limita a pararse encima de la copa,
// se anima cayendo hasta el fondo del agujero de verdad (geometria.ts
// `celdaConAgujero`). Nada de encoger la bola — con el agujero ya teniendo
// profundidad real, encogerla ENCIMA quedaba raro (se veía "hacerse
// pequeña" en vez de caer).
const DURACION_EMBOCADO_S = 0.4;
const PROFUNDIDAD_EMBOCADO = 0.3;

function suavizado(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

// TODO: ajustar en playtest — quita el rebote mientras la bola está cerca
// del suelo (rodando), en vez de corregirlo después. Intentos anteriores
// (recortar la velocidad vertical, incluso teletransportar la posición de
// vuelta a la altura de reposo) sí evitaban el rebote pero se notaban "a
// trompicones" — cualquier corrección aplicada de golpe, frame a frame, ES
// en sí misma un movimiento discontinuo. Poner la restitución del collider
// a 0 mientras rueda ataja la causa (nada rebota si la colisión es
// perfectamente inelástica) en vez de corregir el síntoma después, así que
// el movimiento que sale del propio solver ya es continuo. Con una caída
// real (al aire, lejos del suelo) se restaura la restitución de la pelota.

const DIRECCION_CORRIENTE: Record<DireccionCorriente, THREE.Vector3> = {
  N: new THREE.Vector3(0, 0, -1),
  S: new THREE.Vector3(0, 0, 1),
  E: new THREE.Vector3(1, 0, 0),
  O: new THREE.Vector3(-1, 0, 0),
};

/** Celda bajo un punto del mundo (suelo = y=0, cada celda mide 1×1). */
function celdaEn(x: number, z: number, celdas: Celda[]): Celda | undefined {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  return celdas.find((c) => c.x === cx && c.z === cz);
}

export function Bola({
  celdas,
  pelota,
  posicionInicial,
  posicionBandera,
}: {
  celdas: Celda[];
  pelota: Pelota;
  posicionInicial: THREE.Vector3;
  posicionBandera: THREE.Vector3;
}) {
  const ultimoIdProcesado = useRef(0);
  const estabaEnMovimiento = useRef(false);
  const colisionadorRef = useRef<Collider>(null);
  const embocadoAnim = useRef<{ yInicial: number; t: number } | null>(null);
  const solicitudDisparo = useJuego((s) => s.solicitudDisparo);
  const embocada = useJuego((s) => s.embocada);
  const marcarMovimiento = useJuego((s) => s.marcarMovimiento);
  const marcarEmbocada = useJuego((s) => s.marcarEmbocada);

  // Nuevo golpe: se golpea con setLinvel (velocidad directa) en vez de un
  // impulso, porque vMax ya está expresado como u/s en fisica.ts — así no
  // depende de la masa del RigidBody.
  useEffect(() => {
    if (!solicitudDisparo || solicitudDisparo.id === ultimoIdProcesado.current) return;
    ultimoIdProcesado.current = solicitudDisparo.id;
    const api = bolaRef.current;
    if (!api) return;
    api.wakeUp();
    api.setLinvel(solicitudDisparo.velocidad, true);
  }, [solicitudDisparo]);

  useFrame((_, delta) => {
    const api = bolaRef.current;
    if (!api) return;

    if (embocada) {
      if (!embocadoAnim.current) {
        api.setGravityScale(0, true); // deja de caer "de verdad"; el resto lo anima este bloque
        embocadoAnim.current = { yInicial: api.translation().y, t: 0 };
      }
      embocadoAnim.current.t = Math.min(DURACION_EMBOCADO_S, embocadoAnim.current.t + delta);
      const progreso = suavizado(embocadoAnim.current.t / DURACION_EMBOCADO_S);
      const p = api.translation();
      api.setTranslation({ x: p.x, y: embocadoAnim.current.yInicial - PROFUNDIDAD_EMBOCADO * progreso, z: p.z }, true);
      api.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    if (embocadoAnim.current) {
      // Se ha reiniciado la partida viniendo de un embocado: deshace lo que
      // dejó la animación (gravedad) antes de seguir jugando.
      api.setGravityScale(1, true);
      embocadoAnim.current = null;
    }

    const posicion = api.translation();
    const velocidad = api.linvel();
    const rapidez = Math.hypot(velocidad.x, velocidad.y, velocidad.z);

    const moviendose = rapidez > UMBRAL_DETENIDA;
    if (moviendose !== estabaEnMovimiento.current) {
      estabaEnMovimiento.current = moviendose;
      // Diferido: el store lo leen componentes de OTRO root de React (el DOM,
      // fuera del <Canvas>). Actualizarlo en el mismo tick síncrono que este
      // useFrame puede pillar a React a mitad de renderizar ese otro root.
      queueMicrotask(() => marcarMovimiento(moviendose));
    }

    const celda = celdaEn(posicion.x, posicion.z, celdas);

    // Fricción de rodadura: la fricción de Coulomb del collider (Terreno.tsx)
    // casi no frena una bola que rueda sin deslizar, así que el material se
    // aplica aquí como `linearDamping` (ver comentario en fisica.ts). Solo
    // mientras esté cerca del suelo: en pleno vuelo de un golpe no debe
    // frenarse como si rodara.
    const alturaSuelo = celda?.altura ?? 0;
    const alturaReposo = alturaSuelo + RADIO_BOLA;
    const cercaDelSuelo = posicion.y < alturaReposo + 0.5;
    api.setLinearDamping(cercaDelSuelo ? amortiguacionRodadura(pelota, celda?.material ?? "cesped") : 0);

    // Sin rebote mientras rueda (ver comentario arriba de las constantes):
    // restitución 0 = colisión perfectamente inelástica, así que ningún
    // contacto (una costura, ruido del solver, el golpe en sí) tiene de
    // dónde sacar un rebote. Al alejarse del suelo de verdad, se restaura
    // la restitución real de la pelota para que un golpe fuerte sí bote.
    colisionadorRef.current?.setRestitution(cercaDelSuelo ? 0 : restitucionPelota(pelota) * 2);

    // Corriente: aceleración continua mientras la bola esté sobre esas celdas.
    if (celda?.corriente) {
      const direccion = DIRECCION_CORRIENTE[celda.corriente.direccion];
      const aceleracion = aceleracionCorriente(celda.corriente.fuerza);
      const masa = api.mass();
      api.applyImpulse(
        { x: direccion.x * aceleracion * masa * delta, y: 0, z: direccion.z * aceleracion * masa * delta },
        true,
      );
    }

    // Embocado: dentro del radio de la copa y por debajo del umbral de velocidad.
    const distanciaBandera = Math.hypot(posicion.x - posicionBandera.x, posicion.z - posicionBandera.z);
    if (Math.abs(posicion.y - posicionBandera.y) < 0.5 && embocaria(distanciaBandera, rapidez)) {
      api.setLinvel({ x: 0, y: 0, z: 0 }, true);
      api.setAngvel({ x: 0, y: 0, z: 0 }, true);
      queueMicrotask(() => marcarEmbocada()); // ver comentario sobre "moviendose" arriba
      return;
    }

    // TODO(Fase 3): agua profunda / fuera de límites ⇒ +1 golpe y vuelta a la
    // última posición seca en reposo. De momento, red de seguridad de Fase 1.
    if (posicion.y < Y_CAIDA_LIMITE) {
      api.setTranslation(posicionInicial, true);
      api.setLinvel({ x: 0, y: 0, z: 0 }, true);
      api.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <RigidBody
      ref={bolaRef}
      ccd // obligatorio: a vMax alta la bola no debe atravesar paredes en un solo paso
      type="dynamic"
      colliders={false}
      position={posicionInicial}
      friction={0} // la fricción real la pone el terreno (ver Terreno.tsx)
      angularDamping={0.4}
    >
      {/* restitution empieza en 0 (en reposo); useFrame la ajusta cada
          frame según si está cerca del suelo o no (ver comentario arriba). */}
      <BallCollider ref={colisionadorRef} args={[RADIO_BOLA]} restitution={0} />
      <mesh castShadow>
        <sphereGeometry args={[RADIO_BOLA, 32, 32]} />
        <meshStandardMaterial
          color="#f5f5f0"
          roughness={0.4}
          bumpMap={obtenerTexturaHoyuelosPelota()}
          bumpScale={0.01}
        />
      </mesh>
    </RigidBody>
  );
}
