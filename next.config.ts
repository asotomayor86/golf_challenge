import type { NextConfig } from "next";

// TODO(Fase 4): cuando se integre con el hub, este juego se servirá bajo
// /minigolf/:path* (igual que chess=/ajedrez, marvel_trivia_track=/marvel-trivia).
// Hasta entonces se deja sin basePath para simplificar el bucle de desarrollo
// local (Fase 1-3 no necesitan el hub).
const nextConfig: NextConfig = {};

export default nextConfig;
