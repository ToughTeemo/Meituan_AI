# Life Agent Backend

FastAPI + SQLModel backend for the local-life AI Agent demo.

## Stack

- FastAPI
- SQLModel
- SQLite for local development
- Postgres-ready via SQLAlchemy/psycopg
- Alembic migrations
- uv
- pytest
- ruff

## Setup

Install `uv` first if it is not available:

```bash
pip install uv
```

Install dependencies:

```bash
cd backend
uv sync
```

Run the API:

```bash
uv run fastapi dev app/main.py
```

Open:

```text
http://localhost:8000/docs
```

## Test

```bash
uv run pytest
uv run ruff check .
```

## Data Layer

Local development can auto-create SQLite tables:

```env
DATABASE_URL=sqlite:///./life_agent.db
DATABASE_AUTO_CREATE=true
```

Production-like environments should run migrations instead of calling `create_all`:

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/life_agent
DATABASE_AUTO_CREATE=false
```

Run migrations:

```bash
uv run alembic upgrade head
```

Plans include anonymous-session ownership fields:

- `session_id`
- `user_id`
- `city`
- `source`

Plan changes are snapshotted in `planversionrecord`, available through:

```text
GET /api/plans/{plan_id}/versions
GET /api/plans/{plan_id}/versions/compare
POST /api/plans/{plan_id}/versions/{version_id}/restore
```

Execution checks are snapshotted in `executionsnapshotrecord`, available through:

```text
POST /api/plans/{plan_id}/execution/check
GET  /api/plans/{plan_id}/execution/latest
```

## Current API Surface

```text
GET  /api/health
POST /api/plans
GET  /api/plans?session_id={session_id}
GET  /api/plans/{plan_id}
POST /api/plans/{plan_id}/execution/check
GET  /api/plans/{plan_id}/execution/latest
GET  /api/plans/{plan_id}/versions
GET  /api/plans/{plan_id}/versions/compare
POST /api/plans/{plan_id}/versions/{version_id}/restore
POST /api/plans/{plan_id}/requirements
POST /api/plans/{plan_id}/risks/scan
POST /api/plans/{plan_id}/risks/{risk_id}/replan
POST /api/plans/{plan_id}/risks/{risk_id}/ignore
POST /api/plans/{plan_id}/confirm
POST /api/plans/{plan_id}/actions
```

The current default planning path is rule-based and persists real API responses
through SQLite/SQLModel. Execution check APIs run the execution pipeline and
persist execution snapshots. The service-level replan framework is exposed
through the execution/proposal chain below.

Current replan chain:

```text
POST /api/plans/{plan_id}/execution/check
GET  /api/plans/{plan_id}/execution/latest
GET  /api/plans/{plan_id}/replan/latest
GET  /api/plans/{plan_id}/replans
POST /api/plans/{plan_id}/replan/{proposal_id}/apply
```

Legacy compatibility endpoints remain available for older clients:

- `POST /api/plans/{plan_id}/risks/scan`
- `POST /api/plans/{plan_id}/risks/{risk_id}/replan`
- `POST /api/plans/{plan_id}/risks/{risk_id}/ignore`

## Planning Providers

The default planner now uses the rule-based planning pipeline:

```env
PLANNING_PROVIDER=rule_based
POI_PROVIDER=seed
ROUTE_PROVIDER=estimated
WEATHER_PROVIDER=seed
```

Provider modes:

- `PLANNING_PROVIDER=rule_based`: build `PlanContext` from `ProviderCatalog`, rank candidates with `RuleBasedPlanner`, and adapt the result through `PlanResponseAdapter`.
- `PLANNING_PROVIDER=mock`: use the legacy demo plan generator.
- `PLANNING_PROVIDER=shanghai_seed`: use the legacy Shanghai MVP planner path with seed or Amap-backed POI/route providers.
- `POI_PROVIDER=seed`: use curated Shanghai seed data.
- `POI_PROVIDER=amap`: use Gaode/Amap POI search when `AMAP_API_KEY` is set, with seed data as local fallback.
- `ROUTE_PROVIDER=estimated`: estimate route distance and duration locally from coordinates.
- `ROUTE_PROVIDER=amap`: use Gaode/Amap driving and walking directions when `AMAP_API_KEY` is set, with local estimation as fallback.
- `WEATHER_PROVIDER=seed`: use deterministic local Shanghai weather.
- `WEATHER_PROVIDER=open_meteo`: fetch live weather from Open-Meteo and fall back to seed weather if unavailable.
- `HOURS_PROVIDER=hybrid`: refresh hours from available provider/mock/estimated data.
- `PRICE_PROVIDER=estimated`: refresh price from available provider/mock/estimated data.
- `QUEUE_PROVIDER=estimated`: keep queue as estimated data, not realtime.
- `BOOKING_PROVIDER=stub`: keep booking as user-action guidance, not confirmed booking.
- `ACTION_PROVIDER=amap_uri`: generate user-confirmed navigation/action suggestions.

Run the legacy Shanghai MVP planner with Amap POI and route providers:

```bash
PLANNING_PROVIDER=shanghai_seed POI_PROVIDER=amap ROUTE_PROVIDER=amap AMAP_API_KEY=<your-amap-key> uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The Amap adapter is intentionally defensive: invalid provider status, transport errors,
bad coordinates, non-Shanghai results, empty results, and missing optional fields all
fall back to the curated Shanghai seed data so route generation still succeeds.
Route provider fallback also handles unsupported subway mode, invalid route payloads,
provider errors, and missing API keys.

Frontend production-like mode should use:

```env
VITE_API_MODE=api
VITE_USE_MOCK_FALLBACK=false
```

## Team Docs

- Current API contract: `../docs/API_CONTRACT_CURRENT.md`
- Current acceptance checklist: `../docs/ACCEPTANCE_CHECKLIST_CURRENT.md`
- Shanghai MVP spec: `../docs/SHANGHAI_MVP_SPEC.md`
- Amap provider acceptance: `../docs/AMAP_PROVIDER_ACCEPTANCE.md`
- Amap route acceptance: `../docs/AMAP_ROUTE_ACCEPTANCE.md`
- Production data acceptance: `../docs/PRODUCTION_DATA_ACCEPTANCE.md`
- Plan version acceptance: `../docs/PLAN_VERSION_ACCEPTANCE.md`
- Plan version restore/compare: `../docs/PLAN_VERSION_RESTORE_COMPARE.md`
- Backend progress archive: `docs/progress_archive.md`
