from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from mar_api.db import get_session
from mar_api.services import notes as notes_service

router = APIRouter(prefix="/api/tags", tags=["tags"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[str])
def list_tags(session: SessionDep) -> list[str]:
    return notes_service.list_tags(session)
