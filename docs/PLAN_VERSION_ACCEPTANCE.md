# Plan Version History Acceptance

This checklist validates Milestone 6: plan version history.

## Goal

Every plan should have a traceable version history so users and future evaluators can compare route changes over time.

Snapshots are written to `planversionrecord` when:

- A plan is created.
- A plan is updated by risk scan.
- A plan is updated by replan.
- A plan is confirmed or action logs are appended.

## API

List versions for a plan:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/plans/<plan_id>/versions
```

Expected fields:

- `version_id`
- `plan_id`
- `session_id`
- `user_id`
- `city`
- `source`
- `version`
- `event_type`
- `status`
- `constraints`
- `timeline`
- `cards`
- `active_risk`
- `agent_logs`
- `created_at`

## Expected Flow

Create a plan:

- One snapshot exists.
- `event_type` is `created`.
- `version` is `1`.

Scan a risk:

- A new snapshot is written.
- `event_type` is `updated`.
- `version` remains `1`.
- `status` can become `RISK_DETECTED`.

Accept replan:

- A new snapshot is written.
- `event_type` is `updated`.
- `version` increments to `2`.
- `active_risk` returns to `null`.

## Automated Coverage

Run:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run pytest
uv run ruff check .
```

Coverage includes:

- Initial version snapshot on create.
- Version history after scan and replan.
- Existing plan/session flows still pass.

## Migration

Run:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run alembic upgrade head
```

The second migration creates `planversionrecord` with indexes for:

- `plan_id`
- `session_id`
- `user_id`
- `city`
- `source`
- `version`
- `event_type`
- `status`
- `created_at`

## Current Boundaries

- The API lists snapshots but does not yet restore a previous version.
- Event typing is currently coarse: `created` or `updated`.
- Snapshot payloads are stored as JSON strings to match the existing `PlanRecord` approach.
