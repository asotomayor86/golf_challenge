/**
 * Generación procedural de la geometría del terreno (ver golf_prompt.md §3 y
 * §9): sin modelos 3D externos — cubos, rampas y cuñas se construyen por
 * código a partir de `Celda[]`, y se fusionan en **una sola geometría por
 * material** (nunca un `<mesh>` por bloque) para que el móvil aguante hoyos
 * de hasta 2000 bloques.
 *
 * "Césped con borde", "escalón" y "salto de nivel" no son formas propias: son
 * el resultado natural de que una celda `cubo`/`medio_bloque` tenga una
 * altura distinta a la de su vecina — no hay tipos de bloque redundantes.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Celda, Material, Rotacion } from "./tipos";

type Triangulo = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/** Dos triángulos coplanares a partir de 4 esquinas en orden CCW (visto desde fuera). */
function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): Triangulo[] {
  return [
    [a, b, c],
    [a, c, d],
  ];
}

/**
 * Caja axis-aligned con caras seleccionables (para no generar las caras que
 * quedan internas/ocultas entre la columna base y el bloque superior).
 */
function caja(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  caras: { arriba?: boolean; abajo?: boolean; lados?: boolean } = {},
): Triangulo[] {
  const { arriba = true, abajo = true, lados = true } = caras;
  const p000 = v(x0, y0, z0);
  const p100 = v(x1, y0, z0);
  const p110 = v(x1, y1, z0);
  const p010 = v(x0, y1, z0);
  const p001 = v(x0, y0, z1);
  const p101 = v(x1, y0, z1);
  const p111 = v(x1, y1, z1);
  const p011 = v(x0, y1, z1);

  const tris: Triangulo[] = [];
  if (lados) {
    tris.push(...quad(p001, p101, p111, p011)); // +Z
    tris.push(...quad(p100, p000, p010, p110)); // -Z
    tris.push(...quad(p101, p100, p110, p111)); // +X
    tris.push(...quad(p000, p001, p011, p010)); // -X
  }
  if (arriba) tris.push(...quad(p010, p011, p111, p110)); // +Y
  if (abajo) tris.push(...quad(p001, p000, p100, p101)); // -Y
  return tris;
}

/**
 * Red de seguridad de orientación: para cada triángulo, si su normal (según
 * el orden de sus vértices) apunta HACIA el interior del sólido en vez de
 * alejándose de él, se invierte. Las cuñas/rampas se derivan a mano y un
 * vértice mal ordenado da una normal invertida — Rapier usa esa normal para
 * la respuesta de colisión, así que una cara volteada puede lanzar la bola
 * por los aires en vez de frenarla (bug real que esto corrige).
 *
 * El punto "interior" se calcula como la media de TODOS los vértices del
 * sólido (no un punto fijo como el centro de la celda): en cuñas y rampas
 * ese centro geométrico cae justo ENCIMA de la cara inclinada, un caso límite
 * que hacía fallar la comprobación para exactamente las formas que más lo
 * necesitaban. La media de vértices, al incluir también los de la base y los
 * laterales, cae de forma fiable dentro del sólido.
 */
function orientarHaciaAfuera(triangulos: Triangulo[]): Triangulo[] {
  const centro = new THREE.Vector3();
  let n = 0;
  for (const [a, b, c] of triangulos) {
    centro.add(a).add(b).add(c);
    n += 3;
  }
  centro.divideScalar(n);

  return triangulos.map(([a, b, c]) => {
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const centroide = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
    const haciaFuera = new THREE.Vector3().subVectors(centroide, centro);
    return normal.dot(haciaFuera) < 0 ? ([a, c, b] as Triangulo) : ([a, b, c] as Triangulo);
  });
}

/** Rota (múltiplo de 90°) un punto alrededor del centro de la celda (0.5, *, 0.5), sin trigonometría. */
function rotarY(p: THREE.Vector3, rot: Rotacion): THREE.Vector3 {
  const dx = p.x - 0.5;
  const dz = p.z - 0.5;
  let rx: number;
  let rz: number;
  switch (rot) {
    case 0:
      rx = dx;
      rz = dz;
      break;
    case 90:
      rx = -dz;
      rz = dx;
      break;
    case 180:
      rx = -dx;
      rz = -dz;
      break;
    case 270:
      rx = dz;
      rz = -dx;
      break;
  }
  return v(rx + 0.5, p.y, rz + 0.5);
}

/**
 * Superficie superior a partir de la altura en cada una de las 4 esquinas
 * (mismo orden que la cara +Y de `caja`). Si las 4 alturas coinciden es un
 * techo plano; si no, es una rampa (el quad puede ser no-planar, como en
 * `rampa_esquina`, y eso es exactamente lo que se busca).
 */
function techoPorEsquinas(
  y00: number,
  y01: number,
  y11: number,
  y10: number,
): Triangulo[] {
  return quad(v(0, y00, 0), v(0, y01, 1), v(1, y11, 1), v(1, y10, 0));
}

/** Bloque superior de una celda (sin rotar), altura de suelo `yBase` a techo `yTop = yBase+1`. */
function bloqueSuperior(
  forma: Exclude<Celda["forma"], "cubo">,
  yBase: number,
  incluirFondo: boolean,
): Triangulo[] {
  const yTop = yBase + 1;

  switch (forma) {
    case "medio_bloque":
      // Losa de media altura: dado que occupies solo la mitad inferior del
      // hueco, siempre necesita su propia cara superior (nada la tapa).
      return caja(0, 1, yBase, yBase + 0.5, 0, 1, { abajo: incluirFondo });

    case "rampa": {
      // Rampa recta: alta en z=0, baja (a ras de la columna de debajo) en z=1.
      const tris: Triangulo[] = [
        ...techoPorEsquinas(yTop, yBase, yBase, yTop), // superficie inclinada
        ...quad(v(1, yBase, 0), v(0, yBase, 0), v(0, yTop, 0), v(1, yTop, 0)), // cara alta (z=0, rectángulo)
        // laterales triangulares (x=0 y x=1)
        [v(0, yBase, 1), v(0, yBase, 0), v(0, yTop, 0)],
        [v(1, yTop, 0), v(1, yBase, 0), v(1, yBase, 1)],
      ];
      if (incluirFondo) tris.push(...quad(v(0, yBase, 0), v(0, yBase, 1), v(1, yBase, 1), v(1, yBase, 0)));
      return tris;
    }

    case "rampa_esquina": {
      // Rampa de esquina ("hip"): alta en los dos bordes lejanos (x=0 y z=0),
      // desciende hasta la columna de debajo solo en la esquina (1,1). Las
      // paredes x=0 y z=0 son rectángulos completos; x=1 y z=1 son
      // triángulos (bajan de yTop a yBase).
      const tris: Triangulo[] = [
        ...techoPorEsquinas(yTop, yTop, yBase, yTop), // (x0,z0)(x0,z1)(x1,z1 baja)(x1,z0)
        ...quad(v(0, yBase, 0), v(0, yTop, 0), v(0, yTop, 1), v(0, yBase, 1)), // pared x=0
        ...quad(v(1, yBase, 0), v(0, yBase, 0), v(0, yTop, 0), v(1, yTop, 0)), // pared z=0
        [v(1, yTop, 0), v(1, yBase, 1), v(1, yBase, 0)], // lateral x=1
        [v(0, yTop, 1), v(1, yBase, 1), v(1, yTop, 0)], // lateral z=1
      ];
      if (incluirFondo) tris.push(...quad(v(0, yBase, 0), v(0, yBase, 1), v(1, yBase, 1), v(1, yBase, 0)));
      return tris;
    }

    case "cuna_diagonal": {
      // Cuña diagonal: mitad del hueco (triángulo x+z<=1) sólida a altura
      // completa, la otra mitad vacía — corte vertical en la diagonal, sin
      // pendiente (para bordes de costa/edificio en 45°, no para rodar).
      const tris: Triangulo[] = [
        [v(0, yTop, 0), v(0, yTop, 1), v(1, yTop, 0)], // techo triangular
        ...quad(v(0, yBase, 0), v(0, yTop, 0), v(1, yTop, 0), v(1, yBase, 0)), // pared z=0
        ...quad(v(0, yBase, 1), v(0, yTop, 1), v(0, yTop, 0), v(0, yBase, 0)), // pared x=0
        // corte diagonal (de (1,z=0) a (0,z=1)), normal hacia +X+Z
        ...quad(v(1, yBase, 0), v(1, yTop, 0), v(0, yTop, 1), v(0, yBase, 1)),
      ];
      if (incluirFondo) tris.push([v(0, yBase, 0), v(0, yBase, 1), v(1, yBase, 0)]);
      return tris;
    }
  }
}

/** Punto donde un rayo desde el centro (0.5, 0.5) en dirección `angulo` cruza el borde del cuadrado unidad. */
function puntoEnBordeCuadradoUnidad(angulo: number): [number, number] {
  const dx = Math.cos(angulo);
  const dz = Math.sin(angulo);
  const candidatos: number[] = [];
  if (dx > 1e-9) candidatos.push(0.5 / dx);
  if (dx < -1e-9) candidatos.push(-0.5 / dx);
  if (dz > 1e-9) candidatos.push(0.5 / dz);
  if (dz < -1e-9) candidatos.push(-0.5 / dz);
  const t = Math.min(...candidatos);
  return [0.5 + dx * t, 0.5 + dz * t];
}

/**
 * Ángulos a usar para el aro: `segmentos` pasos regulares MÁS los 4 ángulos
 * exactos de las esquinas del cuadrado. Sin las esquinas, casi ningún paso
 * regular cae justo en una — el tramo entre los dos pasos vecinos "corta" la
 * esquina en vez de llegar a ella, dejando una fuga real en la malla (no
 * solo un redondeo visual): el aro no llegaría a soldar con las paredes de
 * `caja` en esas esquinas exactas.
 */
function angulosAro(segmentos: number): number[] {
  const angulos = new Set<number>([Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]);
  for (let i = 0; i < segmentos; i++) angulos.add((i / segmentos) * Math.PI * 2);
  return Array.from(angulos).sort((a, b) => a - b);
}

/**
 * Celda 'cubo' con un agujero cilíndrico perforado en la cara superior (la
 * copa): un aro entre el borde del cuadrado y el círculo del agujero, más
 * las paredes y el fondo de ese agujero — no un círculo pintado ENCIMA de
 * un bloque sólido (eso quedaba enterrado dentro del bloque y no se veía).
 *
 * El giro de `orientarHaciaAfuera` (que usa la media de los vértices como
 * "centro") no vale aquí: con el agujero ocupando buena parte de la altura
 * del bloque, esa media puede caer más cerca del fondo del agujero que del
 * grueso del sólido y confundir paredes/aro. Por eso esta función deriva el
 * sentido de cada cara a mano (verificado con el producto vectorial) en vez
 * de apoyarse en esa red de seguridad.
 */
function celdaConAgujero(altura: number, radio: number, profundidad: number, segmentos: number): Triangulo[] {
  const tris: Triangulo[] = [...caja(0, 1, 0, altura, 0, 1, { arriba: false })];

  const yBorde = altura;
  const yFondo = altura - profundidad;
  const centro = v(0.5, yFondo, 0.5);

  const angulos = angulosAro(segmentos);
  for (let i = 0; i < angulos.length; i++) {
    const a0 = angulos[i]!;
    const a1 = i + 1 < angulos.length ? angulos[i + 1]! : angulos[0]! + Math.PI * 2;
    const [ox0, oz0] = puntoEnBordeCuadradoUnidad(a0);
    const [ox1, oz1] = puntoEnBordeCuadradoUnidad(a1);
    const i0 = v(0.5 + Math.cos(a0) * radio, yBorde, 0.5 + Math.sin(a0) * radio);
    const i1 = v(0.5 + Math.cos(a1) * radio, yBorde, 0.5 + Math.sin(a1) * radio);
    const f0 = v(i0.x, yFondo, i0.z);
    const f1 = v(i1.x, yFondo, i1.z);

    tris.push(...quad(v(ox0, yBorde, oz0), i0, i1, v(ox1, yBorde, oz1))); // aro (+Y)
    tris.push(...quad(i1, i0, f0, f1)); // pared del agujero, hacia el eje
    tris.push([centro, f1, f0]); // fondo (+Y)
  }

  return tris;
}

/** Todos los triángulos (en espacio local) de una celda, con la normal ya verificada hacia afuera. */
function triangulosCelda(celda: Celda): Triangulo[] {
  if (celda.altura <= 0) return [];

  if (celda.forma === "cubo") {
    // La forma 'cubo' no distingue columna base / bloque superior: es una
    // caja lisa de 0 a `altura`, sin caras internas que evitar.
    return orientarHaciaAfuera(caja(0, 1, 0, celda.altura, 0, 1));
  }

  const yBase = celda.altura - 1;
  const tris: Triangulo[] = [];
  if (yBase > 0) {
    // Columna base: sin cara superior (la tapa el bloque superior).
    tris.push(...caja(0, 1, 0, yBase, 0, 1, { arriba: false }));
  }
  const superior = bloqueSuperior(celda.forma, yBase, yBase <= 0).map(
    ([a, b, c]) => [rotarY(a, celda.rotacion), rotarY(b, celda.rotacion), rotarY(c, celda.rotacion)] as Triangulo,
  );
  tris.push(...superior);
  // Red de seguridad: cualquier cara mal orientada al derivar rampas/cuñas a
  // mano se corrige aquí antes de que llegue al collider de Rapier.
  return orientarHaciaAfuera(tris);
}

/** Proyección plana según el eje dominante de la normal (UV "triplanar" barato, sin shader). */
function proyectarUV(p: THREE.Vector3, normal: THREE.Vector3): [number, number] {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ay >= ax && ay >= az) return [p.x, p.z]; // caras ~horizontales (arriba/abajo)
  if (ax >= az) return [p.z, p.y]; // caras que miran sobre todo en X
  return [p.x, p.y]; // caras que miran sobre todo en Z
}

function geometriaDesdeTriangulos(triangulos: Triangulo[]): THREE.BufferGeometry {
  const geometria = new THREE.BufferGeometry();
  const posiciones = new Float32Array(triangulos.length * 9);
  const uvs = new Float32Array(triangulos.length * 6);
  triangulos.forEach(([a, b, c], i) => {
    posiciones.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], i * 9);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const [ua, va] = proyectarUV(a, normal);
    const [ub, vb] = proyectarUV(b, normal);
    const [uc, vc] = proyectarUV(c, normal);
    uvs.set([ua, va, ub, vb, uc, vc], i * 6);
  });
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  geometria.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometria.computeVertexNormals(); // no-indexed ⇒ normales planas (look "de bloque")
  return geometria;
}

export interface GeometriaMaterial {
  material: Material;
  geometria: THREE.BufferGeometry;
}

export interface DescripcionCopa {
  x: number;
  z: number;
  radio: number;
  profundidad: number;
  segmentos?: number;
}

/**
 * Construye, para un hoyo completo, una geometría fusionada por material.
 * Es la única función que el render debe llamar para pintar el terreno: da
 * como mucho un `<mesh>` por material (§9), nunca uno por bloque.
 *
 * `copa`, si se da, perfora un agujero de verdad en la celda de la bandera
 * (en vez de un decorado plano encima, que quedaba enterrado dentro del
 * bloque sólido y no se veía — ver `celdaConAgujero`). Solo aplica sobre
 * celdas de forma 'cubo'; con otra forma se deja tal cual (TODO Fase 2:
 * decidir qué hacer si el editor permite poner la bandera sobre una rampa).
 */
export function construirGeometriaHoyo(celdas: Celda[], copa?: DescripcionCopa): GeometriaMaterial[] {
  const porMaterial = new Map<Material, THREE.BufferGeometry[]>();

  for (const celda of celdas) {
    const esCopa = copa && celda.x === copa.x && celda.z === copa.z && celda.forma === "cubo" && celda.altura > 0;
    const tris = esCopa
      ? celdaConAgujero(celda.altura, copa.radio, copa.profundidad, copa.segmentos ?? 20)
      : triangulosCelda(celda);
    if (tris.length === 0) continue;
    const geometria = geometriaDesdeTriangulos(tris);
    geometria.translate(celda.x, 0, celda.z);
    const lista = porMaterial.get(celda.material) ?? [];
    lista.push(geometria);
    porMaterial.set(celda.material, lista);
  }

  const resultado: GeometriaMaterial[] = [];
  for (const [material, geometrias] of porMaterial) {
    const fusionada = mergeGeometries(geometrias, false);
    if (fusionada) resultado.push({ material, geometria: fusionada });
  }
  return resultado;
}

/**
 * Vértices e índices para un `TrimeshCollider` de Rapier a partir de una
 * geometría no-indexada (cada triángulo ya tiene sus 3 vértices propios, así
 * que el índice es simplemente 0..n).
 */
export function trimeshDesdeGeometria(geometria: THREE.BufferGeometry): {
  vertices: Float32Array;
  indices: Uint32Array;
} {
  const posicion = geometria.getAttribute("position");
  const vertices =
    posicion.array instanceof Float32Array ? posicion.array : new Float32Array(posicion.array);
  const indices = new Uint32Array(posicion.count);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { vertices, indices };
}
