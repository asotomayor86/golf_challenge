/**
 * Modelo de datos compartido entre editor, motor de física/reglas y
 * persistencia. Una sola fuente de verdad para no divergir entre esas tres
 * capas (ver golf_prompt.md §2).
 */

export type Material =
  | "cesped"
  | "piedra"
  | "arena"
  | "hielo"
  | "cristal"
  | "agua_profunda"
  | "corriente";

export type Forma = "cubo" | "rampa" | "rampa_esquina" | "cuna_diagonal" | "medio_bloque";

export type Rotacion = 0 | 90 | 180 | 270;

export type DireccionCorriente = "N" | "S" | "E" | "O";

export interface Celda {
  x: number; // 0..31
  z: number; // 0..31
  altura: number; // 0..8 (nº de bloques apilados; la celda ocupa y=0..altura)
  material: Material;
  forma: Forma; // aplicada al bloque superior
  rotacion: Rotacion;
  corriente?: { direccion: DireccionCorriente; fuerza: 1 | 2 | 3 | 4 | 5 };
}

export type TipoHoyo = "normal" | "desempate";

export interface Hoyo {
  id: string;
  version: number; // ver §7 — versionado; editar el hoyo lo incrementa
  nombre: string;
  autorId: string;
  tipo: TipoHoyo;
  ancho: number; // máx 32
  largo: number; // máx 32
  celdas: Celda[];
  salida: { x: number; z: number };
  bandera: { x: number; z: number }; // en 'normal' hay copa; en 'desempate' solo bandera
  limiteSegundos: number; // 30..600, por defecto 120
  creadoEn: string;
}

export interface Circuito {
  id: string;
  nombre: string;
  hoyos: string[]; // ids de hoyos 'normal', mínimo 3
  hoyoDesempate?: string; // id de un hoyo tipo 'desempate'
}

/**
 * potencia + guia = 6 siempre.
 *
 * (Decisión de playtest, 2026-08-24: se elimina "precision" del palo — el
 * desvío aleatorio del golpe resultaba demasiado impredecible, así que el
 * golpe ahora sale siempre exactamente hacia donde se apunta, sin importar
 * la potencia usada. "Guía" pasa a ser puramente visual: línea de ayuda +
 * rebotes previsualizados, ver fisica.ts `guiaVisual`.)
 */
export interface Palo {
  potencia: 1 | 2 | 3 | 4 | 5;
  guia: 1 | 2 | 3 | 4 | 5;
}

/**
 * velocidad + bote = 6 siempre.
 *
 * (Misma decisión de playtest: se elimina "precision" de la pelota. Ya no
 * modula la resistencia a la corriente — la corriente arrastra igual a
 * cualquier pelota, ver fisica.ts `aceleracionCorriente`.)
 */
export interface Pelota {
  velocidad: 1 | 2 | 3 | 4 | 5;
  bote: 1 | 2 | 3 | 4 | 5;
}

/** Un palo con nombre, tal y como aparece en el catálogo de 19 combinaciones. */
export interface PaloCatalogo extends Palo {
  nombre: string;
}

/** Una pelota con nombre, tal y como aparece en el catálogo fijo de 5. */
export interface PelotaCatalogo extends Pelota {
  nombre: string;
}

// --- Unidades ---------------------------------------------------------------
// 1 bloque = 1 unidad de mundo. Eje Y = altura.
// Radio de la bola: el diseño original pedía 0,2; en playtest se veía grande
// frente al hoyo (radio 0,35, ver RADIO_COPA en fisica.ts) y se bajó a 0,15.
export const RADIO_BOLA = 0.15;
export const TAMANO_CELDA_MAX = 32;
export const ALTURA_MAX_BLOQUES = 8;
export const LIMITE_BLOQUES_HOYO = 2000;
