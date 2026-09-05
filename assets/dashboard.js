(function () {
  const CATALOG_URL = './assets/catalog.json';
  const REGISTRY_URL = 'https://ventusltd.github.io/registry_of_all_content_in_repos_and_dependencies/';
  const menu = document.getElementById('menu');
  const searchInput = document.getElementById('gridSearch');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function normalise(s) {
    return String(s || '').toLowerCase().trim();
  }

  function searchKey(parts) {
    return normalise(parts.filter(Boolean).join(' '));
  }

  function flatten(catalog) {
    const areas = Array.isArray(catalog.areas) ? catalog.areas : [];
    const rows = [];

    for (const area of areas) {
      const areaName = area.name || '';
      const children = Array.isArray(area.children) ? area.children : [];

      if (children.length) {
        for (const child of children) {
          rows.push({
            name: `${areaName} - ${child.name || ''}`,
            url: child.url || '#',
            note: child.note || '',
            key: searchKey([areaName, child.name, child.note, area.tags && area.tags.join(' '), child.tags && child.tags.join(' '), child.repo, child.status])
          });
        }
      } else if (area.url) {
        rows.push({
          name: areaName,
          url: area.url,
          note: area.note || '',
          key: searchKey([areaName, area.note, area.tags && area.tags.join(' '), area.repo, area.status])
        });
      }
    }

    return rows.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  }

  function build(catalog) {
    const rows = flatten(catalog);

    if (!rows.length) {
      menu.innerHTML = `<p class="noresult">No launch-ready pages added yet. Working board is below the red line.</p>`;
      return;
    }

    menu.innerHTML = rows.map(row => {
      const note = row.note ? ` <span class="dev-status">(${esc(row.note)})</span>` : '';
      return `<a class="toplink" data-name="${esc(row.key)}" href="${encodeURI(row.url)}">${esc(row.name)}</a>${note}`;
    }).join('') + `<p class="noresult" id="noresult" style="display:none">No match.</p>`;
  }

  function applySearch(raw) {
    const q = normalise(raw);
    let anyVisible = false;

    // An empty query shows nothing. The front page is only what is being built
    // now; the rest of the estate is reached by typing, or through Historical
    // builds. Without this, every archived page renders on load and the page is
    // the cluttered list it replaced.
    document.querySelectorAll('.toplink').forEach(el => {
      const show = Boolean(q) && el.dataset.name.includes(q);
      el.style.display = show ? '' : 'none';
      const note = el.nextElementSibling && el.nextElementSibling.classList.contains('dev-status') ? el.nextElementSibling : null;
      if (note) note.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });

    const noresult = document.getElementById('noresult');
    if (noresult) noresult.style.display = (q && !anyVisible) ? '' : 'none';
  }

  function initChecklist() {
    document.querySelectorAll('.task-check').forEach(box => {
      const id = box.dataset.sessionItem;
      const key = `gg2050-check-${id}`;
      box.checked = sessionStorage.getItem(key) === 'checked';
      box.addEventListener('change', () => {
        if (box.checked) {
          sessionStorage.setItem(key, 'checked');
        } else {
          sessionStorage.removeItem(key);
        }
      });
    });
  }

  function initSessionNotes() {
    const box = document.getElementById('sessionNotes');
    if (!box) return;
    const key = 'gg2050-session-notes-checklist-1';
    const saved = sessionStorage.getItem(key);
    if (saved !== null) box.value = saved;
    box.addEventListener('input', () => sessionStorage.setItem(key, box.value));
  }

  function initRegistryAccess() {
    const footer = document.querySelector('.footer');
    if (!footer || document.getElementById('registryAccess')) return;

    const row = document.createElement('p');
    row.id = 'registryAccess';
    row.style.display = 'none';
    row.style.fontSize = '13px';
    row.style.opacity = '0.75';
    row.innerHTML = `<a href="${REGISTRY_URL}">Registry of all content, repos and dependencies</a>`;
    footer.appendChild(row);

    let typed = '';
    function reveal() {
      row.style.display = '';
      row.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') {
        reveal();
        return;
      }
      typed = (typed + event.key.toLowerCase()).slice(-8);
      if (typed === 'registry') reveal();
    });
  }

  async function init() {
    initChecklist();
    initSessionNotes();
    initRegistryAccess();

    try {
      const response = await fetch(CATALOG_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const catalog = await response.json();
      build(catalog);
      applySearch('');
      searchInput.addEventListener('input', e => applySearch(e.target.value));
    } catch (err) {
      menu.innerHTML = `<p class="noresult">Launch-ready page index failed to load.</p>`;
      console.error('GlobalGrid2050 dashboard catalog load failed:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
