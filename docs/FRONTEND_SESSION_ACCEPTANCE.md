# Milestone 8: Frontend Session Acceptance

## Scope

Milestone 8 connects the production session data layer to the web MVP.

## Completed

- The frontend now creates a stable browser session id in `localStorage`.
- `POST /api/plans` receives `session_id` when a user starts a Shanghai weekend plan.
- `GET /api/plans?session_id=...` is available through the frontend API client.
- The dashboard top navigation can refresh "my plans" from the current browser session.
- Mock fallback keeps local demo mode usable when the backend is unavailable.

## Manual Acceptance

1. Start the backend and frontend.
2. Generate a new weekend city-play plan from the home page.
3. Confirm the request payload includes `session_id`.
4. Refresh the browser and generate another plan.
5. Confirm both plans use the same browser session id.
6. Open the dashboard and click "my plans".
7. Confirm the current session's plans appear in the popover.

## Notes

- Session identity is anonymous for MVP and scoped to one browser profile.
- A future authenticated user id can be added without changing the session contract.
