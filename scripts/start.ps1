param(
    [switch]$Setup,
    [ValidateRange(1, 65535)][int]$Port = 8000,
    [string]$Python = 'python'
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if ($Setup) {
        & $Python -m venv .venv
        & .\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
        Push-Location frontend
        try {
            npm ci
            npm run build
        } finally {
            Pop-Location
        }
        & .\.venv\Scripts\python.exe -m scripts.prepare_offline
    }

    if (!(Test-Path -LiteralPath '.venv/Scripts/python.exe') -or !(Test-Path -LiteralPath 'frontend/dist/index.html')) {
        throw 'Falta instalar o compilar. Ejecuta scripts/start.ps1 -Setup con conexión una vez.'
    }

    & .\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port $Port
} finally {
    Pop-Location
}
