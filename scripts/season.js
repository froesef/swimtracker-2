/**
 * Shared season management module.
 * Manages summer/winter state, localStorage persistence, and cross-block coordination.
 */

/** Indoor pools available year-round (shown in winter) */
export const WINTER_POOLS = new Set(['SSD-4', 'SSD-6', 'SSD-7']);

const STORAGE_KEY = 'swimtracker-season';

/**
 * Auto-detect season based on current month.
 * Winter = October through April.
 * @returns {'summer'|'winter'}
 */
function autoDetectSeason() {
  const month = new Date().getMonth() + 1;
  return (month >= 10 || month <= 4) ? 'winter' : 'summer';
}

/**
 * Get the current season from the DOM.
 * @returns {'summer'|'winter'}
 */
export function getSeason() {
  return document.documentElement.dataset.season || 'summer';
}

/**
 * Set season on DOM, persist to localStorage, and dispatch event.
 * @param {'summer'|'winter'} season
 */
export function setSeason(season) {
  document.documentElement.dataset.season = season;
  try {
    localStorage.setItem(STORAGE_KEY, season);
  } catch {
    // localStorage unavailable
  }
  document.dispatchEvent(new CustomEvent('season-change', { detail: { season } }));
}

/**
 * Initialize season from localStorage or auto-detect.
 * Call early in page load before blocks render.
 */
export function initSeason() {
  let season;
  try {
    season = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
  if (season !== 'summer' && season !== 'winter') {
    season = autoDetectSeason();
  }
  document.documentElement.dataset.season = season;
}

/**
 * Filter pools based on current season.
 * In winter, only show indoor pools. In summer, show all.
 * @param {Array} pools
 * @returns {Array}
 */
export function filterPoolsBySeason(pools) {
  if (getSeason() === 'winter') {
    return pools.filter((p) => WINTER_POOLS.has(p.pool_id));
  }
  return pools;
}
