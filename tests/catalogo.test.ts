import { describe, expect, it } from "vitest";
import { generarCatalogoPalos, CATALOGO_PELOTAS } from "@/lib/catalogo";

describe("catálogo de palos", () => {
  const palos = generarCatalogoPalos();

  it("genera exactamente 19 combinaciones", () => {
    expect(palos).toHaveLength(19);
  });

  it("todas suman potencia+precision+guia = 9", () => {
    for (const palo of palos) {
      expect(palo.potencia + palo.precision + palo.guia).toBe(9);
    }
  });

  it("todos los valores están en el rango 1..5", () => {
    for (const palo of palos) {
      for (const valor of [palo.potencia, palo.precision, palo.guia]) {
        expect(valor).toBeGreaterThanOrEqual(1);
        expect(valor).toBeLessThanOrEqual(5);
      }
    }
  });

  it("no hay combinaciones repetidas y todos los nombres son únicos", () => {
    const claves = palos.map((p) => `${p.potencia}/${p.precision}/${p.guia}`);
    expect(new Set(claves).size).toBe(19);
    expect(new Set(palos.map((p) => p.nombre)).size).toBe(19);
  });

  it('el único perfil equilibrado (3/3/3) se llama "Equilibrado"', () => {
    const equilibrado = palos.find((p) => p.potencia === 3 && p.precision === 3 && p.guia === 3);
    expect(equilibrado?.nombre).toBe("Equilibrado 3/3/3");
  });

  it("un perfil dominado por potencia usa el nombre base de potencia", () => {
    const martillo = palos.find((p) => p.potencia === 5 && p.precision === 1 && p.guia === 3);
    expect(martillo?.nombre).toBe("Martillo 5/1/3");
  });

  it("un perfil dominado por precisión usa el nombre base de precisión", () => {
    const bisturi = palos.find((p) => p.potencia === 1 && p.precision === 5 && p.guia === 3);
    expect(bisturi?.nombre).toBe("Bisturí 1/5/3");
  });
});

describe("catálogo de pelotas", () => {
  it("son exactamente las 5 especificadas", () => {
    expect(CATALOGO_PELOTAS).toHaveLength(5);
    expect(CATALOGO_PELOTAS.map((p) => p.nombre)).toEqual([
      "Estándar",
      "Cohete",
      "Bisturí",
      "Saltarina",
      "Equilibrada",
    ]);
  });

  it("todas suman velocidad+precision+bote = 9", () => {
    for (const pelota of CATALOGO_PELOTAS) {
      expect(pelota.velocidad + pelota.precision + pelota.bote).toBe(9);
    }
  });
});
