import { describe, expect, it, vi } from "vitest";
import {
  velocidadMaxima,
  desvioGolpe,
  guiaVisual,
  friccionBase,
  friccionEnMaterial,
  arrastreReal,
  restitucionPelota,
  aceleracionCorriente,
  embocaria,
  MULTIPLICADOR_FRICCION_MATERIAL,
  RADIO_COPA,
} from "@/lib/fisica";
import type { Palo, Pelota } from "@/lib/tipos";

const paloMedio: Palo = { potencia: 3, precision: 3, guia: 3 };
const pelotaEstandar: Pelota = { velocidad: 3, precision: 3, bote: 3 };

describe("palo", () => {
  it("vMax = 8 + potencia*4", () => {
    expect(velocidadMaxima({ potencia: 1, precision: 4, guia: 4 })).toBe(12);
    expect(velocidadMaxima({ potencia: 5, precision: 2, guia: 2 })).toBe(28);
  });

  it("pegar suave con precisión baja es casi perfecto (criterio de aceptación §12)", () => {
    const paloImpreciso: Palo = { potencia: 5, precision: 1, guia: 3 };
    const desvioSuave = Math.abs(desvioGolpe(paloImpreciso, 0.3));
    const desvioFuerte = Math.abs(desvioGolpe(paloImpreciso, 1));
    // (6-1)*1.2*0.3² ≈ 0.54°: prácticamente recto.
    expect(desvioSuave).toBeLessThan(1);
    // (6-1)*1.2*1² = 6°: desvío claro.
    expect(desvioFuerte).toBeCloseTo(6, 5);
    expect(desvioFuerte).toBeGreaterThan(desvioSuave);
  });

  it("precisión máxima (5) da el menor desvío posible (nunca cero, pero mínimo)", () => {
    const paloPreciso: Palo = { potencia: 3, precision: 5, guia: 1 };
    const paloImpreciso: Palo = { potencia: 3, precision: 1, guia: 5 };
    expect(Math.abs(desvioGolpe(paloPreciso, 1))).toBeCloseTo(1.2, 10); // (6-5)*1.2*1²
    expect(Math.abs(desvioGolpe(paloPreciso, 1))).toBeLessThan(Math.abs(desvioGolpe(paloImpreciso, 1)));
  });

  it("el signo del desvío es aleatorio pero la magnitud no", () => {
    const spy = vi.spyOn(Math, "random");
    spy.mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    const negativo = desvioGolpe(paloMedio, 0.6);
    const positivo = desvioGolpe(paloMedio, 0.6);
    spy.mockRestore();
    expect(negativo).toBeLessThan(0);
    expect(positivo).toBeGreaterThan(0);
    expect(Math.abs(negativo)).toBeCloseTo(Math.abs(positivo), 10);
  });

  it("guía: longitud = guia*3, rebotes = guia-1", () => {
    expect(guiaVisual({ potencia: 3, precision: 3, guia: 4 })).toEqual({ longitud: 12, rebotes: 3 });
    expect(guiaVisual({ potencia: 3, precision: 5, guia: 1 })).toEqual({ longitud: 3, rebotes: 0 });
  });
});

describe("pelota + material", () => {
  it("friccionBase = 0.06 - velocidad*0.008", () => {
    expect(friccionBase({ velocidad: 1, precision: 3, bote: 5 })).toBeCloseTo(0.052, 10);
    expect(friccionBase({ velocidad: 5, precision: 3, bote: 1 })).toBeCloseTo(0.02, 10);
  });

  it("multiplicadores de fricción por material son los especificados", () => {
    expect(MULTIPLICADOR_FRICCION_MATERIAL.cesped).toBe(1);
    expect(MULTIPLICADOR_FRICCION_MATERIAL.arena).toBe(2.6);
    expect(MULTIPLICADOR_FRICCION_MATERIAL.piedra).toBe(0.85);
    expect(MULTIPLICADOR_FRICCION_MATERIAL.hielo).toBe(0.25);
    expect(MULTIPLICADOR_FRICCION_MATERIAL.cristal).toBe(0.8);
  });

  it("arena frena mucho más que hielo con la misma pelota", () => {
    const arena = friccionEnMaterial(pelotaEstandar, "arena");
    const hielo = friccionEnMaterial(pelotaEstandar, "hielo");
    expect(arena).toBeGreaterThan(hielo * 5);
  });

  it("restitucion = 0.25 + bote*0.11", () => {
    expect(restitucionPelota({ velocidad: 3, precision: 3, bote: 1 })).toBeCloseTo(0.36, 10);
    expect(restitucionPelota({ velocidad: 3, precision: 3, bote: 5 })).toBeCloseTo(0.8, 10);
  });

  it("arrastreReal = arrastre*(1 - precision*0.12)", () => {
    expect(arrastreReal(10, { velocidad: 3, precision: 5, bote: 3 })).toBeCloseTo(4, 10);
    expect(arrastreReal(10, { velocidad: 3, precision: 1, bote: 3 })).toBeCloseTo(8.8, 10);
  });
});

describe("corriente", () => {
  it("es perceptible pero no dominante: fuerza 5 no lanza una bola parada", () => {
    const aceleracion = aceleracionCorriente(5, pelotaEstandar);
    // Muy por debajo de la vMax mínima de golpe (12 u/s a potencia 1).
    expect(aceleracion).toBeGreaterThan(0);
    expect(aceleracion).toBeLessThan(12);
  });

  it("más fuerza de corriente ⇒ más aceleración", () => {
    expect(aceleracionCorriente(5, pelotaEstandar)).toBeGreaterThan(aceleracionCorriente(1, pelotaEstandar));
  });
});

describe("embocado", () => {
  it("emboca dentro del radio y por debajo del umbral de velocidad", () => {
    expect(embocaria(RADIO_COPA - 0.01, 1)).toBe(true);
  });

  it("lip-out: demasiado rápida, no emboca aunque esté centrada", () => {
    expect(embocaria(0, 20)).toBe(false);
  });

  it("fuera del radio, no emboca aunque vaya despacio", () => {
    expect(embocaria(RADIO_COPA + 0.5, 0)).toBe(false);
  });
});
