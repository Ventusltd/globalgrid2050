// Weekly machine matches are leads for review, never verified project events.
const SCHEMA = 'globalgrid2050.solar-evidence.provisional.v1';
const RESEARCH_SCOPE = 'Completed bounded feed scan using strict name/REPD-ID matching; not independent project-first research. No match is not proof no evidence exists.';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function require(condition, message) { if (!condition) throw Error(message); }
function moment(value) {
  require(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value), 'UTC timestamp required');
  const time = Date.parse(value);
  require(Number.isFinite(time) && new Date(time).toISOString().replace('.000Z', 'Z') === value, 'Invalid UTC timestamp');
  return time;
}
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function add(parent, tag, value) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = String(value);
  parent.appendChild(node);
  return node;
}
function safeArticleURL(value) {
  const url = new URL(value);
  require(url.protocol === 'https:' && !url.username && !url.password && !url.port, 'Unsafe HTTPS link');
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
  const generated = moment(data.generated_at), acquired = moment(data.source_run_at);
  require(acquired <= generated, 'Snapshot predates acquisition');
  require(data.research_scope === RESEARCH_SCOPE, 'Invalid research scope');
  require(Array.isArray(data.sources) && data.sources.length > 0, 'Successful source receipts required');
  const sources = new Map();
  for (const source of data.sources) {
    require(source && nonempty(source.id) && !sources.has(source.id), 'Duplicate or invalid source ID');
    require(source.status === 'ok' && source.eligible_for_publication === true && source.probe_only === false && source.rights_status === 'accepted', 'Source not eligible for publication');
    require([200,304].includes(source.http_status) && /^[a-f0-9]{64}$/.test(source.response_sha256), 'Invalid successful HTTP receipt');
    safeArticleURL(source.url);
    safeArticleURL(source.rights_review_url);
    require(moment(source.fetched_at) <= acquired, 'Source receipt is later than acquisition');
    sources.set(source.id, source);
  }
  require(Array.isArray(data.projects) && data.projects.length === ids.length, 'Evidence membership mismatch');
  const expected = new Set(ids), projects = new Map();
  let count = 0;
  for (const project of data.projects) {
    require(expected.has(project.project_id) && !projects.has(project.project_id), 'Evidence membership mismatch');
    require(Array.isArray(project.evidence) && project.evidence_count === project.evidence.length && project.provisional_count === project.evidence.length && project.verified_count === 0 && project.last_event === null, 'Invalid evidence counts');
    require(project.status === (project.evidence.length ? 'PROVISIONAL' : 'RESEARCH_ATTEMPTED_NO_EVIDENCE'), 'Invalid evidence status');
    require(moment(project.last_researched_at) <= acquired, 'Project research is later than acquisition');
    const articleURLs = new Set();
    for (const article of project.evidence) {
      require(article.status === 'PROVISIONAL' && nonempty(article.id) && nonempty(article.title) && nonempty(article.publisher) && ['repd_id','exact_name'].includes(article.match_method), 'Invalid provisional article');
      require(sources.has(article.source_id), 'Article has no successful source receipt');
      safeArticleURL(article.url);
      moment(article.pub_date);
      require(moment(article.first_seen) <= moment(article.last_seen) && moment(article.last_seen) <= acquired, 'Invalid evidence acquisition dates');
      require(!articleURLs.has(article.url), 'Duplicate project article');
      articleURLs.add(article.url);
    }
    count += project.evidence.length;
    projects.set(project.project_id, project);
  }
  require(count === data.evidence_count, 'Invalid total evidence count');
  const overdue = Date.now() - acquired > WEEK_MS;
  const freshnessLabel = 'Last successful collection: ' + data.source_run_at + (overdue ? ' · Overdue: more than 7 days since collection' : ' · Within weekly collection interval');
  return {projects, generatedAt: data.generated_at, sourceRunAt: data.source_run_at, overdue, freshnessLabel, count};
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
  add(panel, 'p', state.data.freshnessLabel);
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
