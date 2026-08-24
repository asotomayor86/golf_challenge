"use client";

import { useJuego } from "@/lib/store";

/** HUD mínimo de Fase 1: contador de golpes y aviso de embocado (§8 lo amplía en Fase 3-4). */
export function HUD({ nombreHoyo, onReiniciar }: { nombreHoyo: string; onReiniciar: () => void }) {
  const golpes = useJuego((s) => s.golpes);
  const embocada = useJuego((s) => s.embocada);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-white">
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto rounded-xl bg-black/50 px-4 py-2 backdrop-blur">
          <p className="text-sm text-white/70">{nombreHoyo}</p>
          <p className="text-2xl font-bold tabular-nums">{golpes} golpe{golpes === 1 ? "" : "s"}</p>
        </div>
        <button
          type="button"
          onClick={onReiniciar}
          className="pointer-events-auto rounded-xl bg-black/50 px-4 py-2 backdrop-blur transition hover:bg-black/70"
        >
          Reiniciar
        </button>
      </div>

      {embocada && (
        <div className="pointer-events-auto mx-auto mb-8 rounded-xl bg-emerald-600/90 px-6 py-3 text-center text-xl font-bold backdrop-blur">
          ¡Hoyo completado en {golpes} golpe{golpes === 1 ? "" : "s"}!
          <button
            type="button"
            onClick={onReiniciar}
            className="ml-4 rounded-lg bg-white/20 px-3 py-1 text-base font-normal hover:bg-white/30"
          >
            Otra vez
          </button>
        </div>
      )}
    </div>
  );
}
