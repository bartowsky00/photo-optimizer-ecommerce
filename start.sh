#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
VENV_DIR="$SCRIPT_DIR/.venv"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PhotoOptimizer — Avvio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Crea virtualenv se non esiste
if [ ! -d "$VENV_DIR" ]; then
  echo "→ Creazione ambiente virtuale Python..."
  python3 -m venv "$VENV_DIR"
fi

# Attiva venv
source "$VENV_DIR/bin/activate"

# Installa dipendenze
echo "→ Installazione dipendenze..."
pip install -q --upgrade pip
pip install -q -r "$BACKEND_DIR/requirements.txt"

# Porta (default 8000, sovrascrivibile con PORT=xxxx ./start.sh)
PORT="${PORT:-8000}"

echo ""
echo "✓ Avvio server su http://0.0.0.0:$PORT"
echo "  Apri nel browser: http://localhost:$PORT"
echo ""

cd "$BACKEND_DIR"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
