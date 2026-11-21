# Guion de la demostración · 15 minutos

## Preparación

Enciende el equipo que proyectará. Arranca la distribución local con el script y ejecuta `python -m scripts.check_demo` desde otra terminal con el entorno activo. Usa resolución 1920 × 1080 y escala del navegador al 100 %. Abre la aplicación, pulsa **Reiniciar toda la demostración** y activa **Modo Presentación**. En el ensayo, desactiva la conexión externa y verifica que los gráficos y el análisis sigan funcionando.

| Tiempo | Acción del conferencista | Pregunta o explicación |
| --- | --- | --- |
| 0:00–2:00 | **Simulación.** Deja correr la órbita. Pulsa **Ver tránsito** para detenerla en fase cero. Sube el radio relativo y después el ruido. | «¿Podemos encontrar un planeta invisible?» Aumentar el radio aumenta la superficie ocultada. El detector mide brillo y una caída puede esconderse bajo el ruido. |
| 2:00–4:00 | **Observaciones TESS.** Pulsa **Cargar observaciones reales**. Señala TIC 261136679, sector 1, cadencia y fechas del FITS. | TESS mide brillo muchas veces. SPOC procesa la fotometría y MAST conserva la copia que usamos. La fecha de observación se lee de la cabecera. |
| 4:00–7:00 | **Curva original.** Pide a la audiencia que busque un patrón. Haz zoom en unos días, desplaza la vista y pasa el cursor sobre puntos. Usa **Seleccionar intervalo** en la barra del gráfico y, después, **Restablecer vista**. Cambia el selector a **Variación en ppm**. | Señala un hueco y la leyenda para cadencias señaladas o inválidas. Explica BTJD, electrones por segundo y la incertidumbre. La apariencia irregular explica por qué conviene buscar repeticiones. |
| 7:00–9:00 | **Preparación.** Haz zoom en el primer gráfico y muestra el mismo intervalo en el segundo. Desactiva y reactiva la tendencia. Abre las operaciones y el fragmento **Python equivalente**. | Lee cuántas observaciones se retuvieron. Explica qué corrige el filtro y cómo puede atenuar caídas. Activa **Usar valores iniciales** antes de continuar. |
| 9:00–10:30 | **Plegado orbital.** Comienza con 5 d, prueba otro período y pulsa **Mostrar período publicado**. Alterna entre fase cero y órbita completa. | Superponer vueltas equivale a medir cuán lejos estamos de la misma época dentro de cada órbita. Señala la mediana por fase. |
| 10:30–12:00 | Pulsa **Búsqueda automática**, observa el máximo y sus alternativas. Si hay tiempo, pulsa **Recalcular** y selecciona un candidato para plegarlo. | BLS prueba caídas rectangulares con distintos períodos y duraciones. Un armónico puede tener potencia elevada. El cálculo conserva su resultado aunque no coincida con la referencia. |
| 12:00–14:00 | **Pi Mensae c.** Abre la escena con el selector inferior. Compara los parámetros medidos y los publicados. | Comenta la diferencia entre la profundidad BLS y la escala del artículo. La validación del planeta se apoya también en velocidades radiales. «No descubrimos este planeta hoy. Hemos reproducido parte de la evidencia con herramientas abiertas». |
| 14:00–15:00 | **Conclusiones.** Elige una tarjeta de aplicación cercana a la audiencia. | Pide un ejemplo de una serie temporal conocida por el público. Cierra con «La ciencia empieza con una pregunta. Python nos ayuda a buscar la evidencia». |

Si el análisis completo se demora, usa el caché para la configuración predeterminada y continúa con la selección del mejor candidato. Si la preparación cambió, vuelve a los valores iniciales antes de hacer la búsqueda estándar.
