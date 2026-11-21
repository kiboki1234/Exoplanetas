import numpy as np


def generate(radius: float, period: float, noise: float):
    phase = np.linspace(-0.5, 0.5, 501)
    angle = phase * 2 * np.pi
    x = 2.65 * np.sin(angle)
    separation = np.abs(x)
    ingress = np.clip((1 + radius - separation) / (2 * radius), 0, 1)
    occultation = np.where(np.cos(angle) > 0, ingress, 0)
    rng = np.random.default_rng(21)
    flux = 100 * (1 - radius**2 * occultation) + rng.normal(0, noise / 1e4, len(phase))
    return {
        "kind": "simulacion",
        "time": (phase * period).tolist(),
        "flux_percent": flux.tolist(),
        "depth_percent": radius**2 * 100,
        "period": period, "radius": radius, "noise_ppm": noise,
    }
