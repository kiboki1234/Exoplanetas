"""Comprueba el flujo local de la demostración sin acceder a MAST."""

import argparse
import json
from urllib.request import Request, urlopen


def run(url: str, health_only: bool):
    def api(path: str, body=None):
        request = Request(f"{url}/api/{path}", data=json.dumps(body).encode() if body is not None else None,
                          headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=35) as response:
            return json.load(response)

    health = api("health")
    if health["status"] != "ok" or not health["dataset_ready"]:
        raise SystemExit("La API responde, pero falta el respaldo auténtico.")
    if health_only:
        return
    with urlopen(url, timeout=10) as response:
        if "COSMOS LAB" not in response.read().decode():
            raise SystemExit("La compilación de la interfaz no está disponible.")
    source = api("dataset/metadata")
    raw = api("dataset/lightcurve")
    if source["tic"] != 261136679 or raw["kind"] != "observaciones" or len(raw["time"]) != source["rows"]:
        raise SystemExit("Los datos locales no corresponden a Pi Mensae.")
    sample = api("simulator/generate", {"radius": 0.12, "period": 6, "noise": 0})
    if sample["kind"] != "simulacion" or abs(sample["depth_percent"] - 1.44) > 1e-8:
        raise SystemExit("Falló la comprobación de la simulación.")
    processed = api("analysis/preprocess", {})
    fold = api("analysis/fold", {"period": 6.2679, "epoch": 1325.504})
    bls = api("analysis/bls", {"recalculate": True})
    peak = bls["candidates"][0]
    print(f"FITS verificado · {source['rows']} cadencias · {len(processed['time'])} utilizables")
    print(f"Plegado: {len(fold['bins'])} intervalos · BLS: {peak['period']:.6f} d · {peak['depth_ppm']:.1f} ppm")
    print("API local y distribución web verificadas.")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", default="http://127.0.0.1:8000")
    cli.add_argument("--health-only", action="store_true")
    args = cli.parse_args()
    run(args.url.rstrip("/"), args.health_only)
