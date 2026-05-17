from sqlalchemy.engine import Engine
from sqlmodel import create_engine

from mar_api.settings import settings


def get_engine() -> Engine:
    return create_engine(settings.database_url)
