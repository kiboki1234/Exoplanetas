# Procedencia y método científico

## Fotometría de Pi Mensae

El conjunto incluido es el producto oficial SPOC de NASA TESS para **TIC 261136679**, sector 1, cadencia nominal de 120 s. El FITS registra observaciones del **25 de julio al 22 de agosto de 2018 (UTC)**, cubriendo 27,88 días. Su cabecera indica `SIMDATA = F`, versión del pipeline `spoc-5.0.10-20200904` y `TIMEDEL = 1/720 d`. La descarga del archivo público y la exportación se realizaron el 21 de noviembre de 2026. [FITS oficial de MAST](https://archive.stsci.edu/missions/tess/tid/s0001/0000/0002/6113/6679/tess2018206045859-s0001-0000000261136679-0120-s_lc.fits) · [Manifiesto del respaldo](../data/metadata/pi-mensae-sector1.json)

La exportación conserva las **20 076 filas** y las columnas `TIME`, `PDCSAP_FLUX`, `PDCSAP_FLUX_ERR`, `QUALITY` y `CADENCENO` del FITS. Las filas inválidas se conservan en el CSV. La vista original muestra `PDCSAP_FLUX` en electrones por segundo. Este es un producto calibrado y corregido por tendencias sistemáticas durante el preprocesamiento SPOC. `TIME` está en días BTJD, es decir, BJD en la escala TDB menos 2 457 000. Las fechas UTC del intervalo se leen de la cabecera. [NASA TESS Science Support Center](https://heasarc.gsfc.nasa.gov/docs/tess/) · [Misión TESS](https://science.nasa.gov/mission/tess/)

## Simulación

El simulador genera 501 muestras de una órbita circular proyectada. La relación entre radios fija la profundidad máxima según δ ≈ (Rₚ/R★)² para una estrella uniforme y un planeta opaco. El ingreso y egreso se interpolan linealmente. El ruido gaussiano usa semilla fija y se expresa en ppm. La animación es un esquema geométrico. El limbo, la inclinación, el impacto, la dilución real y la variabilidad de la estrella requieren modelos adicionales.

## Preparación y plegado

1. El análisis conserva tiempos y flujos finitos con incertidumbre positiva. Las filas descartadas permanecen disponibles en el respaldo y en la vista original.
2. La máscara de calidad predeterminada de Lightkurve excluye cadencias asociadas a los bits indicados en la interfaz. También se puede elegir una máscara estricta o desactivar la máscara.
3. La normalización divide el flujo y su incertidumbre por la mediana global de las cadencias retenidas.
4. `LightCurve.flatten` estima la tendencia con una ventana Savitzky–Golay de 1001 muestras, aproximadamente 33,4 h, de orden 2. La segmentación considera huecos mayores a cinco cadencias. Usa `niters=1` y `sigma=5` para estimar la tendencia. En segmentos cortos, Lightkurve puede usar estimaciones simplificadas. Se puede desactivar todo el filtrado.
5. El tratamiento opcional de atípicos retira la cola alta por encima de cinco desviaciones robustas (MAD escalada). La cola baja contiene posibles tránsitos. La estimación de la tendencia puede atenuar un tránsito aun con este tratamiento desactivado.
6. La fase en ciclos es `((t − t₀ + P/2) mod P)/P − 0.5`. El modo guiado usa la época publicada por Huang et al. de **1325,50400 BTJD**. El exploratorio usa la época ajustada del candidato elegido. Las 160 franjas de fase resumen cadencias por mediana. El gráfico conserva las mediciones individuales y permite ver el ciclo completo.

[Lightkurve](https://lightkurve.github.io/lightkurve/) · [Tutorial de recuperación de Pi Mensae](https://lightkurve.github.io/lightkurve/tutorials/3-science-examples/exoplanets-recover-first-tess-candidate.html) · [Huang et al. (2018)](https://doi.org/10.3847/2041-8213/aaef91)

## Búsqueda exploratoria

Astropy `BoxLeastSquares` examina 1–12 d por defecto, con duraciones de `[0.075, 0.10, 0.125, 0.15, 0.20]` d. El espaciado se basa en `autoperiod` con `frequency_factor=1.5` y se añaden los extremos del intervalo. Se maximiza la log-verosimilitud ponderada por la incertidumbre, con `oversample=10`. El máximo es una estimación en una malla. La incertidumbre de profundidad es formal y condicional al modelo y la malla. No incorpora la correlación temporal, la sensibilidad al filtrado ni la incertidumbre de selección del período. No se calcula significancia de detección ni radio planetario. El sistema señala posibles armónicos de orden 2 y 3 en torno al máximo, además de picos de borde del intervalo. [Astropy BoxLeastSquares](https://docs.astropy.org/en/stable/api/astropy.timeseries.BoxLeastSquares.html)

Con la configuración incluida se usaron **18 264 cadencias** y se probaron **6335 períodos**. El máximo quedó en **6,267904764 d**, con profundidad del ajuste de caja **219,0 ppm** (σ formal de 4,2 ppm), duración **3,06 h** y época **1325,503210 BTJD**. Se observaron picos alternativos cerca de la mitad y un tercio del período del máximo. Cualquier cambio de rango, máscara o detrending puede alterar el resultado. La coincidencia del período con el valor publicado no justifica presentar el ajuste simple como una estimación de alta precisión.

## Referencias publicadas y confirmación

- **Huang et al. (2018)** publicaron **6,2679 ± 0,00046 d**, una época de **2458325,50400 BJD** y describieron una caída de alrededor de **300 ppm** en el análisis inicial. El modelo de caja, las cadencias retenidas y la corrección de tendencia de esta demo pueden dar una profundidad distinta. [Artículo de Huang et al.](https://doi.org/10.3847/2041-8213/aaef91)
- **Gandolfi et al. (2018)** publicaron un radio de **2,06 ± 0,03 R⊕** en su análisis combinado con velocidades radiales. [Artículo de Gandolfi et al.](https://doi.org/10.1051/0004-6361/201834289) · [Catálogo de NASA](https://science.nasa.gov/exoplanet-catalog/pi-mensae-c/)

Una binaria eclipsante diluida, el muestreo o un artefacto instrumental pueden generar caídas periódicas. La confirmación del planeta en los estudios de 2018 se apoyó en el análisis fotométrico y las velocidades radiales. La actividad reproduce parte de esa evidencia.
