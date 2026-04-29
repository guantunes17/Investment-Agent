from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_identifier: Mapped[str] = mapped_column(String(100), index=True)
    asset_type: Mapped[str] = mapped_column(String(20))
    analysis_type: Mapped[str] = mapped_column(String(50))
    result_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    recommendation: Mapped[str] = mapped_column(String(50))
    confidence: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
