/* V9.22 reader behaviour: real JS executed in an isolated DOM fixture; no network. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(HERE, '../scripts/plugins/live-news.js'), 'utf8');
const NOW = Date.parse('2026-11-15T12:00:00Z');

function node(tag) {
  const n = { tagName: tag, children: [], parentNode: null, attrs: {}, _text: '', open: false,
    setAttribute(name, value) { this.attrs[name] = value; },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    insertBefore(child, anchor) {
      child.parentNode = this;
      const pos = anchor ? this.children.indexOf(anchor) : -1;
      this.children.splice(pos < 0 ? this.children.length : pos, 0, child);
      return child;
    },
    removeChild(child) {
      const pos = this.children.indexOf(child);
      if (pos >= 0) this.children.splice(pos, 1);
      child.parentNode = null;
    },
    addEventListener() {},
  };
  Object.defineProperty(n, 'textContent', {
    get() { return this._text; },
    set(value) { this._text = String(value); this.children = []; },
  });
  return n;
}
function fixture() {
  const elements = { newsStatus: node('span'), liveNews: node('div'), newsArchive: node('details') };
  const document = {
    readyState: 'loading',
    createElement: node,
    getElementById: (id) => elements[id] || null,
    addEventListener() {},
  };
  const window = {};
  runInNewContext(source, { document, window, Date, setTimeout: () => 1,
    clearTimeout() {}, AbortController: undefined, console });
  return { api: window.pipelineHeadlines, elements };
}
function doc(status = 'ok', items = [], extra = {}) {
  return { schema: 'globalgrid2050.news.pipeline-headlines.v1',
    status, items, generated_at: '2026-11-15T11:00:00Z',
    counts: { feeds_ok: 50, feeds_failed: 0 }, scope: 'Headlines only; no verified REPD binding.', ...extra };
}
function headline(date = '2026-11-08T12:00:00Z') {
  return { title: 'Planning decision on solar farm', date,
    first_seen: '2026-11-15T11:00:00Z', source: 'Example Publisher',
    link: 'https://publisher.example/article', category: 'planning_decision',
    technology: 'solar', possible_match: null };
}

test('healthy empty response is accepted, not treated as outage or snapshot', () => {
  const { api, elements } = fixture();
  assert.equal(api.valid(doc()), true);
  api.render(doc(), 'live', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'live');
  assert.match(elements.liveNews.children[0].textContent, /No headlines currently meet the feed criteria/);
  assert.doesNotMatch(elements.newsStatus.textContent, /Headlines updated|verified/i);
});
test('partial 49/50 feeds renders usable results and discloses failure', () => {
  const { api, elements } = fixture();
  api.render(doc('partial', [headline()], { counts: { feeds_ok: 49, feeds_failed: 1 } }), 'live', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'partial');
  assert.match(elements.newsStatus.textContent, /49 sources succeeded, 1 failed/);
  assert.equal(elements.liveNews.children[0].tagName, 'div');
});
test('partial healthy-empty response still shows genuine empty state', () => {
  const { api, elements } = fixture();
  api.render(doc('partial', [], { counts: { feeds_ok: 49, feeds_failed: 1 } }), 'live', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'partial');
  assert.match(elements.liveNews.children[0].textContent, /No headlines currently/);
});
test('invalid JSON schema remains unavailable, not healthy-empty', () => {
  const { api, elements } = fixture();
  const broken = doc('ok', [], { schema: 'wrong' });
  assert.equal(api.valid(broken), false);
  api.render(broken, 'none', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'unavailable');
  assert.equal(elements.newsArchive.open, true);
});
test('failed collection is distinct from a saved fallback snapshot', () => {
  const { api, elements } = fixture();
  api.render(doc('failed', [headline()]), 'live', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'failed');
  assert.match(elements.newsStatus.textContent, /collection failed/i);
  api.render(doc('ok', [headline()]), 'snapshot', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'snapshot');
  assert.match(elements.newsStatus.textContent, /saved snapshot/i);
});
test('recent refresh does not claim eight-day-old article is new', () => {
  const { api, elements } = fixture();
  api.render(doc('ok', [headline('2026-11-07T13:00:00Z')]), 'live', NOW);
  assert.match(elements.newsStatus.textContent, /Feed checked/);
  assert.doesNotMatch(elements.newsStatus.textContent, /Headlines updated|new verified/i);
  assert.match(elements.liveNews.children[0].children[0].textContent, /PUBLISHER DATE 7 NOV 2026/);
});
test('stale partial collection reports both partial and overdue', () => {
  const { api, elements } = fixture();
  api.render(doc('partial', [headline()], { generated_at: '2026-11-12T12:00:00Z',
    counts: { feeds_ok: 49, feeds_failed: 1 } }), 'live', NOW);
  assert.equal(elements.newsStatus.attrs['data-state'], 'overdue-partial');
  assert.match(elements.newsStatus.textContent, /refresh is overdue/);
});
test('missing publisher date uses first-collected not event-effective date', () => {
  const { api, elements } = fixture();
  api.render(doc('ok', [headline(null)]), 'live', NOW);
  assert.match(elements.liveNews.children[0].children[0].textContent, /FIRST COLLECTED/);
});
