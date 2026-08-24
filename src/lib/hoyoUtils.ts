/** Utilidades geométricas sobre un hoyo (posición de mundo a partir de una celda). */
import * as THREE from "three";
import { RADIO_BOLA } from "./tipos";
import type { Celda } from "./tipos";

export function alturaEnCelda(celdas: Celda[], x: number, z: number): number {
  return celdas.find((c) => c.x === x && c.z === z)?.altura ?? 0;
}

/** Centro de una celda, a una elevación dada sobre su superficie (por defecto, apoyando la bola). */
export function posicionSobreCelda(
  celdas: Celda[],
  x: number,
  z: number,
  elevacion = RADIO_BOLA,
): THREE.Vector3 {
  const altura = alturaEnCelda(celdas, x, z);
  return new THREE.Vector3(x + 0.5, altura + elevacion, z + 0.5);
}
