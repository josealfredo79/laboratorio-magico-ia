---
name: nuevo-modo
description: Crea un nuevo modo educativo-interactivo del Laboratorio Mágico IA (física, química, biología o arcade) con detección por cámara, escena 3D y contenido científico verificado. Úsalo cuando el usuario pida "agrega el modo X", "nuevo juego", "nueva actividad".
---
# Crear un modo del laboratorio

1. **Diseño (1 párrafo):** zona, qué detecta (manos/cara/gestos/pose), mecánica de juego, concepto científico, reto con tiempo o puntaje.
2. **Contenido:** delega al agente `contenido-cientifico` → `src/contenido/<id>.json`.
3. **Visión:** si hace falta un gesto nuevo, delega a `vision-mediapipe` → función pura en `src/vision/gestos.js`.
4. **Escena:** delega a `threejs-3d` → `src/modos/<id>.js` con la interfaz `{ id, titulo, zona, iniciar, actualizar, detener }`.
5. **Registro:** agrega el modo a `src/modos/index.js` (aparece en el menú y en la tecla de depuración).
6. **Cierre:** al terminar el reto, mostrar las 3 tarjetas: ✅ logro · 💡 dato curioso · 🎓 carrera.
7. **Prueba:** delega a `qa-feria`; corrige lo que reporte.

Criterios: se entiende en <10 s sin instrucciones escritas, dura 30–90 s, texto legible a 2 m, ≥30 FPS en la laptop del stand.
