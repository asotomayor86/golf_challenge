/**
 * Fórmulas de física del golf (ver golf_prompt.md §4). Funciones puras, sin
 * dependencia de Three.js/Rapier, para poder testearlas sin levantar el motor
 * 3D. Los componentes de render leen estos valores y los aplican a los
 * RigidBody de Rapier.
 *
 * Constantes marcadas "TODO: ajustar en playtest" no vienen fijadas por el
 * documento de diseño — son las que se sintonizan en la Fase 1 al validar que
 * el golpe "se siente bien" (ver §1 del prompt: no seguir sin esa validación).
 */
import type { Material, Palo, Pelota } from "./tipos";

// --- Palo --------------------------------------------------------------------

/** Impulso máximo (unidades/s) que puede dar un palo a máxima potencia. */
export function velocidadMaxima(palo: Palo): number {
  return 8 + palo.potencia * 4;
}

/**
 * Decisión de playtest (2026-08-24): se elimina el desvío aleatorio del
 * golpe (antes ligado a "precision", que ya no existe como estadística). El
 * golpe sale siempre exactamente hacia donde se apunta, pegues suave o
 * fuerte — así que ya no hay `desvioGolpe`. "Guía" queda como ayuda
 * puramente visual (línea + rebotes previsualizados, ver `guiaVisual`).
 */

/** Línea de guía: longitud (unidades) y nº de rebotes que previsualiza. */
export function guiaVisual(palo: Palo): { longitud: number; rebotes: number } {
  return { longitud: palo.guia * 3, rebotes: palo.guia - 1 };
}

// --- Pelota + material ---------------------------------------------------------

/** Fricción de rodadura que aporta la pelota, antes del multiplicador de material. */
export function friccionBase(pelota: Pelota): number {
  return 0.06 - pelota.velocidad * 0.008;
}

/** Multiplicador de fricción por material (se combina con friccionBase vía Rapier `multiply`). */
export const MULTIPLICADOR_FRICCION_MATERIAL: Record<Material, number> = {
  cesped: 1,
  piedra: 0.85,
  arena: 2.6,
  hielo: 0.25,
  cristal: 0.8,
  // El agua profunda no se "rueda" (la bola se repone al caer, ver reglas);
  // la corriente se pinta sobre otro material y no aporta fricción propia.
  agua_profunda: 1,
  corriente: 1,
};

/** Fricción efectiva (coeficiente de Coulomb) de la pelota sobre un material dado. */
export function friccionEnMaterial(pelota: Pelota, material: Material): number {
  return friccionBase(pelota) * MULTIPLICADOR_FRICCION_MATERIAL[material];
}

/**
 * TODO: ajustar en playtest — escala que convierte friccionEnMaterial (un
 * coeficiente de Coulomb, pensado para fricción de CONTACTO) en un
 * `linearDamping` de Rapier. Hace falta porque una bola que rueda SIN
 * deslizar apenas roza la fricción de Coulomb (esa fricción solo actúa
 * cuando hay deslizamiento relativo en el punto de contacto) — con solo
 * `friction` en el collider, la bola "nunca acaba de frenarse del todo"
 * (feedback real de playtest). El `linearDamping` sí frena rodadura pura.
 */
export const ESCALA_AMORTIGUACION_RODADURA = 22;

/** `linearDamping` (Rapier) que aplicar a la bola mientras rueda sobre un material dado. */
export function amortiguacionRodadura(pelota: Pelota, material: Material): number {
  return friccionEnMaterial(pelota, material) * ESCALA_AMORTIGUACION_RODADURA;
}

/** Restitución (rebote) de la pelota, usada como `restitution` del collider. */
export function restitucionPelota(pelota: Pelota): number {
  return 0.25 + pelota.bote * 0.11;
}

// --- Corriente -----------------------------------------------------------------

/** TODO: ajustar en playtest — aceleración (u/s²) por punto de `fuerza` de una corriente. */
export const ACELERACION_CORRIENTE_POR_FUERZA = 0.9;

/**
 * Aceleración (u/s²) que la corriente aplica a la pelota mientras está sobre
 * esas celdas. Debe ser perceptible pero no dominante: a fuerza 5 una bola
 * parada deriva, no sale disparada (muy por debajo de las velocidades de
 * golpe, que arrancan en 12 u/s). Ya no depende de la pelota — sin
 * "precision", no queda ninguna estadística de la pelota a la que ligar la
 * resistencia a la corriente, así que arrastra igual a cualquier pelota.
 */
export function aceleracionCorriente(fuerza: 1 | 2 | 3 | 4 | 5): number {
  return fuerza * ACELERACION_CORRIENTE_POR_FUERZA;
}

// --- Embocado ------------------------------------------------------------------

/** TODO: ajustar en playtest — radio (u) de la copa y velocidad máxima para embocar sin lip-out. */
export const RADIO_COPA = 0.35;
export const VELOCIDAD_MAX_EMBOCAR = 4.5;

/** true = la bola entra; false = demasiado rápida, rebota (lip-out). */
export function embocaria(distanciaAlCentro: number, velocidad: number): boolean {
  return distanciaAlCentro <= RADIO_COPA && velocidad <= VELOCIDAD_MAX_EMBOCAR;
}
