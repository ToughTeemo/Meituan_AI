# Plan Version Restore and Compare Acceptance

This checklist validates Milestone 7: restoring a historical plan version and comparing two snapshots.

## Restore API

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/plans/<plan_id>/versions/<version_id>/restore
```

Expected:

- The latest plan is replaced with the snapshot's constraints, timeline, cards, status, active risk, and logs.
- The plan's version is incremented from the current latest plan version.
- A new `planversionrecord` snapshot is written with `event_type=restored`.
- Historical snapshots are not deleted or mutated.

## Compare API

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:8000/api/plans/<plan_id>/versions/compare?base_version_id=<base>&target_version_id=<target>'
```

Expected response:

- `base_version_id`
- `target_version_id`
- `base_version`
- `target_version`
- `base_status`
- `target_status`
- `added_card_ids`
- `removed_card_ids`
- `changed_card_ids`
- `unchanged_card_ids`

## Expected Flow

1. Create a plan.
2. Save the first `version_id`.
3. Trigger a risk scan.
4. Accept replan.
5. Compare first snapshot against latest snapshot.
6. Restore the first snapshot.
7. Confirm a new `restored` snapshot exists.

## Automated Coverage

Run:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run pytest
uv run ruff check .
```

Coverage includes:

- Version diff returns added and removed card IDs after replan.
- Restoring an older snapshot increments the current plan version.
- Restore writes a `restored` version event.
- Existing version-history behavior remains intact.

## Current Boundaries

- Diff granularity is card-level only.
- A changed card is any card with the same `card_id` but a changed serialized payload.
- Restore does not yet enforce session/user authorization; that belongs with real auth.
- Restore creates a new version instead of mutating or deleting history.
