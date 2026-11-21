from collections import OrderedDict
from secrets import token_urlsafe
from threading import Lock

from fastapi import HTTPException

from ..science.loader import Dataset, load_dataset


_datasets: OrderedDict[str, Dataset] = OrderedDict()
_lock = Lock()
_capacity = 8


def remember(dataset: Dataset) -> str:
    dataset_id = token_urlsafe(24)
    with _lock:
        _datasets[dataset_id] = dataset
        if len(_datasets) > _capacity:
            _datasets.popitem(last=False)
    return dataset_id


def active_dataset(dataset_id: str | None = None) -> Dataset:
    if dataset_id is None:
        return load_dataset()
    with _lock:
        dataset = _datasets.get(dataset_id)
        if dataset is None:
            raise HTTPException(status_code=404, detail="Vuelve a cargar el FITS para analizarlo en esta sesión.")
        _datasets.move_to_end(dataset_id)
    return dataset
