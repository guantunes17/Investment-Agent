import json
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.schemas import ChatMessage

router = APIRouter()

_chat_history: list[dict] = []


async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            user_msg = message.get("message", "")
            history = message.get("history", [])

            _chat_history.append({
                "role": "user",
                "content": user_msg,
                "timestamp": datetime.utcnow().isoformat(),
            })

            from app.agent.core import AgentService
            agent = AgentService()

            chat_messages = [
                ChatMessage(role=h["role"], content=h["content"])
                for h in history
            ]

            response = await agent.chat(user_msg, chat_messages)

            _chat_history.append({
                "role": "assistant",
                "content": response,
                "timestamp": datetime.utcnow().isoformat(),
            })

            await websocket.send_text(json.dumps({
                "role": "assistant",
                "content": response,
                "timestamp": datetime.utcnow().isoformat(),
            }))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "role": "error",
                "content": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }))
        except Exception:
            pass


@router.get("/history")
async def get_chat_history(limit: int = 50):
    return {"messages": _chat_history[-limit:]}
