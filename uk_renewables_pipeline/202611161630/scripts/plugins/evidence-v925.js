// Weekly machine matches are leads for review, never verified project events.
const SCHEMA = 'globalgrid2050.solar-evidence.provisional.v1';
function require(condition, message) { if (!condition) throw Error(message); }
function add(parent, tag, value) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = String(value);
  parent.appendChild(node);
  return node;
}
function safeArticleURL(value) {
  const url = new URL(value);
  require(url.protocol === 'https:' && !url.username && !url.password, 'Unsafe article link');
  return url.href;
}
async function get(url) {
  const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(10000)});
  require(response.ok && response.url === url.href, 'Evidence snapshot unavailable');
  return response;
}
export async function loadEvidence(pointerPath, ids) {
  const pointerURL = new URL(pointerPath, window.location.href);
  require(pointerURL.origin === window.location.origin || pointerURL.href === 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-evidence-data/dist/news/evidence/latest.json', 'Unapproved evidence pointer');
  const pointer = await (await get(pointerURL)).json();
  require(pointer.schema === SCHEMA && pointer.project_count === 1000 && pointer.review_required === true, 'Evidence pointer failed validation');
  require(/^snapshot_\d{8}T\d{6}Z$/.test(pointer.snapshot) && pointer.json === pointer.snapshot + '/evidence.json', 'Invalid evidence path');
  require(/^[a-f0-9]{64}$/.test(pointer.sha256?.['evidence.json']), 'Missing evidence digest');
  const bytes = await (await get(new URL(pointer.json, pointerURL))).arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
  require(digest === pointer.sha256['evidence.json'], 'Evidence digest mismatch');
  const data = JSON.parse(new TextDecoder().decode(bytes));
  require(data.schema === SCHEMA && data.seed_release === '202611161244' && data.project_count === 1000 && data.verified_count === 0 && data.review_required === true, 'Evidence schema failed validation');
  require(data.generated_at === pointer.generated_at && data.evidence_count === pointer.evidence_count, 'Evidence pointer disagrees with snapshot');
  require(Array.isArray(data.projects) && data.projects.length === ids.length, 'Evidence membership mismatch');
  const expected = new Set(ids), projects = new Map();
  let count = 0;
  for (const project of data.projects) {
    require(expected.has(project.project_id) && !projects.has(project.project_id), 'Evidence membership mismatch');
    require(Array.isArray(project.evidence) && project.evidence_count === project.evidence.length && project.provisional_count === project.evidence.length && project.verified_count === 0 && project.last_event === null, 'Invalid evidence counts');
    require(project.status === (project.evidence.length ? 'PROVISIONAL' : 'RESEARCH_ATTEMPTED_NO_EVIDENCE'), 'Invalid evidence status');
    for (const article of project.evidence) {
      require(article.status === 'PROVISIONAL' && typeof article.title === 'string' && typeof article.publisher === 'string' && typeof article.pub_date === 'string', 'Invalid provisional article');
      safeArticleURL(article.url);
    }
    count += project.evidence.length;
    projects.set(project.project_id, project);
  }
  require(count === data.evidence_count, 'Invalid total evidence count');
  return {projects, generatedAt: data.generated_at, count};
}
export function renderEvidence(parent, project, state) {
  const panel = add(parent, 'details');
  panel.className = 'v925-evidence';
  panel.dataset.evidenceProject = project.repd_ref;
  const row = state.data?.projects.get(String(project.repd_ref));
  add(panel, 'summary', 'Evidence · ' + (row ? 'Provisional: ' + row.provisional_count : state.loading ? 'Loading' : 'Unavailable'));
  if (!row) {
    add(panel, 'p', state.loading ? 'Loading weekly evidence…' : 'Evidence unavailable. No research or verification claim is made.');
    return;
  }
  add(panel, 'p', 'Machine-found matches require manual review. No verified events are asserted.');
  if (!row.evidence.length) add(panel, 'p', 'No evidence matched in the fetched feed. Other sources have not been searched.');
  for (const article of row.evidence) {
    const entry = add(panel, 'p');
    const link = add(entry, 'a', article.title);
    link.href = safeArticleURL(article.url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    add(entry, 'small', article.publisher + ' · ' + article.pub_date.slice(0, 10) + ' · PROVISIONAL');
  }
}
