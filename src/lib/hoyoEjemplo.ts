/**
 * Hoyo hardcodeado para la Fase 1: aquí es donde se valida que la física "se
 * siente bien" antes de construir el editor (§1 del prompt). Calle recta de
 * césped hasta el green, y un rincón con las 5 formas (todas en césped) para
 * comprobar que el generador procedural (`geometria.ts`) las construye todas
 * sin fallar.
 *
 * TODO: temporalmente solo en césped y sin rampa en la calle (toda a altura
 * 1) — arena/hielo/corriente/rampa se han quitado para aislar el resto de
 * cambios (guía/flecha, pozo de la copa, tamaño de la bola) del resto de
 * mecánicas mientras se terminan de pulir. Las demás formas y materiales
 * siguen existiendo en `geometria.ts`/`fisica.ts` y en los tests.
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
  // Calle principal (z=1..3), de la salida al green — toda césped, toda a altura 1.
  ...rectangulo(0, 11, 1, 3, CESPED_1),

  // Rincón de muestra (fuera de la calle) con el resto de formas, todas en
  // césped, para comprobar que el generador procedural las soporta todas.
  ...rectangulo(0, 0, 5, 5, { altura: 1, material: "cesped", forma: "cuna_diagonal", rotacion: 0 }),
  ...rectangulo(1, 1, 5, 5, { altura: 1, material: "cesped", forma: "medio_bloque", rotacion: 0 }),
  ...rectangulo(2, 2, 5, 5, { altura: 2, material: "cesped", forma: "rampa_esquina", rotacion: 0 }),
  ...rectangulo(3, 3, 5, 5, CESPED_2),
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
