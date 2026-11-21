import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_detector_flux_is_measured_from_pixels_and_bls_recovers_simulated_orbit():
    frame = client.get("/api/game/sensor/vela/24").json()
    assert len(frame["time"]) + frame["missing"] == 1153
    assert max(np.diff(frame["time"])) > .65
    pixels = np.asarray(frame["counts"])
    np.testing.assert_array_equal(np.median(pixels[:, frame["background_mask"]], axis=1), frame["background"])
    np.testing.assert_array_equal((pixels[:, frame["aperture"]] - np.asarray(frame["background"])[:, None]).sum(axis=1), frame["flux"])
    assert min(frame["error"]) > 0
    response = client.post("/api/game/analyze", json={"target": "vela", "days": 24, "method": "bls"})
    assert response.is_success
    assert abs(response.json()["fit"]["period"] - 3.6) < .06


def test_alternative_explanations_have_measurable_cues():
    def analyze(target, method="prepare"):
        response = client.post("/api/game/analyze", json={"target": target, "days": 24, "method": method})
        assert response.is_success
        return response.json()

    binary = analyze("vela-sur", "bls")
    assert abs(2 * binary["fit"]["period"] - 4.8) < .06
    assert abs(binary["parity"][0] - binary["parity"][1]) > 7000
    assert analyze("centauro")["centroid"] > analyze("vela")["centroid"] * 3
    assert analyze("centauro-norte")["slow_span"] > 4 * analyze("vela")["slow_span"]
    instrumental = analyze("fenix")
    assert instrumental["flags"] >= 5
    assert instrumental["original_points"] - instrumental["points"] == instrumental["flags"]


def test_aperture_reuses_exposures_but_changes_extracted_flux():
    narrow = client.get("/api/game/sensor/centauro/24?aperture=narrow").json()
    wide = client.get("/api/game/sensor/centauro/24?aperture=wide").json()
    early = client.get("/api/game/sensor/centauro/4?aperture=wide").json()
    assert narrow["counts"] == wide["counts"]
    assert len(early["counts"]) == 193
    assert early["counts"] == wide["counts"][:193]
    assert sum(narrow["aperture"]) < sum(wide["aperture"])
    assert wide["flux"] != narrow["flux"]
    assert client.get("/api/game/sensor/centauro/24?aperture=invalid").status_code == 422


def test_report_requires_period_evidence_and_sensor_rejects_real_target():
    assert client.get("/api/game/sensor/pi-mensae/24").status_code == 422
    assert client.get("/api/game/sensor/vela/99").status_code == 422
    statement = {"target": "pi-mensae", "conclusion": "known", "evidence": ["period"], "compared_algorithms": True}
    unsupported = client.post("/api/game/report", json={**statement, "measured_periods": [5]}).json()
    supported = client.post("/api/game/report", json={**statement, "measured_periods": [6.269]}).json()
    assert not unsupported["supported"]
    assert supported["correct"] and supported["supported"] and supported["score"] == 5
