@echo off
rem Cierra el navegador del stand y apaga el servidor.
taskkill /im chrome.exe /fi "WINDOWTITLE eq Laboratorio*" >nul 2>&1
wsl.exe -d Ubuntu -- pkill -f "[v]ite preview"
echo Laboratorio detenido.
timeout /t 2 >nul
