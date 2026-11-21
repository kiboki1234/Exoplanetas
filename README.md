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

## TESS: Cazadores de mundos ocultos

Pulsa **Jugar** en COSMOS LAB. En **Educativo**, mueve la cámara en el visor 3D o usa **Centrar**, captura una imagen y acumula entre 8 y 24 días simulados. La curva de luz procede de la suma de los píxeles de la apertura. En el laboratorio puedes comparar la curva original y la procesada, filtrar indicadores de calidad y buscar períodos con BLS y TLS. Completa tu primer informe con una conclusión correcta y evidencia para desbloquear TLS y avanzar. Las cinco misiones incluyen un candidato a planeta, una binaria, un cuerpo menor, una estrella variable y un artefacto instrumental.

En **Científico**, BLS y TLS usan la curva auténtica del sector 1 de Pi Mensae, incluida en el respaldo local. El visor y el detector de la campaña son simulaciones. BLS usa Astropy y TLS usa el paquete `transitleastsquares`. Para TLS se agrupan las cadencias en intervalos de diez minutos. El análisis predeterminado de TLS se calcula con `scripts.prepare_offline` y queda guardado con la versión del algoritmo y la suma SHA-256 de las observaciones. Los cambios de preparación ejecutan una búsqueda nueva y la primera ejecución puede tardar más por la compilación.

El detector simulado usa un recorte de 7 × 7 píxeles, exposiciones de 30 minutos, fotones con ruido de Poisson, ruido de lectura y variaciones de apuntado. La campaña incluye un hueco de descarga de datos. Puedes cambiar la apertura y medir de nuevo las mismas exposiciones. El fondo se estima con la mediana de los píxeles marcados y la incertidumbre combina ruido de fotones, lectura y estimación del fondo. El visor usa un campo nominal de 24° por cámara. [Instrumento TESS](https://heasarc.gsfc.nasa.gov/docs/tess/telescope_information.html)

En **Conferencia**, usa **Modo Presentación** y recorre la captura, la comparación de dos estrellas simuladas y el análisis real de Pi Mensae en unos 12 minutos. El registro guarda en el navegador el mejor informe por estrella y permite exportarlo como texto. **Laboratorio** vuelve a la escena de COSMOS LAB que estaba abierta.

Si actualizas una instalación local existente, instala las dependencias de `backend/requirements.txt` en el entorno virtual antes de iniciar la nueva versión.

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

## Despliegue en Render y Vercel

- **Render:** el Blueprint de la raíz define el servicio Python, el inicio y la comprobación del respaldo. El servicio del proyecto es `cosmos-lab-api.onrender.com`.
- **Vercel:** importa el mismo repositorio y selecciona `frontend` como directorio raíz. `frontend/vercel.json` publica `dist` y reenvía `/api/*` al servicio de Render. Deja `VITE_API_URL` vacía para usar esta ruta. Si conectas directamente a un backend distinto, fija `VITE_API_URL` con su origen HTTPS y autoriza el origen de Vercel en `COSMOS_CORS_ORIGINS` del backend.

Comprueba `/api/health` en Render y abre **Observaciones TESS** en el sitio de Vercel para verificar que la curva y la carga FITS llegan al backend. La versión local usa el mismo origen cuando `VITE_API_URL` está vacía.

## Material de la charla

- [Guion de la demostración](docs/DEMO_SCRIPT.md)
- [Procedencia, método y limitaciones](docs/SCIENCE.md)
- [Arquitectura, API y decisiones técnicas](docs/ARCHITECTURE.md)
- [Solución de problemas](docs/TROUBLESHOOTING.md)
- [Capturas de las escenas](docs/capturas/)
