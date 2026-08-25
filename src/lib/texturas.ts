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

let texturaHoyuelos: THREE.Texture | null = null;

/**
 * Textura de relieve (bumpMap) con hoyuelos, para que la pelota se lea como
 * una pelota de golf de verdad. Solo afecta al sombreado visual — la esfera
 * de colisión (`BallCollider`, en Bola.tsx) sigue siendo perfectamente lisa,
 * así que no toca la física.
 */
export function obtenerTexturaHoyuelosPelota(): THREE.Texture | undefined {
  if (typeof document === "undefined") return undefined;
  if (texturaHoyuelos) return texturaHoyuelos;

  const tam = 512;
  const lienzo = document.createElement("canvas");
  lienzo.width = tam;
  lienzo.height = tam;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return undefined;

  // Gris neutro = sin relieve en un bumpMap; los hoyuelos se pintan más
  // oscuros (hundidos) con un degradado radial. Antes apenas se notaban
  // (poco contraste, huecos pequeños y separados) — más densos, más
  // grandes y con mucho más contraste (casi negro en el centro) para que
  // se lean claramente como hoyuelos, no como una superficie lisa.
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, tam, tam);

  const columnas = 18;
  const filas = 18;
  const paso = tam / columnas;
  for (let fila = 0; fila <= filas; fila++) {
    const offsetX = (fila % 2) * (paso / 2); // trama al tresbolillo, como un panal
    for (let col = -1; col <= columnas; col++) {
      const cx = col * paso + offsetX;
      const cy = fila * paso * 0.87;
      const radio = paso * 0.42;
      const gradiente = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio);
      gradiente.addColorStop(0, "#0d0d0d");
      gradiente.addColorStop(0.7, "#404040");
      gradiente.addColorStop(1, "#808080");
      ctx.fillStyle = gradiente;
      ctx.beginPath();
      ctx.arc(cx, cy, radio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const textura = new THREE.CanvasTexture(lienzo);
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(6, 3); // varias vueltas alrededor de la esfera
  textura.needsUpdate = true;
  texturaHoyuelos = textura;
  return textura;
}
