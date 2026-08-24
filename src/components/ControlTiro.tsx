"use client";

import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useJuego } from "@/lib/store";
import { bolaRef } from "@/lib/refs";
import { velocidadMaxima, guiaVisual } from "@/lib/fisica";
import type { Palo } from "@/lib/tipos";

const RADIO_INICIO_ARRASTRE_PX = 70; // el arrastre debe empezar cerca de la bola en pantalla
const ARRASTRE_MAX_PX = 160; // arrastre a esta distancia = 100% de potencia
const POTENCIA_MINIMA_PARA_GOLPEAR = 0.03;

// Flecha de potencia: 5 niveles de color, siempre en este orden (verde =
// suave, morado = a tope). Un palo con potencia baja no puede llegar a los
// colores altos aunque se arrastre a fondo — ver `nivelPotencia`.
const COLORES_POTENCIA = ["#4caf50", "#ffd54f", "#ff9800", "#e53935", "#9c27b0"];
const LONGITUD_MAX_FLECHA_POTENCIA = 2.5; // u, a potencia 100% — igual para todos los palos

/** Nivel de color (1..potenciaPalo) que corresponde al tirón actual, tope en la potencia propia del palo. */
function nivelPotencia(potenciaUsada: number, potenciaPalo: number): number {
  const nivel = Math.ceil(potenciaUsada * potenciaPalo);
  return Math.min(potenciaPalo, Math.max(1, nivel));
}

interface Previsualizacion {
  direccion: THREE.Vector3; // horizontal, normalizada — el golpe sale exactamente en esta dirección, sin desvío
  potencia: number; // 0..1
}

function Linea({ desde, hasta, color }: { desde: THREE.Vector3; hasta: THREE.Vector3; color: string }) {
  const puntos = new Float32Array([desde.x, desde.y, desde.z, hasta.x, hasta.y, hasta.z]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[puntos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

/** Línea + punta cónica orientada, para que la potencia se lea como una flecha, no una raya. */
function FlechaPotencia({ desde, hasta, color }: { desde: THREE.Vector3; hasta: THREE.Vector3; color: string }) {
  const direccion = new THREE.Vector3().subVectors(hasta, desde);
  if (direccion.lengthSq() < 0.0001) return null;
  direccion.normalize();
  const cuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direccion);

  return (
    <>
      <Linea desde={desde} hasta={hasta} color={color} />
      <mesh position={hasta} quaternion={cuaternion}>
        <coneGeometry args={[0.06, 0.18, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}

/**
 * Control de tiro único para ratón y dedo (Pointer Events): arrastrar hacia
 * atrás desde la bola marca dirección y potencia, soltar ejecuta el golpe.
 * Si el arrastre no empieza cerca de la bola, se ignora aquí y llega intacto
 * a los OrbitControls de la cámara (arrastrar en cualquier otro punto orbita).
 *
 * Mientras se apunta se ven dos cosas distintas:
 * - La GUÍA (hacia delante, color neutro): longitud fija = guía del palo
 *   (`guiaVisual`), no cambia con lo que arrastres — es "hasta dónde ayuda
 *   a apuntar este palo", no la potencia del golpe.
 * - La FLECHA DE POTENCIA (hacia atrás, coloreada): crece con el arrastre y
 *   su color marca el nivel (verde→morado) que alcanzaría ESTE palo con esa
 *   fuerza — un palo de potencia baja no pasa de los colores bajos.
 */
export function ControlTiro({ palo }: { palo: Palo }) {
  const { camera, gl, size } = useThree();
  const dispara = useJuego((s) => s.dispara);
  const marcarApuntando = useJuego((s) => s.marcarApuntando);
  const enMovimiento = useJuego((s) => s.enMovimiento);
  const embocada = useJuego((s) => s.embocada);

  const arrastrando = useRef(false);
  const inicioPuntero = useRef(new THREE.Vector2());
  const [previsualizacion, setPrevisualizacion] = useState<Previsualizacion | null>(null);
  // Espejo síncrono de `previsualizacion` para leer en alSoltar: los updaters
  // funcionales de useState deben ser puros (sin efectos secundarios), así
  // que disparar el golpe desde dentro de `setPrevisualizacion(prev => ...)`
  // no vale — provoca "Cannot update a component while rendering a different
  // component" porque `dispara()` actualiza otros componentes (Bola, HUD).
  const ultimaPrevisualizacion = useRef<Previsualizacion | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;

    function posicionBolaEnPantalla(): THREE.Vector2 | null {
      const api = bolaRef.current;
      if (!api) return null;
      const p = api.translation();
      const proyectado = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      return new THREE.Vector2(((proyectado.x + 1) / 2) * size.width, ((1 - proyectado.y) / 2) * size.height);
    }

    function alPresionar(evento: PointerEvent) {
      if (enMovimiento || embocada) return;
      const rect = canvas.getBoundingClientRect();
      const bolaPantalla = posicionBolaEnPantalla();
      if (!bolaPantalla) return;
      const xLocal = evento.clientX - rect.left;
      const yLocal = evento.clientY - rect.top;
      if (Math.hypot(xLocal - bolaPantalla.x, yLocal - bolaPantalla.y) > RADIO_INICIO_ARRASTRE_PX) return;

      arrastrando.current = true;
      inicioPuntero.current.set(evento.clientX, evento.clientY);
      canvas.setPointerCapture(evento.pointerId);
      marcarApuntando(true);
    }

    function alMover(evento: PointerEvent) {
      if (!arrastrando.current) return;
      const dx = evento.clientX - inicioPuntero.current.x;
      const dy = evento.clientY - inicioPuntero.current.y;
      const distanciaPx = Math.hypot(dx, dy);
      if (distanciaPx < 4) {
        ultimaPrevisualizacion.current = null;
        setPrevisualizacion(null);
        return;
      }

      // "Arrastrar hacia atrás": el golpe va en la dirección OPUESTA al
      // arrastre, proyectada sobre el plano horizontal según la cámara.
      const adelante = new THREE.Vector3();
      camera.getWorldDirection(adelante);
      adelante.y = 0;
      adelante.normalize();
      const derecha = new THREE.Vector3().crossVectors(adelante, new THREE.Vector3(0, 1, 0)).normalize();

      const direccion = adelante
        .clone()
        .multiplyScalar(dy) // arrastrar hacia abajo en pantalla ⇒ golpear hacia delante
        .add(derecha.clone().multiplyScalar(dx))
        .normalize();
      const potencia = Math.min(1, distanciaPx / ARRASTRE_MAX_PX);

      ultimaPrevisualizacion.current = { direccion, potencia };
      setPrevisualizacion({ direccion, potencia });
    }

    function alSoltar(evento: PointerEvent) {
      if (!arrastrando.current) return;
      arrastrando.current = false;
      canvas.releasePointerCapture(evento.pointerId);
      marcarApuntando(false);

      const actual = ultimaPrevisualizacion.current;
      ultimaPrevisualizacion.current = null;
      setPrevisualizacion(null);
      if (actual && actual.potencia > POTENCIA_MINIMA_PARA_GOLPEAR) {
        const rapidez = velocidadMaxima(palo) * actual.potencia;
        dispara(actual.direccion.clone().multiplyScalar(rapidez));
      }
    }

    canvas.addEventListener("pointerdown", alPresionar);
    canvas.addEventListener("pointermove", alMover);
    canvas.addEventListener("pointerup", alSoltar);
    canvas.addEventListener("pointercancel", alSoltar);
    return () => {
      canvas.removeEventListener("pointerdown", alPresionar);
      canvas.removeEventListener("pointermove", alMover);
      canvas.removeEventListener("pointerup", alSoltar);
      canvas.removeEventListener("pointercancel", alSoltar);
    };
  }, [camera, gl, size, palo, enMovimiento, embocada, dispara, marcarApuntando]);

  const api = bolaRef.current;
  if (!previsualizacion || !api) return null;

  const p = api.translation();
  const origen = new THREE.Vector3(p.x, p.y + 0.05, p.z);

  const { longitud: longitudGuia } = guiaVisual(palo);
  const destinoGuia = origen.clone().addScaledVector(previsualizacion.direccion, longitudGuia);

  const destinoFlecha = origen
    .clone()
    .addScaledVector(previsualizacion.direccion, -(LONGITUD_MAX_FLECHA_POTENCIA * previsualizacion.potencia));
  const colorFlecha = COLORES_POTENCIA[nivelPotencia(previsualizacion.potencia, palo.potencia) - 1]!;

  return (
    <>
      <Linea desde={origen} hasta={destinoGuia} color="#cfe8ff" />
      <FlechaPotencia desde={origen} hasta={destinoFlecha} color={colorFlecha} />
    </>
  );
}
