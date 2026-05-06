"""reports period key for scheduler idempotency

Revision ID: 4c1d6e7a9f22
Revises: 3b0d1a4c2e11
Create Date: 2026-05-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4c1d6e7a9f22"
down_revision: Union[str, None] = "3b0d1a4c2e11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("period_key", sa.String(length=32), nullable=True))
    op.create_unique_constraint(
        "uq_reports_type_period_key",
        "reports",
        ["report_type", "period_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_reports_type_period_key", "reports", type_="unique")
    op.drop_column("reports", "period_key")

