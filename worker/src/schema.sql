CREATE TABLE IF NOT EXISTS occupancy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  pool_name TEXT NOT NULL,
  current_fill INTEGER NOT NULL,
  max_capacity INTEGER NOT NULL,
  occupancy_percent REAL NOT NULL,
  occupancy_level INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_occupancy_pool_time
  ON occupancy(pool_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_occupancy_time
  ON occupancy(timestamp);
