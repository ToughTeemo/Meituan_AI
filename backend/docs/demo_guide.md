# Demo Guide

## Start

Set demo mode before starting the backend:

```powershell
$env:DEMO_MODE="true"
uv run uvicorn app.main:app --reload
```

`DEMO_MODE=true` disables real Open-Meteo calls during execution checks and keeps the provider refresh path deterministic.

## Environment

- `DEMO_MODE=true`: use fixed seed/mock provider snapshots in execution checks.
- `DATABASE_URL`: keep the default local SQLite database or point to a disposable demo database.
- `PLANNING_PROVIDER=rule_based`: keep plan creation on the local deterministic planner.

## Demo Flow

1. Seed a demo plan.
   - `uv run python scripts/demo/seed_weather_risk.py`
   - `uv run python scripts/demo/seed_queue_risk.py`
   - `uv run python scripts/demo/seed_price_risk.py`
   - `uv run python scripts/demo/seed_closed_risk.py`

2. Run execution check.
   - `POST /api/plans/{plan_id}/execution/check`

3. Read the latest proposal.
   - `GET /api/plans/{plan_id}/replan/latest`

4. Read the proposal list.
   - `GET /api/plans/{plan_id}/replans`

5. Apply the proposal.
   - `POST /api/plans/{plan_id}/replan/{proposal_id}/apply`

6. Read the updated plan.
   - `GET /api/plans/{plan_id}`

## Expected Result

- Execution check returns a stable high-severity risk for the seeded scenario.
- A proposal is generated automatically and persisted.
- `latest` and `list` show the same proposal payload.
- `apply` returns `APPLIED` and an updated plan.
- No step depends on live weather.
