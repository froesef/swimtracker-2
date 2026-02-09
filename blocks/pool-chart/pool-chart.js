import { loadScript } from '../../scripts/aem.js';

/**
 * Pool chart colors matching CSS custom properties.
 */
const POOL_COLORS = [
  '#2196f3', '#4caf50', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4',
];

/**
 * Winter-only pool IDs (indoor pools available Oct-Apr).
 */
const WINTER_POOLS = new Set(['SSD-4', 'SSD-6', 'SSD-7']);

/**
 * Determine if we should filter to winter (indoor-only) pools.
 */
function isWinterSeason() {
  const month = new Date().getMonth() + 1;
  return month >= 10 || month <= 4;
}

/**
 * Filter history data based on current season.
 */
function filterBySeason(data) {
  if (isWinterSeason()) {
    return data.filter((r) => WINTER_POOLS.has(r.pool_id));
  }
  return data;
}

/**
 * Extract API URL and default hours from block content.
 * Row 1: API URL. Row 2: default hours.
 */
function getBlockConfig(block) {
  const rows = block.querySelectorAll(':scope > div');
  let apiUrl = '';
  let defaultHours = 24;

  if (rows[0]) {
    const link = rows[0].querySelector('a');
    apiUrl = link ? link.href.replace(/\/$/, '') : rows[0].textContent.trim().replace(/\/$/, '');
  }
  if (rows[1]) {
    const hours = parseInt(rows[1].textContent.trim(), 10);
    if (!Number.isNaN(hours) && hours > 0) defaultHours = hours;
  }

  return { apiUrl, defaultHours };
}

/**
 * Build time range selector buttons.
 */
function buildTimeRangeSelector(activeHours, onChange) {
  const ranges = [
    { label: '1h', hours: 1 },
    { label: '6h', hours: 6 },
    { label: '12h', hours: 12 },
    { label: '24h', hours: 24 },
    { label: '48h', hours: 48 },
    { label: '7d', hours: 168 },
  ];

  const container = document.createElement('div');
  container.className = 'chart-time-range';

  ranges.forEach(({ label, hours }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = hours === activeHours ? 'active' : '';
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(hours);
    });
    container.appendChild(btn);
  });

  return container;
}

/**
 * Group history data by pool for charting.
 */
function groupByPool(data) {
  const pools = {};
  data.forEach((record) => {
    if (!pools[record.pool_id]) {
      pools[record.pool_id] = {
        name: record.pool_name,
        visitors: [],
        percent: [],
      };
    }
    pools[record.pool_id].visitors.push({
      x: new Date(record.timestamp),
      y: record.current_fill,
    });
    pools[record.pool_id].percent.push({
      x: new Date(record.timestamp),
      y: record.occupancy_percent,
    });
  });
  return pools;
}

/**
 * Create a Chart.js line chart.
 */
function createChart(canvas, datasets, yLabel, yMax) {
  const ctx = canvas.getContext('2d');
  const config = {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM d',
            },
          },
          title: { display: true, text: 'Time' },
        },
        y: {
          min: 0,
          max: yMax,
          title: { display: true, text: yLabel },
        },
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
    },
  };

  // eslint-disable-next-line no-undef
  return new Chart(ctx, config);
}

/**
 * Fetch history data and update charts.
 */
async function updateCharts(apiUrl, hours, state) {
  try {
    const resp = await fetch(`${apiUrl}/api/history?hours=${hours}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const filtered = filterBySeason(data);
    const pools = groupByPool(filtered);
    const poolIds = Object.keys(pools);

    // Build datasets
    const visitorDatasets = poolIds.map((uid, i) => ({
      label: pools[uid].name,
      data: pools[uid].visitors,
      borderColor: POOL_COLORS[i % POOL_COLORS.length],
      backgroundColor: `${POOL_COLORS[i % POOL_COLORS.length]}20`,
      fill: false,
      tension: 0.3,
      pointRadius: 2,
    }));

    const percentDatasets = poolIds.map((uid, i) => ({
      label: pools[uid].name,
      data: pools[uid].percent,
      borderColor: POOL_COLORS[i % POOL_COLORS.length],
      backgroundColor: `${POOL_COLORS[i % POOL_COLORS.length]}20`,
      fill: false,
      tension: 0.3,
      pointRadius: 2,
    }));

    // Destroy existing charts
    if (state.visitorsChart) state.visitorsChart.destroy();
    if (state.percentChart) state.percentChart.destroy();

    // Create new charts
    state.visitorsChart = createChart(
      state.visitorsCanvas,
      visitorDatasets,
      'Number of Visitors',
      undefined,
    );
    state.percentChart = createChart(
      state.percentCanvas,
      percentDatasets,
      'Occupancy %',
      100,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch pool history:', err);
  }
}

/**
 * Decorates the pool-chart block.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { apiUrl, defaultHours } = getBlockConfig(block);

  // Clear block and build chart structure
  block.innerHTML = '';

  // Chart state
  const state = {
    visitorsChart: null,
    percentChart: null,
    visitorsCanvas: null,
    percentCanvas: null,
  };

  let currentHours = defaultHours;

  // Time range selector
  const selector = buildTimeRangeSelector(defaultHours, (hours) => {
    currentHours = hours;
    updateCharts(apiUrl, hours, state);
  });
  block.appendChild(selector);

  // Visitors chart
  const visitorsContainer = document.createElement('div');
  visitorsContainer.className = 'chart-container';
  visitorsContainer.innerHTML = '<h3>Number of Visitors</h3>';
  const visitorsWrapper = document.createElement('div');
  visitorsWrapper.className = 'chart-wrapper';
  state.visitorsCanvas = document.createElement('canvas');
  visitorsWrapper.appendChild(state.visitorsCanvas);
  visitorsContainer.appendChild(visitorsWrapper);
  block.appendChild(visitorsContainer);

  // Percentage chart
  const percentContainer = document.createElement('div');
  percentContainer.className = 'chart-container';
  percentContainer.innerHTML = '<h3>Occupancy Percentage</h3>';
  const percentWrapper = document.createElement('div');
  percentWrapper.className = 'chart-wrapper';
  state.percentCanvas = document.createElement('canvas');
  percentWrapper.appendChild(state.percentCanvas);
  percentContainer.appendChild(percentWrapper);
  block.appendChild(percentContainer);

  // Load Chart.js and adapter, then render
  await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
  await loadScript('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js');
  await updateCharts(apiUrl, currentHours, state);

  // Auto-refresh every 60 seconds
  setInterval(() => updateCharts(apiUrl, currentHours, state), 60 * 1000);
}
