import { describe, expect, it } from "vitest";
import {
  velocidadMaxima,
  guiaVisual,
  friccionBase,
  friccionEnMaterial,
  restitucionPelota,
  amortiguacionRodadura,
  aceleracionCorriente,
  embocaria,
  MULTIPLICADOR_FRICCION_MATERIAL,
  RADIO_COPA,
} from "@/lib/fisica";
import type { Pelota } from "@/lib/tipos";

const pelotaEstandar: Pelota = { velocidad: 3, bote: 3 };

describe("palo", () => {
  it("vMax = 8 + potencia*4", () => {
    expect(velocidadMaxima({ potencia: 1, guia: 5 })).toBe(12);
    expect(velocidadMaxima({ potencia: 5, guia: 1 })).toBe(28);
  });

  it("guía: longitud = guia*ESCALA_LONGITUD_GUIA, rebotes = guia-1", () => {
    expect(guiaVisual({ potencia: 2, guia: 4 })).toEqual({ longitud: 4, rebotes: 3 });
    expect(guiaVisual({ potencia: 5, guia: 1 })).toEqual({ longitud: 1, rebotes: 0 });
  });
});

describe("pelota + material", () => {
  it("friccionBase = 0.06 - velocidad*0.008", () => {
    expect(friccionBase({ velocidad: 1, bote: 5 })).toBeCloseTo(0.052, 10);
    expect(friccionBase({ velocidad: 5, bote: 1 })).toBeCloseTo(0.02, 10);
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
    expect(restitucionPelota({ velocidad: 3, bote: 1 })).toBeCloseTo(0.36, 10);
    expect(restitucionPelota({ velocidad: 3, bote: 5 })).toBeCloseTo(0.8, 10);
  });

  it("amortiguacionRodadura escala friccionEnMaterial (así SÍ frena una bola que rueda sin deslizar)", () => {
    const arena = amortiguacionRodadura(pelotaEstandar, "arena");
    const hielo = amortiguacionRodadura(pelotaEstandar, "hielo");
    expect(arena).toBeGreaterThan(0);
    expect(arena).toBeGreaterThan(hielo);
  });
});

describe("corriente", () => {
  it("es perceptible pero no dominante: fuerza 5 no lanza una bola parada", () => {
    const aceleracion = aceleracionCorriente(5);
    // Muy por debajo de la vMax mínima de golpe (12 u/s a potencia 1).
    expect(aceleracion).toBeGreaterThan(0);
    expect(aceleracion).toBeLessThan(12);
  });

  it("más fuerza de corriente ⇒ más aceleración", () => {
    expect(aceleracionCorriente(5)).toBeGreaterThan(aceleracionCorriente(1));
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
