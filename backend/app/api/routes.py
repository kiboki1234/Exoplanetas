import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from ..models.requests import FoldRequest, Preparation, SearchRequest, SimulationRequest
from ..science import bls, simulation, transit
from ..science.fits_upload import MAX_FITS_BYTES, read_lightcurve
from ..science.loader import Dataset, load_dataset
from ..science.preprocessing import prepare
from ..science.validation import DatasetError
from .imported import active_dataset, remember


router = APIRouter(prefix="/api")
Observations = Annotated[Dataset, Depends(active_dataset)]


@router.get("/health")
def health():
    try:
        load_dataset()
        ready = True
    except DatasetError:
        ready = False
    return {"status": "ok", "dataset_ready": ready, "network": "offline"}


@router.get("/dataset/metadata")
def metadata():
    return {**load_dataset().metadata, "origin": "disco_local", "kind": "observaciones"}


@router.get("/dataset/lightcurve")
def lightcurve():
    return load_dataset().public_curve()


@router.post("/dataset/import", status_code=201)
async def import_observations(request: Request, filename: Annotated[str, Query(min_length=1, max_length=255)]):
    contents = bytearray()
    async for chunk in request.stream():
        if len(contents) + len(chunk) > MAX_FITS_BYTES:
            raise HTTPException(status_code=413, detail="El archivo FITS supera el límite de 32 MiB.")
        contents.extend(chunk)
    dataset = await run_in_threadpool(read_lightcurve, contents, filename)
    curve = await run_in_threadpool(dataset.public_curve)
    return {"dataset_id": remember(dataset), "metadata": dataset.metadata, "curve": curve}


@router.post("/analysis/preprocess")
def preprocess(options: Preparation, dataset: Observations):
    return prepare(dataset, options).payload()


@router.post("/analysis/fold")
def fold(request: FoldRequest, dataset: Observations):
    return transit.phase_fold(prepare(dataset, request.preparation), request.period, request.epoch)


@router.post("/analysis/bls")
def search(request: SearchRequest, dataset: Observations):
    return bls.search(dataset, request)


@router.post("/simulator/generate")
def simulate(request: SimulationRequest):
    return simulation.generate(request.radius, request.period, request.noise)


@router.post("/dataset/refresh")
def refresh():
    try:
        if os.getenv("COSMOS_ALLOW_MAST") != "1":
            return {**metadata(), "refresh": "offline"}
        from scripts.prepare_real_data import prepare_file, search_and_download

        prepare_file(*search_and_download())
        return {**metadata(), "refresh": "mast"}
    except Exception as exc:
        try:
            return {**metadata(), "refresh": "fallback", "refresh_detail": str(exc)}
        except DatasetError:
            raise DatasetError(f"MAST no está disponible y falta un respaldo válido. {exc}") from exc
