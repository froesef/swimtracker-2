import { getMetadata } from '../../scripts/aem.js';
import { getSeason, setSeason } from '../../scripts/season.js';

/**
 * Build the season toggle pill.
 * @returns {HTMLElement}
 */
function buildSeasonToggle() {
  const toggle = document.createElement('div');
  toggle.className = 'season-toggle';

  const btnSummer = document.createElement('button');
  btnSummer.textContent = 'Summer';
  btnSummer.dataset.season = 'summer';

  const btnWinter = document.createElement('button');
  btnWinter.textContent = 'Winter';
  btnWinter.dataset.season = 'winter';

  function updateActive() {
    const current = getSeason();
    btnSummer.classList.toggle('active', current === 'summer');
    btnWinter.classList.toggle('active', current === 'winter');
  }

  btnSummer.addEventListener('click', () => { setSeason('summer'); updateActive(); });
  btnWinter.addEventListener('click', () => { setSeason('winter'); updateActive(); });

  toggle.append(btnSummer, btnWinter);
  updateActive();
  return toggle;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // fetch nav content
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';

  const resp = await fetch(`${navPath}.plain.html`);
  if (!resp.ok) {
    // fallback: simple header
    block.innerHTML = `
      <div class="header-content">
        <a class="header-brand" href="/">Zurich Pool Tracker</a>
      </div>
    `;
    block.querySelector('.header-content').appendChild(buildSeasonToggle());
    return;
  }

  const html = await resp.text();
  block.innerHTML = html;

  // decorate nav structure
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (block.firstElementChild) nav.append(block.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  // brand link
  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('a');
    if (brandLink) {
      brandLink.className = '';
      brandLink.closest('.button-container')?.classList.remove('button-container');
    }
  }

  // season toggle
  nav.appendChild(buildSeasonToggle());

  block.append(nav);
}
