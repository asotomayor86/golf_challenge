/**
 * Estado de partida (Fase 1: un único jugador, un único hoyo). Guarda solo lo
 * que cambia a baja frecuencia (golpes, si la bola se mueve, si ha embocado);
 * la posición de la bola vive fuera de React (ver refs.ts) para no forzar un
 * re-render a 60Hz.
 */
import { create } from "zustand";
import * as THREE from "three";

export interface SolicitudDisparo {
  id: number;
  /** Velocidad final (u/s) a aplicar a la bola: dirección + desvío + potencia ya resueltos. */
  velocidad: THREE.Vector3;
}

interface EstadoJuego {
  golpes: number;
  enMovimiento: boolean;
  embocada: boolean;
  /** true mientras se arrastra desde la bola para apuntar — desactiva el orbit de la cámara. */
  apuntando: boolean;
  solicitudDisparo: SolicitudDisparo | null;
  dispara: (velocidad: THREE.Vector3) => void;
  marcarMovimiento: (enMovimiento: boolean) => void;
  marcarEmbocada: () => void;
  marcarApuntando: (apuntando: boolean) => void;
  reiniciar: () => void;
}

let siguienteIdDisparo = 1;

export const useJuego = create<EstadoJuego>((set) => ({
  golpes: 0,
  enMovimiento: false,
  embocada: false,
  apuntando: false,
  solicitudDisparo: null,
  dispara: (velocidad) =>
    set((estado) => ({
      golpes: estado.golpes + 1,
      solicitudDisparo: { id: siguienteIdDisparo++, velocidad },
    })),
  marcarMovimiento: (enMovimiento) => set({ enMovimiento }),
  marcarEmbocada: () => set({ embocada: true }),
  marcarApuntando: (apuntando) => set({ apuntando }),
  reiniciar: () => set({ golpes: 0, enMovimiento: false, embocada: false, apuntando: false, solicitudDisparo: null }),
}));
