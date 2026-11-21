from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from ..models.requests import Preparation, RequestModel
from ..science import game_observations, game_search
from ..science.game_observations import Aperture


router = APIRouter(prefix="/game", tags=["TESS · juego"])
TargetId = Literal["vela", "vela-sur", "centauro", "centauro-norte", "fenix", "pi-mensae"]
SimulatedTargetId = Literal["vela", "vela-sur", "centauro", "centauro-norte", "fenix"]
Evidence = Literal["period", "parity", "centroid", "slow", "flags"]


class Investigation(RequestModel):
    target: TargetId
    days: Literal[8, 12, 16, 20, 24]
    preparation: Preparation = Field(default_factory=Preparation)
    method: Literal["prepare", "bls", "tls"]
    aperture: Aperture = "standard"


class Report(RequestModel):
    target: TargetId
    conclusion: Literal["candidate", "binary", "moving", "variable", "instrument", "known"]
    evidence: list[Evidence] = Field(min_length=1, max_length=2)
    measured_periods: list[float] = Field(default_factory=list, max_length=2)
    compared_algorithms: bool = False


@router.get("/catalog")
def catalog():
    return game_observations.catalog()


@router.get("/sensor/{target}/{days}")
def sensor(target: SimulatedTargetId, days: Literal["0", "4", "8", "12", "16", "20", "24"],
           aperture: Aperture = "standard"):
    return game_observations.sensor_payload(target, int(days), aperture)


@router.post("/analyze")
def analyze(request: Investigation):
    return game_search.investigate(request.target, request.days, request.preparation, request.method, request.aperture)


@router.post("/report")
def grade(request: Report):
    target = game_observations.TARGETS[request.target]
    correct = request.conclusion == target.conclusion
    supported = target.evidence in request.evidence
    if target.evidence == "period":
        expected = 6.2679 if request.target == "pi-mensae" else 3.6
        supported = supported and any(abs(period - expected) < .15 for period in request.measured_periods)
    return {"score": 2 * int(correct) + 2 * int(supported) + int(request.compared_algorithms),
            "correct": correct, "supported": supported, "explanation": target.explanation}
