/** Apariencia visual de cada material del terreno (no afecta a la física; ver fisica.ts). */
import type { Material } from "./tipos";

export interface EstiloMaterial {
  color: string;
  rugosidad: number;
  metalico: number;
  opacidad?: number; // <1 = transparente (cristal, agua)
  emisivo?: string;
}

export const ESTILO_MATERIAL: Record<Material, EstiloMaterial> = {
  cesped: { color: "#4caf50", rugosidad: 0.9, metalico: 0 },
  piedra: { color: "#8d8d8d", rugosidad: 0.8, metalico: 0.05 },
  arena: { color: "#e3c16f", rugosidad: 1, metalico: 0 },
  hielo: { color: "#bfe9f5", rugosidad: 0.05, metalico: 0.1, opacidad: 0.85 },
  cristal: { color: "#bcd8ff", rugosidad: 0.02, metalico: 0, opacidad: 0.35 },
  agua_profunda: { color: "#1b5e8f", rugosidad: 0.1, metalico: 0, opacidad: 0.75 },
  corriente: { color: "#3f8fbf", rugosidad: 0.2, metalico: 0, opacidad: 0.8 },
};
