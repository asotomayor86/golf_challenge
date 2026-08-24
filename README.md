# ⛳ Minigolf — Hub Familiar

Minigolf 3D multijugador (referencia de jugabilidad: *Golf Battle*) para el hub
familiar de juegos (*One Page to Rule Them All*). El golf **no implementa auth,
salas ni torneos propios** — se engancha a los del hub. Ver `docs/fase-0.md`
(pendiente de extraer del hilo de diseño) para el resultado completo del
descubrimiento del hub y las decisiones tomadas.

Stack: **Next.js 16 · React 19 · TypeScript estricto · @react-three/fiber +
drei + rapier · Tailwind v4 · Zustand · Vitest**. UI en español.

## Estado: Fase 1 (render 3D + física + un hoyo de prueba)

Un hoyo hardcodeado (`src/lib/hoyoEjemplo.ts`) jugable en solitario, para
validar que el golpe **se siente bien** antes de construir el editor. Todavía
sin: editor, catálogo completo de reglas (tope de 8, tiempo, cristal que se
rompe, agua profunda), circuitos, multijugador ni estadísticas — eso llega en
las fases 2-5.

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # motor de física/reglas (puro, sin Three.js/Rapier)
npm run typecheck
```

**Control**: arrastra desde la bola hacia atrás (ratón o dedo) para apuntar;
suelta para golpear. Arrastra en cualquier otro punto para orbitar la cámara.

## Estructura

```
src/
  lib/
    tipos.ts        Modelo de datos compartido (Celda, Hoyo, Palo, Pelota…)
    fisica.ts        Fórmulas de física puras y testeables (sin Three/Rapier)
    catalogo.ts      Catálogo de 19 palos (generado) + 5 pelotas (fijas)
    geometria.ts      Generación procedural de terreno (cubos/rampas/cuñas),
                      fusionada por material — nunca un mesh por bloque
    materiales.ts    Apariencia visual por material
    hoyoEjemplo.ts    El hoyo hardcodeado de la Fase 1
    hoyoUtils.ts      Posición de mundo a partir de una celda
    store.ts          Estado de partida (Zustand): golpes, movimiento, embocado
    refs.ts           Puente imperativo (posición de la bola sin re-render a 60Hz)
  components/
    EscenaGolf.tsx    Canvas + Physics (60Hz fijo) + luces + calidad PC/móvil
    Terreno.tsx        Geometría fusionada por material + TrimeshCollider
    Bola.tsx           RigidBody de la bola (CCD), corriente, embocado
    ControlTiro.tsx    Arrastre (Pointer Events) → dirección + potencia
    CamaraSeguimiento.tsx  OrbitControls con objetivo en la bola
    Bandera.tsx        Marcador visual de la copa
    HUD.tsx            Contador de golpes
tests/                 Fórmulas de física y catálogo de palos (Vitest)
```

## Notas de diseño (para no repetirlas en cada sesión)

- **Sin auth/salas/torneos propios**: eso vendrá en la Fase 4, reutilizando el
  contrato HTTP del hub (`GET /api/rooms/{code}`, `POST /api/rooms/{code}/result`).
- **Sin canal en tiempo real propio del hub** (el hub es "sin realtime, juegos
  por turnos"): la Fase 4 sincronizará las bolas fantasma por SSE + sondeo de
  una fila JSONB en la Neon propia de este juego, igual que hacen `chess` y
  `murcia_kingdom` en el resto de la familia de repos — a menor frecuencia
  (~2-3Hz) porque los fantasmas son solo cosméticos.
- **Constantes marcadas "TODO: ajustar en playtest"** (gravedad, aceleración
  de la corriente, radio/umbral de embocado) no vienen fijadas por el diseño;
  se sintonizan jugando, no adivinando.
