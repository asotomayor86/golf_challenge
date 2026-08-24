/**
 * Catálogos de palos y pelotas (ver golf_prompt.md §4, con la simplificación
 * de playtest del 2026-08-24: sin "precision" en ninguno de los dos).
 *
 * Palos: las 5 combinaciones válidas de (potencia, guía) en 1..5 que suman 6
 * se generan por código (no se hardcodea la lista); solo el nombre base
 * según el perfil dominante es vocabulario fijo.
 *
 * Pelotas: catálogo cerrado de 5 (velocidad, bote), mismo criterio de suma.
 */
import type { PaloCatalogo, PelotaCatalogo } from "./tipos";

function nombreBasePalo(potencia: number, guia: number): string {
  if (potencia === guia) return "Equilibrado"; // solo 3/3
  return potencia > guia ? "Martillo" : "Brújula";
}

/** Genera las 5 combinaciones válidas de palo (potencia + guía = 6). */
export function generarCatalogoPalos(): PaloCatalogo[] {
  const palos: PaloCatalogo[] = [];
  for (let potencia = 1; potencia <= 5; potencia++) {
    const guia = 6 - potencia;
    if (guia < 1 || guia > 5) continue;
    const p = potencia as 1 | 2 | 3 | 4 | 5;
    const g = guia as 1 | 2 | 3 | 4 | 5;
    palos.push({ potencia: p, guia: g, nombre: `${nombreBasePalo(potencia, guia)} ${potencia}/${guia}` });
  }
  return palos;
}

export const CATALOGO_PELOTAS: PelotaCatalogo[] = [
  { nombre: "Cohete", velocidad: 5, bote: 1 },
  { nombre: "Bala", velocidad: 4, bote: 2 },
  { nombre: "Estándar", velocidad: 3, bote: 3 },
  { nombre: "Muelle", velocidad: 2, bote: 4 },
  { nombre: "Saltarina", velocidad: 1, bote: 5 },
];
