---
name: modo-feria
description: Prepara y lanza la app para el día de la feria (build, modelos offline, Chrome en modo quiosco con cámara). Úsalo cuando pidan "prepara para la feria", "modo quiosco", "lanzar el stand".
---
# Lanzar el stand

- Desde Windows: `feria/iniciar-feria.bat` (copia en el escritorio como "Iniciar Laboratorio"). Arranca `scripts/feria.sh` en WSL (modelos + build + `vite preview` en el puerto 4173), espera a que responda y abre Chrome en quiosco con `--autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream` y un perfil propio en `%TEMP%\laboratorio-feria`.
- Apagar: `feria/detener-feria.bat` o `Alt+F4` + cerrar la ventana del servidor.
- Checklist imprimible para el operador: `feria/LEEME.md`.
- Los .bat deben conservar saltos de línea CRLF.

Antes del evento:
1. `URL="http://localhost:4173/?prueba" npm run prueba` con `scripts/feria.sh` corriendo (en WSL añade el `LD_LIBRARY_PATH` de CLAUDE.md).
2. En la laptop real: `F` en cada actividad (≥30 FPS), luz frontal, marca en el piso a 1.5 m.
3. Teclas del operador: `Esc` menú, `1`–`9` actividades, `F` FPS, `R` reinicia ranking, `D` modo científico.
