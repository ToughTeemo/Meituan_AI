# Amap POI Provider Acceptance

This checklist validates Milestone 3: real Shanghai POI provider readiness.

## Goal

When `PLANNING_PROVIDER=amap` and `AMAP_API_KEY` are set, `/api/plans` should use Gaode/Amap POI search for Shanghai route candidates. If Amap is unavailable, returns invalid data, or returns no usable Shanghai POI, the backend should fall back to the curated Shanghai seed data instead of failing the planning flow.

## Local Setup

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
$env:PLANNING_PROVIDER='amap'
$env:WEATHER_PROVIDER='seed'
$env:AMAP_API_KEY='<your-amap-key>'
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend production-like mode:

```powershell
cd E:\Meituan_AI
$env:VITE_API_MODE='api'
$env:VITE_USE_MOCK_FALLBACK='false'
npm run dev
```

## API Smoke Test

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/plans `
  -Method Post `
  -ContentType 'application/json; charset=utf-8' `
  -Body '{"prompt":"周末在上海市区玩半天，预算 500，地铁方便，别太累"}'
```

Expected:

- Response status is `201`.
- `cards` contains at least two `activity` or `dining` cards.
- POI fields include `name`, `district`, `address`, `latitude`, `longitude`, and `recommendation_reason`.
- If Amap returns no usable results, the response still succeeds using seed POI.

## Automated Coverage

Run:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run pytest
uv run ruff check .
```

The provider tests cover:

- Successful Amap response mapping.
- Missing API key fallback.
- Provider error status fallback.
- Transport timeout fallback.
- Bad coordinates and out-of-Shanghai filtering.
- Missing optional field defaults.
- Non-object payload fallback.

## Current Boundaries

- Amap search is currently POI text search only.
- Route time can be enabled separately with `ROUTE_PROVIDER=amap`; subway mode still uses local estimation.
- Booking links, ticket availability, and real-time queue are still out of scope.
- Provider calls are synchronous for the first MVP pass.
