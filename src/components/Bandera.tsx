"use client";

import * as THREE from "three";
import { RADIO_COPA } from "@/lib/fisica";

const PROFUNDIDAD_COPA = 0.4; // u — un pozo de verdad, no un círculo pintado encima del césped

/**
 * Marcador visual de la copa + bandera: un pozo cilíndrico de verdad (paredes
 * + fondo), no un disco negro plano — así se ve que tiene profundidad en vez
 * de leerse como un agujero negro. No recorta la malla del césped todavía
 * (eso es pulido de Fase 2); el pozo simplemente se superpone encima.
 */
export function Bandera({ posicion }: { posicion: [number, number, number] }) {
  const [x, y, z] = posicion;
  const alturaAsta = 1.8;
  return (
    <group position={[x, y, z]}>
      {/* Paredes del pozo */}
      <mesh position={[0, -PROFUNDIDAD_COPA / 2, 0]}>
        <cylinderGeometry args={[RADIO_COPA, RADIO_COPA, PROFUNDIDAD_COPA, 24, 1, true]} />
        <meshStandardMaterial color="#2e2a26" side={THREE.DoubleSide} roughness={1} />
      </mesh>
      {/* Fondo del pozo */}
      <mesh position={[0, -PROFUNDIDAD_COPA + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RADIO_COPA, 24]} />
        <meshStandardMaterial color="#1c1815" roughness={1} />
      </mesh>
      {/* Asta: baja hasta el fondo del pozo para que no quede flotando sobre él */}
      <mesh position={[0, (alturaAsta - PROFUNDIDAD_COPA) / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, alturaAsta + PROFUNDIDAD_COPA, 6]} />
        <meshStandardMaterial color="#d9d9d9" />
      </mesh>
      <mesh position={[0.18, alturaAsta - 0.25, 0]}>
        <planeGeometry args={[0.36, 0.24]} />
        <meshStandardMaterial color="#e63946" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
