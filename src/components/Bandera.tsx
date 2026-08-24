"use client";

import * as THREE from "three";
import { PROFUNDIDAD_COPA } from "@/lib/fisica";

/**
 * Asta + bandera. El agujero de verdad (paredes + fondo) ya no vive aquí:
 * lo recorta `construirGeometriaHoyo` directamente en la malla del terreno
 * (ver geometria.ts `celdaConAgujero`) — un decorado aparte quedaba enterrado
 * dentro del bloque sólido del césped y no se veía.
 */
export function Bandera({ posicion }: { posicion: [number, number, number] }) {
  const [x, y, z] = posicion;
  const alturaAsta = 1.8;
  return (
    <group position={[x, y, z]}>
      {/* Baja hasta el fondo del agujero para que no quede flotando sobre él. */}
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
