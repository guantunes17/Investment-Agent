import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import portfolio, watchlist, analysis, chat, reports, notifications

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting Investment Agent backend...")

    from app.api.deps import get_redis
    redis = await get_redis()
    logger.info("Redis connection established")

    from app.scheduler.jobs import setup_scheduler
    sched = setup_scheduler()
    sched.start()
    logger.info("Scheduler started with all jobs")

    yield

    sched.shutdown(wait=False)
    logger.info("Scheduler stopped")

    redis_conn = await get_redis()
    await redis_conn.close()
    logger.info("Redis connection closed")


app = FastAPI(
    title="Investment Agent",
    description="Multi-Asset Investment Agent API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

from app.api.routes.chat import websocket_chat
from app.api.routes.notifications import notification_stream

app.add_api_websocket_route("/ws/chat", websocket_chat)
app.add_api_websocket_route("/ws/notifications", notification_stream)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
