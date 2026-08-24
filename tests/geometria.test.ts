import { describe, expect, it } from "vitest";
import { construirGeometriaHoyo, trimeshDesdeGeometria } from "@/lib/geometria";
import { HOYO_EJEMPLO } from "@/lib/hoyoEjemplo";
import type { Celda, Forma } from "@/lib/tipos";

const FORMAS: Forma[] = ["cubo", "rampa", "rampa_esquina", "cuna_diagonal", "medio_bloque"];

function celdaDePrueba(forma: Forma, altura: number, x = 0, z = 0): Celda {
  return { x, z, altura, material: "cesped", forma, rotacion: 0 };
}

describe("construirGeometriaHoyo", () => {
  it("genera una geometría fusionada por cada material presente (nunca una por bloque)", () => {
    const materialesEsperados = new Set(HOYO_EJEMPLO.celdas.map((c) => c.material));
    const grupos = construirGeometriaHoyo(HOYO_EJEMPLO.celdas);
    expect(grupos).toHaveLength(materialesEsperados.size);
  });

  it("una celda con altura 0 no genera geometría (vacío)", () => {
    const grupos = construirGeometriaHoyo([celdaDePrueba("cubo", 0)]);
    expect(grupos).toHaveLength(0);
  });

  it.each(FORMAS)("la forma '%s' genera triángulos válidos (sin NaN, múltiplos de 3 vértices)", (forma) => {
    for (const altura of [1, 3]) {
      const grupos = construirGeometriaHoyo([celdaDePrueba(forma, altura)]);
      expect(grupos).toHaveLength(1);
      const geometria = grupos[0]!.geometria;
      const posiciones = geometria.getAttribute("position");
      expect(posiciones.count % 3).toBe(0);
      expect(posiciones.count).toBeGreaterThan(0);
      for (let i = 0; i < posiciones.array.length; i++) {
        expect(Number.isFinite(posiciones.array[i])).toBe(true);
      }
    }
  });

  it("las 4 rotaciones de una rampa producen geometría (no fallan)", () => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const grupos = construirGeometriaHoyo([{ x: 0, z: 0, altura: 2, material: "cesped", forma: "rampa", rotacion }]);
      expect(grupos[0]!.geometria.getAttribute("position").count).toBeGreaterThan(0);
    }
  });
});

describe("trimeshDesdeGeometria", () => {
  it("produce un índice 'identidad' (0..n) del mismo tamaño que los vértices", () => {
    const [grupo] = construirGeometriaHoyo([celdaDePrueba("cubo", 1)]);
    const { vertices, indices } = trimeshDesdeGeometria(grupo!.geometria);
    expect(indices.length).toBe(vertices.length / 3);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(indices.length - 1);
  });
});
