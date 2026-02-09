/**
 * Pool name mapping — only Zurich pools we track.
 */
export const POOLS: Record<string, string> = {
  'SSD-4': 'Hallenbad City',
  'SSD-7': 'Hallenbad Oerlikon',
  'SSD-10': 'Utoquai',
  'SSD-6': 'Leimbach',
  'fb012': 'Heuried',
  'BADI-1': 'Enge',
};

const TRACKED_POOL_IDS = new Set(Object.keys(POOLS));

// Workers fetch() requires https:// scheme for WebSocket upgrade (not wss://)
const WS_URL = 'https://badi-public.crowdmonitor.ch:9591/api';

/**
 * Raw data shape from the CrowdMonitor WebSocket API.
 */
interface CrowdMonitorEntry {
  uid: string;
  maxspace: number;
  currentfill: string | number;
}

/**
 * Processed pool record ready for D1 insertion.
 */
export interface PoolRecord {
  timestamp: string;
  pool_id: string;
  pool_name: string;
  current_fill: number;
  max_capacity: number;
  occupancy_percent: number;
  occupancy_level: number;
}

/**
 * Calculate occupancy level on a 1-4 scale.
 * Level 1: 0-25%, Level 2: 25-50%, Level 3: 50-75%, Level 4: 75-100%
 */
function calculateOccupancyLevel(currentFill: number, maxCapacity: number): number {
  if (maxCapacity <= 0 || currentFill < 0) return 0;
  const ratio = currentFill / maxCapacity;
  return Math.min(4, Math.floor((ratio * 100) / 25) + 1);
}

/**
 * Connect to CrowdMonitor WebSocket, send 'all', receive pool data.
 * Returns processed records for tracked pools only.
 */
async function fetchFromWebSocket(): Promise<PoolRecord[]> {
  const resp = await fetch(WS_URL, {
    headers: { Upgrade: 'websocket' },
  });

  const ws = resp.webSocket;
  if (!ws) {
    throw new Error('WebSocket upgrade failed');
  }

  ws.accept();

  return new Promise<PoolRecord[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout after 10s'));
    }, 10_000);

    ws.addEventListener('message', (event) => {
      clearTimeout(timeout);
      try {
        const data: CrowdMonitorEntry[] = JSON.parse(
          typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer),
        );

        const timestamp = new Date().toISOString();
        const records: PoolRecord[] = data
          .filter((entry) => TRACKED_POOL_IDS.has(entry.uid))
          .map((entry) => {
            const currentFill = Number(entry.currentfill);
            const maxCapacity = Number(entry.maxspace);
            return {
              timestamp,
              pool_id: entry.uid,
              pool_name: POOLS[entry.uid] || entry.uid,
              current_fill: currentFill,
              max_capacity: maxCapacity,
              occupancy_percent:
                maxCapacity > 0
                  ? Math.round((currentFill / maxCapacity) * 10000) / 100
                  : 0,
              occupancy_level: calculateOccupancyLevel(currentFill, maxCapacity),
            };
          });

        ws.close();
        resolve(records);
      } catch (err) {
        ws.close();
        reject(err);
      }
    });

    ws.addEventListener('error', (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${event}`));
    });

    // Send 'all' after a brief delay, matching the reference implementation
    setTimeout(() => ws.send('all'), 500);
  });
}

/**
 * Scrape pool data and store in D1.
 */
export async function scrapeAndStore(db: D1Database): Promise<number> {
  const records = await fetchFromWebSocket();

  if (records.length === 0) {
    console.log('No pool data received');
    return 0;
  }

  // Batch insert all records
  const stmt = db.prepare(
    `INSERT INTO occupancy (timestamp, pool_id, pool_name, current_fill, max_capacity, occupancy_percent, occupancy_level)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const batch = records.map((r) =>
    stmt.bind(
      r.timestamp,
      r.pool_id,
      r.pool_name,
      r.current_fill,
      r.max_capacity,
      r.occupancy_percent,
      r.occupancy_level,
    ),
  );

  await db.batch(batch);
  console.log(`Stored ${records.length} pool records at ${records[0].timestamp}`);

  return records.length;
}

/**
 * Delete data older than 90 days. Called from the cron handler.
 */
export async function cleanupOldData(db: D1Database): Promise<void> {
  const result = await db
    .prepare(`DELETE FROM occupancy WHERE timestamp < datetime('now', '-90 days')`)
    .run();
  if (result.meta.changes > 0) {
    console.log(`Cleaned up ${result.meta.changes} old records`);
  }
}
