from functools import lru_cache
from threading import Lock

import numpy as np

from ..models.requests import Preparation, SearchRequest
from . import bls, transit
from .game_observations import simulated_observation
from .loader import load_dataset
from .preprocessing import prepare
from .validation import DatasetError, nullable


TLS_LOCK = Lock()


def _search_tls(curve, maximum):
    try:
        from transitleastsquares import transitleastsquares
    except ImportError as exc:
        raise DatasetError("TLS no está instalado. Instala las dependencias de backend/requirements.txt.") from exc
    # Positive normalized flux is required by TLS. Ten-minute inverse-variance bins
    # bound the work for authentic two-minute data and preserve multi-hour dips.
    flux = curve.flux / curve.baseline
    keep = flux > 0
    time, flux, error = curve.time[keep], flux[keep], curve.error[keep] / curve.baseline
    bins = ((time - time[0]) * 144).astype(int)
    _, groups = np.unique(bins, return_inverse=True)
    weights = 1 / error**2
    totals = np.bincount(groups, weights)
    averaged_time = np.bincount(groups, time * weights) / totals
    averaged_flux = np.bincount(groups, flux * weights) / totals
    result = transitleastsquares(averaged_time, averaged_flux, 1 / np.sqrt(totals)).power(
        period_min=1, period_max=maximum, n_transits_min=2, oversampling_factor=3,
        use_threads=1, verbose=False, show_progress_bar=False,
    )
    power = np.asarray(result.power, dtype=float)
    valid = np.isfinite(result.period) and np.isfinite(result.T0) and result.duration > 0
    return {
        "periods": result.periods.tolist(), "power": nullable(power),
        "fit": {
            "period": float(result.period), "epoch": float(result.T0),
            "duration": float(result.duration), "depth": float(1 - result.depth) * 1e6,
        } if valid else None,
        "count": len(averaged_time),
    }


def _parity(curve, fit):
    if not fit:
        return None
    cycles = (curve.time - fit["epoch"]) / fit["period"]
    rounded = np.rint(cycles)
    inside = np.abs(cycles - rounded) * fit["period"] < fit["duration"] / 2
    depth = (1 - curve.flux / curve.baseline) * 1e6
    groups = [depth[inside & (rounded % 2 == parity)] for parity in (0, 1)]
    if any(len(group) < 3 for group in groups):
        return None
    return [float(np.median(group)) for group in groups]


def investigate(target, days, options, method, aperture):
    dataset, offset = (load_dataset(), None) if target == "pi-mensae" else _simulation(target, days, aperture)
    if method == "tls":
        # Serializing TLS keeps simultaneous browser requests from duplicating JIT work.
        with TLS_LOCK:
            return _cached_tls(target, days, options.model_dump_json(), dataset.metadata.get("csv_sha256", "sim"), aperture)
    return _analyze(dataset, offset, options, method)


def _simulation(target, days, aperture):
    dataset, _, offset, _ = simulated_observation(target, days, aperture)
    return dataset, offset


@lru_cache(maxsize=24)
def _cached_tls(target, days, options, dataset_revision, aperture):
    dataset, offset = (load_dataset(), None) if target == "pi-mensae" else _simulation(target, days, aperture)
    return _analyze(dataset, offset, Preparation.model_validate_json(options), "tls")


def _analyze(dataset, offset, options, method):
    curve = prepare(dataset, options)
    maximum = min(10, float(np.ptp(curve.time)) / 2)
    if method == "prepare":
        stride = max(1, len(dataset.time) // 1600)
        valid = np.isfinite(dataset.time) & np.isfinite(dataset.flux)
        raw = dataset.flux[valid]
        reference = float(np.median(raw))
        raw_ppm = (raw / reference - 1) * 1e6
        flags = dataset.quality[valid] != 0
        days = np.floor(dataset.time[valid])
        daily = [np.median(raw_ppm[(days == day) & ~flags]) for day in np.unique(days[~flags])]
        cleaned = curve.flux / curve.baseline
        return {
            "raw": {"time": dataset.time[valid][::stride].tolist(), "values": raw_ppm[::stride].tolist()},
            "clean": {"time": curve.time[::stride].tolist(), "values": cleaned[::stride].tolist() if options.normalize
                      else curve.flux[::stride].tolist()},
            "points": len(curve.time), "original_points": len(dataset.time), "steps": curve.steps, "code": curve.code,
            "flags": int(flags.sum()), "flag_excursion": float(np.max(np.abs(raw_ppm[flags]))) if flags.any() else None,
            "centroid": float(np.max(offset)) if offset is not None else None,
            "slow_span": float(np.percentile(daily, 90) - np.percentile(daily, 10)) if daily else None,
            "unit": curve.unit,
        }
    if method == "bls":
        result = bls.search(dataset, SearchRequest(minimum=1, maximum=maximum, preparation=options))
        best = result["candidates"][0]
        search = {
            "periods": result["periods"], "power": result["power"], "count": len(curve.time),
            "fit": {"period": best["period"], "epoch": best["epoch_btjd"],
                    "duration": best["duration_hours"] / 24, "depth": best["depth_ppm"]},
        }
    else:
        search = _search_tls(curve, maximum)
    fit = search["fit"]
    folded = transit.phase_fold(curve, fit["period"], fit["epoch"])["bins"] if fit else []
    secondary = None
    if fit:
        phase = (curve.time - fit["epoch"]) / fit["period"] % 1
        halfway = np.abs(phase - .5) * fit["period"] < fit["duration"] / 2
        if int(halfway.sum()) >= 3:
            secondary = float(np.median(1 - curve.flux[halfway] / curve.baseline) * 1e6)
    return {
        **search, "method": method, "folded": folded, "parity": _parity(curve, fit),
        "limits": [1, maximum], "secondary_depth": secondary,
    }
