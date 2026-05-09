"""add user_settings table

Revision ID: 5d2e3f4a5b66
Revises: 4c1d6e7a9f22
Create Date: 2026-05-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5d2e3f4a5b66"
down_revision: Union[str, None] = "4c1d6e7a9f22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint("uq_user_settings_key", "user_settings", ["key"])
    op.create_index("ix_user_settings_key", "user_settings", ["key"])


def downgrade() -> None:
    op.drop_index("ix_user_settings_key", table_name="user_settings")
    op.drop_constraint("uq_user_settings_key", "user_settings", type_="unique")
    op.drop_table("user_settings")
