from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func
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
    query = select(Note)
    if q:
        # plainto_tsquery は語ごとに AND を取る (=「a b」は a AND b)。
        # GIN(search_vector) が効くので空白だけの入力でも問題なし。
        query = query.where(
            Note.search_vector.op("@@")(func.plainto_tsquery("simple", q))  # ty: ignore[unresolved-attribute]
        )
    if tag:
        query = query.where(Note.tags.op("@>")([tag]))  # ty: ignore[unresolved-attribute]
    query = query.order_by(Note.created_at.desc())  # ty: ignore[unresolved-attribute]
    return list(session.exec(query).all())


def list_tags(session: Session) -> list[str]:
    # unnest で text[] を行に展開し distinct + sort。GIN(tags) が無くても
    # 全件スキャンになるだけで件数が少ない PoC では十分。
    stmt = select(func.distinct(func.unnest(Note.tags))).order_by(func.unnest(Note.tags))
    return list(session.exec(stmt).all())


def get_note(session: Session, note_id: UUID) -> Note:
    note = session.get(Note, note_id)
    if note is None:
        raise NotFoundError("Note", note_id)
    return note


def update_note(session: Session, note_id: UUID, data: NoteUpdate) -> Note:
    note = get_note(session, note_id)
    # exclude_none で explicit null を無視する。NOT NULL カラム (body/tags) に
    # null を流して 500 になるのを防ぐ。null は「未送信」と同じ扱いとする。
    for key, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
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
