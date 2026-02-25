const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'w3c-cache.sqlite');

let dbPromise = null;

const REQUIRED_FLAT_COLUMNS = [
  ['teams_json', 'TEXT'],
  ['server_info_json', 'TEXT'],
  ['server_player_infos_json', 'TEXT'],
  ['p1_ranking_rp', 'REAL'],
  ['p1_ranking_rank', 'INTEGER'],
  ['p1_ranking_division', 'INTEGER'],
  ['p1_ranking_league_id', 'INTEGER'],
  ['p1_ranking_league_order', 'INTEGER'],
  ['p1_ranking_progress', 'REAL'],
  ['p1_ranking_json', 'TEXT'],
  ['p2_ranking_rp', 'REAL'],
  ['p2_ranking_rank', 'INTEGER'],
  ['p2_ranking_division', 'INTEGER'],
  ['p2_ranking_league_id', 'INTEGER'],
  ['p2_ranking_league_order', 'INTEGER'],
  ['p2_ranking_progress', 'REAL'],
  ['p2_ranking_json', 'TEXT'],
];

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildRequestKey(query) {
  return `${query.playerId}|${query.gateway}|${query.season}|${query.offset}|${query.pageSize}`;
}

function extractMatchId(match) {
  const candidates = [
    match && match.id,
    match && match.matchId,
    match && match.gameId,
    match && match.game_id,
    match && match.lobbyGameId,
  ];

  const firstValid = candidates.find((value) => value !== undefined && value !== null && String(value).length > 0);
  if (firstValid) {
    return String(firstValid);
  }

  return `sha256:${hashObject(match)}`;
}

async function getDb() {
  if (!dbPromise) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec('PRAGMA journal_mode = WAL;');
      await db.exec('PRAGMA foreign_keys = ON;');

      await db.exec(`
        CREATE TABLE IF NOT EXISTS w3c_match_search_payloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_key TEXT NOT NULL,
          player_id TEXT NOT NULL,
          gateway INTEGER NOT NULL,
          season INTEGER NOT NULL,
          offset INTEGER NOT NULL,
          page_size INTEGER NOT NULL,
          source TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          payload_hash TEXT NOT NULL
        );
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS w3c_match_search_cache (
          request_key TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          gateway INTEGER NOT NULL,
          season INTEGER NOT NULL,
          offset INTEGER NOT NULL,
          page_size INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          payload_hash TEXT NOT NULL
        );
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS w3c_matches_raw (
          match_id TEXT PRIMARY KEY,
          season INTEGER,
          first_seen_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          payload_hash TEXT NOT NULL
        );
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS w3c_matches_flat (
          match_id TEXT PRIMARY KEY,
          map TEXT,
          map_name TEXT,
          map_id INTEGER,
          original_ongoing_match_id TEXT,
          flo_match_id INTEGER,
          duration_in_seconds INTEGER,
          start_time TEXT,
          end_time TEXT,
          game_mode INTEGER,
          gateway INTEGER,
          season INTEGER,
          game_number INTEGER,
          team1_won INTEGER,
          team1_match_ranking INTEGER,
          p1_race INTEGER,
          p1_rnd_race INTEGER,
          p1_old_mmr INTEGER,
          p1_old_mmr_quantile REAL,
          p1_old_rank_deviation REAL,
          p1_current_mmr INTEGER,
          p1_battle_tag TEXT,
          p1_invite_name TEXT,
          p1_name TEXT,
          p1_mmr_gain INTEGER,
          p1_won INTEGER,
          p1_match_ranking INTEGER,
          p1_location TEXT,
          p1_country_code TEXT,
          p1_country TEXT,
          p1_twitch TEXT,
          p1_heroes_json TEXT,
          p1_ranking INTEGER,
          team2_won INTEGER,
          team2_match_ranking INTEGER,
          p2_race INTEGER,
          p2_rnd_race INTEGER,
          p2_old_mmr INTEGER,
          p2_old_mmr_quantile REAL,
          p2_old_rank_deviation REAL,
          p2_current_mmr INTEGER,
          p2_battle_tag TEXT,
          p2_invite_name TEXT,
          p2_name TEXT,
          p2_mmr_gain INTEGER,
          p2_won INTEGER,
          p2_match_ranking INTEGER,
          p2_location TEXT,
          p2_country_code TEXT,
          p2_country TEXT,
          p2_twitch TEXT,
          p2_heroes_json TEXT,
          p2_ranking INTEGER,
          server_provider TEXT,
          server_node_id INTEGER,
          server_country_code TEXT,
          server_location TEXT,
          server_name TEXT,
          p1_avg_ping INTEGER,
          p1_current_ping INTEGER,
          p2_avg_ping INTEGER,
          p2_current_ping INTEGER,
          teams_json TEXT,
          server_info_json TEXT,
          server_player_infos_json TEXT,
          p1_ranking_rp REAL,
          p1_ranking_rank INTEGER,
          p1_ranking_division INTEGER,
          p1_ranking_league_id INTEGER,
          p1_ranking_league_order INTEGER,
          p1_ranking_progress REAL,
          p1_ranking_json TEXT,
          p2_ranking_rp REAL,
          p2_ranking_rank INTEGER,
          p2_ranking_division INTEGER,
          p2_ranking_league_id INTEGER,
          p2_ranking_league_order INTEGER,
          p2_ranking_progress REAL,
          p2_ranking_json TEXT,
          raw_payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const flatColumns = await db.all('PRAGMA table_info(w3c_matches_flat)');
      const existingFlatColumns = new Set(flatColumns.map((column) => column.name));
      for (const requiredColumn of REQUIRED_FLAT_COLUMNS) {
        const columnName = requiredColumn[0];
        const columnType = requiredColumn[1];
        if (!existingFlatColumns.has(columnName)) {
          await db.exec(`ALTER TABLE w3c_matches_flat ADD COLUMN ${columnName} ${columnType};`);
        }
      }

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_w3c_match_search_payloads_player_season
        ON w3c_match_search_payloads (player_id, season, fetched_at);
      `);

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_w3c_match_search_cache_player_season
        ON w3c_match_search_cache (player_id, season);
      `);

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_w3c_matches_raw_season_last_seen
        ON w3c_matches_raw (season, last_seen_at);
      `);

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_w3c_matches_flat_season_end_time
        ON w3c_matches_flat (season, end_time);
      `);

      return db;
    });
  }

  return dbPromise;
}

async function getCachedMatchSearchPayload(query) {
  const db = await getDb();
  const requestKey = buildRequestKey(query);
  const row = await db.get(
    `SELECT payload_json, updated_at, payload_hash
     FROM w3c_match_search_cache
     WHERE request_key = ?`,
    requestKey
  );

  if (!row) {
    return null;
  }

  return {
    requestKey,
    updatedAt: row.updated_at,
    payloadHash: row.payload_hash,
    payload: JSON.parse(row.payload_json),
  };
}

async function saveMatchSearchPayload(query, payload, source) {
  const db = await getDb();
  const now = new Date().toISOString();
  const requestKey = buildRequestKey(query);
  const payloadHash = hashObject(payload);
  const payloadJson = JSON.stringify(payload);

  await db.run(
    `INSERT INTO w3c_match_search_payloads (
       request_key, player_id, gateway, season, offset, page_size,
       source, fetched_at, payload_json, payload_hash
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      requestKey,
      query.playerId,
      query.gateway,
      query.season,
      query.offset,
      query.pageSize,
      source,
      now,
      payloadJson,
      payloadHash,
    ]
  );

  await db.run(
    `INSERT INTO w3c_match_search_cache (
       request_key, player_id, gateway, season, offset, page_size,
       updated_at, payload_json, payload_hash
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(request_key) DO UPDATE SET
       updated_at = excluded.updated_at,
       payload_json = excluded.payload_json,
       payload_hash = excluded.payload_hash`,
    [
      requestKey,
      query.playerId,
      query.gateway,
      query.season,
      query.offset,
      query.pageSize,
      now,
      payloadJson,
      payloadHash,
    ]
  );

  const matches = payload && Array.isArray(payload.matches) ? payload.matches : [];
  for (const match of matches) {
    const matchId = extractMatchId(match);
    const matchPayloadJson = JSON.stringify(match);
    const matchPayloadHash = hashObject(match);
    const teams = Array.isArray(match.teams) ? match.teams : [];
    const team1 = teams[0] && typeof teams[0] === 'object' ? teams[0] : {};
    const team2 = teams[1] && typeof teams[1] === 'object' ? teams[1] : {};
    const team1Players = Array.isArray(team1.players) ? team1.players : [];
    const team2Players = Array.isArray(team2.players) ? team2.players : [];
    const player1 = team1Players[0] && typeof team1Players[0] === 'object' ? team1Players[0] : {};
    const player2 = team2Players[0] && typeof team2Players[0] === 'object' ? team2Players[0] : {};

    const serverInfo = match.serverInfo && typeof match.serverInfo === 'object' ? match.serverInfo : {};
    const playerServerInfos = Array.isArray(serverInfo.playerServerInfos) ? serverInfo.playerServerInfos : [];
    const pingByTag = new Map();
    for (const playerServerInfo of playerServerInfos) {
      if (!playerServerInfo || typeof playerServerInfo !== 'object') {
        continue;
      }
      const battleTag = typeof playerServerInfo.battleTag === 'string'
        ? playerServerInfo.battleTag
        : '';
      if (!battleTag) {
        continue;
      }
      pingByTag.set(battleTag.toLowerCase(), playerServerInfo);
    }

    const player1TagKey = typeof player1.battleTag === 'string' ? player1.battleTag.toLowerCase() : '';
    const player2TagKey = typeof player2.battleTag === 'string' ? player2.battleTag.toLowerCase() : '';
    const p1Server = player1TagKey ? pingByTag.get(player1TagKey) : null;
    const p2Server = player2TagKey ? pingByTag.get(player2TagKey) : null;
    const p1Ranking = player1.ranking && typeof player1.ranking === 'object' ? player1.ranking : null;
    const p2Ranking = player2.ranking && typeof player2.ranking === 'object' ? player2.ranking : null;
    const teamsJson = teams.length > 0 ? JSON.stringify(teams) : null;
    const serverInfoJson = Object.keys(serverInfo).length > 0 ? JSON.stringify(serverInfo) : null;
    const playerServerInfosJson = playerServerInfos.length > 0 ? JSON.stringify(playerServerInfos) : null;

    await db.run(
      `INSERT INTO w3c_matches_raw (
         match_id, season, first_seen_at, last_seen_at, payload_json, payload_hash
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(match_id) DO UPDATE SET
         season = excluded.season,
         last_seen_at = excluded.last_seen_at,
         payload_json = excluded.payload_json,
         payload_hash = excluded.payload_hash`,
      [
        matchId,
        query.season,
        now,
        now,
        matchPayloadJson,
        matchPayloadHash,
        ]
    );

    await db.run(
      `INSERT INTO w3c_matches_flat (
         match_id, map, map_name, map_id, original_ongoing_match_id, flo_match_id,
         duration_in_seconds, start_time, end_time, game_mode, gateway, season, game_number,
         team1_won, team1_match_ranking,
         p1_race, p1_rnd_race, p1_old_mmr, p1_old_mmr_quantile, p1_old_rank_deviation,
         p1_current_mmr, p1_battle_tag, p1_invite_name, p1_name, p1_mmr_gain, p1_won,
         p1_match_ranking, p1_location, p1_country_code, p1_country, p1_twitch,
         p1_heroes_json, p1_ranking,
         team2_won, team2_match_ranking,
         p2_race, p2_rnd_race, p2_old_mmr, p2_old_mmr_quantile, p2_old_rank_deviation,
         p2_current_mmr, p2_battle_tag, p2_invite_name, p2_name, p2_mmr_gain, p2_won,
         p2_match_ranking, p2_location, p2_country_code, p2_country, p2_twitch,
         p2_heroes_json, p2_ranking,
         server_provider, server_node_id, server_country_code, server_location, server_name,
         p1_avg_ping, p1_current_ping, p2_avg_ping, p2_current_ping,
         teams_json, server_info_json, server_player_infos_json,
         p1_ranking_rp, p1_ranking_rank, p1_ranking_division, p1_ranking_league_id, p1_ranking_league_order, p1_ranking_progress, p1_ranking_json,
         p2_ranking_rp, p2_ranking_rank, p2_ranking_division, p2_ranking_league_id, p2_ranking_league_order, p2_ranking_progress, p2_ranking_json,
         raw_payload_json, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?,
         ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?,
         ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?
       )
       ON CONFLICT(match_id) DO UPDATE SET
         map = excluded.map,
         map_name = excluded.map_name,
         map_id = excluded.map_id,
         original_ongoing_match_id = excluded.original_ongoing_match_id,
         flo_match_id = excluded.flo_match_id,
         duration_in_seconds = excluded.duration_in_seconds,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         game_mode = excluded.game_mode,
         gateway = excluded.gateway,
         season = excluded.season,
         game_number = excluded.game_number,
         team1_won = excluded.team1_won,
         team1_match_ranking = excluded.team1_match_ranking,
         p1_race = excluded.p1_race,
         p1_rnd_race = excluded.p1_rnd_race,
         p1_old_mmr = excluded.p1_old_mmr,
         p1_old_mmr_quantile = excluded.p1_old_mmr_quantile,
         p1_old_rank_deviation = excluded.p1_old_rank_deviation,
         p1_current_mmr = excluded.p1_current_mmr,
         p1_battle_tag = excluded.p1_battle_tag,
         p1_invite_name = excluded.p1_invite_name,
         p1_name = excluded.p1_name,
         p1_mmr_gain = excluded.p1_mmr_gain,
         p1_won = excluded.p1_won,
         p1_match_ranking = excluded.p1_match_ranking,
         p1_location = excluded.p1_location,
         p1_country_code = excluded.p1_country_code,
         p1_country = excluded.p1_country,
         p1_twitch = excluded.p1_twitch,
         p1_heroes_json = excluded.p1_heroes_json,
         p1_ranking = excluded.p1_ranking,
         team2_won = excluded.team2_won,
         team2_match_ranking = excluded.team2_match_ranking,
         p2_race = excluded.p2_race,
         p2_rnd_race = excluded.p2_rnd_race,
         p2_old_mmr = excluded.p2_old_mmr,
         p2_old_mmr_quantile = excluded.p2_old_mmr_quantile,
         p2_old_rank_deviation = excluded.p2_old_rank_deviation,
         p2_current_mmr = excluded.p2_current_mmr,
         p2_battle_tag = excluded.p2_battle_tag,
         p2_invite_name = excluded.p2_invite_name,
         p2_name = excluded.p2_name,
         p2_mmr_gain = excluded.p2_mmr_gain,
         p2_won = excluded.p2_won,
         p2_match_ranking = excluded.p2_match_ranking,
         p2_location = excluded.p2_location,
         p2_country_code = excluded.p2_country_code,
         p2_country = excluded.p2_country,
         p2_twitch = excluded.p2_twitch,
         p2_heroes_json = excluded.p2_heroes_json,
         p2_ranking = excluded.p2_ranking,
         server_provider = excluded.server_provider,
         server_node_id = excluded.server_node_id,
         server_country_code = excluded.server_country_code,
         server_location = excluded.server_location,
         server_name = excluded.server_name,
         p1_avg_ping = excluded.p1_avg_ping,
         p1_current_ping = excluded.p1_current_ping,
         p2_avg_ping = excluded.p2_avg_ping,
         p2_current_ping = excluded.p2_current_ping,
         teams_json = excluded.teams_json,
         server_info_json = excluded.server_info_json,
         server_player_infos_json = excluded.server_player_infos_json,
         p1_ranking_rp = excluded.p1_ranking_rp,
         p1_ranking_rank = excluded.p1_ranking_rank,
         p1_ranking_division = excluded.p1_ranking_division,
         p1_ranking_league_id = excluded.p1_ranking_league_id,
         p1_ranking_league_order = excluded.p1_ranking_league_order,
         p1_ranking_progress = excluded.p1_ranking_progress,
         p1_ranking_json = excluded.p1_ranking_json,
         p2_ranking_rp = excluded.p2_ranking_rp,
         p2_ranking_rank = excluded.p2_ranking_rank,
         p2_ranking_division = excluded.p2_ranking_division,
         p2_ranking_league_id = excluded.p2_ranking_league_id,
         p2_ranking_league_order = excluded.p2_ranking_league_order,
         p2_ranking_progress = excluded.p2_ranking_progress,
         p2_ranking_json = excluded.p2_ranking_json,
         raw_payload_json = excluded.raw_payload_json,
         updated_at = excluded.updated_at`,
      [
        matchId,
        match.map ?? null,
        match.mapName ?? null,
        match.mapId ?? null,
        match['original-ongoing-match-id'] ?? null,
        match.floMatchId ?? null,
        match.durationInSeconds ?? null,
        match.startTime ?? null,
        match.endTime ?? null,
        match.gameMode ?? null,
        match.gateWay ?? null,
        match.season ?? query.season,
        match.number ?? null,
        team1.won ?? null,
        team1.matchRanking ?? null,
        player1.race ?? null,
        player1.rndRace ?? null,
        player1.oldMmr ?? null,
        player1.oldMmrQuantile ?? null,
        player1.oldRankDeviation ?? null,
        player1.currentMmr ?? null,
        player1.battleTag ?? null,
        player1.inviteName ?? null,
        player1.name ?? null,
        player1.mmrGain ?? null,
        player1.won ?? null,
        player1.matchRanking ?? null,
        player1.location ?? null,
        player1.countryCode ?? null,
        player1.country ?? null,
        player1.twitch ?? null,
        player1.heroes === null || player1.heroes === undefined ? null : JSON.stringify(player1.heroes),
        p1Ranking && p1Ranking.rank !== undefined ? p1Ranking.rank : null,
        team2.won ?? null,
        team2.matchRanking ?? null,
        player2.race ?? null,
        player2.rndRace ?? null,
        player2.oldMmr ?? null,
        player2.oldMmrQuantile ?? null,
        player2.oldRankDeviation ?? null,
        player2.currentMmr ?? null,
        player2.battleTag ?? null,
        player2.inviteName ?? null,
        player2.name ?? null,
        player2.mmrGain ?? null,
        player2.won ?? null,
        player2.matchRanking ?? null,
        player2.location ?? null,
        player2.countryCode ?? null,
        player2.country ?? null,
        player2.twitch ?? null,
        player2.heroes === null || player2.heroes === undefined ? null : JSON.stringify(player2.heroes),
        p2Ranking && p2Ranking.rank !== undefined ? p2Ranking.rank : null,
        serverInfo.provider ?? null,
        serverInfo.nodeId ?? null,
        serverInfo.countryCode ?? null,
        serverInfo.location ?? null,
        serverInfo.name ?? null,
        p1Server && p1Server.averagePing !== undefined ? p1Server.averagePing : null,
        p1Server && p1Server.currentPing !== undefined ? p1Server.currentPing : null,
        p2Server && p2Server.averagePing !== undefined ? p2Server.averagePing : null,
        p2Server && p2Server.currentPing !== undefined ? p2Server.currentPing : null,
        teamsJson,
        serverInfoJson,
        playerServerInfosJson,
        p1Ranking && p1Ranking.rp !== undefined ? p1Ranking.rp : null,
        p1Ranking && p1Ranking.rank !== undefined ? p1Ranking.rank : null,
        p1Ranking && p1Ranking.division !== undefined ? p1Ranking.division : null,
        p1Ranking && p1Ranking.leagueId !== undefined ? p1Ranking.leagueId : null,
        p1Ranking && p1Ranking.leagueOrder !== undefined ? p1Ranking.leagueOrder : null,
        p1Ranking && p1Ranking.progress !== undefined ? p1Ranking.progress : null,
        p1Ranking ? JSON.stringify(p1Ranking) : null,
        p2Ranking && p2Ranking.rp !== undefined ? p2Ranking.rp : null,
        p2Ranking && p2Ranking.rank !== undefined ? p2Ranking.rank : null,
        p2Ranking && p2Ranking.division !== undefined ? p2Ranking.division : null,
        p2Ranking && p2Ranking.leagueId !== undefined ? p2Ranking.leagueId : null,
        p2Ranking && p2Ranking.leagueOrder !== undefined ? p2Ranking.leagueOrder : null,
        p2Ranking && p2Ranking.progress !== undefined ? p2Ranking.progress : null,
        p2Ranking ? JSON.stringify(p2Ranking) : null,
        matchPayloadJson,
        now,
        now,
      ]
    );
  }

  return {
    requestKey,
    payloadHash,
    matchCount: matches.length,
    storedAt: now,
  };
}

async function getCacheStats() {
  const db = await getDb();
  const payloadCountRow = await db.get('SELECT COUNT(*) AS count FROM w3c_match_search_payloads');
  const requestCountRow = await db.get('SELECT COUNT(*) AS count FROM w3c_match_search_cache');
  const matchCountRow = await db.get('SELECT COUNT(*) AS count FROM w3c_matches_raw');
  const flatMatchCountRow = await db.get('SELECT COUNT(*) AS count FROM w3c_matches_flat');
  return {
    payloadRows: payloadCountRow ? payloadCountRow.count : 0,
    cachedRequests: requestCountRow ? requestCountRow.count : 0,
    cachedMatches: matchCountRow ? matchCountRow.count : 0,
    flattenedMatches: flatMatchCountRow ? flatMatchCountRow.count : 0,
    databasePath: DB_PATH,
  };
}

module.exports = {
  getCachedMatchSearchPayload,
  saveMatchSearchPayload,
  getCacheStats,
};
