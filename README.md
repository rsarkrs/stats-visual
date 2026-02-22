# Stats Visual

This app pulls player match history from W3Champions and visualizes summary and interval stats.

## Usage
Before first use (and whenever you want to refresh names), run:

```powershell
npm run refresh:names
```

1. Select one or more seasons.
2. Select a race.
3. Select a player name.
4. Click `Pull Match Data`.

Multi-select seasons with `Shift + Left Click` or `Alt + Left Click`.

## Local Run (Required)
Do not open `index.html` with `file://`. The app uses `fetch()` and must run from an HTTP server.

Preferred (deterministic runtime with pinned dev tooling):

```powershell
npm install
npm run start
```

Then open:

`http://localhost:8000/index.html`

Fallback without npm tooling:

```powershell
python -m http.server 8000
```

If `python` is not available:

```powershell
py -m http.server 8000
```

Then open:

`http://localhost:8000/index.html`

Stop the server with `Ctrl + C`.

## Known Limitations
- `playerNames.json` is refreshed manually (not scheduled/automatic).

## Notes
- Chart.js and chartjs-plugin-annotation are pinned to explicit CDN versions in `index.html` for stable behavior.

## Quality Checks
Run syntax checks:

```powershell
npm run check
```

Refresh local player names cache:

```powershell
npm run refresh:names
```

Manual regression checklist:
- Pull single-season and multi-season data; verify both tables populate.
- Verify graph 1 renders avg line, X min/max markers, and LCL/UCL bars.
- Verify graph 2 player-race filter starts on `All` and each race button isolates one race.
- Export both tables and confirm filenames are unique and CSV values stay quoted in spreadsheet apps.
