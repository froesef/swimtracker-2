/**
 * Winter-only pool IDs (indoor pools available Oct-Apr)
 */
const WINTER_POOLS = new Set(['SSD-4', 'SSD-6', 'SSD-7']);

/**
 * Determine if we should filter to winter (indoor-only) pools.
 * Winter = October through April.
 * @returns {boolean}
 */
function isWinterSeason() {
  const month = new Date().getMonth() + 1; // 1-12
  return month >= 10 || month <= 4;
}

/**
 * Filter pools based on current season.
 * In winter, only show indoor pools. In summer, show all.
 * @param {Array} pools
 * @returns {Array}
 */
function filterBySeason(pools) {
  if (isWinterSeason()) {
    return pools.filter((p) => WINTER_POOLS.has(p.pool_id));
  }
  return pools;
}

/**
 * Build a pool card element.
 * @param {Object} pool Pool data object
 * @returns {HTMLElement}
 */
function buildPoolCard(pool) {
  const card = document.createElement('div');
  card.className = 'pool-card';

  const pct = Math.min(100, pool.occupancy_percent);
  const level = pool.occupancy_level || 0;

  card.innerHTML = `
    <h3>${pool.pool_name}</h3>
    <div class="occupancy-bar">
      <div class="occupancy-fill level-${level}" style="width: ${pct}%"></div>
    </div>
    <div class="pool-stats">
      <span>${Math.round(pool.current_fill)} / ${Math.round(pool.max_capacity)}</span>
      <span>${pool.occupancy_percent.toFixed(1)}%</span>
    </div>
  `;

  return card;
}

/**
 * Extract API URL from block content.
 * The block table has one row with the worker API base URL.
 * @param {Element} block
 * @returns {string}
 */
function getApiUrl(block) {
  const link = block.querySelector('a');
  if (link) return link.href.replace(/\/$/, '');
  const text = block.textContent.trim();
  return text.replace(/\/$/, '');
}

/**
 * Fetch current pool data and render cards.
 * @param {Element} block
 * @param {string} apiUrl
 */
async function renderPoolStatus(block, apiUrl) {
  const grid = block.querySelector('.pool-status-grid');
  try {
    const resp = await fetch(`${apiUrl}/api/current`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const pools = filterBySeason(data);
    if (pools.length === 0) {
      grid.innerHTML = '<p class="pool-status-empty">No pool data available. Pools may be closed for the season.</p>';
      return;
    }

    grid.innerHTML = '';
    pools.forEach((pool) => {
      grid.appendChild(buildPoolCard(pool));
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch pool status:', err);
    grid.innerHTML = '<p class="pool-status-error">Unable to load pool data. Please try again later.</p>';
  }
}

/**
 * Decorates the pool-status block.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const apiUrl = getApiUrl(block);

  // Replace block content with grid container
  block.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'pool-status-grid';
  grid.innerHTML = '<p class="pool-status-loading">Loading pool data...</p>';
  block.appendChild(grid);

  // Initial render
  await renderPoolStatus(block, apiUrl);

  // Auto-refresh every 60 seconds
  setInterval(() => renderPoolStatus(block, apiUrl), 60 * 1000);
}
