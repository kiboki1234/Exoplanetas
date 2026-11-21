from dataclasses import dataclass

import lightkurve as lk
import numpy as np
from astropy.stats import mad_std
from lightkurve.utils import TessQualityFlags

from ..models.requests import Preparation
from .loader import Dataset
from .validation import CADENCE, nullable


WINDOW = 1001
GAP_FACTOR = 5
CLIP_SIGMA = 5
MASKS = {"none": 0, "default": TessQualityFlags.DEFAULT_BITMASK, "strict": TessQualityFlags.HARD_BITMASK}


def detrend_window(cadence_seconds: float) -> int:
    # Preserve the time span of the demo filter across TESS cadence products.
    return max(5, 2 * round((WINDOW * CADENCE / cadence_seconds - 1) / 2) + 1)


@dataclass
class Processed:
    time: np.ndarray
    flux: np.ndarray
    error: np.ndarray
    cadence: np.ndarray
    reference: float
    baseline: float
    unit: str
    steps: list
    code: str

    def payload(self):
        return {
            "kind": "observaciones_transformadas",
            "time": self.time.tolist(),
            "flux": nullable(self.flux),
            "error": nullable(self.error),
            "cadence": self.cadence.tolist(),
            "unit": self.unit,
            "reference": self.reference,
            "baseline": self.baseline,
            "steps": self.steps,
            "code": self.code,
        }


def prepare(dataset: Dataset, options: Preparation) -> Processed:
    steps = []

    def record(operation, enabled, before, after, parameters, purpose, risk):
        steps.append(dict(operation=operation, enabled=enabled, preserved=after, removed=before-after,
                          parameters=parameters, purpose=purpose, risk=risk))

    valid = np.isfinite(dataset.time) & np.isfinite(dataset.flux) & np.isfinite(dataset.error) & (dataset.error > 0)
    count = int(valid.sum())
    record("Valores válidos", True, len(valid), count, "TIME y PDCSAP finitos; σ > 0",
           "Selecciona mediciones utilizables por el ajuste ponderado.", "Los huecos permanecen sin interpolar.")
    mask = MASKS[options.quality]
    keep = valid & ((dataset.quality & mask) == 0)
    kept = int(keep.sum())
    record("Calidad SPOC", bool(mask), count, kept, f"Bits decimales: {mask}",
           "Excluye cadencias según sus indicadores.", "Una máscara estricta reduce la cobertura temporal.")
    if kept < 20:
        raise ValueError("Quedaron menos de 20 observaciones válidas.")
    order = np.flatnonzero(keep)
    order = order[np.argsort(dataset.time[order], kind="stable")]
    reference = float(np.median(dataset.flux[order]))
    if reference <= 0:
        raise ValueError("La referencia mediana del flujo debe ser positiva.")
    lc = lk.LightCurve(time=dataset.time[order], flux=dataset.flux[order], flux_err=dataset.error[order])
    code = ["valid = finite_time & finite_flux & finite_error & (error > 0)",
            f"keep = valid & ((quality & {mask}) == 0)", "lc = lightcurve[keep]"]
    if options.normalize:
        lc = lc.normalize()
        code.append("lc = lc.normalize()  # Mediana global")
    record("Normalización", options.normalize, kept, kept, f"Mediana: {reference:.3f} e⁻/s",
           "Expresa el flujo respecto a un nivel de referencia.", "Una mediana global puede ocultar cambios absolutos.")
    window = detrend_window(dataset.metadata["cadence_seconds"])
    if options.detrend:
        flat = lc.flatten(window_length=window, polyorder=2, break_tolerance=GAP_FACTOR, niters=1, sigma=5)
        code.append(f"lc = lc.flatten({window}, polyorder=2, break_tolerance={GAP_FACTOR}, niters=1, sigma=5)")
        lc = flat if options.normalize else lk.LightCurve(time=flat.time, flux=flat.flux * reference,
                                                          flux_err=flat.flux_err * reference)
        if not options.normalize:
            code.append("lc.flux *= reference; lc.flux_err *= reference")
        valid_flat = np.isfinite(lc.flux.value) & np.isfinite(lc.flux_err.value) & (lc.flux_err.value > 0)
        lc, order = lc[valid_flat], order[valid_flat]
    filtered = len(lc)
    hours = window * dataset.metadata["cadence_seconds"] / 3600
    record("Tendencia lenta", options.detrend, kept, filtered, f"Savitzky–Golay · {window} muestras (~{hours:.1f} h) · orden 2 · huecos > {GAP_FACTOR} cadencias",
           "Divide el flujo por una tendencia local estimada.", "Puede atenuar el tránsito o distorsionar bordes de huecos.")
    if options.clip and filtered:
        flux = np.asarray(lc.flux.value)
        high = flux > np.median(flux) + CLIP_SIGMA * mad_std(flux)
        lc, order = lc[~high], order[~high]
        code.append("lc = lc[flux <= median(flux) + 5 * mad_std(flux)]")
    record("Valores atípicos", options.clip, filtered, len(lc), "Solo cola alta · 5 σ robustas (MAD)",
           "Excluye excursiones positivas extremas.", "Puede retirar aumentos de brillo genuinos. Conserva la cola baja.")
    if len(lc) < 20:
        raise ValueError("La preparación dejó menos de 20 mediciones válidas. Prueba con un filtro menos restrictivo.")
    return Processed(
        np.asarray(lc.time.value), np.asarray(lc.flux.value), np.asarray(lc.flux_err.value), dataset.cadence[order],
        reference, 1.0 if options.normalize else reference, "relativo" if options.normalize else "e⁻/s", steps,
        "\n".join(code),
    )
