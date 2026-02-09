import { POOLS } from './scraper.js';

/**
 * CORS headers for all API responses.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Create a JSON response with CORS headers.
 */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handle CORS preflight requests.
 */
function handleOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/current — latest occupancy for all pools.
 */
async function handleCurrent(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT * FROM occupancy
       WHERE timestamp = (SELECT MAX(timestamp) FROM occupancy)
       ORDER BY pool_name`,
    )
    .all();

  return json(results);
}

/**
 * GET /api/history?hours=24&pool=SSD-4 — historical data.
 */
async function handleHistory(db: D1Database, url: URL): Promise<Response> {
  const hours = parseInt(url.searchParams.get('hours') || '24', 10);
  const pool = url.searchParams.get('pool') || null;

  const clampedHours = Math.min(Math.max(hours, 1), 168 * 4); // max ~4 weeks

  const { results } = await db
    .prepare(
      `SELECT * FROM occupancy
       WHERE timestamp >= datetime('now', '-' || ? || ' hours')
         AND (pool_id = ? OR ? IS NULL)
       ORDER BY timestamp ASC`,
    )
    .bind(clampedHours, pool, pool)
    .all();

  return json(results);
}

/**
 * GET /api/pools — list of tracked pools with metadata.
 */
function handlePools(): Response {
  const pools = Object.entries(POOLS).map(([id, name]) => ({
    pool_id: id,
    pool_name: name,
    type: ['SSD-4', 'SSD-6', 'SSD-7'].includes(id) ? 'indoor' : 'outdoor',
  }));
  return json(pools);
}

/**
 * Main API request router.
 */
export async function handleRequest(
  request: Request,
  db: D1Database,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const { pathname } = url;

  switch (pathname) {
    case '/api/current':
      return handleCurrent(db);
    case '/api/history':
      return handleHistory(db, url);
    case '/api/pools':
      return handlePools();
    default:
      return json({ error: 'Not found' }, 404);
  }
}
