# Solución de problemas

## El servidor responde pero no aparece la interfaz

Compila primero con `npm ci` y `npm run build` desde `frontend`. Reinicia FastAPI después de crear `frontend/dist`. El script de inicio verifica que exista la compilación. Trata `http://localhost:8000` y `http://127.0.0.1:8000` como orígenes distintos durante las pruebas.

## Falta el respaldo o no coincide su hash

Comprueba que `data/metadata` y `data/real` estén disponibles. Ejecuta `python -m scripts.prepare_offline` para revisar ambos archivos. Repite la ingesta desde el FITS oficial si el CSV fue modificado. La API muestra 503 si no hay un respaldo válido.

## MAST no responde

Para la charla usa el respaldo incluido. Si habilitaste `COSMOS_ALLOW_MAST=1`, **Comprobar origen** intenta la consulta y vuelve al respaldo si falla. Si Lightkurve no puede buscar o resolver el archivo, `python -m scripts.prepare_real_data --direct` usa el enlace exacto del producto. Cuando un FITS recuperado no coincide con el SHA-256 incorporado, verifica si el archivo cambió en el archivo oficial antes de actualizar la referencia del proyecto.

## La búsqueda devuelve otro período

Revisa si el intervalo BLS contiene 6,27 d, vuelve a la preparación predeterminada y mira los picos alternativos. Compara sus curvas plegadas, épocas y formas de tránsito. El resultado publicado está disponible en el modo guiado. El resultado exploratorio muestra la salida calculada para las condiciones seleccionadas.

## La animación está detenida

Comprueba los controles de pausa y de animación en el pie de página. Si el sistema operativo pide reducir movimiento, la reproducción automática queda detenida. **Ver tránsito** sigue llevando el esquema al punto de la caída.

## Playwright no encuentra Chromium

Con conexión, entra en `frontend` y ejecuta `npx playwright install chromium`. En Linux quizá debas instalar también las dependencias del navegador. Ejecuta el servidor antes de las pruebas. Si usas otro puerto, configura `COSMOS_TEST_URL` con el origen correspondiente.

## Docker no se conecta al daemon

Inicia Docker Desktop o el servicio de Docker y verifica que `docker info` reporte una versión del servidor. El arranque con Python y Vite sirve la misma aplicación en un equipo sin Docker.
