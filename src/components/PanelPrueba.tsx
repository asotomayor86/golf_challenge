"use client";

import type { PaloCatalogo, PelotaCatalogo } from "@/lib/tipos";

/**
 * Panel de depuración de la Fase 1 — NO es la UI final de elección de bolsa
 * (eso es Fase 3, con 3 palos elegidos de antemano). Sirve para poder
 * cambiar de palo/pelota sobre la marcha y comparar cómo se siente cada
 * combinación sin tocar código. Cambiar de palo o pelota reinicia el hoyo.
 */
export function PanelPrueba({
  palos,
  pelotas,
  paloActual,
  pelotaActual,
  onCambiarPalo,
  onCambiarPelota,
}: {
  palos: PaloCatalogo[];
  pelotas: PelotaCatalogo[];
  paloActual: PaloCatalogo;
  pelotaActual: PelotaCatalogo;
  onCambiarPalo: (palo: PaloCatalogo) => void;
  onCambiarPelota: (pelota: PelotaCatalogo) => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-xs flex-col gap-2 rounded-xl bg-black/60 p-3 text-xs text-white backdrop-blur">
      <p className="text-white/50">Panel de prueba (Fase 1, no es la UI final)</p>

      <div>
        <p className="mb-1 text-white/70">Palo — potencia/guía</p>
        <div className="flex flex-wrap gap-1">
          {palos.map((palo) => (
            <button
              key={palo.nombre}
              type="button"
              onClick={() => onCambiarPalo(palo)}
              className={`rounded px-2 py-1 transition ${
                palo.nombre === paloActual.nombre
                  ? "bg-emerald-600"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {palo.nombre}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-white/70">Pelota — velocidad/bote</p>
        <div className="flex flex-wrap gap-1">
          {pelotas.map((pelota) => (
            <button
              key={pelota.nombre}
              type="button"
              onClick={() => onCambiarPelota(pelota)}
              className={`rounded px-2 py-1 transition ${
                pelota.nombre === pelotaActual.nombre
                  ? "bg-sky-600"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {pelota.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
