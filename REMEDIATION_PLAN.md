# Stats Visual Remediation Plan

## Current Concerns (Post-Refactor)
1. Name selection scalability: `playerNames.json` currently loads ~50k names directly into a `<datalist>`, which can degrade browser responsiveness and input usability.
2. Data freshness and drift: `playerNames.json` refresh is manual with no stale-data warning, no age check, and no guard that the file matches current API behavior.
3. API resilience and UX feedback: API failures are mostly logged to console; user-facing errors/retry states are limited.
4. Long-term maintainability: `pullAndVisualize.js` is still a large monolith with tightly coupled fetch, transform, DOM rendering, and chart logic.
5. Deterministic dependency/runtime risk: chart dependencies are CDN-based and can still break on network/CDN issues.
6. Lightweight QA coverage: there are syntax checks, but no behavioral/regression tests for key transformations.

## Priority 0: Runtime Performance and Data Reliability
1. Replace full datalist population with incremental name search:
   - Option A: client-side prefix index over `playerNames.json` and render top-N matches.
   - Option B: call W3C search endpoint on input and cache results.
2. Add stale-data policy for `playerNames.json`:
   - Read `generatedAt` and show warning if older than threshold (for example 7-14 days).
   - Add UI hint with command: `npm run refresh:names`.
3. Harden `refreshPlayerNames.js`:
   - Add max page guard per season.
   - Add retry backoff with jitter.
   - Add run summary (seasons processed, pages fetched, dedupe ratio).

## Priority 1: API Failure Handling and User Experience
1. Add centralized `fetchJson` helper in frontend with timeout, consistent error objects, and retry policy for transient failures.
2. Surface errors in UI (inline alert/banner) instead of console-only messages for:
   - seasons fetch
   - player names load
   - match pull requests
3. Add empty-state handling for no data returned (table and chart placeholders instead of blank displays).

## Priority 1: Refactor for Maintainability
1. Split `pullAndVisualize.js` into focused modules/functions:
   - data access (`matches`, `seasons`)
   - transformation/stat aggregation
   - table rendering
   - chart rendering/filter controls
2. Introduce a single race utility module as source of truth for name/id mappings and labels (already started via `raceConfig.js`; complete migration).
3. Remove remaining duplicated parsing/normalization paths and normalize number/race coercion in one place.

## Priority 2: Deterministic Packaging and Offline Friendliness
1. Vendor Chart.js and annotation plugin locally (or add integrity hashes and fallback loading) to reduce CDN fragility.
2. Expand `.gitignore` baseline (`node_modules`, logs, local artifacts) to avoid accidental commits.
3. Add a lightweight CI check step (`npm run check`) to enforce syntax health on every change.

## Priority 2: QA and Regression Safety
1. Add automated tests for critical transforms:
   - season selection resolution
   - race mapping
   - interval bucket aggregation
   - duplicate row suppression
2. Add integration smoke tests for:
   - pull single season
   - pull multiple seasons
   - race filter behavior in graph #2
   - CSV export correctness

## Future: Hybrid Cache Database (Old Seasons Cached, Latest Season Live)
1. Introduce a lightweight backend service (Node.js) with a local database (SQLite recommended).
2. Add cache policy by season:
   - seasons older than latest: serve from DB cache by default
   - latest season: call W3C API live (optionally upsert cache)
3. Add cache population strategy:
   - on-demand cache fill when user requests uncached historical season/player data
   - optional background pre-warm job for frequently requested players/seasons
4. Add cache invalidation/versioning:
   - store schema/version in metadata table
   - invalidate computed cache rows when aggregation logic changes
5. Add backend API endpoint for frontend consumption (frontend stops calling W3C directly).
6. Add observability and controls:
   - log cache hit/miss rates
   - provide manual refresh/rebuild command for historical cache
