"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import type { Hoyo, Palo, Pelota } from "@/lib/tipos";
import { posicionSobreCelda } from "@/lib/hoyoUtils";
import { Terreno } from "./Terreno";
import { Bola } from "./Bola";
import { Bandera } from "./Bandera";
import { CamaraSeguimiento } from "./CamaraSeguimiento";
import { ControlTiro } from "./ControlTiro";

// Dos niveles de calidad autodetectados (§9): sombras+antialiasing en PC,
// sombras simplificadas y dpr limitado en móvil. Heurística simple por ahora
// (puntero basto = táctil); se puede refinar con medidas de fps reales.
function esMovil(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function EscenaGolf({ hoyo, palo, pelota }: { hoyo: Hoyo; palo: Palo; pelota: Pelota }) {
  const movil = useMemo(esMovil, []);
  const posicionInicial = useMemo(
    () => posicionSobreCelda(hoyo.celdas, hoyo.salida.x, hoyo.salida.z),
    [hoyo],
  );
  const posicionBandera = useMemo(
    () => posicionSobreCelda(hoyo.celdas, hoyo.bandera.x, hoyo.bandera.z, 0),
    [hoyo],
  );

  return (
    <Canvas
      shadows={!movil}
      dpr={movil ? [1, 1.5] : [1, 2]}
      gl={{ antialias: !movil }}
      camera={{
        position: [
          posicionInicial.x - 3,
          posicionInicial.y + 3,
          posicionInicial.z + 5,
        ],
        fov: 55,
      }}
    >
      <color attach="background" args={["#87ceeb"]} />
      <fog attach="fog" args={["#87ceeb", 30, 70]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.4}
        castShadow={!movil}
        shadow-mapSize={[1024, 1024]}
      />

      {/*
        Timestep fijo a 60Hz (§4) y CCD en la bola (Bola.tsx) para que nunca
        atraviese paredes. Gravedad TODO: ajustar en playtest — con -9.81 m/s²
        "de verdad" una bola de radio 0.2 en un mundo a escala 1 bloque =
        1 unidad se siente floja; -18 da botes más secos y golpes más nítidos.
      */}
      <Physics timeStep={1 / 60} gravity={[0, -18, 0]}>
        <Terreno celdas={hoyo.celdas} pelota={pelota} />
        <Bola
          celdas={hoyo.celdas}
          pelota={pelota}
          posicionInicial={posicionInicial}
          posicionBandera={posicionBandera}
        />
      </Physics>

      <Bandera posicion={[posicionBandera.x, posicionBandera.y, posicionBandera.z]} />
      <CamaraSeguimiento />
      <ControlTiro palo={palo} />
    </Canvas>
  );
}
