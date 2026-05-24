from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import Session, select

from mar_api.errors import NotFoundError
from mar_api.models.note import Note
from mar_api.schemas.note import NoteCreate, NoteUpdate


def create_note(session: Session, data: NoteCreate) -> Note:
    note = Note(**data.model_dump())
    session.add(note)
    session.commit()
    session.refresh(note)
    return note


def list_notes(
    session: Session,
    q: str | None = None,
    tag: str | None = None,
) -> list[Note]:
    # q / tag は M4 で実装する。本タスクではシグネチャだけ確定させて noop
    _ = (q, tag)
    return list(session.exec(select(Note)).all())


def get_note(session: Session, note_id: UUID) -> Note:
    note = session.get(Note, note_id)
    if note is None:
        raise NotFoundError("Note", note_id)
    return note


def update_note(session: Session, note_id: UUID, data: NoteUpdate) -> Note:
    note = get_note(session, note_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    note.updated_at = datetime.now(UTC)
    session.add(note)
    session.commit()
    session.refresh(note)
    return note


def delete_note(session: Session, note_id: UUID) -> None:
    note = get_note(session, note_id)
    session.delete(note)
    session.commit()
