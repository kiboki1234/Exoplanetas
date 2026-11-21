import numpy as np

from .preprocessing import Processed


PUBLISHED_PERIOD = 6.2679
PUBLISHED_EPOCH = 1325.50400


def phase_fold(curve: Processed, period: float, epoch: float):
    phase = ((curve.time - epoch + period / 2) % period) / period - 0.5
    order = np.argsort(phase, kind="stable")
    ppm = (curve.flux / curve.baseline - 1) * 1e6
    error_ppm = curve.error / curve.baseline * 1e6
    indices = np.minimum(159, ((phase + 0.5) * 160).astype(int))
    bins = []
    for index in np.unique(indices):
        in_bin = indices == index
        bins.append([float(np.median(phase[in_bin])), float(np.median(ppm[in_bin])), int(in_bin.sum())])
    return {
        "kind": "observaciones_transformadas",
        "phase": phase[order].tolist(),
        "ppm": ppm[order].tolist(),
        "error_ppm": error_ppm[order].tolist(),
        "bins": bins, "period": period, "epoch_btjd": epoch,
    }
