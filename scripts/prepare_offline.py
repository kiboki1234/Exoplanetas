"""Verifica el respaldo científico y precalcula la búsqueda BLS estándar."""

from backend.app.models.requests import SearchRequest
from backend.app.science.bls import search
from backend.app.science.loader import DATA, load_dataset
from backend.app.science.validation import FITS_NAME, sha256


def main():
    dataset = load_dataset()
    if sha256(DATA / "real" / FITS_NAME) != dataset.metadata["fits_sha256"]:
        raise SystemExit("El FITS local no coincide con el manifiesto.")
    result = search(dataset, SearchRequest(recalculate=True), persist=True)
    peak = result["candidates"][0]
    print(f"Respaldo verificado. BLS: {peak['period']:.6f} d, {peak['depth_ppm']:.1f} ppm, "
          f"{peak['duration_hours']:.2f} h. Fuente: {dataset.metadata['source_uri']}")


if __name__ == "__main__":
    main()
