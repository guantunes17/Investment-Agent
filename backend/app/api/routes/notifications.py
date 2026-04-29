from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.schemas import NotificationResponse
from app.services.notification import NotificationService, register_ws, unregister_ws

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> NotificationService:
    return NotificationService(db)


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    unread: bool = False,
    service: NotificationService = Depends(_get_service),
):
    notifications = await service.list_all(unread_only=unread)
    return [NotificationResponse.model_validate(n) for n in notifications]


@router.get("/count")
async def unread_count(service: NotificationService = Depends(_get_service)):
    count = await service.unread_count()
    return {"unread_count": count}


@router.put("/{notif_id}/read")
async def mark_read(
    notif_id: int,
    service: NotificationService = Depends(_get_service),
):
    success = await service.mark_read(notif_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}


@router.put("/read-all")
async def mark_all_read(service: NotificationService = Depends(_get_service)):
    count = await service.mark_all_read()
    return {"status": "ok", "marked": count}


@router.delete("/read")
async def delete_read_notifications(service: NotificationService = Depends(_get_service)):
    count = await service.delete_read_notifications()
    return {"status": "ok", "deleted": count}


@router.delete("/{notif_id}")
async def delete_notification(
    notif_id: int,
    service: NotificationService = Depends(_get_service),
):
    success = await service.delete_notification(notif_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}


@router.websocket("/ws")
async def notification_stream(websocket: WebSocket):
    await websocket.accept()
    register_ws(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        unregister_ws(websocket)
    except Exception:
        unregister_ws(websocket)
