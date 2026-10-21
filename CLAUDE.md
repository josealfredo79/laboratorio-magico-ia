# Laboratorio Mágico IA

App web para feria vocacional: la cámara web reconoce manos, cara y gestos (MediaPipe) y el visitante juega con física, química y biología en 3D (Three.js).

## Comandos
- `npm run dev` — servidor de desarrollo (http://localhost:5173)
- `npm run modelos` — descarga modelos MediaPipe a `public/models` y copia WASM a `public/wasm`
- `npm run build` / `npm run preview`
- `npm run prueba` — prueba de humo con Chrome headless y cámara falsa (requiere `npm run dev`). En WSL necesita `LD_LIBRARY_PATH=$HOME/.cache/ms-playwright/libs/usr/lib/x86_64-linux-gnu` (libnss3/libnspr4 extraídas sin sudo). Corre a ~1–5 FPS por no tener GPU; no edites `src/` mientras corre (Vite recarga la página).

## Controles
- Mano: apuntar y mantener 1.3 s sobre un botón = clic. Pellizco (pulgar+índice) = agarrar.
- Sin cámara: el ratón hace de mano (clic sostenido = pellizco).
- Teclas: `1`–`9` actividades (orden de `src/modos/index.js`), `D` modo científico, `Esc` menú, `F` FPS, `R` reinicia el ranking.
- Sin nadie: 20 s en el menú → bienvenida (`src/ui/bienvenida.js`); 60 s en una actividad → menú. `?prueba` en la URL desactiva ambos.
- Al terminar, una actividad llama `ctx.terminar(tarjetas, puntos)`: muestra las tarjetas y registra en el ranking del día (`src/ui/ranking.js`, localStorage). `puntosPorTiempo(segundos, máximo)` premia la rapidez.
- Feria: `feria/iniciar-feria.bat` → `scripts/feria.sh` (build + preview :4173) + Chrome quiosco. Guía del operador: `feria/LEEME.md`.

## Actividades
| Tecla | id | Detecta | Reto |
|---|---|---|---|
| 1 | gravedad | manos (pellizco) | Encestar en Tierra, Luna, Marte y Júpiter |
| 2 | theremin | altura de manos | Afinar La4, Do5, Mi4, Sol4 (Tone.js) |
| 3 | cargas | manos (puño cambia signo) | Atraer, repeler, chispa |
| 4 | moleculas | manos (pellizco) | H₂O, CO₂, CH₄, NH₃ |
| 5 | estados | separación de manos = temperatura | Sólido, líquido, gas |
| 6 | rayosx | pose + manos (señalar) | Cráneo, clavícula, costillas, columna, húmero |
| 7 | ojo | cara + brillo de la cámara | Pupila abierta, enfocar de cerca, parpadear |
| 8 | cientifico | manos + cara | (exploración libre) |
| 9 | quiz | 👍/👎 o botones | 6 preguntas V/F |

## Estructura
- `src/main.js` — arranque, bucle, cambio de modos. `window.__lab` expone ctx para pruebas.
- `src/vision/` — cámara, detector MediaPipe, gestos puros, procesado de manos + ratón.
- `src/escena/` — Three.js (`normAMundo`, `normAPantalla`, `pantallaAMundo`, `liberar`) y efectos.
- `src/ui/` — HUD, menú, cursores con dwell, sonido (Tone.js).
- `src/modos/` — actividades; `index.js` las registra (las `proximamente` salen bloqueadas). Un modo puede pedir `necesita: { cara, pose }` y usar `ctx.video`, `ctx.cara`, `ctx.pose`.
- `src/ui/botonera.js` — botones grandes elegibles por dwell dentro de una actividad.

## Stack
Vite · three · @mediapipe/tasks-vision · cannon-es (física) · tone (sonido)

## Reglas
- Todo offline: modelos y WASM desde `/models` y `/wasm`, nunca CDN.
- Un modo = `src/modos/<id>.js` con `{ id, titulo, zona, iniciar, actualizar, detener }`; contenido científico en `src/contenido/<id>.json`.
- Textos en español, grandes, para jóvenes de 14–18 años. Datos científicos verificados.
- Agentes: `vision-mediapipe`, `threejs-3d`, `contenido-cientifico`, `qa-feria`. Skills: `nuevo-modo`, `modo-feria`.
