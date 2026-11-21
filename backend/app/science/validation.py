import hashlib
import json
from pathlib import Path

import numpy as np


TIC = 261136679
SECTOR = 1
CADENCE = 120
FITS_NAME = "tess2018206045859-s0001-0000000261136679-0120-s_lc.fits"
FITS_SHA256 = "1eecffff3afa7e8c4ad763b6907e62447bacf339968292d86be45acd9bf1d609"
MAST_URI = f"mast:TESS/product/{FITS_NAME}"
MAST_URL = f"https://archive.stsci.edu/missions/tess/tid/s0001/0000/0002/6113/6679/{FITS_NAME}"


class DatasetError(RuntimeError):
    """El respaldo no cumple el contrato de procedencia."""


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path: Path, data: dict):
    from tempfile import NamedTemporaryFile

    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        temp = Path(stream.name)
        json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    try:
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def nullable(values):
    return [float(value) if np.isfinite(value) else None for value in values]
