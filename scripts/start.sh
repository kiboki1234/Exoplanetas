#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ "${1:-}" == "--setup" ]]; then
  "${COSMOS_PYTHON:-python3.13}" -m venv .venv
  .venv/bin/python -m pip install -r backend/requirements-dev.txt
  (cd frontend && npm ci && npm run build)
  .venv/bin/python -m scripts.prepare_offline
  shift
fi

if [[ ! -x .venv/bin/python || ! -f frontend/dist/index.html ]]; then
  printf '%s\n' 'Falta instalar o compilar. Ejecuta bash scripts/start.sh --setup con conexión una vez.' >&2
  exit 1
fi
exec .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port "${1:-8000}"
