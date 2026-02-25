const crypto = require('node:crypto');
const path = require('node:path');

const dotenv = require('dotenv');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const {
  getCachedMatchSearchPayload,
  saveMatchSearchPayload,
  getCacheStats,
} = require('./cacheDb');

dotenv.config();

const app = express();

const PORT = Number.parseInt(process.env.PORT || '8000', 10);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-session-secret';

const BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID || '';
const BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET || '';
const BLIZZARD_REDIRECT_URI = process.env.BLIZZARD_REDIRECT_URI || `${APP_BASE_URL}/auth/callback`;
const BLIZZARD_AUTHORIZE_URL = 'https://oauth.battle.net/authorize';
const BLIZZARD_TOKEN_URL = 'https://oauth.battle.net/token';
const BLIZZARD_USERINFO_URL = 'https://oauth.battle.net/userinfo';

const W3C_BASE_URL = 'https://website-backend.w3champions.com';
const DEFAULT_GATEWAY = 20;
const DEFAULT_PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10);
const LATEST_SEASON_TTL_MS = Number.parseInt(process.env.LATEST_SEASON_TTL_MS || String(5 * 60 * 1000), 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const latestSeasonState = {
  value: null,
  fetchedAt: 0,
};

const authConfigured = Boolean(BLIZZARD_CLIENT_ID && BLIZZARD_CLIENT_SECRET && BLIZZARD_REDIRECT_URI);

function validateEnvironment() {
  if (!IS_PRODUCTION) {
    return;
  }

  const required = [
    ['APP_BASE_URL', APP_BASE_URL],
    ['SESSION_SECRET', SESSION_SECRET],
    ['BLIZZARD_CLIENT_ID', BLIZZARD_CLIENT_ID],
    ['BLIZZARD_CLIENT_SECRET', BLIZZARD_CLIENT_SECRET],
    ['BLIZZARD_REDIRECT_URI', BLIZZARD_REDIRECT_URI],
  ];

  const missing = required
    .filter((pair) => !pair[1])
    .map((pair) => pair[0]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

validateEnvironment();

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const requestId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const logPayload = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };
    console.log(JSON.stringify(logPayload));
  });

  next();
});
app.use(
  session({
    name: 'stats_visual_sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function buildAuthErrorResponse(res, message) {
  return res.status(500).json({
    error: message,
    authConfigured,
  });
}

function createState() {
  return crypto.randomBytes(16).toString('hex');
}

function extractBattleTag(userInfo) {
  if (!userInfo || typeof userInfo !== 'object') {
    return '';
  }

  const candidates = [
    userInfo.battletag,
    userInfo.battleTag,
    userInfo.battle_tag,
  ];

  return candidates.find((value) => typeof value === 'string' && value.length > 0) || '';
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLatestSeasonId() {
  const now = Date.now();
  if (
    Number.isFinite(latestSeasonState.value) &&
    now - latestSeasonState.fetchedAt < LATEST_SEASON_TTL_MS
  ) {
    return latestSeasonState.value;
  }

  const response = await fetchJsonWithTimeout(`${W3C_BASE_URL}/api/ladder/seasons`);
  if (!response.ok) {
    throw new Error(`Unable to fetch seasons (${response.status})`);
  }

  const seasonPayload = await response.json();
  const latestSeasonId = seasonPayload
    .map((season) => Number.parseInt(season.id, 10))
    .filter((seasonId) => Number.isFinite(seasonId) && seasonId > 0)
    .reduce((max, seasonId) => Math.max(max, seasonId), 0);

  latestSeasonState.value = latestSeasonId;
  latestSeasonState.fetchedAt = now;
  return latestSeasonId;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.battleTag) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    authConfigured,
  });
});

app.get('/auth/login', authLimiter, (req, res) => {
  if (!authConfigured) {
    return buildAuthErrorResponse(res, 'Blizzard OAuth is not configured');
  }

  const state = createState();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: BLIZZARD_CLIENT_ID,
    redirect_uri: BLIZZARD_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid',
    state,
  });

  return res.redirect(`${BLIZZARD_AUTHORIZE_URL}?${params.toString()}`);
});

app.get('/auth/callback', authLimiter, async (req, res) => {
  if (!authConfigured) {
    return buildAuthErrorResponse(res, 'Blizzard OAuth is not configured');
  }

  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send('Missing OAuth callback parameters');
  }

  if (!req.session || !req.session.oauthState || state !== req.session.oauthState) {
    return res.status(400).send('Invalid OAuth state');
  }

  delete req.session.oauthState;

  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: BLIZZARD_REDIRECT_URI,
    });

    const basicToken = Buffer.from(`${BLIZZARD_CLIENT_ID}:${BLIZZARD_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetchJsonWithTimeout(BLIZZARD_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      return res.status(502).send(`OAuth token exchange failed (${tokenResponse.status}): ${tokenError}`);
    }

    const tokenJson = await tokenResponse.json();
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      return res.status(502).send('OAuth token exchange did not return access token');
    }

    const profileResponse = await fetchJsonWithTimeout(BLIZZARD_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text();
      return res.status(502).send(`OAuth userinfo failed (${profileResponse.status}): ${profileError}`);
    }

    const userInfo = await profileResponse.json();
    const battleTag = extractBattleTag(userInfo);
    if (!battleTag) {
      return res.status(502).send('Unable to resolve battletag from Blizzard profile');
    }

    req.session.user = {
      battleTag,
      displayName: battleTag.split('#')[0] || battleTag,
      linkedAt: new Date().toISOString(),
    };

    return res.redirect('/index.html');
  } catch (error) {
    return res.status(502).send(`OAuth callback error: ${error.message}`);
  }
});

app.get('/auth/me', (req, res) => {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user) {
    return res.json({
      authenticated: false,
      authConfigured,
    });
  }

  return res.json({
    authenticated: true,
    authConfigured,
    battleTag: user.battleTag,
    displayName: user.displayName,
    linkedAt: user.linkedAt,
  });
});

app.post('/auth/logout', authLimiter, (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Failed to clear session' });
    }
    res.clearCookie('stats_visual_sid');
    return res.json({ ok: true });
  });
});

function parseMatchSearchQuery(req, playerId) {
  const season = Number.parseInt(String(req.query.season || ''), 10);
  const offset = Number.parseInt(String(req.query.offset || '0'), 10);
  const pageSize = Number.parseInt(String(req.query.pageSize || DEFAULT_PAGE_SIZE), 10);
  const gateway = Number.parseInt(String(req.query.gateway || DEFAULT_GATEWAY), 10);

  if (!Number.isFinite(season) || season <= 0) {
    return { error: 'Invalid season query parameter' };
  }

  if (!Number.isFinite(offset) || offset < 0) {
    return { error: 'Invalid offset query parameter' };
  }

  if (!Number.isFinite(pageSize) || pageSize <= 0 || pageSize > 100) {
    return { error: 'Invalid pageSize query parameter' };
  }

  if (!Number.isFinite(gateway)) {
    return { error: 'Invalid gateway query parameter' };
  }

  return {
    query: {
      playerId,
      season,
      offset,
      pageSize,
      gateway,
    },
  };
}

async function fetchW3cMatchesWithHybridCache(query) {
  const latestSeasonId = await fetchLatestSeasonId();
  const shouldPreferCache = query.season < latestSeasonId;

  if (shouldPreferCache) {
    const cachedPayload = await getCachedMatchSearchPayload(query);
    if (cachedPayload) {
      return {
        payload: cachedPayload.payload,
        source: 'cache',
        latestSeasonId,
      };
    }
  }

  const params = new URLSearchParams({
    playerId: query.playerId,
    gateway: String(query.gateway),
    offset: String(query.offset),
    pageSize: String(query.pageSize),
    season: String(query.season),
  });
  const url = `${W3C_BASE_URL}/api/matches/search?${params.toString()}`;
  const response = await fetchJsonWithTimeout(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`W3C request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  let stored = null;
  try {
    const saveResult = await saveMatchSearchPayload(
      query,
      payload,
      shouldPreferCache ? 'live-cache-fill' : 'live-latest-season'
    );
    stored = {
      requestKey: saveResult.requestKey,
      payloadHash: saveResult.payloadHash,
      matchCount: saveResult.matchCount,
      storedAt: saveResult.storedAt,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'warn',
      message: 'Failed to persist W3C payload to SQLite cache',
      details: error.message,
      playerId: query.playerId,
      season: query.season,
      offset: query.offset,
    }));
  }

  return {
    payload,
    source: 'live',
    latestSeasonId,
    stored,
  };
}

async function respondWithHybridMatches(req, res, playerId) {
  const parsed = parseMatchSearchQuery(req, playerId);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const result = await fetchW3cMatchesWithHybridCache(parsed.query);
    return res.json({
      ...result.payload,
      cacheMeta: {
        source: result.source,
        latestSeasonId: result.latestSeasonId,
        stored: result.stored || null,
      },
    });
  } catch (error) {
    return res.status(502).json({
      error: `W3C request failed: ${error.message}`,
    });
  }
}

app.get('/api/w3c/matches/search', apiLimiter, async (req, res) => {
  const playerId = String(req.query.playerId || '').trim();
  if (!playerId) {
    return res.status(400).json({ error: 'Invalid playerId query parameter' });
  }
  return respondWithHybridMatches(req, res, playerId);
});

app.get('/api/my-stats', apiLimiter, requireAuth, async (req, res) => {
  return respondWithHybridMatches(req, res, req.session.user.battleTag);
});

app.get('/api/my-matches', apiLimiter, requireAuth, async (req, res) => {
  return respondWithHybridMatches(req, res, req.session.user.battleTag);
});

app.get('/api/cache/stats', apiLimiter, async (_req, res) => {
  try {
    const stats = await getCacheStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({
      error: `Failed to read cache stats: ${error.message}`,
    });
  }
});

app.use(express.static(path.resolve(__dirname)));

app.get('/', (_req, res) => {
  res.redirect('/index.html');
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const requestId = req && req.requestId ? req.requestId : 'unknown';
  const statusCode = Number.isInteger(error && error.statusCode) ? error.statusCode : 500;
  const message = statusCode >= 500 ? 'Internal server error' : (error && error.message) || 'Request failed';

  console.error(JSON.stringify({
    level: 'error',
    requestId,
    statusCode,
    message: error && error.message ? error.message : String(error),
  }));

  return res.status(statusCode).json({
    error: message,
    requestId,
  });
});

app.listen(PORT, () => {
  console.log(`Stats Visual server running on ${APP_BASE_URL}`);
  if (!authConfigured) {
    console.warn('Blizzard OAuth is not configured. Set BLIZZARD_CLIENT_ID/SECRET/REDIRECT_URI.');
  }
});
