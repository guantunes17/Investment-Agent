"""fi maturity_date nullable for open-ended CDBs

Revision ID: 3b0d1a4c2e11
Revises: 2a8c4e2f1b00
Create Date: 2026-05-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3b0d1a4c2e11"
down_revision: Union[str, None] = "2a8c4e2f1b00"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "fixed_income_positions",
        "maturity_date",
        existing_type=sa.Date(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE fixed_income_positions
        SET maturity_date = COALESCE(maturity_date, purchase_date)
        WHERE maturity_date IS NULL
        """
    )
    op.alter_column(
        "fixed_income_positions",
        "maturity_date",
        existing_type=sa.Date(),
        nullable=False,
    )
