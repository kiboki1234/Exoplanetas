import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from .validation import CADENCE, SECTOR, TIC, DatasetError, nullable, sha256


ROOT = Path(__file__).resolve().parents[3]
DATA = Path(os.getenv("COSMOS_DATA_DIR", ROOT / "data"))


@dataclass(frozen=True)
class Dataset:
    time: np.ndarray
    flux: np.ndarray
    error: np.ndarray
    quality: np.ndarray
    cadence: np.ndarray
    metadata: dict

    def public_curve(self):
        valid = np.isfinite(self.time) & np.isfinite(self.flux)
        reference = float(np.median(self.flux[valid]))
        return {
            "kind": "observaciones",
            "time": nullable(self.time),
            "flux": nullable(self.flux),
            "error": nullable(self.error),
            "quality": self.quality.tolist(),
            "cadence": self.cadence.tolist(),
            "reference": reference,
            "invalid": int((~(valid & np.isfinite(self.error) & (self.error > 0))).sum()),
        }


def load_dataset() -> Dataset:
    try:
        manifest = DATA / "metadata" / "pi-mensae-sector1.json"
        return _load_dataset(manifest, manifest.stat().st_mtime_ns)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise DatasetError("Respaldo auténtico ausente o ilegible. Ejecuta python -m scripts.prepare_real_data.") from exc


@lru_cache(maxsize=2)
def _load_dataset(manifest: Path, revision: int) -> Dataset:
    metadata = json.loads(manifest.read_text(encoding="utf-8"))
    if (metadata["tic"], metadata["sector"], metadata["cadence_seconds"]) != (TIC, SECTOR, CADENCE):
        raise DatasetError("El manifiesto corresponde a otro TIC, sector o cadencia.")
    digest = metadata["csv_sha256"]
    path = DATA / "real" / f"pi-mensae-sector1-{digest[:12]}.csv"
    if path.name != metadata["csv_file"] or sha256(path) != digest:
        raise DatasetError("El CSV no coincide con la suma SHA-256 del manifiesto.")
    frame = pd.read_csv(path, float_precision="round_trip")
    time, flux, error = (frame[name].to_numpy(float, copy=True) for name in ("time_btjd", "flux", "flux_error"))
    quality, cadence = (frame[name].to_numpy(int, copy=True) for name in ("quality", "cadence"))
    if len(time) != metadata["rows"] or not np.any(np.isfinite(time) & np.isfinite(flux)):
        raise DatasetError("La cantidad de cadencias o el flujo no coincide con el manifiesto.")
    for array in (time, flux, error, quality, cadence):
        array.flags.writeable = False
    return Dataset(time, flux, error, quality, cadence, metadata)
