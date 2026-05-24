"""add_search_vector_to_notes

Revision ID: 05483cde1f20
Revises: d3da33cfbd30
Create Date: 2026-05-24 13:19:06.743227

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "05483cde1f20"
down_revision: str | Sequence[str] | None = "d3da33cfbd30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# PostgreSQL の GENERATED 列は IMMUTABLE な式しか許さない。to_tsvector(regconfig, ..)
# は PG からは STABLE 扱いされるため、明示的に IMMUTABLE な wrapper 関数で包み
# 「不変である」と宣言する。同じ関数定義をテスト時の create_all 用に
# mar_api.models.note でも参照する。
CREATE_FN_SQL = """
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
$$;
"""

DROP_FN_SQL = "DROP FUNCTION IF EXISTS notes_search_vector(text, text, text[]);"


def upgrade() -> None:
    op.execute(CREATE_FN_SQL)
    op.add_column(
        "note",
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("notes_search_vector(title, body, tags)", persisted=True),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("note", "search_vector")
    op.execute(DROP_FN_SQL)
