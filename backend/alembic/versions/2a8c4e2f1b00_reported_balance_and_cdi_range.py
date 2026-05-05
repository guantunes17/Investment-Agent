"""reported balance + CDI range fields

Revision ID: 2a8c4e2f1b00
Revises: 1085fdfcc518
Create Date: 2026-05-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2a8c4e2f1b00"
down_revision: Union[str, None] = "1085fdfcc518"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_positions",
        sa.Column("reported_position_value", sa.Numeric(), nullable=True),
    )
    op.add_column(
        "fixed_income_positions",
        sa.Column("reported_position_value", sa.Numeric(), nullable=True),
    )
    op.add_column(
        "fixed_income_positions",
        sa.Column("cdi_index_mode", sa.String(length=20), nullable=False, server_default="FIXED"),
    )
    op.add_column(
        "fixed_income_positions",
        sa.Column("rate_ceiling_value", sa.Numeric(), nullable=True),
    )
    op.add_column(
        "fixed_income_positions",
        sa.Column("projection_cdi_percent", sa.Numeric(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fixed_income_positions", "projection_cdi_percent")
    op.drop_column("fixed_income_positions", "rate_ceiling_value")
    op.drop_column("fixed_income_positions", "cdi_index_mode")
    op.drop_column("fixed_income_positions", "reported_position_value")
    op.drop_column("stock_positions", "reported_position_value")
