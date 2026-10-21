@echo off
title Laboratorio Magico IA
echo.
echo   Laboratorio Magico IA - iniciando...
echo   (Para salir de la pantalla completa: Alt + F4)
echo.

rem Servidor dentro de WSL, en una ventana minimizada.
start "Servidor Laboratorio (no cerrar)" /min wsl.exe -d Ubuntu -- bash /home/josealfredo/realidad3d/scripts/feria.sh

rem Esperar a que el servidor responda.
:esperar
curl.exe -s -o nul http://localhost:4173/ && goto listo
timeout /t 2 /nobreak >nul
goto esperar
:listo

rem Chrome en modo quiosco: pantalla completa, camara permitida y sonido sin clic.
set "NAVEGADOR=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%NAVEGADOR%" set "NAVEGADOR=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%NAVEGADOR%" set "NAVEGADOR=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%NAVEGADOR%" set "NAVEGADOR=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

start "" "%NAVEGADOR%" --kiosk --user-data-dir="%TEMP%\laboratorio-feria" --no-first-run ^
  --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream ^
  --disable-pinch --overscroll-history-navigation=0 --disable-features=Translate ^
  http://localhost:4173/
