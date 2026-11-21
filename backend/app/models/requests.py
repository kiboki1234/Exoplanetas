from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Preparation(RequestModel):
    quality: Literal["none", "default", "strict"] = "default"
    normalize: bool = True
    detrend: bool = True
    clip: bool = False


class FoldRequest(RequestModel):
    period: float = Field(ge=0.5, le=15)
    epoch: float
    preparation: Preparation = Field(default_factory=Preparation)


class SearchRequest(RequestModel):
    minimum: float = Field(default=1, ge=0.5, le=13)
    maximum: float = Field(default=12, ge=0.6, le=15)
    preparation: Preparation = Field(default_factory=Preparation)
    recalculate: bool = False

    @model_validator(mode="after")
    def ordered_range(self):
        if self.maximum - self.minimum < 0.05:
            raise ValueError("El rango de búsqueda debe abarcar al menos 0,05 días.")
        return self


class SimulationRequest(RequestModel):
    radius: float = Field(default=0.12, ge=0.02, le=0.22)
    period: float = Field(default=6, ge=2, le=12)
    noise: float = Field(default=0, ge=0, le=2500)
