// Find in the dash: a REPD project, postcode or "lat, lon"; the drone flies there. Near the staged site there is terrain.
// Loaded just after the first frame with the other tools (review E). ctx: { site(), attribution, origin(), SITE_HALF_M,
// first(), canvas, close(), flyTo(x, y) }. Returns the search panel ({ element, open, close }).
import { createSearchPanel, arrivalNote } from './search-ui.mjs';
import { wgs84ToBng } from './bng.mjs';
import { createOstn15 } from './ostn15.mjs';
import { toLocal } from './origin.mjs';

export function mountFind({ site, attribution, origin, SITE_HALF_M, first, canvas, close, flyTo, doc = document, ostn = createOstn15() }) {
  const siteNear = (lat, lon) => {
    const s = site();
    if (!s) return false;
    const p = wgs84ToBng(lat, lon);
    return Math.abs(p.e - s.centre_e) <= SITE_HALF_M && Math.abs(p.n - s.centre_n) <= SITE_HALF_M;
  };
  const loadIndex = () => fetch('./world/data/projects.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); });
  const search = createSearchPanel(doc.body, {
    loadIndex, attribution, hasTerrain: siteNear, liveTerrain: true,
    onChoose: async choice => { // a postcode brings its own national-grid figures; a lat, lon goes through OSTN15
      const { lat, lon, e, n } = choice, given = Number.isFinite(e) && Number.isFinite(n);
      if (!given) await ostn.need(lat, lon);
      const p = given ? { e, n, ostn15: true } : ostn.toBng(lat, lon), [x, y] = toLocal(origin(), p.e, p.n);
      close();
      flyTo(x, y);
      const note = arrivalNote(choice, siteNear, true);
      first()?.showPlace(choice, p.e, p.n, p.ostn15 ? note : `${note ? note + ' ' : ''}Position approximate (±5 m): outside the OSTN15 blocks held here.`);
      canvas.focus();
    }
  });
  search.element.id = 'find';
  // Test sites (staged locally) sit under the search; project-ui.mjs fills the list and shows it.
  const sites = doc.createElement('section'), h = doc.createElement('h3'), box = doc.createElement('div');
  Object.assign(sites, { id: 'site-section', className: 'site-section', hidden: true });
  h.textContent = 'Test sites'; box.id = 'site-box';
  sites.append(h, box); search.element.append(sites);
  // Escape inside the box closes it; keep the Find button in step.
  search.element.addEventListener('keydown', e => {
    if (e.key === 'Escape') { doc.getElementById('find-toggle').setAttribute('aria-expanded', 'false'); delete doc.body.dataset.panel; }
  });
  return search;
}
