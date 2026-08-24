/**
 * Hoyo hardcodeado para la Fase 1: aquí es donde se valida que la física "se
 * siente bien" antes de construir el editor (§1 del prompt). Recorre calle de
 * césped → búnker de arena → rampa → placa de hielo → corriente → green, y
 * añade un rincón con las 5 formas para comprobar que el generador procedural
 * (`geometria.ts`) las construye todas sin fallar.
 */
import type { Celda, Hoyo } from "./tipos";

function rectangulo(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  base: Omit<Celda, "x" | "z">,
): Celda[] {
  const celdas: Celda[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      celdas.push({ ...base, x, z });
    }
  }
  return celdas;
}

const CESPED_1 = { altura: 1, material: "cesped", forma: "cubo", rotacion: 0 } as const;
const CESPED_2 = { altura: 2, material: "cesped", forma: "cubo", rotacion: 0 } as const;

const celdas: Celda[] = [
  // Calle principal (z=1..3), de la salida al green.
  ...rectangulo(0, 2, 1, 3, CESPED_1), // salida
  ...rectangulo(3, 4, 1, 3, { altura: 1, material: "arena", forma: "cubo", rotacion: 0 }), // búnker
  ...rectangulo(5, 5, 1, 3, { altura: 2, material: "cesped", forma: "rampa", rotacion: 90 }), // sube hacia +x
  ...rectangulo(6, 7, 1, 3, CESPED_2), // meseta
  ...rectangulo(8, 8, 1, 3, { altura: 2, material: "hielo", forma: "cubo", rotacion: 0 }), // placa de hielo
  ...rectangulo(9, 9, 1, 3, {
    altura: 2,
    material: "corriente",
    forma: "cubo",
    rotacion: 0,
    corriente: { direccion: "E", fuerza: 3 },
  }),
  ...rectangulo(10, 11, 1, 3, CESPED_2), // green con la copa

  // Rincón de muestra (fuera de la calle) con el resto de formas, para
  // comprobar que el generador procedural las soporta todas.
  ...rectangulo(0, 0, 5, 5, { altura: 1, material: "piedra", forma: "cuna_diagonal", rotacion: 0 }),
  ...rectangulo(1, 1, 5, 5, { altura: 1, material: "cesped", forma: "medio_bloque", rotacion: 0 }),
  ...rectangulo(2, 2, 5, 5, { altura: 2, material: "piedra", forma: "rampa_esquina", rotacion: 0 }),
  ...rectangulo(3, 3, 5, 5, { altura: 1, material: "cristal", forma: "cubo", rotacion: 0 }),
];

export const HOYO_EJEMPLO: Hoyo = {
  id: "hoyo-ejemplo-fase1",
  version: 1,
  nombre: "Hoyo de prueba (Fase 1)",
  autorId: "sistema",
  tipo: "normal",
  ancho: 12,
  largo: 6,
  celdas,
  salida: { x: 1, z: 2 },
  bandera: { x: 10, z: 2 },
  limiteSegundos: 120,
  creadoEn: new Date(0).toISOString(),
};
