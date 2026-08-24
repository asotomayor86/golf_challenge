"use client";

import { useCallback } from "react";
import { EscenaGolf } from "@/components/EscenaGolf";
import { HUD } from "@/components/HUD";
import { HOYO_EJEMPLO } from "@/lib/hoyoEjemplo";
import { CATALOGO_PELOTAS } from "@/lib/catalogo";
import { posicionSobreCelda } from "@/lib/hoyoUtils";
import { bolaRef } from "@/lib/refs";
import { useJuego } from "@/lib/store";
import type { Palo, PelotaCatalogo } from "@/lib/tipos";

// TODO(Fase 3): el jugador elegirá 3 palos de los 5 del catálogo y 1 pelota
// antes de la partida. La Fase 1 fija uno de cada para validar la física.
const PALO_PRUEBA: Palo = { potencia: 3, guia: 3 };
const PELOTA_PRUEBA: PelotaCatalogo = CATALOGO_PELOTAS.find((p) => p.nombre === "Estándar")!;

export default function Pagina() {
  const reiniciarEstado = useJuego((s) => s.reiniciar);

  const reiniciar = useCallback(() => {
    reiniciarEstado();
    const posicionInicial = posicionSobreCelda(HOYO_EJEMPLO.celdas, HOYO_EJEMPLO.salida.x, HOYO_EJEMPLO.salida.z);
    const api = bolaRef.current;
    api?.setTranslation(posicionInicial, true);
    api?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    api?.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [reiniciarEstado]);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <EscenaGolf hoyo={HOYO_EJEMPLO} palo={PALO_PRUEBA} pelota={PELOTA_PRUEBA} />
      <HUD nombreHoyo={HOYO_EJEMPLO.nombre} onReiniciar={reiniciar} />
    </main>
  );
}
