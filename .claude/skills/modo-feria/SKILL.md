---
name: modo-feria
description: Prepara y lanza la app para el día de la feria (build, modelos offline, Chrome en modo quiosco con cámara). Úsalo cuando pidan "prepara para la feria", "modo quiosco", "lanzar el stand".
---
# Lanzar el stand

1. `npm run modelos` — confirma que `public/models/*.task` y `public/wasm` existen (offline).
2. `npm run build && npm run preview` (sirve `dist/` en http://localhost:4173).
3. Chrome en quiosco (Windows, fuera de WSL):
   `chrome.exe --kiosk --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required http://localhost:4173`
   (en Linux: `google-chrome --kiosk ...`). Cámara solo funciona en localhost o HTTPS.
4. Checklist físico: luz frontal (aro de luz), fondo liso, marca en el piso a 1.5 m, laptop conectada a corriente, modo "no suspender", pantalla grande.
5. Tecla `Esc` vuelve al menú, `F` muestra FPS (debe ser ≥30), `D` abre el modo científico.
6. Antes del evento: `npm run prueba` con el servidor corriendo.
