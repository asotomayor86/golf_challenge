"use client";

import * as THREE from "three";
import { RADIO_COPA } from "@/lib/fisica";

/**
 * Marcador visual de la copa + bandera. Fase 1: un disco oscuro sobre el
 * césped (no recorta la malla del terreno todavía — eso es pulido de Fase 2).
 */
export function Bandera({ posicion }: { posicion: [number, number, number] }) {
  const [x, y, z] = posicion;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RADIO_COPA, 24]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.8, 6]} />
        <meshStandardMaterial color="#d9d9d9" />
      </mesh>
      <mesh position={[0.18, 1.55, 0]}>
        <planeGeometry args={[0.36, 0.24]} />
        <meshStandardMaterial color="#e63946" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
