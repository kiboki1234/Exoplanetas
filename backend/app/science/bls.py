import hashlib
import json
from importlib.metadata import version

import numpy as np
from astropy.timeseries import BoxLeastSquares
from scipy.signal import find_peaks

from ..models.requests import SearchRequest
from .loader import DATA, Dataset
from .preprocessing import GAP_FACTOR, detrend_window, prepare
from .validation import write_json


CACHE_REVISION = 1
DURATIONS = [0.075, 0.10, 0.125, 0.15, 0.20]
FREQUENCY_FACTOR = 1.5


def search(dataset: Dataset, request: SearchRequest, persist: bool = False):
    parameters = request.model_dump(exclude={"recalculate"})
    checksum_field = "csv_sha256" if "csv_sha256" in dataset.metadata else "fits_sha256"
    provenance = {
        "parameters": parameters, "algorithm": "Astropy BoxLeastSquares",
        "objective": "likelihood", "durations_days": DURATIONS, "frequency_factor": FREQUENCY_FACTOR,
        "oversample": 10, "detrend_window": detrend_window(dataset.metadata["cadence_seconds"]), "gap_factor": GAP_FACTOR,
        checksum_field: dataset.metadata[checksum_field],
        "versions": {name: version(name) for name in ("astropy", "lightkurve", "numpy", "scipy")},
        "cache_revision": CACHE_REVISION,
    }
    digest = hashlib.sha256(json.dumps(provenance, sort_keys=True).encode()).hexdigest()
    path = DATA / "processed" / f"bls-{digest[:16]}.json"
    if not request.recalculate and path.is_file():
        try:
            result = json.loads(path.read_text(encoding="utf-8"))
            if result["provenance"] == provenance:
                return {**result, "cached": True}
        except (OSError, ValueError, KeyError):
            pass
    curve = prepare(dataset, request.preparation)
    baseline = float(np.ptp(curve.time))
    if baseline < 2 * request.minimum:
        raise ValueError("Reduce el período mínimo para cubrir al menos dos ciclos en el intervalo observado.")
    model = BoxLeastSquares(curve.time, curve.flux / curve.baseline, dy=curve.error / curve.baseline)
    period_grid = model.autoperiod(
        DURATIONS, minimum_period=request.minimum, maximum_period=request.maximum, frequency_factor=FREQUENCY_FACTOR,
    )
    periods = np.unique(np.r_[request.minimum, period_grid[(period_grid > request.minimum) &
                                                           (period_grid < request.maximum)], request.maximum])
    power = model.power(periods, DURATIONS, objective="likelihood", method="fast", oversample=10)
    peaks = find_peaks(power.power)[0]
    strongest = int(np.argmax(power.power))
    ranked = sorted(set(map(int, peaks)) | {strongest}, key=lambda index: -power.power[index])
    selected = []
    for index in ranked:
        current = float(power.period[index])
        if any(abs(current - value[1]) < 0.35 * current**2 / baseline for value in selected):
            continue
        selected.append((index, current))
        if len(selected) == 5:
            break
    best = float(power.period[strongest])
    candidates = []
    for index, period in selected:
        ratio = period / best
        alias = next((name for center, name in ((0.5, "P/2"), (1/3, "P/3"), (2, "2P"), (3, "3P"))
                      if abs(ratio / center - 1) < 0.04), None)
        epoch = float(power.transit_time[index])
        duration = float(power.duration[index])
        candidates.append({
            "period": period, "epoch_btjd": epoch, "duration_hours": duration * 24,
            "depth_ppm": float(power.depth[index]) * 1e6,
            "depth_error_ppm": float(power.depth_err[index]) * 1e6,
            "power": float(power.power[index]), "alias": alias,
            "window_edge": index in (0, len(periods) - 1),
        })
    result = {
        "kind": "observaciones_transformadas", "periods": power.period.tolist(), "power": power.power.tolist(),
        "candidates": candidates, "points": len(curve.time), "provenance": provenance,
    }
    if persist:
        write_json(path, result)
    return {**result, "cached": False}
