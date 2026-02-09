/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // fetch footer content
  const footerMeta = document.querySelector('head meta[name="footer"]');
  const footerPath = footerMeta ? new URL(footerMeta.content, window.location).pathname : '/footer';

  const resp = await fetch(`${footerPath}.plain.html`);
  if (!resp.ok) {
    // fallback: simple footer
    block.innerHTML = `
      <div class="footer-content">
        <p>Data from <a href="https://www.stadt-zuerich.ch/ssd/de/index/sport/schwimmen.html" target="_blank" rel="noopener">Stadt Zurich</a> via CrowdMonitor</p>
      </div>
    `;
    return;
  }

  const html = await resp.text();
  block.innerHTML = html;
}
