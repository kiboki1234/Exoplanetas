import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import router
from .science.loader import ROOT
from .science.validation import DatasetError


app = FastAPI(title="COSMOS LAB", version="1.0.0", docs_url=None, redoc_url=None)
app.include_router(router)


@app.exception_handler(DatasetError)
async def dataset_error(_request: Request, error: DatasetError):
    logging.getLogger(__name__).warning("%s", error)
    return JSONResponse({"detail": str(error)}, status_code=503)


@app.exception_handler(ValueError)
async def analysis_error(_request: Request, error: ValueError):
    return JSONResponse({"detail": str(error)}, status_code=422)


@app.exception_handler(RequestValidationError)
async def request_error(_request: Request, error: RequestValidationError):
    messages = [f"{item['loc'][-1]}: {item['msg']}" for item in error.errors()]
    return JSONResponse({"detail": "Parámetros inválidos. " + " · ".join(messages)}, status_code=422)


dist = ROOT / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
