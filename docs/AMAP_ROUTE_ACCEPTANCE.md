# Amap Route Provider Acceptance

This checklist validates Milestone 4: real route-time provider readiness.

## Goal

When `ROUTE_PROVIDER=amap` and `AMAP_API_KEY` are set, route legs should use Gaode/Amap direction APIs for supported transport modes. If Amap is unavailable or returns unusable data, route generation should fall back to local coordinate-based estimation.

## Supported Modes

Current MVP support:

- `驾车`: Amap driving direction API.
- `步行`: Amap walking direction API.
- `地铁`: falls back to local estimation for now.

The MVP keeps subway/transit fallback intentionally because Amap public transit responses require a different parsing model and station-level transfer handling.

## Local Setup

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
$env:PLANNING_PROVIDER='amap'
$env:ROUTE_PROVIDER='amap'
$env:WEATHER_PROVIDER='seed'
$env:AMAP_API_KEY='<your-amap-key>'
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Seed POI with Amap route is also valid:

```powershell
$env:PLANNING_PROVIDER='shanghai_seed'
$env:ROUTE_PROVIDER='amap'
```

## API Smoke Test

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/plans `
  -Method Post `
  -ContentType 'application/json; charset=utf-8' `
  -Body '{"prompt":"周末在上海市区玩半天，预算 500，打车方便，别太累"}'
```

Expected:

- Response status is `201`.
- Transit cards contain summaries like `驾车约 ... 分钟，距离约 ... 公里` for driving mode when enabled.
- If route provider fails, planning still succeeds with local estimated summaries.

## Automated Coverage

Run:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run pytest
uv run ruff check .
```

The provider tests cover:

- Successful driving response mapping.
- Successful walking response mapping.
- Subway mode fallback.
- Missing API key fallback.
- Provider error status fallback.
- Transport timeout fallback.
- Invalid payload fallback.
- Invalid distance or duration fallback.
- Non-object payload fallback.

## Current Boundaries

- Public transit/subway is still estimated locally.
- Route calls are synchronous.
- Route selection does not yet optimize across multiple candidate permutations; it estimates legs for the chosen route.
- Real-time traffic incidents are not yet modeled separately from Amap duration.
