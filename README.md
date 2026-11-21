# COSMOS LAB

**Python en el cosmos: explorando mundos más allá de la Tierra.** Laboratorio interactivo para una demostración universitaria de 15 minutos sobre astronomía computacional. Recorre en ocho escenas un tránsito simulado y la recuperación de la señal conocida de Pi Mensae c con fotometría de NASA TESS.

## Arrancar en Windows

Usa **Python 3.13** y **Node.js 22 LTS** o una versión compatible. Los scripts presuponen PowerShell 7 o Bash.

```powershell
# Primera vez, con conexión para instalar y compilar.
pwsh -NoProfile -File scripts/start.ps1 -Setup

# En el auditorio, con el entorno y la compilación preparados.
pwsh -NoProfile -File scripts/start.ps1
```

Si `python` apunta a otra instalación, pasa `-Python C:\ruta\a\python.exe` junto con `-Setup`. Usa `-Port 8001` si el puerto 8000 está ocupado.

## Arrancar en Linux

```bash
bash scripts/start.sh --setup
bash scripts/start.sh
```

Para seleccionar otro ejecutable de Python 3.13, define `COSMOS_PYTHON` antes de la instalación. La instalación y compilación se hacen una sola vez en el equipo que se usará para presentar. Las ejecuciones siguientes reutilizan los archivos locales.

Abre [COSMOS LAB en localhost](http://127.0.0.1:8000) y pulsa **Modo Presentación**. Las flechas cambian de escena. La barra inferior permite pausar el movimiento, desactivar animaciones y activar el alto contraste. La API local también ofrece [OpenAPI JSON](http://127.0.0.1:8000/openapi.json).

## Analizar el FITS de otra estrella

1. En **Observaciones TESS**, pulsa **Cargar archivo FITS**.
2. Elige el archivo de **curva de luz** de TESS con flujo PDCSAP, identificado como `_lc.fits` o `_lc.fits.gz`. Cada archivo corresponde a una estrella y un sector. [Descargas públicas de MAST](https://archive.stsci.edu/tess/bulk_downloads/bulk_downloads_ffi-tp-lc-dv.html#lc)
3. Comprueba el TIC y el sector en la ficha. Abre **Ver curva de luz**, prepara las mediciones y usa **Búsqueda BLS** para probar períodos.

La app procesa los archivos de hasta 32 MiB en el equipo. El archivo cargado se mantiene temporalmente en memoria mientras funciona el servidor. Para recuperar el ejemplo y sus parámetros publicados, vuelve a **Observaciones TESS** y pulsa **Volver a Pi Mensae**.

## Preparar datos y ensayar offline

El producto FITS oficial, el CSV de 20 076 cadencias, el manifiesto y el caché BLS vienen incluidos. El inicio normal usa el respaldo local. El botón **Comprobar origen** puede consultar MAST si el proceso se inició con `COSMOS_ALLOW_MAST=1`. Si falla esa consulta, la app vuelve al respaldo verificado. Mantén esta opción desactivada durante la presentación.

Desde la raíz, con el entorno virtual activo:

```bash
# Solo para reingestar o recuperar los datos.
python -m scripts.prepare_real_data
# Alternativa de descarga desde el enlace exacto del archivo:
python -m scripts.prepare_real_data --direct
# Alternativa con un FITS auténtico ya descargado:
python -m scripts.prepare_real_data --fits ruta/al/producto.fits

python -m scripts.prepare_offline
python -m scripts.check_demo
python -m pytest -q
```

Para las pruebas de navegador, deja la aplicación arrancada y ejecuta desde `frontend`:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright bloquea cualquier origen distinto al servidor local y verifica que la demo no intente hacer solicitudes externas. La prueba Python también bloquea conexiones salientes en el flujo de API. Para ensayar en las condiciones del evento, desactiva Wi-Fi y desconecta Ethernet antes de ejecutar `check_demo` y reproducir el recorrido. Conserva el entorno virtual, `frontend/dist` y `data` en ese equipo. Los enlaces a artículos y al FITS requieren internet cuando se abren.

## Docker como alternativa

```bash
docker compose build
docker compose up --no-build
```

Construye la imagen antes del evento. El contenedor escucha en el puerto 8000 del equipo local. Docker Compose incluye una comprobación de salud del respaldo.

## Material de la charla

- [Guion de la demostración](docs/DEMO_SCRIPT.md)
- [Procedencia, método y limitaciones](docs/SCIENCE.md)
- [Arquitectura, API y decisiones técnicas](docs/ARCHITECTURE.md)
- [Solución de problemas](docs/TROUBLESHOOTING.md)
- [Capturas de las escenas](docs/capturas/)
