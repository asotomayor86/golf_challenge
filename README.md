# ⛳ Minigolf — Hub Familiar

Minigolf 3D multijugador (referencia de jugabilidad: *Golf Battle*) para el hub
familiar de juegos (*One Page to Rule Them All*). El golf **no implementa auth,
salas ni torneos propios** — se engancha a los del hub (contrato exacto y
decisiones de la Fase 0 en la memoria de la sesión de diseño; se documentarán
aquí en el repo cuando llegue la Fase 4, que es cuando se cablean de verdad).

Stack: **Next.js 16 · React 19 · TypeScript estricto · @react-three/fiber +
drei + rapier · Tailwind v4 · Zustand · Vitest**. UI en español.

## Estado: Fase 1 (render 3D + física + un hoyo de prueba)

Un hoyo hardcodeado (`src/lib/hoyoEjemplo.ts`) jugable en solitario, para
validar que el golpe **se siente bien** antes de construir el editor —
todavía en eso: varias rondas de playtest real y ajuste en el mismo día
(24-08-2026), pendiente de la confirmación final antes de pasar a la Fase 2.
El hoyo de prueba está **temporalmente solo en césped y sin rampa** (se
simplificó a mitad de sesión para aislar el ajuste de físicas del resto de
materiales/formas — esas piezas siguen implementadas y testeadas, solo no
aparecen en este hoyo concreto). Todavía sin: editor, catálogo completo de
reglas (tope de 8, tiempo, cristal que se rompe, agua profunda), circuitos,
multijugador ni estadísticas — eso llega en las fases 2-5.

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # motor de física/reglas (puro, sin Three.js/Rapier)
npm run typecheck
```

**Control**: arrastra desde la bola hacia atrás (ratón o dedo) para apuntar;
suelta para golpear. Arrastra en cualquier otro punto para orbitar la cámara.
Mientras apuntas se ven dos líneas distintas: la **guía** (hacia delante,
longitud fija según el palo) y la **flecha de potencia** (hacia atrás, crece
con el arrastre y cambia de color en 5 niveles según cuánta potencia
alcanzaría ese palo).

## Estructura

```
src/
  lib/
    tipos.ts        Modelo de datos compartido (Celda, Hoyo, Palo, Pelota…)
    fisica.ts        Fórmulas de física puras y testeables (sin Three/Rapier)
    catalogo.ts      Catálogo de 5 palos (generado) + 5 pelotas (fijas)
    geometria.ts      Generación procedural de terreno (cubos/rampas/cuñas),
                      fusionada por material — nunca un mesh por bloque
    materiales.ts    Apariencia visual por material
    texturas.ts       Texturas procedurales por canvas (césped, hoyuelos de la bola)
    hoyoEjemplo.ts    El hoyo hardcodeado de la Fase 1 (hoy: llano, solo césped)
    hoyoUtils.ts      Posición de mundo a partir de una celda
    store.ts          Estado de partida (Zustand): golpes, movimiento, embocado
    refs.ts           Puente imperativo (posición de la bola sin re-render a 60Hz)
  components/
    EscenaGolf.tsx    Canvas + Physics (60Hz fijo) + luces + calidad PC/móvil
    Terreno.tsx        Geometría fusionada por material + TrimeshCollider + agujero de la copa
    Bola.tsx           RigidBody de la bola (CCD), corriente, embocado, restitución dinámica
    ControlTiro.tsx    Arrastre (Pointer Events) → guía + flecha de potencia
    CamaraSeguimiento.tsx  OrbitControls con objetivo en la bola
    Bandera.tsx        Asta + bandera (el agujero de la copa lo recorta Terreno.tsx)
    HUD.tsx            Contador de golpes
tests/                 Física, catálogo de palos/pelotas y geometría (Vitest)
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
- **Sin "precisión"** (decisión de playtest, 2026-08-24): el palo ya solo
  tiene potencia+guía (=6) y la pelota velocidad+bote (=6). El golpe sale
  siempre exactamente hacia donde se apunta — sin desvío aleatorio — y la
  corriente arrastra igual a cualquier pelota. "Guía" es puramente visual
  (línea de ayuda + rebotes previsualizados).
- **La fricción de rodadura se aplica como `linearDamping`, no solo como
  `friction` del collider**: una bola que rueda sin deslizar apenas nota la
  fricción de Coulomb (esa solo actúa cuando hay deslizamiento relativo), así
  que con solo `friction` "nunca acababa de frenarse del todo" (feedback real
  de playtest). Ver `amortiguacionRodadura` en `fisica.ts`.
- **El rebote (restitución) se controla frame a frame, no con un valor fijo**:
  se pone a 0 mientras la bola está cerca del suelo (nada de rebote al rodar)
  y se restaura el valor real de la pelota solo al caer de verdad desde
  altura. Se probaron primero un recorte de velocidad y hasta un
  teletransporte de posición para evitar el rebote — ambos funcionaban pero
  se notaban "a trompicones" (cualquier corrección de golpe, frame a frame,
  ES un salto discontinuo). Cambiar una propiedad física real en vez de
  corregir la posición a mano es lo que dio un movimiento continuo de verdad.
- **La copa es un agujero de verdad recortado en la malla del terreno**
  (`celdaConAgujero` en `geometria.ts`), no un círculo pintado encima — eso
  quedaba enterrado dentro del bloque sólido y no se veía. Al embocar, la
  bola cae animada hasta el fondo real del agujero (sin encogerse: eso era
  un truco de cuando el agujero no tenía profundidad real, y sobraba).
