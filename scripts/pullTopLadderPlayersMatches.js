const { saveMatchSearchPayload, getCacheStats } = require('../cacheDb');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const BASE_URL = 'https://website-backend.w3champions.com';
const DEFAULT_GATEWAY = 20;
const DEFAULT_GAME_MODE = 1;
const DEFAULT_PAGE_SIZE = 50;

const SEASON_LIMIT = Number.parseInt(process.env.PULL_SEASON_LIMIT || '5', 10);
const LADDER_PAGE_LIMIT = Number.parseInt(process.env.PULL_LADDER_PAGE_LIMIT || '5', 10);
const MATCH_PAGE_SIZE = Number.parseInt(process.env.PULL_MATCH_PAGE_SIZE || String(DEFAULT_PAGE_SIZE), 10);
const MAX_MATCH_PAGES_PER_PLAYER_SEASON = Number.parseInt(process.env.PULL_MAX_MATCH_PAGES || '200', 10);
const MAX_RETRIES = Number.parseInt(process.env.PULL_MAX_RETRIES || '3', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.PULL_REQUEST_TIMEOUT_MS || '20000', 10);
const GATEWAY = Number.parseInt(process.env.PULL_GATEWAY || String(DEFAULT_GATEWAY), 10);
const GAME_MODE = Number.parseInt(process.env.PULL_GAME_MODE || String(DEFAULT_GAME_MODE), 10);
const SKIP_EXISTING = String(process.env.PULL_SKIP_EXISTING || 'true').toLowerCase() !== 'false';
const PLAYER_DELAY_MS = Number.parseInt(process.env.PULL_PLAYER_DELAY_MS || '500', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const backoffMs = 200 * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed request after ${MAX_RETRIES} attempts: ${url} (${lastError && lastError.message})`);
}

async function fetchLatestSeasonIds(limit) {
  const payload = await fetchJson(`${BASE_URL}/api/ladder/seasons`);
  return payload
    .map((season) => Number.parseInt(season.id, 10))
    .filter((seasonId) => Number.isFinite(seasonId) && seasonId > 0)
    .sort((left, right) => right - left)
    .slice(0, limit);
}

function extractBattleTagsFromLadderRows(rows) {
  const tags = [];
  if (!Array.isArray(rows)) {
    return tags;
  }

  for (const row of rows) {
    if (!row || !Array.isArray(row.playersInfo)) {
      continue;
    }
    for (const playerInfo of row.playersInfo) {
      if (
        playerInfo &&
        typeof playerInfo.battleTag === 'string' &&
        playerInfo.battleTag.length > 0
      ) {
        tags.push(playerInfo.battleTag);
      }
    }
  }

  return tags;
}

async function fetchLadderPlayersForSeason(seasonId, pageLimit) {
  const players = new Set();

  for (let page = 1; page <= pageLimit; page += 1) {
    const url = `${BASE_URL}/api/ladder/${page}?gateWay=${GATEWAY}&gameMode=${GAME_MODE}&season=${seasonId}`;
    const rows = await fetchJson(url);
    const pageTags = extractBattleTagsFromLadderRows(rows);
    pageTags.forEach((battleTag) => players.add(battleTag));
    process.stdout.write(`season ${seasonId} ladder page ${page}: ${pageTags.length} players\n`);
  }

  return Array.from(players).sort((a, b) => a.localeCompare(b));
}

async function fetchAndPersistPlayerSeasonMatches(playerId, seasonId, stats) {
  let offset = 0;
  let page = 0;

  while (true) {
    if (page >= MAX_MATCH_PAGES_PER_PLAYER_SEASON) {
      process.stdout.write(
        `reached max pages (${MAX_MATCH_PAGES_PER_PLAYER_SEASON}) for ${playerId} season ${seasonId}\n`
      );
      break;
    }

    const query = {
      playerId,
      gateway: GATEWAY,
      season: seasonId,
      offset,
      pageSize: MATCH_PAGE_SIZE,
    };

    const params = new URLSearchParams({
      playerId,
      gateway: String(query.gateway),
      offset: String(query.offset),
      pageSize: String(query.pageSize),
      season: String(query.season),
    });
    const url = `${BASE_URL}/api/matches/search?${params.toString()}`;
    const payload = await fetchJson(url);
    const saveResult = await saveMatchSearchPayload(query, payload, 'seed-top-ladder-players');

    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    stats.totalMatchRequests += 1;
    stats.totalMatchesPersisted += saveResult.matchCount;

    if (matches.length < query.pageSize) {
      break;
    }

    offset += query.pageSize;
    page += 1;
  }
}

async function loadExistingSeededPairs() {
  const cacheStats = await getCacheStats();
  const db = await open({
    filename: path.resolve(cacheStats.databasePath),
    driver: sqlite3.Database,
  });

  const rows = await db.all(`
    SELECT season, player_id
    FROM w3c_match_search_payloads
    WHERE source = 'seed-top-ladder-players'
    GROUP BY season, player_id
  `);

  await db.close();

  const existing = new Set();
  for (const row of rows) {
    if (!row) {
      continue;
    }
    existing.add(`${row.season}|${row.player_id}`);
  }
  return existing;
}

async function main() {
  if (!Number.isFinite(SEASON_LIMIT) || SEASON_LIMIT <= 0) {
    throw new Error('PULL_SEASON_LIMIT must be a positive integer');
  }
  if (!Number.isFinite(LADDER_PAGE_LIMIT) || LADDER_PAGE_LIMIT <= 0) {
    throw new Error('PULL_LADDER_PAGE_LIMIT must be a positive integer');
  }
  if (!Number.isFinite(MATCH_PAGE_SIZE) || MATCH_PAGE_SIZE <= 0 || MATCH_PAGE_SIZE > 100) {
    throw new Error('PULL_MATCH_PAGE_SIZE must be an integer between 1 and 100');
  }
  if (!Number.isFinite(MAX_MATCH_PAGES_PER_PLAYER_SEASON) || MAX_MATCH_PAGES_PER_PLAYER_SEASON <= 0) {
    throw new Error('PULL_MAX_MATCH_PAGES must be a positive integer');
  }
  if (!Number.isFinite(PLAYER_DELAY_MS) || PLAYER_DELAY_MS < 0) {
    throw new Error('PULL_PLAYER_DELAY_MS must be an integer greater than or equal to 0');
  }

  const stats = {
    seasons: [],
    totalSeedPlayers: 0,
    totalPlayerSeasonTasks: 0,
    totalMatchRequests: 0,
    totalMatchesPersisted: 0,
  };

  const seasonIds = await fetchLatestSeasonIds(SEASON_LIMIT);
  stats.seasons = seasonIds;
  process.stdout.write(`latest seasons selected: ${seasonIds.join(', ')}\n`);

  const existingPairs = SKIP_EXISTING ? await loadExistingSeededPairs() : new Set();
  if (SKIP_EXISTING) {
    process.stdout.write(`resume mode: skipping ${existingPairs.size} already-seeded player-season pairs\n`);
  }

  const seasonPlayers = new Map();
  for (const seasonId of seasonIds) {
    const players = await fetchLadderPlayersForSeason(seasonId, LADDER_PAGE_LIMIT);
    seasonPlayers.set(seasonId, players);
    stats.totalSeedPlayers += players.length;
    stats.totalPlayerSeasonTasks += players.length;
    process.stdout.write(`season ${seasonId}: ${players.length} unique ladder players (pages 1-${LADDER_PAGE_LIMIT})\n`);
  }

  for (const seasonId of seasonIds) {
    const players = seasonPlayers.get(seasonId) || [];
    let completed = 0;
    for (const playerId of players) {
      completed += 1;
      const playerSeasonKey = `${seasonId}|${playerId}`;
      if (SKIP_EXISTING && existingPairs.has(playerSeasonKey)) {
        process.stdout.write(`[${seasonId}] ${completed}/${players.length} skip ${playerId} (already seeded)\n`);
        continue;
      }
      process.stdout.write(`[${seasonId}] ${completed}/${players.length} pulling ${playerId}\n`);
      await fetchAndPersistPlayerSeasonMatches(playerId, seasonId, stats);
      existingPairs.add(playerSeasonKey);
      if (PLAYER_DELAY_MS > 0) {
        await sleep(PLAYER_DELAY_MS);
      }
    }
  }

  const cacheStats = await getCacheStats();

  process.stdout.write('\npull completed\n');
  process.stdout.write(`seasons processed: ${stats.seasons.join(', ')}\n`);
  process.stdout.write(`seed players (sum of unique players per season): ${stats.totalSeedPlayers}\n`);
  process.stdout.write(`player-season pulls: ${stats.totalPlayerSeasonTasks}\n`);
  process.stdout.write(`match-search requests stored: ${stats.totalMatchRequests}\n`);
  process.stdout.write(`matches persisted (raw + flat upserts): ${stats.totalMatchesPersisted}\n`);
  process.stdout.write(
    `cache stats: payloadRows=${cacheStats.payloadRows}, cachedRequests=${cacheStats.cachedRequests}, cachedMatches=${cacheStats.cachedMatches}, flattenedMatches=${cacheStats.flattenedMatches}\n`
  );
  process.stdout.write(`database: ${cacheStats.databasePath}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
