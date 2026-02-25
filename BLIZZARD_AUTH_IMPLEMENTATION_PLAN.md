# Blizzard Auth Implementation Plan (Replace `playerNames.json`)

## Goal
Replace global name selection (`playerNames.json`) with authenticated user flow:
1. User signs in with Blizzard.
2. App resolves user battletag from authenticated identity.
3. App pulls W3C data only for that authenticated battletag.

## Scope
- In scope:
  - Backend OAuth integration (Authorization Code flow).
  - Session-based auth for frontend.
  - Frontend login/logout/account UX.
  - Backend proxy endpoint for user stats pull.
  - Remove runtime dependency on `playerNames.json` for account selection.
- Out of scope (for this phase):
  - Multi-account linking.
  - Admin impersonation.
  - Full DB caching layer (tracked separately in remediation plan).

## Target Architecture
1. Frontend (static UI):
   - Renders auth state.
   - Calls backend `/auth/*` and `/api/my-stats`.
2. Backend (Node/Express):
   - Handles Blizzard OAuth callback and session cookie.
   - Resolves canonical battletag for current user.
   - Calls W3C APIs server-side and returns transformed payload.
3. External providers:
   - Blizzard OAuth/profile APIs.
   - W3Champions APIs.

## Security Requirements
1. Keep `BLIZZARD_CLIENT_SECRET` server-only.
2. Use HTTP-only, `Secure`, `SameSite=Lax` session cookies.
3. Validate OAuth `state` to prevent CSRF.
4. Enforce auth on `/api/my-stats`; never trust battletag from client for this endpoint.
5. Add rate limits on auth callback and stats endpoints.
6. Do not log access tokens or secrets.

## Environment and Config
Add environment variables:
1. `BLIZZARD_CLIENT_ID`
2. `BLIZZARD_CLIENT_SECRET`
3. `BLIZZARD_REDIRECT_URI`
4. `SESSION_SECRET`
5. `APP_BASE_URL`
6. `NODE_ENV`

Optional:
1. `SESSION_TTL_HOURS`
2. `W3C_GATEWAY_DEFAULT`
3. `REQUEST_TIMEOUT_MS`

## API Contract (Backend)
### Auth endpoints
1. `GET /auth/login`
   - Redirects user to Blizzard authorize URL.
2. `GET /auth/callback`
   - Validates `state`, exchanges code for token, fetches profile, stores session, redirects to app.
3. `POST /auth/logout`
   - Destroys session; clears cookie.
4. `GET /auth/me`
   - Returns authenticated user summary:
   ```json
   {
     "authenticated": true,
     "battleTag": "User#12345",
     "displayName": "User"
   }
   ```

### Stats endpoint
1. `GET /api/my-stats?seasons=24,23&race=All`
   - Auth required.
   - Battletag derived from session.
   - Returns data needed by existing tables/charts.

## Data Flow
1. User clicks `Sign in with Blizzard`.
2. Browser -> `/auth/login` -> Blizzard authorize screen.
3. Blizzard redirects to `/auth/callback?code=...&state=...`.
4. Backend:
   - verifies `state`
   - exchanges `code`
   - fetches profile
   - stores `{ battleTag, displayName, region }` in session
5. Frontend calls `/auth/me` and renders authenticated state.
6. User clicks `Pull Match Data`.
7. Frontend calls `/api/my-stats`; backend queries W3C with session battletag.

## Frontend Changes
1. Remove name input dependency:
   - Remove `playerNames.json` loading in `populateDropdown.js`.
   - Replace name input with readonly account display from `/auth/me`.
2. Add auth controls:
   - `Sign in with Blizzard` button (logged out).
   - account badge + `Sign out` button (logged in).
3. Update pull flow:
   - `pullAndVisualize.js` should use backend endpoint instead of direct `playerId` input.
4. Add visible auth/session error messages.

## Backend Implementation Tasks
## Phase 1: Skeleton
1. Add Express server and middleware:
   - `express-session`
   - cookie/session config
   - JSON + URL encoded parsing
2. Add health endpoint: `GET /health`.

## Phase 2: OAuth
1. Implement `GET /auth/login`.
2. Implement `GET /auth/callback`:
   - state generation/storage/validation
   - token exchange
   - profile fetch
   - session write
3. Implement `GET /auth/me` and `POST /auth/logout`.

## Phase 3: W3C Proxy Endpoint
1. Implement `GET /api/my-stats`.
2. Reuse current stats transformation logic server-side (or return raw + transform client-side, pick one and keep consistent).
3. Add request timeout + retry policy for W3C calls.

## Phase 4: Frontend Integration
1. Update UI for auth state.
2. Remove name datalist usage.
3. Wire pull action to `/api/my-stats`.
4. Keep season and race selectors intact.

## Phase 5: Hardening
1. Add rate limiting.
2. Add centralized error handler.
3. Add structured logs with correlation IDs.
4. Add minimal e2e auth smoke test in local/dev environment.

## Testing Plan
1. Unit tests:
   - OAuth state validation.
   - session guard middleware.
   - battletag extraction/normalization.
2. Integration tests:
   - login -> callback -> `/auth/me`.
   - unauthorized access blocked for `/api/my-stats`.
   - authorized `/api/my-stats` returns expected schema.
3. Manual QA:
   - first login, reload, logout, session expiry, pull stats after login.

## Acceptance Criteria
1. App can be fully used without `playerNames.json`.
2. Authenticated user can pull only their own account stats.
3. Direct client battletag manipulation does not affect `/api/my-stats` identity.
4. Clear UI state for logged out, logged in, and expired session.
5. README updated with OAuth setup and local callback instructions.

## Risks and Mitigations
1. Blizzard profile battletag mismatch with W3C identifier format.
   - Mitigation: normalization utility + explicit mapping checks.
2. Region/gateway ambiguity.
   - Mitigation: configurable default gateway + UI override if needed.
3. OAuth callback misconfiguration across environments.
   - Mitigation: strict env validation at startup.
4. Increased complexity from introducing backend.
   - Mitigation: keep backend thin and focused on auth + proxy only.

## Rollout Strategy
1. Feature flag auth path while keeping existing flow temporarily.
2. Validate with a small set of users.
3. Remove legacy name-input path once stable.
4. Decommission `playerNames.json` refresh workflow.
