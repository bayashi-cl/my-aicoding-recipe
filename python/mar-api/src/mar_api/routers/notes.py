from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from mar_api.db import get_session
from mar_api.models.note import Note
from mar_api.schemas.note import NoteCreate, NoteRead, NoteUpdate
from mar_api.services import notes as notes_service

router = APIRouter(prefix="/api/notes", tags=["notes"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteCreate, session: SessionDep) -> Note:
    return notes_service.create_note(session, data)


@router.get("", response_model=list[NoteRead])
def list_notes(
    session: SessionDep,
    q: str | None = None,
    tag: str | None = None,
) -> list[Note]:
    return notes_service.list_notes(session, q=q, tag=tag)


@router.get("/{note_id}", response_model=NoteRead)
def get_note(note_id: UUID, session: SessionDep) -> Note:
    return notes_service.get_note(session, note_id)


@router.put("/{note_id}", response_model=NoteRead)
def update_note(note_id: UUID, data: NoteUpdate, session: SessionDep) -> Note:
    return notes_service.update_note(session, note_id, data)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: UUID, session: SessionDep) -> None:
    notes_service.delete_note(session, note_id)
