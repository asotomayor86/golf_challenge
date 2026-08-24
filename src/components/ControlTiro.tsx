"use client";

import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useJuego } from "@/lib/store";
import { bolaRef } from "@/lib/refs";
import { velocidadMaxima, desvioGolpe, guiaVisual } from "@/lib/fisica";
import type { Palo } from "@/lib/tipos";

const RADIO_INICIO_ARRASTRE_PX = 70; // el arrastre debe empezar cerca de la bola en pantalla
const ARRASTRE_MAX_PX = 160; // arrastre a esta distancia = 100% de potencia
const POTENCIA_MINIMA_PARA_GOLPEAR = 0.03;

interface Previsualizacion {
  direccion: THREE.Vector3; // horizontal, normalizada, sin desvío (el desvío es aleatorio y solo se decide al soltar)
  potencia: number; // 0..1
}

/**
 * Control de tiro único para ratón y dedo (Pointer Events): arrastrar hacia
 * atrás desde la bola marca dirección y potencia, soltar ejecuta el golpe.
 * Si el arrastre no empieza cerca de la bola, se ignora aquí y llega intacto
 * a los OrbitControls de la cámara (arrastrar en cualquier otro punto orbita).
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
        const desvioRad = THREE.MathUtils.degToRad(desvioGolpe(palo, actual.potencia));
        const direccionFinal = actual.direccion.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), desvioRad);
        const rapidez = velocidadMaxima(palo) * actual.potencia;
        dispara(direccionFinal.multiplyScalar(rapidez));
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

  const { longitud } = guiaVisual(palo);
  const origen = api.translation();
  const destino = new THREE.Vector3(origen.x, origen.y, origen.z).addScaledVector(
    previsualizacion.direccion,
    longitud * previsualizacion.potencia,
  );
  const puntos = new Float32Array([origen.x, origen.y + 0.05, origen.z, destino.x, destino.y + 0.05, destino.z]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[puntos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffe066" linewidth={2} />
    </line>
  );
}
