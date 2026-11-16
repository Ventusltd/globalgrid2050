#!/usr/bin/env node
// Read-only Chrome acceptance of a served Pipeline release. No route interception.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SEED_SHA256 = 'c625edbb9c471a1e9a9034a1afe99881fbfabb1fcadcf0623355931f5b6aed1f';
export const POINTER = 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-evidence-data/dist/news/evidence/latest.json';
export const WIDTHS = [375, 768, 1440];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function requireThat(condition, code) { if (!condition) throw new Error(code); }
function git(...args) {
  return execFileSync('git', ['--no-replace-objects', '-c', 'protocol.allow=never', '-C', ROOT, ...args], {
    maxBuffer: 80 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000,
    env: {...process.env, GIT_NO_LAZY_FETCH: '1', GIT_GRAFT_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_ALLOW_PROTOCOL: ''},
  });
}
export function validateOptions({release, origin, sourceCommit}) {
  requireThat(/^\d{12}$/.test(release || ''), 'invalid_release');
  requireThat(/^[a-f0-9]{40}$/.test(sourceCommit || ''), 'invalid_source_commit');
  const url = new URL(origin);
  requireThat(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, 'invalid_origin');
  requireThat(url.pathname === '/', 'origin_must_have_no_path');
  requireThat(url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'http_requires_loopback');
  return {release, sourceCommit, origin: url.origin};
}
export function sourceContract(release, sourceCommit) {
  requireThat(git('rev-parse', '--verify', `${sourceCommit}^{commit}`).toString().trim() === sourceCommit, 'missing_exact_commit');
  const prefix = `uk_renewables_pipeline/${release}/`;
  const cache = new Map();
  const read = path => {
    if (!cache.has(path)) cache.set(path, git('show', `${sourceCommit}:${path}`));
    return cache.get(path);
  };
  const index = read(prefix + 'index.html');
  requireThat(index.toString().includes(`UK Renewables Pipeline ${release}`), 'source_release_identity');
  const seedBytes = read(prefix + 'solar1000/manifest.json');
  requireThat(sha256(seedBytes) === SEED_SHA256, 'immutable_solar_seed_changed');
  const seed = JSON.parse(seedBytes);
  requireThat(seed.record_count === 7775 && seed.ids.length === 1000 && new Set(seed.ids).size === 1000, 'invalid_solar_seed');
  const dc = JSON.parse(read(prefix + 'global-datacentres/projects.json'));
  requireThat(Number.isInteger(dc.record_count) && dc.record_count > 0 && dc.records.length === dc.record_count, 'dc_declared_count');
  requireThat(new Set(dc.records.map(r => r.id)).size === dc.record_count, 'dc_duplicate_identity');
  const candidates = JSON.parse(read(prefix + 'solar1000/candidates.json'));
  requireThat(candidates.length === 2, 'inherited_source_count');
  return {prefix, read, index, seed, dc, candidates, tree: git('rev-parse', `${sourceCommit}:${prefix.slice(0, -1)}`).toString().trim()};
}
export function assertServedBytes(actual, expected) {
  requireThat(sha256(actual) === sha256(expected), 'served_bytes_differ');
}
export function safeMap(link, id = '1018') {
  try {
    const u = new URL(link.href);
    return u.origin === 'https://ventusltd.github.io' && u.pathname === '/gridatlas/atlas/' &&
      !u.username && !u.password && u.searchParams.get('repd_ref') === id && u.searchParams.get('technology') === 'solar' &&
      link.target === '_blank' && link.rel.split(/\s+/).includes('noopener');
  } catch { return false; }
}
// RFC4180 quoting, including embedded commas, quotes and newlines; not line counting.
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else { requireThat(!closed && c !== '"', 'invalid_csv'); cell += c; }
  }
  requireThat(!quoted, 'invalid_csv');
  if (row.length || cell || closed) { row.push(cell); rows.push(row); }
  requireThat(rows.length > 0 && rows.every(r => r.length === rows[0].length), 'invalid_csv_width');
  return rows;
}
export function assertInventory(refs, canonical) {
  requireThat(refs.length === 7775 && new Set(refs).size === 7775, 'official_inventory_count');
  requireThat(JSON.stringify([...refs].sort()) === JSON.stringify([...canonical].sort()), 'official_inventory_identity');
}
export function networkVerdict({responses, failures, consoleErrors, pageErrors, evidenceText, implicitFavicon = null}) {
  const absent = responses.some(r => r.url === POINTER && r.status === 404);
  const truthful = /^Evidence unavailable\b/.test(evidenceText) && /no validated snapshot|source identity checks failed/.test(evidenceText);
  const expected = absent && truthful;
  const favicon404 = e => implicitFavicon !== null && e.url === implicitFavicon &&
    (e.status === 404 || /^Failed to load resource:.*404/.test(e.text || ''));
  return {
    pass: pageErrors === 0 && failures.length === 0 &&
      responses.every(r => r.status < 400 || (expected && r.url === POINTER && r.status === 404) || favicon404(r)) &&
      consoleErrors.every(e => (expected && e.url === POINTER && /^Failed to load resource:.*404/.test(e.text)) || favicon404(e)),
    missing_evidence_pointer: absent,
    truthful_evidence_unavailable: truthful,
    expected_pointer_404_count: expected ? responses.filter(r => r.url === POINTER && r.status === 404).length : 0,
    incidental_default_favicon_404_count: consoleErrors.filter(favicon404).length,
    unexpected_http_count: responses.filter(r => r.status >= 400 && !(expected && r.url === POINTER && r.status === 404) && !favicon404(r)).length,
    failed_request_count: failures.length, console_error_count: consoleErrors.length, page_error_count: pageErrors,
  };
}
async function loadBrowser() {
  return import(new URL('../news/acquisition/browser/node_modules/playwright/index.mjs', import.meta.url));
}
export async function inspectViewport(browser, options, source, width) {
  const context = await browser.newContext({viewport: {width, height: 900}, serviceWorkers: 'block', acceptDownloads: true});
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  const responses = [], failures = [], consoleErrors = [], pending = [], assetFailures = [], assets = new Map();
  let pageErrors = 0;
  page.on('pageerror', () => pageErrors++);
  page.on('console', e => { if (e.type() === 'error') consoleErrors.push({text: e.text(), url: e.location().url}); });
  page.on('requestfailed', request => failures.push(request.url()));
  page.on('response', response => {
    responses.push({url: response.url(), status: response.status()});
    const url = new URL(response.url());
    if (url.origin !== options.origin || !url.pathname.startsWith('/' + source.prefix) || response.status() !== 200) return;
    const path = decodeURIComponent(url.pathname.slice(1));
    pending.push((async () => {
      try {
        const body = await response.body(); assertServedBytes(body, source.read(path));
        assets.set(path.slice(source.prefix.length), sha256(body));
      } catch { assetFailures.push('loaded_release_asset_differed'); }
    })());
  });
  const checks = [];
  const check = (name, condition) => { requireThat(condition, name); checks.push(name); };
  const overflow = async name => check(name, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  try {
    const response = await page.goto(`${options.origin}/${source.prefix}index.html`, {waitUntil: 'load', timeout: 45000});
    check('index_http_200', response?.status() === 200);
    assertServedBytes(await response.body(), source.index); checks.push('exact_index_bytes');
    check('release_identity', (await page.title()) === `GlobalGrid2050 | UK Renewables Pipeline ${options.release}`);
    await page.locator('#tbody[data-complete="true"]').waitFor();
    await page.locator('#evidenceCoverage[data-selection-count="1000"]').waitFor({state: 'attached'});
    await page.waitForFunction(() => /Evidence (unavailable|snapshot)/.test(document.querySelector('[data-evidence-status]')?.textContent || ''));
    check('news_before_pipeline', await page.evaluate(() => {
      const news = document.querySelectorAll('.newspaper'), pipeline = document.querySelectorAll('#officialRegister');
      return news.length === 1 && pipeline.length === 1 && Boolean(news[0].compareDocumentPosition(pipeline[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
    check('official_visible_total', /7,775/.test(await page.locator('#resultsMeta').innerText()));
    await overflow('uk_no_horizontal_overflow');
    // Use the release's real loader in the same browser, backed by its unmodified HTTP responses.
    const model = await page.evaluate(async () => {
      const {loadCanonicalProjectsV9_5_1} = await import('./scripts/data/canonical-projects-v9-5-1.js');
      const m = await loadCanonicalProjectsV9_5_1();
      return m.projects.map(p => ({id: p.repd_ref, technology: p.technology}));
    });
    assertInventory(model.map(p => p.id), model.map(p => p.id)); checks.push('official_unique_7775');
    const solar = model.filter(p => p.technology === 'solar').map(p => p.id).sort((a, b) => Number(a) - Number(b));
    check('ordered_immutable_solar_1000', solar.length === 3604 && JSON.stringify(solar.slice(0, 1000)) === JSON.stringify(source.seed.ids));
    await page.locator('#search').fill('1018');
    await page.locator('#repd-1018 .project-record > summary').click();
    await page.locator('[data-integrated-evidence="1018"]').waitFor();
    check('search_and_inline_record', (await page.locator('#repd-1018').innerText()).includes('1018'));
    check('safe_map_handoff', safeMap(await page.locator('#repd-1018 a.atlaslink').evaluate(a => ({href: a.href, target: a.target, rel: a.rel}))));
    await overflow('expanded_record_no_horizontal_overflow');
    for (const candidate of source.candidates) {
      await page.locator('#search').fill(String(candidate.repd_ref));
      const row = page.locator(`#repd-${candidate.repd_ref}`);
      await row.locator('.project-record > summary').click();
      const inherited = row.locator('.v925-inherited-source');
      await inherited.waitFor();
      check(`inherited_source_${candidate.repd_ref}`, (await inherited.innerText()).includes('unverified') &&
        await inherited.locator('a').getAttribute('href') === candidate.source_url);
    }
    await page.locator('#clearFilters').click();
    await page.waitForFunction(() => /7,775/.test(document.querySelector('#resultsMeta')?.textContent || ''));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportInline').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream(); const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const csvBytes = Buffer.concat(chunks), csv = parseCsv(csvBytes.toString('utf8'));
    const refColumn = csv[0].indexOf('REPD Ref'); check('csv_identity_column', refColumn >= 0);
    assertInventory(csv.slice(1).map(row => row[refColumn]), model.map(p => p.id)); checks.push('csv_exact_7775_membership');
    await page.locator('#globalProjectsTab').click();
    await page.locator('#globalDcCount').waitFor();
    const dcIDs = await page.locator('#globalProjectPanel [data-dc-id]').evaluateAll(rows => rows.map(r => r.dataset.dcId));
    check('dc_declared_inventory', JSON.stringify(dcIDs) === JSON.stringify(source.dc.records.map(r => r.id)));
    check('dc_visible_declared_count', (await page.locator('#globalDcCount').innerText()).startsWith(`${source.dc.record_count} of ${source.dc.record_count} `));
    await overflow('dc_no_horizontal_overflow');
    const sample = source.dc.records[0];
    await page.locator('#globalDcSearch').fill(sample.id);
    check('dc_search_identity', await page.locator('#globalProjectPanel [data-dc-id]').count() === 1 &&
      await page.locator('#globalProjectPanel [data-dc-id]').getAttribute('data-dc-id') === sample.id);
    await page.locator('#globalDcSearch').fill('');
    await page.locator('#globalDcCountry').selectOption(sample.country.wikidata_id);
    const countryIDs = await page.locator('#globalProjectPanel [data-dc-id]').evaluateAll(rows => rows.map(r => r.dataset.dcId));
    check('dc_country_filter', JSON.stringify(countryIDs) === JSON.stringify(source.dc.records.filter(r => r.country.wikidata_id === sample.country.wikidata_id).map(r => r.id)));
    await page.locator('#ukProjectsTab').click();
    check('uk_inventory_survives_tab_switch', /7,775/.test(await page.locator('#resultsMeta').innerText()));
    await Promise.all(pending);
    check('loaded_release_assets_match_commit', assetFailures.length === 0 && assets.has('solar1000/manifest.json') && assets.has('global-datacentres/projects.json'));
    const evidenceText = await page.locator('[data-evidence-status]').textContent();
    const declaresIcon = await page.locator('link[rel~="icon"]').count();
    const network = networkVerdict({responses, failures, consoleErrors, pageErrors, evidenceText,
      implicitFavicon: declaresIcon ? null : `${options.origin}/favicon.ico`});
    if (!network.pass) {
      const error = new Error('console_and_network');
      error.diagnostics = {width, ...network};
      throw error;
    }
    checks.push('console_and_network');
    return {width, height: 900, pass: true, checks, network, csv: {records: csv.length - 1, sha256: sha256(csvBytes)},
      loaded_release_assets: Object.fromEntries([...assets].sort()), dc_records: dcIDs.length};
  } finally { await context.close(); }
}
export async function runReadback(input) {
  const options = validateOptions(input);
  const source = sourceContract(options.release, options.sourceCommit);
  const {chromium} = await loadBrowser();
  const browser = await chromium.launch(process.env.CHROME_BIN ? {executablePath: process.env.CHROME_BIN, headless: true} : {channel: 'chrome', headless: true});
  try {
    const viewports = [];
    for (const width of WIDTHS) viewports.push(await inspectViewport(browser, options, source, width));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(options.origin).hostname);
    return {schema: 'globalgrid2050.pipeline.browser-readback.v1', pass: true, checked_at: new Date().toISOString(),
      release: options.release, source_commit: options.sourceCommit, release_tree: source.tree,
      source_index_sha256: sha256(source.index), immutable_seed_sha256: SEED_SHA256,
      origin: local ? 'loopback' : options.origin, browser: browser.version(), node: process.versions.node,
      proof_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), viewports,
      limitations: ['Desktop Chrome responsive viewports; not native Android.', 'MAP destination contract only; no GridAtlas computation claim.',
        'Current observation, not source rights, independent project verification or permission to publish.',
        'Loaded release assets are checked; this does not replace the full release byte verifier.']};
  } finally { await browser.close(); }
}
async function main() {
  const {values} = parseArgs({options: {release: {type: 'string'}, origin: {type: 'string'}, 'source-commit': {type: 'string'}, out: {type: 'string'}}});
  // Refuse an existing output before making network requests; exclusive creation also closes the race.
  if (values.out) { try { readFileSync(values.out); throw new Error('receipt_exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  const sourceCommit = values['source-commit'] || git('rev-parse', 'HEAD').toString().trim();
  const receipt = await runReadback({release: values.release, origin: values.origin, sourceCommit});
  const bytes = JSON.stringify(receipt, null, 2) + '\n';
  if (values.out) writeFileSync(values.out, bytes, {flag: 'wx'});
  else process.stdout.write(bytes);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never print browser stacks, temporary profile paths or arbitrary page content.
    const code = /^[a-z][a-z0-9_]+$/.test(error.message) ? error.message : 'readback_failed';
    process.stderr.write(JSON.stringify({schema: 'globalgrid2050.pipeline.browser-readback.v1', pass: false, error: code,
      ...(error.diagnostics ? {diagnostics: error.diagnostics} : {})}) + '\n');
    process.exitCode = 1;
  });
}
