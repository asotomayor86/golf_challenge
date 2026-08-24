/**
 * Catálogos de palos y pelotas (ver golf_prompt.md §4).
 *
 * Palos: las 19 combinaciones válidas de (potencia, precisión, guía) en 1..5
 * que suman 9 se generan por código (no se hardcodea la lista); solo el
 * nombre base según el perfil dominante es vocabulario fijo.
 *
 * Pelotas: catálogo cerrado de 5, tal cual las especifica el documento.
 */
import type { PaloCatalogo, PelotaCatalogo } from "./tipos";

function nombreBasePalo(potencia: number, precision: number, guia: number): string {
  const max = Math.max(potencia, precision, guia);
  const esPotencia = potencia === max;
  const esPrecision = precision === max;
  const esGuia = guia === max;

  if (esPotencia && esPrecision && esGuia) return "Equilibrado";
  if (esPotencia && esPrecision) return "Ariete";
  if (esPotencia && esGuia) return "Lanza";
  if (esPrecision && esGuia) return "Compás";
  if (esPotencia) return "Martillo";
  if (esPrecision) return "Bisturí";
  return "Brújula"; // guía es el único máximo
}

/** Genera las 19 combinaciones válidas de palo (potencia+precisión+guía = 9). */
export function generarCatalogoPalos(): PaloCatalogo[] {
  const palos: PaloCatalogo[] = [];
  for (let potencia = 1; potencia <= 5; potencia++) {
    for (let precision = 1; precision <= 5; precision++) {
      const guia = 9 - potencia - precision;
      if (guia < 1 || guia > 5) continue;
      const p = potencia as 1 | 2 | 3 | 4 | 5;
      const pr = precision as 1 | 2 | 3 | 4 | 5;
      const g = guia as 1 | 2 | 3 | 4 | 5;
      palos.push({
        potencia: p,
        precision: pr,
        guia: g,
        nombre: `${nombreBasePalo(potencia, precision, guia)} ${potencia}/${precision}/${guia}`,
      });
    }
  }
  return palos;
}

export const CATALOGO_PELOTAS: PelotaCatalogo[] = [
  { nombre: "Estándar", velocidad: 3, precision: 3, bote: 3 },
  { nombre: "Cohete", velocidad: 5, precision: 2, bote: 2 },
  { nombre: "Bisturí", velocidad: 2, precision: 5, bote: 2 },
  { nombre: "Saltarina", velocidad: 2, precision: 2, bote: 5 },
  { nombre: "Equilibrada", velocidad: 4, precision: 4, bote: 1 },
];
