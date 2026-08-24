"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import * as THREE from "three";
import { RADIO_BOLA } from "@/lib/tipos";
import type { Celda, DireccionCorriente, Pelota } from "@/lib/tipos";
import { restitucionPelota, aceleracionCorriente, amortiguacionRodadura, embocaria } from "@/lib/fisica";
import { obtenerTexturaHoyuelosPelota } from "@/lib/texturas";
import { useJuego } from "@/lib/store";
import { bolaRef } from "@/lib/refs";

const UMBRAL_DETENIDA = 0.05; // u/s — por debajo se considera "parada" para el HUD
const Y_CAIDA_LIMITE = -5; // TODO(Fase 3): sustituir por la regla real (agua/fuera de límites ⇒ +1 y vuelve a la última posición seca)

// Animación de embocado: la bola no se limita a pararse encima de la copa
// (con el radio de copa más grande que la bola no se notaba que "caía"
// dentro) — se anima cayendo y encogiendo un poco, puramente visual.
const DURACION_EMBOCADO_S = 0.4;
const PROFUNDIDAD_EMBOCADO = 0.3;

function suavizado(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

// TODO: ajustar en playtest — mantiene la bola "pegada al suelo" mientras
// rueda: sin esto, cualquier micro-bache del collider (una costura entre
// materiales, ruido numérico del solver, o el cambio de normal al entrar o
// salir de una rampa) se traducía en rebotitos perceptibles incluso en
// terreno llano (feedback real de playtest). Solo se distingue de una
// CAÍDA real por la velocidad vertical que traía el frame anterior: si ya
// venía cayendo fuerte, se deja rebotar con normalidad; si no, cualquier
// vy hacia arriba por encima del tope se recorta.
const CAYENDO_DE_VERDAD_VY = -3; // vy (frame anterior) más negativa que esto ⇒ fue una caída real
const TOPE_VY_RODANDO = 0.3; // por encima de esto sin venir de una caída real, se recorta
const TOLERANCIA_ALTURA = 0.08; // u — cuánto puede separarse del suelo antes de devolverla a la altura de reposo

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
  const velocidadYAnterior = useRef(0);
  const mallaRef = useRef<THREE.Mesh>(null);
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
      mallaRef.current?.scale.setScalar(1 - 0.6 * progreso);
      return;
    }

    if (embocadoAnim.current) {
      // Se ha reiniciado la partida viniendo de un embocado: deshace lo que
      // dejó la animación (gravedad, escala) antes de seguir jugando.
      api.setGravityScale(1, true);
      mallaRef.current?.scale.setScalar(1);
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

    // Pegada al suelo salvo caída real (ver comentario arriba de las
    // constantes). El recorte de velocidad no basta cuando el propio golpe
    // (inyectar de golpe una velocidad horizontal grande sobre una bola en
    // reposo) hace que el solver de contacto "empuje" la bola hacia arriba
    // en un único paso de física — para cuando este código lo ve puede
    // llevar ya más de 0.5u en el aire (fuera de `cercaDelSuelo`), así que
    // la corrección de posición NO se limita a "cerca del suelo": mientras
    // haya una celda de verdad debajo (si no, está cayendo por un hueco de
    // verdad, eso sí hay que dejarlo) y no venga de una caída real, no hay
    // ninguna razón legítima para que se haya separado del suelo.
    const veniaCayendoFuerte = velocidadYAnterior.current < CAYENDO_DE_VERDAD_VY;
    const sinRazonParaSubir = celda !== undefined && !veniaCayendoFuerte;
    if (sinRazonParaSubir && posicion.y > alturaReposo + TOLERANCIA_ALTURA) {
      api.setTranslation({ x: posicion.x, y: alturaReposo, z: posicion.z }, true);
      api.setLinvel({ x: velocidad.x, y: 0, z: velocidad.z }, true);
      velocidadYAnterior.current = 0;
    } else if (cercaDelSuelo && sinRazonParaSubir && velocidad.y > TOPE_VY_RODANDO) {
      api.setLinvel({ x: velocidad.x, y: TOPE_VY_RODANDO, z: velocidad.z }, true);
      velocidadYAnterior.current = TOPE_VY_RODANDO;
    } else {
      velocidadYAnterior.current = velocidad.y;
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
      friction={0} // la fricción real la pone el terreno (ver Terreno.tsx)
      restitution={restitucionPelota(pelota) * 2} // combine-rule por defecto = media; terreno pone 0
      angularDamping={0.4}
    >
      <BallCollider args={[RADIO_BOLA]} />
      <mesh ref={mallaRef} castShadow>
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
