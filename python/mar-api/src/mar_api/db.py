from functools import lru_cache

from sqlalchemy.engine import Engine
from sqlmodel import create_engine

from mar_api.settings import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url)
