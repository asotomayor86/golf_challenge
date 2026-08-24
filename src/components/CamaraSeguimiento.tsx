"use client";

import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { bolaRef } from "@/lib/refs";
import { useJuego } from "@/lib/store";

/** Cámara orbitable con el objetivo siempre sobre la bola (§8: "cámara detrás de la bola, orbitable"). */
export function CamaraSeguimiento() {
  const controlesRef = useRef<OrbitControlsImpl>(null);
  const apuntando = useJuego((s) => s.apuntando);

  useFrame(() => {
    const api = bolaRef.current;
    const controles = controlesRef.current;
    if (!api || !controles) return;
    const p = api.translation();
    controles.target.set(p.x, p.y, p.z);
    controles.update();
  });

  return (
    <OrbitControls
      ref={controlesRef}
      makeDefault
      enabled={!apuntando} // mientras se apunta (arrastre desde la bola), el orbit no compite por el puntero
      enablePan={false}
      minDistance={2}
      maxDistance={14}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  );
}
