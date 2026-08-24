/**
 * Puente imperativo entre componentes R3F que necesitan la posición de la
 * bola en cada frame (cámara, HUD) sin suscribirse a React state a 60Hz —
 * eso disparía un re-render por frame. Un objeto mutable de módulo es el
 * patrón habitual en R3F para esto.
 */
import type { RapierRigidBody } from "@react-three/rapier";

export const bolaRef: { current: RapierRigidBody | null } = { current: null };
