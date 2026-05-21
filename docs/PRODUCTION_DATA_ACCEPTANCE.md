# Production Data Layer Acceptance

This checklist validates Milestone 5: production data-layer and anonymous session readiness.

## Goal

Plans should no longer be purely global demo records. Every plan now has:

- `session_id`: anonymous browser/session owner.
- `user_id`: future authenticated user owner, nullable for anonymous MVP usage.
- `city`: currently Shanghai.
- `source`: `api` or `mock`.

This lets the MVP list and restore plans for a session, and gives the backend a clear path toward authenticated accounts.

## Local Development

Local development can still auto-create SQLite tables:

```env
DATABASE_URL=sqlite:///./life_agent.db
DATABASE_AUTO_CREATE=true
```

If you already have an older local `life_agent.db` without the new columns, either run migrations on a fresh database or recreate the local DB.

## Production-Like Database

Production should use Postgres and Alembic:

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/life_agent
DATABASE_AUTO_CREATE=false
```

Run migrations:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
$env:DATABASE_URL='postgresql+psycopg://user:password@host:5432/life_agent'
uv run alembic upgrade head
```

## API Smoke Test

Create a plan with an explicit anonymous session:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/plans `
  -Method Post `
  -ContentType 'application/json; charset=utf-8' `
  -Body '{"prompt":"周末在上海市区玩半天","session_id":"anon_browser_001"}'
```

Expected:

- Response status is `201`.
- Response includes `session_id: "anon_browser_001"`.
- Response includes `city: "上海"`.

List plans for the same session:

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:8000/api/plans?session_id=anon_browser_001'
```

Expected:

- Only plans from that session are returned.
- Plans are ordered by latest update first.

## Automated Coverage

Run:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run pytest
uv run ruff check .
```

Coverage includes:

- Explicit `session_id` is persisted and returned.
- Missing `session_id` generates an anonymous `anon_...` id.
- List endpoint filters plans by session.
- Existing plan/risk/replan/confirm flows still pass with session fields.

## Current Boundaries

- `user_id` is accepted and persisted, but authentication is not implemented yet.
- Plan version history is still represented by the current plan record version number; a separate `plan_versions` table is a later milestone.
- Existing local SQLite files created before this milestone may need migration or recreation.
