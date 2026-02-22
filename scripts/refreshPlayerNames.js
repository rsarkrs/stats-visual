const fs = require('node:fs/promises');
const path = require('node:path');

const BASE_URL = 'https://website-backend.w3champions.com';
const GATEWAY = 20;
const GAME_MODE = 1;
const OUTPUT_PATH = path.resolve(__dirname, '..', 'playerNames.json');
const MAX_RETRIES = 3;

async function fetchJson(url) {
  let attempt = 0;
  let lastError;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} attempts: ${url} (${lastError.message})`);
}

async function fetchSeasonIds() {
  const seasons = await fetchJson(`${BASE_URL}/api/ladder/seasons`);
  return seasons
    .map((season) => Number.parseInt(season.id, 10))
    .filter((seasonId) => Number.isFinite(seasonId) && seasonId > 0)
    .sort((a, b) => b - a);
}

function extractBattleTags(ladderRows) {
  const tags = [];

  for (const row of ladderRows) {
    if (!row || !Array.isArray(row.playersInfo)) {
      continue;
    }

    for (const player of row.playersInfo) {
      if (player && typeof player.battleTag === 'string' && player.battleTag.length > 0) {
        tags.push(player.battleTag);
      }
    }
  }

  return tags;
}

async function fetchSeasonBattleTags(seasonId) {
  const tags = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/api/ladder/${page}?gateWay=${GATEWAY}&gameMode=${GAME_MODE}&season=${seasonId}`;
    const ladderRows = await fetchJson(url);

    if (!Array.isArray(ladderRows) || ladderRows.length === 0) {
      break;
    }

    const pageTags = extractBattleTags(ladderRows);
    if (pageTags.length === 0) {
      break;
    }

    tags.push(...pageTags);
    page += 1;
  }

  return tags;
}

function buildOutputPayload(seasons, battleTags) {
  return {
    generatedAt: new Date().toISOString(),
    source: {
      endpointPattern: '/api/ladder/{PAGE_NUMBER}?gateWay=20&gameMode=1&season={SEASON_NUMBER}',
      gateway: GATEWAY,
      gameMode: GAME_MODE,
      seasons,
    },
    count: battleTags.length,
    battleTags,
  };
}

async function main() {
  const seasons = await fetchSeasonIds();
  const dedupe = new Set();

  for (const seasonId of seasons) {
    process.stdout.write(`Fetching season ${seasonId}... `);
    const seasonTags = await fetchSeasonBattleTags(seasonId);
    seasonTags.forEach((battleTag) => dedupe.add(battleTag));
    process.stdout.write(`${seasonTags.length} tags\n`);
  }

  const battleTags = Array.from(dedupe).sort((a, b) => a.localeCompare(b));
  const payload = buildOutputPayload(seasons, battleTags);

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${battleTags.length} unique names to ${OUTPUT_PATH}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
