import { getMetadata } from '../../scripts/aem.js';

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

  block.append(nav);
}
