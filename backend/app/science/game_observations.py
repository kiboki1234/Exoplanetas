from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

import numpy as np
from scipy.special import ndtr

from .loader import Dataset


@dataclass(frozen=True)
class Target:
    name: str
    sector: str
    longitude: float
    latitude: float
    color: str
    conclusion: str
    evidence: str
    explanation: str


TARGETS = {
    "vela": Target("Vela 01", "Vela", 24, -8, "#9eeaff", "candidate", "period",
                   "La caída corta se repite con profundidad similar cada 3,6 días. Es una señal candidata de la simulación."),
    "vela-sur": Target("Vela 04", "Vela", 46, -18, "#ffd4a9", "binary", "parity",
                       "Hay dos eclipses de distinta profundidad por vuelta. El período entre eclipses primarios es de 4,8 días."),
    "centauro": Target("Centauro 11", "Centauro", 146, 12, "#beadff", "moving", "centroid",
                       "Una fuente móvil cruza la apertura y altera el brillo medido. Su luz se desplaza en el detector."),
    "centauro-norte": Target("Centauro 18", "Centauro", 172, 25, "#fca17d", "variable", "slow",
                             "El brillo oscila suavemente a lo largo de varios días. En esta simulación la propia estrella varía."),
    "fenix": Target("Fénix 07", "Fénix", 273, -25, "#b8ddff", "instrument", "flags",
                    "Las excursiones intensas coinciden con cadencias marcadas por el instrumento. El filtro de calidad las retira."),
    "pi-mensae": Target("Pi Mensae", "Sector 1 · TESS", 84.29, -80.47, "#ffcf95", "known", "period",
                        "Contrastaste observaciones archivadas con la señal conocida de Pi Mensae c, publicada con un período de aproximadamente 6,27 días."),
}

SAMPLES_PER_DAY = 48
MISSION_DAYS = 24
SIDE = 7
PIXEL_Y, PIXEL_X = np.mgrid[:SIDE, :SIDE] - SIDE // 2
RADIUS_SQUARED = PIXEL_X**2 + PIXEL_Y**2
Aperture = Literal["narrow", "standard", "wide"]
APERTURES = {"narrow": RADIUS_SQUARED <= 1, "standard": RADIUS_SQUARED <= 2, "wide": RADIUS_SQUARED <= 5}
BACKGROUND = RADIUS_SQUARED >= 10
READ_NOISE = 12.0
SCALE_ARCSEC = 21
GAP = (13.67, 14.33)


def catalog():
    return [{"id": key, "name": target.name, "sector": target.sector, "longitude": target.longitude,
             "latitude": target.latitude, "color": target.color, "real": key == "pi-mensae"}
            for key, target in TARGETS.items()]


def _dip(time, period, epoch, depth):
    # Average over each exposure and approximate limb darkening along a central chord.
    sample = time[:, None] + np.linspace(-.4, .4, 5) / SAMPLES_PER_DAY
    distance = np.abs((sample - epoch + period / 2) % period - period / 2)
    radius = np.sqrt(depth)
    separation = (1 + radius) * distance / .105
    fraction = np.clip((1 + radius - separation) / (2 * radius), 0, 1)
    coverage = fraction**2 * (3 - 2 * fraction)
    limb_brightness = 1 - .48 * (1 - np.sqrt(np.clip(1 - separation**2, 0, 1)))
    return depth * np.mean(coverage * limb_brightness, axis=1)


def _pixel_response(x, y, width):
    dx = PIXEL_X - x[:, None, None]
    dy = PIXEL_Y - y[:, None, None]
    return ((ndtr((dx + .5) / width) - ndtr((dx - .5) / width))
            * (ndtr((dy + .5) / width) - ndtr((dy - .5) / width)))


@lru_cache(maxsize=5)
def _exposures(target_id: str):
    target = TARGETS[target_id]
    cadences = np.arange(MISSION_DAYS * SAMPLES_PER_DAY + 1)
    time = cadences / SAMPLES_PER_DAY
    rng = np.random.default_rng(list(TARGETS).index(target_id) + 2026)
    pointing_x = .024 * np.sin(2 * np.pi * time / 1.11) + rng.normal(0, .003, len(time))
    pointing_y = .027 * np.cos(2 * np.pi * time / 1.35) + rng.normal(0, .003, len(time))
    brightness = np.ones_like(time)
    quality = np.zeros(time.shape, dtype=int)
    if target.conclusion == "candidate":
        brightness -= _dip(time, 3.6, 1.2, 0.012)
    elif target.conclusion == "binary":
        brightness -= _dip(time, 4.8, 1.2, 0.021) + _dip(time, 4.8, 3.6, 0.009)
    elif target.conclusion == "variable":
        brightness += 0.011 * np.sin(2 * np.pi * time / 5.2)
    elif target.conclusion == "instrument":
        anomaly = ((cadences - 72) % 178 <= 1) & (cadences >= 72)
        quality[anomaly] = 32
        pointing_x[anomaly] += .92
        pointing_y[anomaly] -= .36
    sky_background = 350 + 110 * np.sin(2 * np.pi * time / 13.7)**2
    pixels = sky_background[:, None, None] + 1_700_000 * brightness[:, None, None] * _pixel_response(
        pointing_x, pointing_y, .76)
    if target.conclusion == "moving":
        passages = np.array([3.5, 7.5, 12.5, 16.5, 21.5])
        nearest = time - passages[np.abs(time[:, None] - passages).argmin(axis=1)]
        pixels += 215_000 * _pixel_response(8 * nearest, np.full_like(time, -1.55), .72)
    pixels = np.maximum(0, np.rint(rng.poisson(pixels) + rng.normal(0, READ_NOISE, pixels.shape))).astype(np.int32)
    observed = (time < GAP[0]) | (time > GAP[1])
    return time[observed], pixels[observed], quality[observed], cadences[observed]


def simulated_observation(target_id: str, days: int, aperture: Aperture = "standard"):
    time, pixels, quality, cadence = _exposures(target_id)
    end = np.searchsorted(time, days, side="right")
    time, pixels, quality, cadence = time[:end], pixels[:end], quality[:end], cadence[:end]
    mask = APERTURES[aperture]
    background = np.median(pixels[:, BACKGROUND], axis=1)
    counts = pixels[:, mask].sum(axis=1)
    flux = counts - mask.sum() * background
    background_variance = np.pi / 2 * (background + READ_NOISE**2) / BACKGROUND.sum()
    errors = np.sqrt(counts + mask.sum() * READ_NOISE**2 + mask.sum()**2 * background_variance)
    dataset = Dataset(time, flux, errors, quality, cadence, {
        "cadence_seconds": 86400 / SAMPLES_PER_DAY,
        "fits_sha256": f"game-v2-{target_id}-{days}-{aperture}",
    })
    light = np.maximum(0, pixels - background[:, None, None])
    center_x = (light * PIXEL_X).sum(axis=(1, 2)) / light.sum(axis=(1, 2))
    center_y = (light * PIXEL_Y).sum(axis=(1, 2)) / light.sum(axis=(1, 2))
    return dataset, pixels, np.hypot(center_x, center_y), background


def sensor_payload(target_id: str, days: int, aperture: Aperture):
    dataset, pixels, offset, background = simulated_observation(target_id, days, aperture)
    return {
        "time": dataset.time.tolist(), "counts": pixels.reshape(-1, SIDE * SIDE).tolist(),
        "flux": dataset.flux.tolist(), "flags": dataset.quality.tolist(), "offset": offset.tolist(),
        "side": SIDE, "aperture": APERTURES[aperture].ravel().tolist(), "background": background.tolist(),
        "background_mask": BACKGROUND.ravel().tolist(), "error": dataset.error.tolist(),
        "cadence_minutes": 1440 // SAMPLES_PER_DAY, "pixel_arcsec": SCALE_ARCSEC,
        "missing": int(days * SAMPLES_PER_DAY + 1 - len(dataset.time)),
    }
