"""Descarga y publica el producto SPOC de Pi Mensae sin descartar cadencias."""

import argparse
import shutil
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import urlretrieve

import astropy.io.fits as fits
import lightkurve as lk
import numpy as np
import pandas as pd
from astroquery.mast import conf as mast_conf

from backend.app.science.loader import DATA, load_dataset
from backend.app.science.validation import CADENCE, FITS_NAME, FITS_SHA256, MAST_URI, MAST_URL, SECTOR, TIC, sha256, write_json


def search_and_download():
    with mast_conf.set_temp("timeout", 12):
        results = lk.search_lightcurve(f"TIC {TIC}", mission="TESS", author="SPOC", sector=SECTOR, exptime=CADENCE)
        if len(results) == 0:
            raise RuntimeError("MAST no devolvió productos TESS SPOC de 120 s para el sector 1.")
        selected = next((index for index, row in enumerate(results.table)
                         if str(row["productFilename"]) == FITS_NAME), None)
        if selected is None:
            raise RuntimeError("La consulta no contiene la versión reproducible del producto SPOC esperado.")
        directory = DATA / "downloads"
        directory.mkdir(parents=True, exist_ok=True)
        downloaded = results[selected].download(quality_bitmask="none", download_dir=str(directory))
        if downloaded is None:
            raise RuntimeError("Lightkurve no pudo descargar el producto.")
    return Path(downloaded.meta["FILENAME"]), MAST_URL, "lightkurve_search"


def prepare_file(path: Path, source: str, method: str):
    fits_digest = sha256(path)
    if fits_digest != FITS_SHA256:
        raise ValueError("El FITS difiere del producto oficial reproducible (SHA-256).")
    with fits.open(path, memmap=False) as hdus:
        hdus.verify("exception")
        header, observations = hdus[0].header, hdus["LIGHTCURVE"]
        timing = observations.header
        if str(header["TELESCOP"]).upper() != "TESS" or int(header["TICID"]) != TIC or int(header["SECTOR"]) != SECTOR:
            raise ValueError("El FITS no corresponde a TESS, TIC 261136679 y sector 1.")
        if bool(header["SIMDATA"]) or not str(header["PROCVER"]).lower().startswith("spoc-"):
            raise ValueError("El FITS no corresponde al producto SPOC esperado.")
        if abs(float(timing["TIMEDEL"]) * 86400 - CADENCE) > 2:
            raise ValueError("El FITS no tiene cadencia de aproximadamente 120 s.")
        if str(timing["TIMESYS"]).upper() != "TDB" or timing["BJDREFI"] + timing.get("BJDREFF", 0) != 2457000:
            raise ValueError("Se requiere BJD_TDB menos 2457000.")
        data = observations.data
        fields = ("TIME", "PDCSAP_FLUX", "PDCSAP_FLUX_ERR", "QUALITY", "CADENCENO")
        frame = pd.DataFrame({label: np.asarray(data[field], dtype=float if index < 3 else int)
                              for index, (label, field) in enumerate(zip(
                                  ("time_btjd", "flux", "flux_error", "quality", "cadence"), fields))})
        if not np.any(np.isfinite(frame["flux"])):
            raise ValueError("No hay mediciones finitas de PDCSAP_FLUX.")
        received = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        provenance = {
            "object": "Pi Mensae", "tic": TIC, "mission": "TESS", "author": "SPOC",
            "sector": SECTOR, "cadence_seconds": CADENCE, "product": FITS_NAME, "source_uri": MAST_URI,
            "source_url": source, "retrieved_utc": received.isoformat(),
            "retrieval_timestamp_basis": "fecha de modificación del archivo recibido",
            "prepared_utc": datetime.now(timezone.utc).isoformat(),
            "retrieval_method": method, "fits_sha256": fits_digest,
            "time_unit": "d", "time_scale": "TDB", "bjd_reference": 2457000, "time_label": "BTJD",
            "date_obs": header.get("DATE-OBS", timing.get("DATE-OBS")),
            "date_end": header.get("DATE-END", timing.get("DATE-END")),
            "start_btjd": float(timing["TSTART"]), "end_btjd": float(timing["TSTOP"]),
            "flux_column": "PDCSAP_FLUX", "error_column": "PDCSAP_FLUX_ERR",
            "flux_unit": observations.columns["PDCSAP_FLUX"].unit, "quality_column": "QUALITY",
            "pipeline": str(header.get("PROCVER", "")), "rows": len(frame),
            "preparation": {"quality_bitmask": "none", "operations": ["exportación literal de cinco columnas"],
                            "search": {"target": f"TIC {TIC}", "mission": "TESS", "author": "SPOC",
                                       "sector": SECTOR, "exptime": CADENCE}},
            "versions": {name: version(name) for name in ("lightkurve", "astropy", "numpy", "pandas", "scipy")},
        }

    real = DATA / "real"
    real.mkdir(parents=True, exist_ok=True)
    fits_backup = real / FITS_NAME
    if path.resolve() != fits_backup.resolve():
        with NamedTemporaryFile(dir=real, delete=False) as stream:
            fits_temp = Path(stream.name)
        try:
            shutil.copyfile(path, fits_temp)
            fits_temp.replace(fits_backup)
        finally:
            fits_temp.unlink(missing_ok=True)
    with NamedTemporaryFile(dir=real, delete=False) as stream:
        csv_temp = Path(stream.name)
    try:
        frame.to_csv(csv_temp, index=False, float_format="%.17g", lineterminator="\n")
        digest = sha256(csv_temp)
        csv_backup = real / f"pi-mensae-sector1-{digest[:12]}.csv"
        csv_temp.replace(csv_backup)
    finally:
        csv_temp.unlink(missing_ok=True)
    provenance.update(csv_file=csv_backup.name, csv_sha256=digest)
    write_json(DATA / "metadata" / "pi-mensae-sector1.json", provenance)
    load_dataset()
    return provenance


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    source = cli.add_mutually_exclusive_group()
    source.add_argument("--fits", type=Path, help="FITS oficial descargado previamente")
    source.add_argument("--direct", action="store_true", help="Usa la URL exacta en archive.stsci.edu")
    args = cli.parse_args()
    if args.fits:
        metadata = prepare_file(args.fits, MAST_URL, "fits_local")
    elif args.direct:
        with NamedTemporaryFile(suffix=".fits", delete=False) as stream:
            path = Path(stream.name)
        try:
            urlretrieve(MAST_URL, path)
            metadata = prepare_file(path, MAST_URL, "mast_direct")
        finally:
            path.unlink(missing_ok=True)
    else:
        metadata = prepare_file(*search_and_download())
    print(f"{metadata['product']} · {metadata['rows']} cadencias · SHA-256 CSV {metadata['csv_sha256']}")


if __name__ == "__main__":
    main()
