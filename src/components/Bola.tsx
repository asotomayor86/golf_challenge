"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import * as THREE from "three";
import { RADIO_BOLA } from "@/lib/tipos";
import type { Celda, DireccionCorriente, Pelota } from "@/lib/tipos";
import { restitucionPelota, aceleracionCorriente, embocaria } from "@/lib/fisica";
import { useJuego } from "@/lib/store";
import { bolaRef } from "@/lib/refs";

const UMBRAL_DETENIDA = 0.05; // u/s — por debajo se considera "parada" para el HUD
const Y_CAIDA_LIMITE = -5; // TODO(Fase 3): sustituir por la regla real (agua/fuera de límites ⇒ +1 y vuelve a la última posición seca)

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
    if (!api || embocada) return;

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

    // Corriente: aceleración continua mientras la bola esté sobre esas celdas.
    const celda = celdaEn(posicion.x, posicion.z, celdas);
    if (celda?.corriente) {
      const direccion = DIRECCION_CORRIENTE[celda.corriente.direccion];
      const aceleracion = aceleracionCorriente(celda.corriente.fuerza, pelota);
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
      <mesh castShadow>
        <sphereGeometry args={[RADIO_BOLA, 24, 24]} />
        <meshStandardMaterial color="#f5f5f0" roughness={0.4} />
      </mesh>
    </RigidBody>
  );
}
