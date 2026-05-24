"""add_gin_index_on_search_vector

Revision ID: 2dfbb084d9bf
Revises: 05483cde1f20
Create Date: 2026-05-24 13:19:08.496932

"""

from collections.abc import Sequence

from alembic import op

revision: str = "2dfbb084d9bf"
down_revision: str | Sequence[str] | None = "05483cde1f20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_note_search_vector",
        "note",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_note_search_vector", table_name="note")
