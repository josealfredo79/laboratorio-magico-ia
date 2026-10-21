#!/usr/bin/env bash
# Prepara y sirve la versión final para la feria (lo abre feria/iniciar-feria.bat desde Windows).
set -e
cd "$(dirname "$0")/.."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

[ -d node_modules ] || npm install
npm run modelos
npm run build
exec npx vite preview --host --port 4173 --strictPort
