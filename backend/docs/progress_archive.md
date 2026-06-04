# Backend Progress Archive

Current version tag: `planning-v0.3-execution`

Current commit: `cf0bb38`

Archive date: 2026-06-04

## Current Stage

This archive records the backend state after the `planning-v0.3-execution`
milestone. The current backend has completed the rule-based planning path,
execution check pipeline, execution snapshot persistence, and the service-level
replan framework.

No P15/P17 work, frontend work, OpenAI integration, API behavior change, or
database structure change is included in this archive task.

## Completed Modules

### Provider and Mock Data

- `MockDatasetLoader`
  - Loads `backend/docs/mock/*.json`.
  - Indexes all provider mock records by `poi_id`.
  - Raises explicit errors for invalid JSON shape or missing `poi_id`.
- `ProviderCatalog`
  - Provides unified access to POI, hours, price, queue, booking, and action
    context.
  - Uses `pois_mock.json` as the primary catalog when present.
  - Falls back to seed POI data and unknown-safe provider snapshots where mock
    data is missing.
- `HoursProvider`, `PriceProvider`, `WeatherProvider`
  - Provide execution-time refresh data for weather, hours, and price.
  - Keep provider output JSON-serializable and confidence/source annotated.

### Planning

- `PlanContextBuilder`
  - Builds planning context from user prompt, constraints, weather, provider
    catalog candidates, and provider snapshots.
  - Tracks source summary and unknown provider counts.
- `RuleBasedPlanner`
  - Ranks bounded provider candidates.
  - Produces rule-based plan cards, estimated cost, confidence, and summary.
- `PlanResponseAdapter`
  - Converts planner output into the existing frontend-compatible
    `PlanResponse`.
  - Preserves `constraints`, `timeline`, `cards`, `agent_logs`, and `summary`.
- `PlanningService`
  - Defaults to `PLANNING_PROVIDER=rule_based`.
  - Persists created plans through `PlanRepository`.
  - Keeps legacy `mock` and Shanghai MVP planner paths available.

### Persistence

- `PlanRepository`
  - Creates, loads, lists, saves, restores, and compares plans.
  - Persists `summary_json` for active plan records and plan version records.
  - Persists execution snapshots through `ExecutionSnapshotRecord`.
- `PlanRecord`
  - Stores the current active plan state.
- `PlanVersionRecord`
  - Stores plan version snapshots.
- `ExecutionSnapshotRecord`
  - Stores execution check status, summary, execution context, risk flags,
    actions, and created timestamp.

### Execution

- `ExecutionContextBuilder`
  - Builds execution context from a `PlanResponse`.
  - Captures current step, current card, constraints, timeline, cards, initial
    provider snapshot, and initial risk flags.
- `ExecutionProviderRefreshService`
  - Refreshes weather, hours, and price snapshots.
  - Falls back to unknown-safe provider snapshots on provider errors.
- `ExecutionRiskScanner`
  - Detects weather, closure, queue, booking, and unknown-data risks.
  - Produces JSON-serializable risk flags.
- `ExecutionActionPlanner`
  - Converts risks into confirmation, replan suggestion, wait/continue, notify,
    or navigation actions.
  - Keeps external actions as user-confirmed suggestions.
- `ExecutionPipeline`
  - Runs context build -> provider refresh -> risk scan -> action planning.
  - Produces `READY`, `NEEDS_CONFIRMATION`, or `NEEDS_REPLAN`.
  - Exposes API response views and snapshot response views.
- Execution snapshot persistence
  - `PlanRepository.save_execution_snapshot()`
  - `PlanRepository.get_latest_execution_snapshot()`
  - `PlanRepository.list_execution_snapshots()`

### Execution API

- `POST /api/plans/{plan_id}/execution/check`
  - Loads plan.
  - Runs `ExecutionPipeline`.
  - Persists execution snapshot.
  - Returns status, summary, risk flags, and actions.
- `GET /api/plans/{plan_id}/execution/latest`
  - Loads latest persisted execution snapshot summary.
  - Returns snapshot id, status, summary, risk flags, actions, and created time.

### Replan Framework

- `ReplanDecisionService`
  - Converts execution pipeline risk flags into a replan decision.
  - Supports strategies such as `INDOOR_FALLBACK`, `ALTERNATIVE_POI`, and
    `CONTINUE`.
- `ReplanContextBuilder`
  - Builds a replan context from plan, pipeline result, and replan decision.
  - Carries current card, risk flags, actions, execution context, and provider
    snapshot into the replanner.
- `RuleBasedReplanner`
  - Proposes replacement POIs from `ProviderCatalog`.
  - Scores candidates by strategy, category similarity, hours, queue, booking,
    and budget.
- `ApplyReplanService`
  - Applies a replan proposal to a plan payload copy.
  - Replaces only the target card and syncs provider snapshot fields when
    present.

Important current boundary: the new replan framework is service-level
infrastructure. It is verified by scripts, but it is not yet exposed as a new
formal API and does not persist replan proposals.

## End-to-End Chains

### Planning

```text
User Request
-> PlanningService
-> PlanContextBuilder
-> RuleBasedPlanner
-> PlanResponseAdapter
-> Plan Persistence
-> POST /api/plans
-> GET /api/plans/{plan_id}
```

### Execution

```text
Plan
-> ExecutionContextBuilder
-> ExecutionProviderRefreshService
-> ExecutionRiskScanner
-> ExecutionActionPlanner
-> ExecutionPipeline
-> ExecutionSnapshot
-> POST /api/plans/{plan_id}/execution/check
-> GET /api/plans/{plan_id}/execution/latest
```

### Replan

```text
ExecutionPipelineResult
-> ReplanDecisionService
-> ReplanContextBuilder
-> RuleBasedReplanner
-> ApplyReplanService
-> updated_plan
```

## API List

### Health

- `GET /api/health`

### Plans

- `POST /api/plans`
- `GET /api/plans?session_id={session_id}`
- `GET /api/plans/{plan_id}`

### Execution

- `POST /api/plans/{plan_id}/execution/check`
- `GET /api/plans/{plan_id}/execution/latest`

### Plan Versions

- `GET /api/plans/{plan_id}/versions`
- `GET /api/plans/{plan_id}/versions/compare`
- `POST /api/plans/{plan_id}/versions/{version_id}/restore`

### Requirements

- `POST /api/plans/{plan_id}/requirements`

### Legacy Risk/Replan

- `POST /api/plans/{plan_id}/risks/scan`
- `POST /api/plans/{plan_id}/risks/{risk_id}/replan`
- `POST /api/plans/{plan_id}/risks/{risk_id}/ignore`

Current note: `risks/{risk_id}/replan` still uses the legacy `RiskService`
mock-data replan path. It is not the new
`ReplanDecisionService -> ReplanContextBuilder -> RuleBasedReplanner ->
ApplyReplanService` chain.

### Actions

- `POST /api/plans/{plan_id}/confirm`
- `POST /api/plans/{plan_id}/actions`

## Database Migrations

- `20260521_0001_create_plan_records.py`
  - Creates `planrecord`.
- `20260521_0002_create_plan_versions.py`
  - Creates `planversionrecord`.
- `20260603_0003_add_plan_summary_json.py`
  - Adds `summary_json` to `planrecord`.
  - Adds `summary_json` to `planversionrecord`.
- `20260603_0004_add_execution_snapshot.py`
  - Creates `executionsnapshotrecord`.
  - Adds indexes for id, plan id, version, status, and created time.

## Mock Data

Directory: `backend/docs/mock`

Current mock files:

- `amap_poi_seed_queries.json`
- `pois_amap_raw.json`
- `pois_mock.json`
- `hours_mock.json`
- `price_mock.json`
- `queue_mock.json`
- `booking_mock.json`
- `action_mock.json`
- `README.md`

Current dataset status:

- POI records: 37
- Hours records: 37
- Price records: 37
- Queue records: 37
- Booking records: 37
- Action records: 37

The provider mock files are joined by `poi_id`. The data is intended for stable
local planning and execution validation. Queue data remains estimated mock data,
and booking data remains stub/user-action guidance. They must not be presented
as realtime queue, confirmed booking, paid order, or completed external action.

## Validation Scripts

All validation scripts live in `backend/scripts`.

- `check_api_contract.py`
  - Validates create/get plan API response compatibility.
- `check_apply_replan.py`
  - Validates full service-level replan application flow and non-mutating
    behavior.
- `check_execution_action_planner.py`
  - Validates risk-to-action conversion and JSON serialization.
- `check_execution_api.py`
  - Validates execution check API, latest snapshot API, persisted snapshot
    equality, and action safety flags.
- `check_execution_context_builder.py`
  - Validates execution context shape and provider snapshot initialization.
- `check_execution_pipeline.py`
  - Validates end-to-end execution pipeline result shape, status, risks,
    actions, and serialization.
- `check_execution_provider_refresh.py`
  - Validates execution provider refresh behavior for weather, hours, and price.
- `check_execution_risk_scanner.py`
  - Validates execution risk scanning and risk flag serialization.
- `check_execution_snapshot_persistence.py`
  - Validates execution snapshot save/load/list behavior and JSON stability.
- `check_plan_context_builder.py`
  - Validates planning context, candidates, provider snapshots, source summary,
    and unknown counts.
- `check_plan_persistence.py`
  - Validates plan save/load equality for summary, cards, risk notes, and
    recommendation reasons.
- `check_plan_response_adapter.py`
  - Validates conversion from planner output to `PlanResponse`.
- `check_planning_service_rule_based.py`
  - Validates `PlanningService` rule-based create-plan path with in-memory
    persistence.
- `check_provider_catalog.py`
  - Validates provider catalog loading, search, context joining, and fallback
    behavior when mock records/files are missing.
- `check_replan_context.py`
  - Validates replan context construction from plan, pipeline result, decision,
    risks, actions, and current step.
- `check_replan_decision.py`
  - Validates replan decision strategies and severity ordering.
- `check_rule_based_planner.py`
  - Validates rule-based planner ranking and output fields.
- `check_rule_based_replanner.py`
  - Validates rule-based replan proposal generation from execution risks.

## Known Limits

- The new replan framework is not exposed through a formal API yet.
- Replan proposals are not persisted.
- `ApplyReplanService` is not connected to a production API route.
- Legacy `POST /api/plans/{plan_id}/risks/{risk_id}/replan` still exists and
  uses `RiskService.replan`, which is a different path from the new replan
  framework.
- Execution provider refresh currently covers weather, hours, and price. Queue
  and booking are still primarily mock/estimated/stub snapshots.
- `PlanVersionResponse` does not expose `summary`, even though
  `summary_json` is persisted for version records.
- `restore_plan_version` still writes a restored summary instead of restoring
  the original version summary.
- Validation scripts are useful but numerous. They should eventually be grouped
  under a documented test/validation command or converted into pytest coverage
  where appropriate.
- Some legacy service paths still contain debug-style prints in the old Shanghai
  MVP planner branch. They are not part of the rule-based default path, but they
  should be cleaned before production hardening.

## Next Recommendations

1. Add a formal replan API only after deciding whether it replaces or coexists
   with `risks/{risk_id}/replan`.
2. Persist replan proposals and applied replan results before exposing apply
   behavior to clients.
3. Connect `ApplyReplanService` through an explicit route or application service
   once persistence semantics are settled.
4. Decide whether execution snapshots should keep full internal context forever
   or be compacted after API contract stabilization.
5. Add README script grouping for the 18 validation scripts, or wrap them in one
   stable command.
6. Expose version summary in `PlanVersionResponse` or document why summaries are
   intentionally omitted from version API responses.
7. Clean legacy naming around `RiskService.replan` versus the new replan
   framework before frontend or product documentation depends on the term
   "replan".
