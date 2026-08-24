import { describe, expect, it } from "vitest";
import { generarCatalogoPalos, CATALOGO_PELOTAS } from "@/lib/catalogo";

describe("catálogo de palos", () => {
  const palos = generarCatalogoPalos();

  it("genera exactamente 5 combinaciones", () => {
    expect(palos).toHaveLength(5);
  });

  it("todas suman potencia+guia = 6", () => {
    for (const palo of palos) {
      expect(palo.potencia + palo.guia).toBe(6);
    }
  });

  it("todos los valores están en el rango 1..5", () => {
    for (const palo of palos) {
      for (const valor of [palo.potencia, palo.guia]) {
        expect(valor).toBeGreaterThanOrEqual(1);
        expect(valor).toBeLessThanOrEqual(5);
      }
    }
  });

  it("no hay combinaciones repetidas y todos los nombres son únicos", () => {
    const claves = palos.map((p) => `${p.potencia}/${p.guia}`);
    expect(new Set(claves).size).toBe(5);
    expect(new Set(palos.map((p) => p.nombre)).size).toBe(5);
  });

  it('el único perfil equilibrado (3/3) se llama "Equilibrado"', () => {
    const equilibrado = palos.find((p) => p.potencia === 3 && p.guia === 3);
    expect(equilibrado?.nombre).toBe("Equilibrado 3/3");
  });

  it("un perfil dominado por potencia usa el nombre base de potencia", () => {
    const martillo = palos.find((p) => p.potencia === 5 && p.guia === 1);
    expect(martillo?.nombre).toBe("Martillo 5/1");
  });

  it("un perfil dominado por guía usa el nombre base de guía", () => {
    const brujula = palos.find((p) => p.potencia === 1 && p.guia === 5);
    expect(brujula?.nombre).toBe("Brújula 1/5");
  });
});

describe("catálogo de pelotas", () => {
  it("son exactamente las 5 especificadas", () => {
    expect(CATALOGO_PELOTAS).toHaveLength(5);
    expect(CATALOGO_PELOTAS.map((p) => p.nombre)).toEqual(["Cohete", "Bala", "Estándar", "Muelle", "Saltarina"]);
  });

  it("todas suman velocidad+bote = 6", () => {
    for (const pelota of CATALOGO_PELOTAS) {
      expect(pelota.velocidad + pelota.bote).toBe(6);
    }
  });
});
