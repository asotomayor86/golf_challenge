/**
 * Texturas procedurales (sin assets externos, coherente con §3: la geometría
 * del terreno ya es procedural, esto extiende el mismo criterio al color).
 * Se generan una vez con <canvas> 2D y se cachean en memoria.
 */
import * as THREE from "three";

let texturaCesped: THREE.Texture | null = null;

/** Textura de césped: motas de verdes distintos simulando briznas de hierba. */
export function obtenerTexturaCesped(): THREE.Texture | undefined {
  if (typeof document === "undefined") return undefined; // solo en cliente (dentro del <Canvas>)
  if (texturaCesped) return texturaCesped;

  const tam = 128;
  const lienzo = document.createElement("canvas");
  lienzo.width = tam;
  lienzo.height = tam;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return undefined;

  ctx.fillStyle = "#3f9142";
  ctx.fillRect(0, 0, tam, tam);

  const tonos = ["#357a38", "#4caf50", "#5fbf63", "#2f6b32"];
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = tonos[Math.floor(Math.random() * tonos.length)]!;
    const x = Math.random() * tam;
    const y = Math.random() * tam;
    const ancho = 1 + Math.random() * 1.4;
    const alto = 3 + Math.random() * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillRect(-ancho / 2, -alto / 2, ancho, alto); // brizna suelta, como un trazo de hierba
    ctx.restore();
  }

  const textura = new THREE.CanvasTexture(lienzo);
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.colorSpace = THREE.SRGBColorSpace;
  // Cada celda mide 1 unidad y sus UV van 0..1: repetir la textura un par de
  // veces por celda da briznas de tamaño creíble en vez de un tile gigante.
  textura.repeat.set(2, 2);
  textura.needsUpdate = true;
  texturaCesped = textura;
  return textura;
}
