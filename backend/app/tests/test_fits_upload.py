import gzip
from io import BytesIO

import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def light_curve_fits():
    time = 3888.0 + np.arange(1400) * 0.02
    phase = (time - 3888.31 + 1.85) % 3.7 - 1.85
    flux = 1000 - 5 * (np.abs(phase) < 0.06)
    columns = [
        fits.Column(name="TIME", format="D", array=time),
        fits.Column(name="PDCSAP_FLUX", format="D", unit="e-/s", array=flux),
        fits.Column(name="PDCSAP_FLUX_ERR", format="D", unit="e-/s", array=np.full(len(time), 0.3)),
        fits.Column(name="QUALITY", format="J", array=np.zeros(len(time), dtype=int)),
        fits.Column(name="CADENCENO", format="J", array=np.arange(len(time))),
    ]
    primary = fits.PrimaryHDU(header=fits.Header({"TELESCOP": "TESS", "TICID": 593228, "SECTOR": 108}))
    table = fits.BinTableHDU.from_columns(columns, name="LIGHTCURVE", header=fits.Header({
        "TIMESYS": "TDB", "TIMEUNIT": "d", "BJDREFI": 2457000, "BJDREFF": 0, "TIMEDEL": 0.02,
    }))
    buffer = BytesIO()
    fits.HDUList([primary, table]).writeto(buffer)
    return buffer.getvalue()


def test_imported_lightcurve_uses_its_own_source_for_all_analyses(light_curve_fits):
    with TestClient(app) as client:
        response = client.post("/api/dataset/import?filename=otro_lc.fits.gz", content=gzip.compress(light_curve_fits))
        assert response.status_code == 201, response.text
        imported = response.json()
        dataset = {"dataset_id": imported["dataset_id"]}
        assert imported["metadata"]["tic"] == 593228
        assert imported["metadata"]["sector"] == 108
        assert imported["metadata"]["origin"] == "archivo_importado"
        assert imported["curve"]["time"][0] == 3888
        prep = {"detrend": False}
        processed = client.post("/api/analysis/preprocess", params=dataset, json=prep)
        assert processed.status_code == 200
        assert processed.json()["time"][0] == 3888
        folded = client.post("/api/analysis/fold", params=dataset, json={"period": 3.7, "epoch": 3888.31, "preparation": prep})
        assert folded.status_code == 200
        assert folded.json()["epoch_btjd"] == 3888.31
        assert min(folded.json()["ppm"]) < -4000
        search = client.post("/api/analysis/bls", params=dataset, json={"minimum": 3.2, "maximum": 4.2, "preparation": prep})
        assert search.status_code == 200, search.text
        assert search.json()["candidates"][0]["period"] == pytest.approx(3.7, abs=0.03)
        assert search.json()["provenance"]["fits_sha256"] == imported["metadata"]["fits_sha256"]
        assert client.get("/api/dataset/metadata").json()["tic"] == 261136679
        assert client.post("/api/analysis/preprocess", json={}).json()["time"][0] < 1360


def test_rejects_non_fits_and_never_falls_back_for_unknown_dataset():
    with TestClient(app) as client:
        invalid = client.post("/api/dataset/import?filename=lista.sh", content=b"#!/bin/sh\n")
        assert invalid.status_code == 422
        assert "curva de luz FITS" in invalid.json()["detail"]
        expired = client.post("/api/analysis/preprocess?dataset_id=unknown", json={})
        assert expired.status_code == 404
