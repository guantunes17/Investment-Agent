from typing import Any, Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

_ws_connections: list = []


def register_ws(ws):
    _ws_connections.append(ws)


def unregister_ws(ws):
    if ws in _ws_connections:
        _ws_connections.remove(ws)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def list_all(self, unread_only: bool = False) -> list[Notification]:
        stmt = select(Notification).order_by(Notification.created_at.desc())
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def create_notification(
        self,
        title: str,
        body: str,
        notification_type: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Notification:
        notif = Notification(
            title=title,
            body=body,
            notification_type=notification_type,
            metadata_json=metadata,
        )
        self._db.add(notif)
        await self._db.commit()
        await self._db.refresh(notif)

        await self._push_to_websockets({
            "id": notif.id,
            "title": notif.title,
            "body": notif.body,
            "type": notif.notification_type,
            "created_at": notif.created_at.isoformat(),
        })

        return notif

    async def mark_read(self, notif_id: int) -> bool:
        notif = await self._db.get(Notification, notif_id)
        if not notif:
            return False
        notif.is_read = True
        await self._db.commit()
        return True

    async def mark_all_read(self) -> int:
        stmt = (
            update(Notification)
            .where(Notification.is_read == False)
            .values(is_read=True)
        )
        result = await self._db.execute(stmt)
        await self._db.commit()
        return result.rowcount

    async def unread_count(self) -> int:
        stmt = select(func.count()).select_from(Notification).where(Notification.is_read == False)
        result = await self._db.execute(stmt)
        return result.scalar_one()

    async def delete_notification(self, notif_id: int) -> bool:
        notif = await self._db.get(Notification, notif_id)
        if not notif:
            return False
        await self._db.delete(notif)
        await self._db.commit()
        return True

    async def delete_read_notifications(self) -> int:
        stmt = delete(Notification).where(Notification.is_read == True)
        result = await self._db.execute(stmt)
        await self._db.commit()
        return result.rowcount

    async def _push_to_websockets(self, data: dict) -> None:
        import json
        payload = json.dumps(data, default=str)
        disconnected = []
        for ws in _ws_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            unregister_ws(ws)
