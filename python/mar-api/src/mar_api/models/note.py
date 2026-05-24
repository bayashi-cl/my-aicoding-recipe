from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import DDL, Column, Computed, DateTime, Index, String, event
from sqlalchemy.dialects.postgresql import ARRAY, TSVECTOR
from sqlmodel import Field, SQLModel

# title / body / tags から DB が自動算出する PostgreSQL generated column。
# 実体の SQL 関数 notes_search_vector はマイグレーション
# (mar_migrate/versions/202605241319_*.py) で CREATE しているが、テスト時の
# SQLModel.metadata.create_all() でも同じ関数が要るため、この下で before_create
# イベントとして CREATE OR REPLACE を発行している。
_CREATE_SEARCH_FN_SQL = """
CREATE OR REPLACE FUNCTION notes_search_vector(title text, body text, tags text[])
RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
SELECT to_tsvector(
  'simple'::regconfig,
  coalesce(title, '') || ' ' ||
  coalesce(body, '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
);
$$
"""


class Note(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str = Field(min_length=1, max_length=200)
    body: str
    tags: list[str] = Field(sa_column=Column(ARRAY(String), nullable=False, default=list))
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    )
    updated_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    )
    # 検索クエリの WHERE 節で参照するためモデルに載せる。書き込みは DB 側で完結し、
    # NoteRead スキーマには含めないので外部からは見えない。
    search_vector: str | None = Field(
        default=None,
        sa_column=Column(
            TSVECTOR(),
            Computed("notes_search_vector(title, body, tags)", persisted=True),
            nullable=False,
        ),
        exclude=True,
    )

    __table_args__ = (Index("ix_note_search_vector", "search_vector", postgresql_using="gin"),)


event.listen(
    Note.__table__,  # ty: ignore[unresolved-attribute]
    "before_create",
    DDL(_CREATE_SEARCH_FN_SQL).execute_if(dialect="postgresql"),
)
event.listen(
    Note.__table__,  # ty: ignore[unresolved-attribute]
    "after_drop",
    DDL("DROP FUNCTION IF EXISTS notes_search_vector(text, text, text[])").execute_if(
        dialect="postgresql"
    ),
)
