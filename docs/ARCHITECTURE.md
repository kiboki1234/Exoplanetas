# Arquitectura

COSMOS LAB es un monolito modular local. Durante la charla FastAPI sirve una compilación de React y la API en el mismo origen. Para desarrollo, Vite redirige `/api` a FastAPI en el puerto 8000. Los datos se leen desde disco y la interfaz empaqueta scripts, estilos, tipografía y Plotly.

| Módulo | Responsabilidad |
| --- | --- |
| `frontend/src/scenes` | Flujo didáctico y controles de cada escena. |
| `frontend/src/charts` | Renderizado Plotly, series WebGL, sincronización y formato de unidades. |
| `frontend/src/services` y `hooks` | Contratos de red, manejo de errores y cancelación de solicitudes obsoletas. |
| `backend/app/api` y `models` | Validación Pydantic y endpoints FastAPI. |
| `backend/app/science` | Verificación del respaldo, preparación, plegado, BLS y simulación. |
| `data` y `scripts` | FITS, CSV identificado por hash, procedencia y generación del caché. |

## Contrato de datos

Una fila contiene `time_btjd`, `flux`, `flux_error`, `quality` y `cadence`. Se usa JSON `null` para valores no finitos en la API. El manifiesto referencia el FITS y el CSV por SHA-256. La carga valida el contrato y el hash del CSV. Una serie preparada conserva las cadencias de origen y las operaciones aplicadas. Simulación y observaciones tienen rutas y tipos separados.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/health` | Estado de API y presencia del respaldo. |
| GET | `/api/dataset/metadata` | Manifiesto y origen de carga. |
| GET | `/api/dataset/lightcurve` | Cadencias y errores de PDCSAP preservados. |
| POST | `/api/dataset/import?filename=…` | Recibe el FITS en el cuerpo y devuelve el identificador temporal, los metadatos y la serie. |
| POST | `/api/dataset/refresh` | Consulta de MAST si se habilitó el acceso y retorno al respaldo ante errores. |
| POST | `/api/analysis/preprocess` | Serie preparada, conteos y operaciones. |
| POST | `/api/analysis/fold` | Fase, flujo en ppm, error y bins por fase. |
| POST | `/api/analysis/bls` | Malla, potencia, parámetros y candidatos calculados. |
| POST | `/api/simulator/generate` | Serie sintética determinista. |

La API devuelve 422 para parámetros inválidos y 503 si el respaldo no se puede comprobar. Las solicitudes científicas usan workers de FastAPI para que una búsqueda no detenga todas las operaciones. El cliente mantiene el estado al cambiar de escena y aborta solicitudes pendientes al reiniciar. El caché BLS es de solo lectura durante la demo. Se construye fuera del servidor y se identifica por hash de datos, parámetros, versiones científicas y revisión del cálculo.

Las rutas de análisis aceptan `dataset_id` como parámetro de consulta al trabajar con un archivo importado. Al omitirlo se usa el respaldo de Pi Mensae. Cada importación verifica la tabla de fotometría, las unidades y la escala temporal. El servidor conserva en memoria hasta ocho series importadas y devuelve 404 cuando el identificador expiró. El procesamiento se ejecuta en el mismo servidor local.

## Decisiones técnicas

1. **Distribución local con FastAPI.** Un puerto evita configurar CORS y permite un ensayo con el mismo artefacto que se desplegará en el auditorio.
2. **Archivos tabulares con manifiesto.** La fotometría de la demo es de solo lectura y se puede reproducir desde un FITS de aproximadamente 2 MB. El CSV con hash se prepara antes de publicar el manifiesto.
3. **Gráficos Plotly GL2D.** Se carga bajo demanda y conserva las cadencias originales en los gráficos científicos. La animación usa SVG y evita redibujar las gráficas científicas en cada fotograma.
4. **Versión de Python y Pandas.** Se fijó Python 3.13 para la instalación verificada. Lightkurve 2.6 rechaza Pandas 3 y se fijó 2.3.3.
5. **Validación FITS.** Este producto identifica SPOC con `PROCVER` y no contiene `FILENAME` en la cabecera primaria. Se verifican el hash del producto y los campos `SIMDATA`, `TELESCOP`, `TICID`, `SECTOR`, `TIMEDEL` y la escala temporal.

## Comprobaciones de calidad

- Compilar TypeScript, Vite y Tailwind.
- Verificar el respaldo contra las cinco columnas del FITS.
- Ensayar análisis y fallos de MAST con pytest.
- Ejecutar Playwright a 1920 × 1080 y comprobar que el ancho también se adapte a un móvil.
- Probar desde la red del auditorio o con la red externa desconectada.
