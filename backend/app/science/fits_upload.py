import gzip
import hashlib
from io import BytesIO
from pathlib import PurePosixPath
from zlib import error as CompressionError

import numpy as np
from astropy.io import fits
from astropy.io.fits.verify import VerifyError

from .loader import Dataset


MAX_FITS_BYTES = 32 * 1024 * 1024
FLUX_COLUMN = "PDCSAP_FLUX"
COLUMNS = ("TIME", FLUX_COLUMN, FLUX_COLUMN + "_ERR", "QUALITY", "CADENCENO")


def read_lightcurve(contents: bytes | bytearray, filename: str) -> Dataset:
    if contents.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=BytesIO(contents)) as stream:
                contents = stream.read(MAX_FITS_BYTES + 1)
        except (OSError, EOFError, CompressionError) as exc:
            raise ValueError("El archivo FITS comprimido está dañado.") from exc
    if len(contents) > MAX_FITS_BYTES:
        raise ValueError("El archivo FITS extraído supera el límite de 32 MiB.")
    if not contents.startswith(b"SIMPLE  ="):
        raise ValueError("Selecciona una curva de luz FITS de TESS (archivo _lc.fits o _lc.fits.gz).")

    try:
        with fits.open(BytesIO(contents), memmap=False) as hdus:
            primary = hdus[0].header
            if primary.get("TELESCOP") != "TESS" or primary.get("SIMDATA", False):
                raise ValueError("Selecciona observaciones de TESS en formato FITS.")
            if "LIGHTCURVE" not in hdus:
                raise ValueError("El FITS debe contener una tabla LIGHTCURVE. Usa el producto _lc.fits de MAST.")
            table = hdus["LIGHTCURVE"]
            if not isinstance(table, fits.BinTableHDU) or not set(COLUMNS).issubset(table.columns.names):
                raise ValueError("La curva debe incluir tiempo, flujo PDCSAP, incertidumbre, calidad y cadencia.")
            header = table.header
            if (header.get("TIMESYS"), header.get("TIMEUNIT"), header.get("BJDREFI"), header.get("BJDREFF", 0)) != (
                "TDB", "d", 2457000, 0,
            ):
                raise ValueError("El tiempo de la curva debe estar en días BTJD (BJD en TDB menos 2457000).")
            if any(table.columns[column].unit != "e-/s" for column in COLUMNS[1:3]):
                raise ValueError("El flujo PDCSAP y su incertidumbre deben estar en electrones por segundo.")
            if table.fileinfo()["datLoc"] + table.size > len(contents):
                raise ValueError("El archivo FITS está incompleto.")
            tic, sector = int(primary["TICID"]), int(primary["SECTOR"])
            if tic <= 0 or sector <= 0:
                raise ValueError("El archivo debe identificar la estrella TIC y el sector TESS.")
            time, flux, error = (np.array(table.data[column], dtype=float) for column in COLUMNS[:3])
            quality, cadence = (np.array(table.data[column], dtype=int) for column in COLUMNS[3:])
            if any(array.ndim != 1 for array in (time, flux, error, quality, cadence)):
                raise ValueError("Cada fila del FITS debe representar una medición de la estrella.")
    except (OSError, EOFError, KeyError, IndexError, TypeError, OverflowError, VerifyError) as exc:
        raise ValueError("El FITS está dañado o le faltan metadatos de TESS.") from exc

    valid = np.isfinite(time) & np.isfinite(flux) & np.isfinite(error) & (error > 0)
    times = np.unique(time[valid])
    if len(times) < 20 or np.median(flux[np.isfinite(time) & np.isfinite(flux)]) <= 0:
        raise ValueError("La curva debe tener al menos 20 mediciones válidas y un flujo de referencia positivo.")
    if not 0 < times[0] <= times[-1] < 100000 or np.ptp(times) > 65:
        raise ValueError("El tiempo del FITS no corresponde a una curva BTJD de un solo sector TESS.")
    cadence_seconds = float(header.get("TIMEDEL", np.median(np.diff(times)))) * 86400
    if not np.isfinite(cadence_seconds) or cadence_seconds < 1:
        raise ValueError("La cadencia de observación del FITS no es válida.")

    for array in (time, flux, error, quality, cadence):
        array.flags.writeable = False
    return Dataset(time, flux, error, quality, cadence, {
        "object": str(primary.get("OBJECT") or f"TIC {tic}"), "tic": tic,
        "mission": "TESS", "sector": sector, "cadence_seconds": round(cadence_seconds, 2),
        "product": PurePosixPath(filename.replace("\\", "/")).name,
        "date_obs": str(header.get("DATE-OBS") or primary.get("DATE-OBS") or ""),
        "date_end": str(header.get("DATE-END") or primary.get("DATE-END") or ""),
        "time_label": "BTJD", "start_btjd": float(times[0]), "rows": len(time),
        "flux_column": FLUX_COLUMN, "flux_unit": "e-/s", "fits_sha256": hashlib.sha256(contents).hexdigest(),
        "origin": "archivo_importado", "kind": "observaciones",
    })
