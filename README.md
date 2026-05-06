# Investment Agent — Multi-Asset Investment AI Agent

A full-stack web application that uses AI to analyze your investments across **stocks** (Brazilian B3 + global), **fixed-income** (CDB, LCI, LCA, Tesouro Direto), **INFRA funds**, and **FIIs** (Fundos Imobiliários). Get buy/sell/hold recommendations, automated reports, and intelligent portfolio rebalancing suggestions.

## Features

- **Comprehensive Analysis**: Fundamental, technical, and sentiment analysis for stocks and FIIs
- **Fixed-Income Yield Simulation**: Real-time yield calculation using BCB (Banco Central) rates (CDI, Selic, IPCA)
- **AI Chat**: Conversational interface powered by GPT 5.4-mini for on-demand questions
- **Automated Reports**: Daily and weekly portfolio analysis reports
- **In-App Inbox**: Notification inbox with alerts for maturity dates, recommendation changes, and rate updates
- **Multi-Asset Portfolio**: Track stocks, FIIs, CDB, LCI, LCA, Tesouro Direto, and INFRA in one place
- **Interactive Charts**: TradingView-powered candlestick charts with technical indicators
- **Glassmorphism UI**: Modern, vivid design with glass-effect cards and smooth animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| AI | OpenAI GPT 5.4-mini with function calling |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Data Sources | Yahoo Finance, brapi.dev (B3), Alpha Vantage, BCB/BACEN API |
| Deployment | Docker Compose, Nginx reverse proxy |

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- OpenAI API key

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd investment-agent
   ```

2. Create your `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your API keys:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```

4. Start all services:
   ```bash
   docker compose up --build
   ```

5. Access the application:
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000/docs (Swagger UI)
   - **Nginx proxy**: http://localhost (routes to both)

### Running Database Migrations

```bash
docker compose exec backend alembic upgrade head
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Nginx (port 80)                    │
├──────────────────────┬──────────────────────────────┤
│  Frontend (port 3000)│    Backend (port 8000)        │
│  Next.js App Router  │    FastAPI + WebSocket        │
│  Glassmorphism UI    │    AI Agent (GPT 5.4-mini)    │
│  TradingView Charts  │    Yield Simulation Engine    │
│                      │    APScheduler Jobs           │
├──────────────────────┴──────────────────────────────┤
│         PostgreSQL (port 5432)  │  Redis (port 6379) │
└─────────────────────────────────┴────────────────────┘
         │                              │
    ┌────┴────────────────────────┐     │
    │     External APIs           │     │
    │  • Yahoo Finance            │     │
    │  • brapi.dev (B3/Bovespa)   │     │
    │  • Alpha Vantage            │     │
    │  • BCB/BACEN (CDI/Selic)    │     │
    │  • OpenAI                   │     │
    └─────────────────────────────┘     │
```

## Project Structure

```
investment-agent/
├── docker-compose.yml          # All services orchestration
├── .env.example                # Environment variables template
├── nginx/nginx.conf            # Reverse proxy config
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint
│   │   ├── config.py           # Settings
│   │   ├── api/routes/         # REST + WebSocket endpoints
│   │   ├── agent/              # AI agent with OpenAI tools
│   │   ├── data/providers/     # Pluggable data providers
│   │   ├── yield_engine/       # Fixed-income yield simulation
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── services/           # Business logic
│   │   └── scheduler/          # APScheduler periodic jobs
│   └── alembic/                # Database migrations
└── frontend/
    └── src/
        ├── app/                # Next.js App Router pages
        ├── components/         # UI + feature components
        ├── hooks/              # Custom React hooks
        ├── lib/                # API client, utilities
        └── stores/             # Zustand state management
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/portfolio/` | List all positions |
| GET | `/api/portfolio/summary` | Portfolio net worth + breakdown |
| POST | `/api/portfolio/stocks` | Add stock position |
| POST | `/api/portfolio/fixed-income` | Add fixed-income position |
| POST | `/api/portfolio/import-csv` | Import from CSV |
| GET | `/api/watchlist/` | List watchlist |
| POST | `/api/analysis/{type}/{id}` | Trigger analysis |
| GET | `/api/analysis/rates` | Current BCB rates |
| WS | `/ws/chat` | AI chat WebSocket |
| WS | `/ws/notifications` | Live notifications |
| GET | `/api/notifications/` | List notifications |
| GET | `/api/notifications/count` | Unread notification count |
| GET | `/api/reports/` | List reports |
| POST | `/api/reports/generate` | Generate new report (on-demand) |
| DELETE | `/api/reports/{id}` | Delete a report |

## Data Refresh Schedule

| Job | Frequency | Details |
|-----|-----------|---------|
| BCB rates (CDI/Selic/IPCA) | Daily 09:00 BRT | From Banco Central API |
| Fixed-income recalculation | Daily 09:30 BRT | Uses latest BCB rates |
| Maturity alerts | Daily 10:00 BRT | Flags positions maturing in 7/30/60 days |
| Daily report generation | Daily 18:00 BRT | AI report persisted in `/api/reports` |
| Weekly report generation | Monday 18:10 BRT | AI weekly report persisted in `/api/reports` |

Scheduler times are configurable via `.env`:

```bash
SCHEDULER_ENABLED=true
SCHEDULER_TIMEZONE=America/Sao_Paulo
DAILY_REPORT_HOUR=18
DAILY_REPORT_MINUTE=0
WEEKLY_REPORT_DAY=mon
WEEKLY_REPORT_HOUR=18
WEEKLY_REPORT_MINUTE=10
```

Production recommendation:
- Run API containers with `SCHEDULER_ENABLED=false`
- Run exactly one dedicated scheduler process/container with `SCHEDULER_ENABLED=true`

This avoids duplicated jobs when scaling API workers.

## Runtime Dependency Notes

- Report generation requires: **backend + PostgreSQL + Redis + OpenAI API access**.
- If Docker is down, report generation fails because backend/API is unavailable.
- Docker is not mandatory in principle: reports still work if you run backend locally with reachable DB/Redis and valid OpenAI credentials.

## License

MIT
