"use client";

import { useCallback, useMemo, useState } from "react";
import { EscenaGolf } from "@/components/EscenaGolf";
import { HUD } from "@/components/HUD";
import { PanelPrueba } from "@/components/PanelPrueba";
import { HOYO_EJEMPLO } from "@/lib/hoyoEjemplo";
import { generarCatalogoPalos, CATALOGO_PELOTAS } from "@/lib/catalogo";
import { posicionSobreCelda } from "@/lib/hoyoUtils";
import { bolaRef } from "@/lib/refs";
import { useJuego } from "@/lib/store";
import type { PaloCatalogo, PelotaCatalogo } from "@/lib/tipos";

// TODO(Fase 3): el jugador elegirá 3 palos de los 5 del catálogo y 1 pelota
// antes de la partida. La Fase 1 deja elegir uno de cada sobre la marcha
// (ver PanelPrueba) para poder comparar cómo se siente cada combinación.
const CATALOGO_PALOS = generarCatalogoPalos();
const PALO_PRUEBA: PaloCatalogo = CATALOGO_PALOS.find((p) => p.potencia === 5 && p.guia === 1)!; // "Martillo 5/1"
const PELOTA_PRUEBA: PelotaCatalogo = CATALOGO_PELOTAS.find((p) => p.nombre === "Estándar")!;

export default function Pagina() {
  const [palo, setPalo] = useState<PaloCatalogo>(PALO_PRUEBA);
  const [pelota, setPelota] = useState<PelotaCatalogo>(PELOTA_PRUEBA);
  const reiniciarEstado = useJuego((s) => s.reiniciar);

  const posicionInicial = useMemo(
    () => posicionSobreCelda(HOYO_EJEMPLO.celdas, HOYO_EJEMPLO.salida.x, HOYO_EJEMPLO.salida.z),
    [],
  );

  const reiniciar = useCallback(() => {
    reiniciarEstado();
    const api = bolaRef.current;
    api?.setTranslation(posicionInicial, true);
    api?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    api?.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [reiniciarEstado, posicionInicial]);

  // Cambiar de equipo a mitad de golpe no tiene sentido: reinicia el hoyo.
  const cambiarPalo = useCallback(
    (nuevo: PaloCatalogo) => {
      setPalo(nuevo);
      reiniciar();
    },
    [reiniciar],
  );
  const cambiarPelota = useCallback(
    (nueva: PelotaCatalogo) => {
      setPelota(nueva);
      reiniciar();
    },
    [reiniciar],
  );

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <EscenaGolf hoyo={HOYO_EJEMPLO} palo={palo} pelota={pelota} />
      <HUD nombreHoyo={HOYO_EJEMPLO.nombre} onReiniciar={reiniciar} />
      <PanelPrueba
        palos={CATALOGO_PALOS}
        pelotas={CATALOGO_PELOTAS}
        paloActual={palo}
        pelotaActual={pelota}
        onCambiarPalo={cambiarPalo}
        onCambiarPelota={cambiarPelota}
      />
    </main>
  );
}
