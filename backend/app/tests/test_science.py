import socket

import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.requests import Preparation, SearchRequest
from backend.app.science.bls import search
from backend.app.science.loader import DATA, load_dataset
from backend.app.science.preprocessing import prepare
from backend.app.science.simulation import generate
from backend.app.science.transit import PUBLISHED_EPOCH, PUBLISHED_PERIOD, phase_fold
from backend.app.science.validation import FITS_NAME, FITS_SHA256, sha256


@pytest.fixture(scope="module")
def real():
    return load_dataset()


def test_offline_data_matches_fits_column_for_column(real):
    path = DATA / "real" / FITS_NAME
    assert sha256(path) == real.metadata["fits_sha256"] == FITS_SHA256
    with fits.open(path) as hdus:
        table = hdus["LIGHTCURVE"].data
        assert not hdus[0].header["SIMDATA"]
        for values, field in zip((real.time, real.flux, real.error, real.quality, real.cadence),
                                 ("TIME", "PDCSAP_FLUX", "PDCSAP_FLUX_ERR", "QUALITY", "CADENCENO")):
            np.testing.assert_array_equal(values, table[field])


def test_preprocessing_options_and_uncertainties(real):
    minimal = prepare(real, Preparation(quality="none", normalize=False, detrend=False))
    defaults = prepare(real, Preparation())
    strict = prepare(real, Preparation(quality="strict", clip=True))
    assert len(real.time) >= len(minimal.time) >= len(defaults.time) >= len(strict.time)
    assert minimal.unit == "e⁻/s"
    assert defaults.unit == "relativo"
    assert np.all(np.isfinite(defaults.flux) & np.isfinite(defaults.error) & (defaults.error > 0))
    assert len(defaults.cadence) == len(defaults.time)
    assert np.median(defaults.flux) == pytest.approx(1, abs=2e-4)
    assert sum(step["removed"] for step in defaults.steps) == len(real.time) - len(defaults.time)


def test_phase_epoch_period_and_trace(real):
    curve = prepare(real, Preparation())
    guided = phase_fold(curve, PUBLISHED_PERIOD, PUBLISHED_EPOCH)
    other = phase_fold(curve, 5, PUBLISHED_EPOCH)
    assert guided["phase"] != other["phase"]
    assert min(guided["phase"]) >= -0.5 and max(guided["phase"]) < 0.5
    assert sum(item[2] for item in guided["bins"]) == len(curve.flux)
    nearest = min(guided["bins"], key=lambda item: abs(item[0]))
    assert nearest[1] < -100


def test_blind_recovery_and_period_grid(real):
    measured = search(real, SearchRequest(recalculate=True))
    cached = search(real, SearchRequest())
    peak = measured["candidates"][0]
    assert abs(peak["period"] - PUBLISHED_PERIOD) < 0.10
    assert 100 < peak["depth_ppm"] < 500
    assert peak["depth_error_ppm"] > 0
    phase = ((peak["epoch_btjd"] - PUBLISHED_EPOCH + PUBLISHED_PERIOD / 2) % PUBLISHED_PERIOD) / PUBLISHED_PERIOD - 0.5
    assert abs(phase) < 0.02
    assert measured["candidates"] == cached["candidates"]
    narrowed = search(real, SearchRequest(minimum=2.8, maximum=3.3))
    assert all(2.8 <= period <= 3.3 for period in narrowed["periods"])
    assert narrowed["candidates"][0]["period"] != peak["period"]


def test_simulation_depth_and_noise_are_separate():
    a = generate(0.1, 6, 0)
    b = generate(0.2, 8, 0)
    noisy = generate(0.1, 6, 500)
    assert a["kind"] == "simulacion"
    assert a["depth_percent"] == pytest.approx(1)
    assert min(a["flux_percent"]) == pytest.approx(99)
    assert min(b["flux_percent"]) == pytest.approx(96)
    assert b["time"][0] == -4
    assert a["flux_percent"] != noisy["flux_percent"]
    assert noisy == generate(0.1, 6, 500)


def test_api_runs_with_external_network_blocked(monkeypatch):
    original_connect = socket.socket.connect

    def only_local(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6) and address[0] not in ("127.0.0.1", "::1"):
            raise AssertionError(f"Conexión externa durante la demo: {address}")
        return original_connect(sock, address)

    monkeypatch.setattr(socket.socket, "connect", only_local)
    monkeypatch.setenv("COSMOS_ALLOW_MAST", "0")
    with TestClient(app) as client:
        assert client.get("/api/health").json()["dataset_ready"]
        assert client.get("/api/dataset/metadata").json()["origin"] == "disco_local"
        assert client.get("/api/dataset/lightcurve").json()["kind"] == "observaciones"
        assert client.post("/api/dataset/refresh").json()["refresh"] == "offline"
        for path, body in (
            ("analysis/preprocess", {}), ("analysis/fold", {"period": 6, "epoch": 1325.504}),
            ("analysis/bls", {"recalculate": True}), ("simulator/generate", {}),
        ):
            assert client.post("/api/" + path, json=body).status_code == 200
        assert client.post("/api/analysis/bls", json={"minimum": 4, "maximum": 3}).status_code == 422


def test_archive_error_falls_back_and_missing_data_returns_503(monkeypatch, tmp_path):
    from scripts import prepare_real_data
    from backend.app.science import loader

    def offline():
        raise OSError("MAST temporalmente inaccesible")

    monkeypatch.setenv("COSMOS_ALLOW_MAST", "1")
    monkeypatch.setattr(prepare_real_data, "search_and_download", offline)
    with TestClient(app) as client:
        response = client.post("/api/dataset/refresh")
        assert response.json()["refresh"] == "fallback"
        assert response.json()["kind"] == "observaciones"
        monkeypatch.setattr(loader, "DATA", tmp_path)
        assert client.get("/api/dataset/lightcurve").status_code == 503
        assert client.post("/api/dataset/refresh").status_code == 503
        assert not client.get("/api/health").json()["dataset_ready"]
