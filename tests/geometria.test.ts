import { describe, expect, it } from "vitest";
import { construirGeometriaHoyo, trimeshDesdeGeometria } from "@/lib/geometria";
import { HOYO_EJEMPLO } from "@/lib/hoyoEjemplo";
import type { Celda, Forma } from "@/lib/tipos";

const FORMAS: Forma[] = ["cubo", "rampa", "rampa_esquina", "cuna_diagonal", "medio_bloque"];

function celdaDePrueba(forma: Forma, altura: number, x = 0, z = 0): Celda {
  return { x, z, altura, material: "cesped", forma, rotacion: 0 };
}

/**
 * Volumen de una malla cerrada por el teorema de la divergencia (suma de
 * a·(b×c)/6 por triángulo). Solo da el volumen "real" si TODOS los
 * triángulos tienen la normal hacia afuera de forma consistente — por eso
 * es una prueba mucho más dura que "no hay NaN": una sola cara mal orientada
 * (el bug real que se coló en `rampa`, ver geometria.ts) dispara un volumen
 * negativo o disparatado en vez de fallar a medias.
 */
function volumenSolido(vertices: ArrayLike<number>): number {
  let volumen = 0;
  for (let i = 0; i + 8 < vertices.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = Array.from(vertices).slice(i, i + 9);
    volumen += ax! * (by! * cz! - bz! * cy!) - ay! * (bx! * cz! - bz! * cx!) + az! * (bx! * cy! - by! * cx!);
  }
  return volumen / 6;
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

  it("el volumen de un cubo de altura 1 es 1 (mallado cerrado y consistente)", () => {
    const [grupo] = construirGeometriaHoyo([celdaDePrueba("cubo", 1)]);
    expect(volumenSolido(grupo!.geometria.getAttribute("position").array)).toBeCloseTo(1, 6);
  });

  it("el volumen de un medio_bloque de altura 1 es 0.5", () => {
    const [grupo] = construirGeometriaHoyo([celdaDePrueba("medio_bloque", 1)]);
    expect(volumenSolido(grupo!.geometria.getAttribute("position").array)).toBeCloseTo(0.5, 6);
  });

  it("el volumen de una rampa de altura 1 es 0.5 (medio cubo, cuña recta) — cubre el bug de la cara alta invertida", () => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const [grupo] = construirGeometriaHoyo([{ x: 0, z: 0, altura: 1, material: "cesped", forma: "rampa", rotacion }]);
      expect(volumenSolido(grupo!.geometria.getAttribute("position").array)).toBeCloseTo(0.5, 6);
    }
  });

  it("el volumen de una cuña diagonal de altura 1 es 0.5 (medio cubo, corte en diagonal)", () => {
    const [grupo] = construirGeometriaHoyo([celdaDePrueba("cuna_diagonal", 1)]);
    expect(volumenSolido(grupo!.geometria.getAttribute("position").array)).toBeCloseTo(0.5, 6);
  });

  it("el volumen de una rampa de esquina de altura 1 está entre el de una cuña (0.5) y un cubo (1)", () => {
    const [grupo] = construirGeometriaHoyo([celdaDePrueba("rampa_esquina", 1)]);
    const volumen = volumenSolido(grupo!.geometria.getAttribute("position").array);
    expect(volumen).toBeGreaterThan(0.5);
    expect(volumen).toBeLessThan(1);
  });

  it("con 'copa', la celda de la bandera queda hueca por dentro (agujero de verdad, no un decorado encima)", () => {
    const radio = 0.35;
    const profundidad = 0.4;
    const segmentos = 20;
    const celda = celdaDePrueba("cubo", 1, 4, 4);
    const [grupo] = construirGeometriaHoyo([celda], { x: 4, z: 4, radio, profundidad, segmentos });
    const volumen = volumenSolido(grupo!.geometria.getAttribute("position").array);

    // El borde exterior del aro pasa EXACTO por las 4 esquinas del cuadrado
    // (ver angulosAro en geometria.ts) — por eso el área exterior es 1 en
    // vez de un polígono aproximado. El área interior sí usa los mismos
    // ángulos irregulares (pasos regulares + esquinas) que la implementación,
    // vía la fórmula de un polígono "en abanico" desde el centro:
    // área = (r²/2)·Σ sin(Δángulo).
    const esquinas = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    const pasos = Array.from({ length: segmentos }, (_, i) => (i / segmentos) * Math.PI * 2);
    const angulos = Array.from(new Set([...esquinas, ...pasos])).sort((a, b) => a - b);
    let areaInterior = 0;
    for (let i = 0; i < angulos.length; i++) {
      const a0 = angulos[i]!;
      const a1 = i + 1 < angulos.length ? angulos[i + 1]! : angulos[0]! + Math.PI * 2;
      areaInterior += 0.5 * radio * radio * Math.sin(a1 - a0);
    }
    const esperado = 1 * 1 * 1 - areaInterior * profundidad;
    expect(volumen).toBeCloseTo(esperado, 6);
  });

  it("sin 'copa' (o en otra celda), no perfora ningún agujero", () => {
    const celda = celdaDePrueba("cubo", 1, 4, 4);
    const [grupo] = construirGeometriaHoyo([celda], { x: 9, z: 9, radio: 0.35, profundidad: 0.4 });
    expect(volumenSolido(grupo!.geometria.getAttribute("position").array)).toBeCloseTo(1, 6);
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
