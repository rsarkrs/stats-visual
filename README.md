# Stats Visual

This app pulls player match history from W3Champions and visualizes summary and interval stats.

## Usage
Before first use (and whenever you want to refresh names), run:

```powershell
npm run refresh:names
```

1. Select one or more seasons.
2. Select a race.
3. Select a player name (battle tag) from the list.
4. Click `Pull Match Data`.

Multi-select seasons with `Shift + Left Click` or `Alt + Left Click`.

## Local Run (Required)
Do not open `index.html` with `file://`. The app uses `fetch()` and must run from the Node backend HTTP server.

Preferred:

```powershell
npm install
npm run start
```

Then open:

`http://localhost:8000/index.html`

Stop the server with `Ctrl + C`.

## Known Limitations
1. `playerNames.json` is refreshed manually (not scheduled/automatic).

## Optional OAuth Work (Preserved)
OAuth/backend implementation files are kept for future use:
1. `server.js`
2. `auth.js`
3. `.env.example`
4. `BLIZZARD_AUTH_IMPLEMENTATION_PLAN.md`

Current runtime path uses `playerNames.json` for battletag selection and `server.js` as a proxy/cache for W3C matches.

## SQLite Cache
1. Match search responses are stored in SQLite at `data/w3c-cache.sqlite`.
2. Full `/api/matches/search` payload JSON is stored per request/page.
3. Full raw match JSON objects are stored per match id.
4. Cache stats endpoint: `GET /api/cache/stats`

## Notes
1. Chart.js and chartjs-plugin-annotation are pinned to explicit CDN versions in `index.html` for stable behavior.

## Quality Checks
Run syntax checks:

```powershell
npm run check
```

Refresh local player names cache:

```powershell
npm run refresh:names
```

Seed SQLite match cache from ladder pages (latest 5 seasons, pages 1-5):

```powershell
npm run pull:matches:top5x5
```
