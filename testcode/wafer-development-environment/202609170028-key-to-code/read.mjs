/* Reading one numbered line, without holding the estate.
 *
 * THE POINT. The wafer already knows where every line sits, because position is
 * a pure function of the key. What it has never known is what a line SAYS. The
 * old answer was to load a layer file — tens of thousands of features — to show
 * one of them. This reads the one row, out of a 25 MB document, over HTTP Range.
 *
 * HOW. LINES.md is `number<TAB>code`, one row per key, sorted by key, and
 * GitHub Pages serves it with Accept-Ranges: bytes. line-index.json records the
 * byte offset of every 512th row (and cuts a block early at 64 KB, because a
 * few rows hold an entire changelog). A key's block is one Range request of
 * about 45 KB, and every other line in that block arrives with it: the lines
 * you click next are the lines numbered near the one you clicked, so the block
 * that answered the first click usually answers the next twenty.
 *
 * WHY IT DOES NOT ASK WHETHER THE INDEX IS FRESH. LINES.md is regenerated as
 * the estate grows, so an offset is a guess about a document that may have
 * moved. The first version tried to settle that in advance with a HEAD request,
 * comparing ETag and Content-Length, and it was wrong twice over: a browser
 * cannot read ETag across origins at all (it is not a CORS-safelisted response
 * header, and nothing here can add Access-Control-Expose-Headers to GitHub
 * Pages), and Content-Length over a compressed response is the COMPRESSED size
 * — 6,788,562 against the 25,238,570 the index recorded. So the check failed
 * every time in the browser and sent every read down the slow path.
 *
 * The check was also unnecessary, because a read can verify itself. The block
 * is fetched, and either it contains a row beginning `key<TAB>` or it does not.
 * If it does, the offsets were right about this key and the answer is proven.
 * If it does not, the document has moved and the row is found by searching.
 * Nothing is ever shown that was not read from a row carrying the key asked
 * for, so a stale index costs speed and can never produce another line's code.
 */

const DEC = new TextDecoder();

/* ── the index ───────────────────────────────────────────────────────────── */

/* The greatest anchor at or before `key`. Anchors are ascending, so this is the
   ordinary binary search, and -1 means the key is below the first row. */
function anchorFor(keys, key) {
  let lo = 0, hi = keys.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] <= key) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/* Every `number<TAB>code` row in a slice of the document, as a Map. A slice
   fetched by byte offset can begin or end mid-row; a partial first row is
   dropped when `fromRowStart` is false, and the last row is dropped whenever
   the slice did not end on a row end, because a truncated line cannot be told
   from a complete one and showing it would be a lie. */
function rowsIn(bytes, fromRowStart, endsAtRowEnd) {
  const lines = DEC.decode(bytes).split('\n');
  if (!fromRowStart) lines.shift();
  if (!endsAtRowEnd) lines.pop();
  const out = new Map();
  for (const row of lines) {
    const t = row.indexOf('\t');
    if (t <= 0) continue;
    const n = Number(row.slice(0, t));
    if (!Number.isInteger(n) || n <= 0) continue;
    if (!out.has(n)) out.set(n, row.slice(t + 1));
  }
  return out;
}

/* ── the store ───────────────────────────────────────────────────────────── */

export const PROBE_BYTES = 4096;      /* the first window of a search step */
export const PROBE_MAX = 1 << 20;     /* a window stops growing here */
export const PROBE_CAP = 24;          /* refuse rather than walk a document for ever */
export const FINAL_SPAN = 8 * PROBE_BYTES;   /* when the bracket is this small, read it whole */
export const BLOCK_CACHE = 24;        /* blocks held; about 1 MB at the usual size */

export async function openLineStore({ indexUrl, fetchImpl = fetch, onStatus = () => {} } = {}) {
  const ir = await fetchImpl(indexUrl, { cache: 'default' });
  if (!ir.ok) throw new Error(indexUrl + ' returned HTTP ' + ir.status);
  const index = await ir.json();
  const SRC = index.source.url;

  const blocks = new Map();          /* anchor index -> Map(key -> text) */
  const stats = { requests: 0, bytes: 0, blockHits: 0, searched: 0, probes: 0 };
  let drifted = false;               /* set once a block is found not to hold its key */
  /* The document's real size, learned from the first Content-Range. A drifted
     index cannot be trusted for it: offsets shifted down by 90,000 bytes put
     the last row beyond what the index believes the end to be, and the search
     could then never reach the final keys. Content-Range reports the total of
     the UNCOMPRESSED representation, which is what byte offsets address, and
     it is readable across origins where ETag is not. */
  let docEnd = 0;

  const range = async (from, to) => {
    stats.requests++;
    const r = await fetchImpl(SRC, { headers: { Range: `bytes=${from}-${to}` }, cache: 'default' });
    if (r.status !== 206 && r.status !== 200) throw new Error('Range on LINES.md returned HTTP ' + r.status);
    const cr = r.headers.get('content-range');
    const total = cr && Number(cr.split('/')[1]);
    if (Number.isFinite(total) && total > docEnd) docEnd = total;
    const b = new Uint8Array(await r.arrayBuffer());
    stats.bytes += b.length;
    if (!docEnd && r.status === 200) docEnd = b.length;
    /* A 200 means the server ignored the Range and sent the whole document;
       then the slice asked for is a window into what arrived. */
    return r.status === 200 ? b.subarray(from, to + 1) : b;
  };

  /* The fast path, and the one that proves itself: the block between two
     anchors. Either it holds a row for this key or the offsets have drifted. */
  async function fromBlock(key) {
    const a = anchorFor(index.keys, key);
    if (a < 0) return null;
    if (!blocks.has(a)) {
      const rows = rowsIn(await range(index.offs[a], index.offs[a + 1] - 1), true, true);
      blocks.set(a, rows);
      if (blocks.size > BLOCK_CACHE) blocks.delete(blocks.keys().next().value);
    } else stats.blockHits++;
    return blocks.get(a).get(key) ?? null;
  }

  /* One window of the search, grown until it holds at least one COMPLETE row.
     Growing matters: a few rows in this document are over 100 KB on their own,
     and the first version treated an empty window as "the key is further on"
     and stepped past the very row it was looking for. */
  async function windowAt(at, hi) {
    let size = PROBE_BYTES;
    for (;;) {
      const end = Math.min(hi, at + size);
      stats.probes++;
      const rows = rowsIn(await range(at, end), false, end === hi);
      if (rows.size || end >= hi || size >= PROBE_MAX) return { rows, end };
      size *= 4;
    }
  }

  /* The honest path: bracket the key between two byte offsets, then read the
     bracket. Every step keeps the invariant that the row, if it exists, lies in
     [lo, hi]; nothing is ever stepped over. */
  async function bySearch(key) {
    stats.searched++;
    let lo = index.offs[0], hi = Math.max(docEnd || 0, index.offs[index.offs.length - 1]);
    /* Start from the anchors: even a drifted index is usually drifted a little,
       so this is a far better bracket than the whole document. */
    const a = anchorFor(index.keys, key);
    if (a >= 0) {
      const pad = Math.max(PROBE_MAX, (index.offs[a + 1] - index.offs[a]) * 4);
      lo = Math.max(lo, index.offs[a] - pad);
      hi = Math.min(hi, Math.max(index.offs[a + 1] + pad, (index.offs[a + 1] >= index.offs[index.offs.length - 1] - 1) ? hi : 0));
    }
    for (let p = 0; p < PROBE_CAP && hi - lo > FINAL_SPAN; p++) {
      const mid = (lo + hi) >> 1;
      const { rows, end } = await windowAt(mid, hi);
      if (rows.has(key)) return rows.get(key);
      if (!rows.size) { hi = mid; continue; }           /* nothing readable above: look below */
      const seen = [...rows.keys()];
      if (seen[seen.length - 1] < key) lo = end; else hi = mid;
    }
    const rows = rowsIn(await range(lo, hi), lo === index.offs[0], true);
    stats.probes++;
    return rows.get(key) ?? null;
  }

  const store = {
    index,
    get drifted() { return drifted; },
    stats: () => ({ ...stats, blocksHeld: blocks.size }),
    /* The text of one numbered line, or a stated reason there is none. */
    async get(key) {
      if (!Number.isInteger(key) || key < index.min || key > index.max)
        return { key, text: null, why: `outside the numbered range ${index.min}–${index.max}` };
      try {
        let text = await fromBlock(key);
        if (text === null) {
          if (!drifted) { drifted = true; onStatus({ drifted: true, why: 'LINES.md has moved since the index was built, so rows are found by search' }); }
          text = await bySearch(key);
        }
        if (text === null) return { key, text: null, why: 'no row for this number in LINES.md' };
        return { key, text, why: '' };
      } catch (e) {
        return { key, text: null, why: 'could not be read: ' + (e.message || e) };
      }
    }
  };
  onStatus({ drifted: false, why: `${index.anchors} anchors over ${index.rows.toLocaleString()} rows` });
  return store;
}
