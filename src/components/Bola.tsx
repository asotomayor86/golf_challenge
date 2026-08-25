"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import type { Collider } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { RADIO_BOLA } from "@/lib/tipos";
import type { Celda, DireccionCorriente, Pelota } from "@/lib/tipos";
import { restitucionPelota, aceleracionCorriente, desaceleracionRodadura, embocaria } from "@/lib/fisica";
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
// del suelo (rodando), en vez de corregirlo después. Poner la restitución
// del collider a 0 mientras rueda ataja la causa (nada rebota si la
// colisión es perfectamente inelástica). Con una caída real (al aire, lejos
// del suelo) se restaura la restitución de la pelota.
//
// TODO(rampas futuras): con el hoyo de prueba totalmente llano, además se
// fija la Y de la bola en seco cada frame mientras esté cerca del suelo (ver
// más abajo) — así el eje vertical no varía NUNCA mientras rueda, cero
// salto posible por construcción, en vez de ir corrigiendo desviaciones a
// posteriori (eso se notaba "a trompicones": cualquier corrección aplicada
// de golpe ES un salto). Con desniveles de verdad habrá que interpolar la
// altura de reposo en vez de fijarla en seco — pendiente de diseñar cuando
// vuelva la rampa al hoyo de prueba.

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
    const alturaSuelo = celda?.altura ?? 0;
    const alturaReposo = alturaSuelo + RADIO_BOLA;
    const cercaDelSuelo = posicion.y < alturaReposo + 0.5;

    // Sin rebote mientras rueda: restitución 0 = colisión perfectamente
    // inelástica, así que ningún contacto (una costura, ruido del solver, el
    // golpe en sí) tiene de dónde sacar un rebote. Al alejarse del suelo de
    // verdad, se restaura la restitución real de la pelota para que un golpe
    // fuerte sí bote.
    colisionadorRef.current?.setRestitution(cercaDelSuelo ? 0 : restitucionPelota(pelota) * 2);

    if (celda && cercaDelSuelo) {
      // Frenado final: desaceleración CONSTANTE (fisica.ts), no proporcional
      // a la velocidad como un `linearDamping` — pesa cada vez más según
      // queda menos velocidad, para un frenado decidido al final en vez de
      // reptar (feedback real: "debe frenarse más al final").
      const velocidadHorizontal = Math.hypot(velocidad.x, velocidad.z);
      let vx = velocidad.x;
      let vz = velocidad.z;
      if (velocidadHorizontal > 0.001) {
        const desaceleracion = desaceleracionRodadura(pelota, celda.material);
        const reduccion = Math.min(velocidadHorizontal, desaceleracion * delta);
        const factor = (velocidadHorizontal - reduccion) / velocidadHorizontal;
        vx *= factor;
        vz *= factor;
      }
      // Pegada al suelo: en un hoyo llano, fija la Y en seco cada frame (no
      // solo cuando se desvía) — así el eje vertical no cambia nunca
      // mientras rueda, cero salto posible por construcción.
      api.setTranslation({ x: posicion.x, y: alturaReposo, z: posicion.z }, true);
      api.setLinvel({ x: vx, y: 0, z: vz }, true);
    }

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
      angularDamping={0.4}
    >
      {/* friction/restitution se declaran aquí, en el collider, no en el
          RigidBody: con colliders={false} un `friction`/`restitution` puesto
          en RigidBody no tiene ningún collider auto-generado al que
          aplicarse. La fricción de rodadura real la pone el frenado
          explícito en Bola.tsx (desaceleracionRodadura), no este valor —
          se deja en 0 para no sumar fricción de deslizamiento por encima.
          restitution empieza en 0 (en reposo); useFrame la ajusta cada
          frame según si está cerca del suelo o no (ver comentario arriba). */}
      <BallCollider ref={colisionadorRef} args={[RADIO_BOLA]} friction={0} restitution={0} />
      <mesh castShadow>
        <sphereGeometry args={[RADIO_BOLA, 32, 32]} />
        <meshStandardMaterial
          color="#f5f5f0"
          roughness={0.4}
          bumpMap={obtenerTexturaHoyuelosPelota()}
          bumpScale={0.04}
        />
      </mesh>
    </RigidBody>
  );
}
