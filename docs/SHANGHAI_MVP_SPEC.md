# Shanghai Weekend Play MVP

## 1. Product Positioning

This MVP helps users plan a weekend city outing in Shanghai. The first release should generate one executable half-day or one-day route based on real Shanghai POI, weather, operating hours, travel time, budget, and user preferences.

The product should move from a demo cockpit to a real planning assistant:

- User enters a natural-language outing request.
- System extracts constraints and generates a route.
- User can adjust preferences or replace a stop.
- System can react to weather, closed venues, long travel time, budget pressure, and likely crowding.
- User confirms the route and continues to navigation, booking links, sharing, or reminders.

## 2. MVP Scope

### City

- Shanghai only.
- City boundary should be treated as Shanghai municipality.
- First release can bias toward central urban districts and subway-friendly areas.

### Supported Scenarios

- Weekend city outing.
- Half-day or one-day route.
- City leisure, not intercity travel.
- First-class scenarios:
  - Parent-child outing.
  - Friends outing.
  - Couple outing.

### Route Shape

Each plan should contain 3 to 5 stops:

1. Start location.
2. Activity stop.
3. Optional second activity or backup stop.
4. Dining or cafe stop.
5. End or return guidance.

Each stop must include:

- Place name.
- Address or district.
- Time window.
- Estimated duration.
- Estimated cost.
- Travel time from previous stop.
- Recommendation reason.
- Risk labels.
- Actions: navigate, replace, save, confirm.

## 3. User Input Contract

The first version should support a single natural-language prompt such as:

- "周六下午在上海市区玩半天，预算 500，别太累。"
- "想和朋友周末在上海逛展吃饭，最好地铁方便。"
- "带孩子周日出去玩，室内优先，晚上 8 点前回家。"

The system should extract:

- Date or weekend day.
- Half-day or full-day duration.
- Start location. If missing, use a clear default and ask later for refinement.
- End time.
- Companions.
- Budget.
- Preferences: indoor, parent-child, less walking, less queuing, photo-friendly, subway-friendly, relaxed pace.
- Constraints: avoid rain, avoid long travel, avoid closed venues, avoid over-budget route.

## 4. Real Data Priority

### P0 Data

These are required before calling the product an online MVP:

- Real Shanghai POI search.
- POI address, district, coordinates, category, and rating or popularity signal.
- Route distance and travel time between stops.
- Shanghai weather forecast.
- Operating hours or open/closed state where available.

### P1 Data

These improve quality but can be estimated in the first release:

- Crowd or queue estimation.
- Per-person cost estimate.
- Subway convenience.
- Child-friendly or date-friendly tags.
- Booking or ticket links.

### Explicit Non-Goals

Do not include these in the first online MVP:

- Multi-city support.
- Multi-day travel.
- Automatic booking.
- Payment.
- Refund handling.
- Full real-time queue integration.
- Multi-user collaboration.
- Complex map cockpit UI as the core experience.

## 5. Backend Target Architecture

The backend should stop letting `PlanningService` directly return mock plans in production. Split the implementation into replaceable services:

- `PoiService`: search and normalize Shanghai POI.
- `WeatherService`: fetch Shanghai weekend forecast.
- `RouteService`: estimate travel time and distance.
- `PlannerService`: compose route candidates from constraints and real data.
- `RiskService`: detect weather, closed venue, travel-time, budget, and crowd risks.
- `ActionService`: expose next actions such as navigation, external booking links, sharing, and reminders.

The demo mock implementation can remain, but only behind a dev/demo environment mode.

## 6. Frontend Target Experience

The online MVP should prioritize a simple user flow:

1. Home prompt.
2. Planning/loading state.
3. Route result page.
4. Stop detail and replace action.
5. Risk prompt and replan action.
6. Confirm route.
7. Next actions.

Demo-only controls should be hidden outside development mode.

Production should not silently fall back to mock data. If real services fail, show a clear error or partial-data warning.

## 7. Production Readiness Requirements

Before MVP launch:

- Use `VITE_API_MODE=api` in production.
- Disable frontend mock fallback in production.
- Move persistent storage from local SQLite to a production database such as Postgres.
- Add database migrations.
- Add user or anonymous session identity.
- Persist plans, plan versions, risk events, and feedback.
- Add backend structured logs.
- Add API request latency and error logging.
- Add rate limiting for public endpoints.
- Add frontend and backend environment examples for production.
- Add CI for frontend build, backend lint, backend tests, and smoke tests.

## 8. MVP Acceptance Criteria

A release candidate is acceptable when this flow works:

1. User enters: "周末在上海市区玩半天，预算 500，地铁方便，别太累。"
2. System returns one route with 3 to 5 real Shanghai places.
3. Every recommended stop has address, area, time window, estimated cost, travel time, and recommendation reason.
4. Route times do not conflict.
5. Bad weather prefers indoor alternatives.
6. Closed or unavailable venues are not knowingly recommended.
7. User can replace at least one stop.
8. User can submit a new preference and trigger re-planning.
9. User can confirm the route.
10. Confirmation page exposes next actions: navigation, booking link or external action, share, reminder.

## 9. Recommended First Engineering Milestone

Milestone 1 should be "real Shanghai route generation":

- Keep the existing UI mostly intact.
- Add backend interfaces for POI, weather, route, and planning.
- Implement one real POI provider.
- Implement one weather provider.
- Implement route-time estimation.
- Generate a real Shanghai route for one prompt.
- Return partial-data warnings instead of mock success.

This milestone is the point where the project stops being only a demo and becomes a usable MVP foundation.
