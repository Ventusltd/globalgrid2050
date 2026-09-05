(() => {
  'use strict';

  const GENERATION = '202609041945';
  const DATA_BASE = 'https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/';
  const MANIFEST_URL = `${DATA_BASE}data/manifest.json`;
  const MANIFEST_SHA256 = '3246dbdaa042ae8352ec9b7128cb6c2fe65e4f1aba0534302510661828df2526';
  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
  const CRITICAL_RELEASE_PATH = 'data/grid_400kv.geojson';
  const CRITICAL_RUNTIME_URL = '../cartridges/5f5fbec83f9ce307b47ddc6e7277743f0bba1a2445b0f3ca50a9a1806146e993/grid_400kv.geojson';
  const MAP_READY_PATHS = new Set([
    'data/grid_400kv.geojson',
    'data/grid_275kv.geojson',
    'data/grid_220kv.geojson',
    'data/grid_132kv.geojson',
    'data/grid_66kv.geojson',
    'data/grid_substations.geojson',
    'data/power_plants.geojson',
    'data/industrial_offtakers.geojson',
    'data/datacentres.geojson',
    'data/airports.geojson',
    'data/railways.geojson'
  ]);

  const nativeFetch = window.fetch.bind(window);
  const sourceCache = new Map();
  let manifestPromise = null;
  let runtimePromise = null;

  const state = {
    schema: 'gridatlas.maplibre-worker-fetch-bridge.v1',
    generation: GENERATION,
    data_release: '202608291237-data-gridatlas',
    architecture: {
      map_ready_same_origin_geojson: true,
      critical_400kv_maplibre_worker_source: true,
      critical_400kv_window_prefetch: false,
      critical_400kv_main_thread_json_parse: false,
      preload_browser_duckdb: 'AFTER_CRITICAL_SOURCE',
      serialized_preload_queue: false,
      topology_pre_snapped: true,
      analytical_search_duckdb_retained: true
    },
    critical_source: {
      release_copy_path: CRITICAL_RELEASE_PATH,
      runtime_url: CRITICAL_RUNTIME_URL,
      cache_identity: 'CONTENT_ADDRESSED_STABLE_URL',
      delivery: 'MAPLIBRE_WORKER_DIRECT_URL',
      eager_window_prefetch: false,
      window_fetch_hits: 0
    },
    map_ready_requests: 0,
    map_ready_paths: [...MAP_READY_PATHS],
    parquet_requests: 0,
    duckdb_runtime_started: false,
    duckdb_runtime_started_at_ms: null,
    duckdb_runtime_shared: false,
    intercepted_on_demand: 0,
    loaded_on_demand: {},
    failures: [],
    streamed_responses: 0,
    released_payloads: 0,
    stream_failures: [],
    runtime_prewarm: { requested: false, started: false, completed: false, failed: null }
  };
  window.__GRIDATLAS_MAP_READY__ = state;

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function requestPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      return new URL(raw, window.location.href).pathname;
    } catch {
      return '';
    }
  }

  function mapReadyKey(pathname) {
    const marker = '/data/';
    const index = pathname.toLowerCase().lastIndexOf(marker);
    if (index < 0) return '';
    return `data/${decodeURIComponent(pathname.slice(index + marker.length)).toLowerCase()}`;
  }

  function legacyStem(pathname) {
    const name = decodeURIComponent(pathname.split('/').pop() || '').toLowerCase();
    if (name === 'repd_master.json') return 'repd_master_v8_oracle';
    if (name === 'heavy_emitters_uk.json') return 'heavy_emitters_uk';
    if (name.endsWith('.geojson')) return name.slice(0, -8);
    return '';
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
  }

  async function getManifest() {
    manifestPromise ||= (async () => {
      const response = await nativeFetch(MANIFEST_URL, { cache: 'no-store' });
      invariant(response.ok, `manifest HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      invariant(await sha256Hex(bytes) === MANIFEST_SHA256, 'data manifest SHA-256 mismatch');
      const manifest = JSON.parse(new TextDecoder().decode(bytes));
      invariant(manifest?.schema === 'data-gridatlas.v8-transplant-manifest.v1', 'data manifest schema mismatch');
      invariant(manifest?.closure?.sources === 56, 'V8 source closure mismatch');
      invariant(manifest?.closure?.layers === 60, 'V8 layer closure mismatch');
      invariant(manifest?.closure?.features === 541282, 'V8 feature closure mismatch');
      return manifest;
    })();
    return manifestPromise;
  }

  /* ONE DuckDB runtime for the whole page.
     ----------------------------------------------------------------------
     This cartridge and the uk-gazetteer-flyto search lane each built their
     own. Both were correctly memoised internally, so neither was a fault by
     itself; nothing coordinated between them because they are separate
     cartridges by design. Measured on the live page at an iPhone 13 profile,
     202609041500: duckdb-eh.wasm fetched TWICE, 5.92 MB each, 11.84 MB of a
     12.81 MB arrival - and, which matters more on a phone, two WebAssembly
     heaps and two workers alive at once. iOS Safari caps per-tab memory hard
     where a desktop does not.

     The broker below is deliberately duplicated verbatim into the search
     lane rather than imported. Cartridges are composed as independent
     scripts with no shared module loader between them, so there is nothing
     to import from; the CONTRACT is the window key and the shape it holds,
     not this function. Whichever cartridge asks first builds the runtime and
     the other awaits the same promise, so it is order-independent - which
     matters because composition order is a manifest decision, not a
     guarantee this code should rely on.

     A rejected runtime is dropped rather than cached, so a retry rebuilds
     instead of inheriting a dead promise. And note what is NOT here: nobody
     terminates a shared database. The search lane's retry closes only its
     own connection - see the note there. */
  function sharedDuckDBRuntime(moduleUrl) {
    const KEY = '__GRIDATLAS_DUCKDB_RUNTIME__';
    const held = window[KEY];
    if (held && held.module_url === moduleUrl) return held.promise;
    const promise = (async () => {
      const duckdb = await import(moduleUrl);
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
      invariant(bundle?.mainModule && bundle?.mainWorker, 'DuckDB-WASM bundle unavailable');
      const workerUrl = URL.createObjectURL(new Blob([
        `importScripts(${JSON.stringify(bundle.mainWorker)});`
      ], { type: 'text/javascript' }));
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const database = new duckdb.AsyncDuckDB(logger, worker);
      try {
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      } finally {
        URL.revokeObjectURL(workerUrl);
      }
      return { duckdb, database, worker };
    })();
    /* Assigned synchronously, before the first await inside the IIFE can
       yield, so two callers in the same task cannot both build one. */
    window[KEY] = { module_url: moduleUrl, promise, claimed_at_ms: performance.now() };
    promise.catch(() => {
      if (window[KEY] && window[KEY].promise === promise) delete window[KEY];
    });
    return promise;
  }

  async function getRuntime() {
    runtimePromise ||= (async () => {
      state.duckdb_runtime_started = true;
      state.duckdb_runtime_started_at_ms = performance.now();
      const shared = await sharedDuckDBRuntime(DUCKDB_MODULE);
      state.duckdb_runtime_shared = true;
      return { database: shared.database, worker: shared.worker };
    })();
    return runtimePromise;
  }

  function scheduleRuntimePrewarm() {
    state.runtime_prewarm.requested = true;
    let checks = 0;
    const poll = setInterval(() => {
      checks += 1;
      let criticalReady = false;
      try {
        const map = window.__GRIDATLAS_V9_MAP__;
        criticalReady = Boolean(map && map.getSource('src-400') && map.isSourceLoaded('src-400'));
      } catch {}
      if (!criticalReady && checks < 240) return;
      clearInterval(poll);
      const start = () => {
        state.runtime_prewarm.started = true;
        getRuntime().then(() => {
          state.runtime_prewarm.completed = true;
        }).catch(error => {
          state.runtime_prewarm.failed = String(error?.message || error);
          state.failures.push({ pathname: 'duckdb-runtime-prewarm', message: state.runtime_prewarm.failed });
        });
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2000 });
      else setTimeout(start, 0);
    }, 250);
  }

  queueMicrotask(scheduleRuntimePrewarm);

  async function resolvePartition(pathname) {
    const stem = legacyStem(pathname);
    invariant(stem, `unsupported V8 data path: ${pathname}`);
    const alias = stem === 'uk_metros_trams' ? 'uk_metros_trams_root' : stem;
    const expected = `partitions/${alias}.parquet`.toLowerCase();
    const manifest = await getManifest();
    const artifact = (manifest.artifacts || []).find(
      item => String(item.path || '').toLowerCase() === expected
    );
    invariant(artifact, `no V9 Parquet partition for V8 source ${pathname}`);
    invariant(/^[a-f0-9]{64}$/.test(artifact.sha256 || ''), `bad partition digest for ${artifact.path}`);
    return artifact;
  }

  function rowObject(row) {
    return row && typeof row.toJSON === 'function' ? row.toJSON() : row;
  }

  async function queryOnDemand(pathname) {
    if (sourceCache.has(pathname)) return sourceCache.get(pathname);
    const task = (async () => {
      const artifact = await resolvePartition(pathname);
      const parquetUrl = `${DATA_BASE}data/${artifact.path}`;
      const { database } = await getRuntime();
      const connection = await database.connect();
      state.parquet_requests += 1;
      try {
        const escaped = parquetUrl.replaceAll("'", "''");
        const table = await connection.query(`
          SELECT source_id, feature_index, feature_id, geometry_json, properties_json
          FROM read_parquet('${escaped}')
          ORDER BY feature_index
        `);
        const features = table.toArray().map(raw => {
          const row = rowObject(raw);
          return {
            type: 'Feature',
            id: row.feature_id || `${row.source_id}:${row.feature_index}`,
            geometry: JSON.parse(String(row.geometry_json)),
            properties: JSON.parse(String(row.properties_json || '{}'))
          };
        });
        state.loaded_on_demand[pathname] = {
          parquet: artifact.path,
          rows: features.length,
          sha256: artifact.sha256
        };
        return { type: 'FeatureCollection', features };
      } finally {
        await connection.close();
      }
    })();
    sourceCache.set(pathname, task);
    try {
      return await task;
    } catch (error) {
      sourceCache.delete(pathname);
      state.failures.push({ pathname, message: String(error?.message || error) });
      throw error;
    }
  }

  window.fetch = async function gridAtlasMaplibreWorkerFetch(input, init = undefined) {
    const pathname = requestPath(input);
    // A pinned 722 KB GeoJSON keeps industrial identities and works without
    // a second-origin Parquet/WASM round trip before a site can be selected.
    if (legacyStem(pathname) === 'heavy_emitters_uk') {
      return nativeFetch(new URL('./data/heavy_emitters_uk.json', location.href), {...(init || {}), cache:'force-cache'});
    }
    const readyKey = mapReadyKey(pathname);

    if (MAP_READY_PATHS.has(readyKey)) {
      state.map_ready_requests += 1;
      if (readyKey === CRITICAL_RELEASE_PATH) state.critical_source.window_fetch_hits += 1;
      return nativeFetch(input, { ...(init || {}), cache: 'force-cache' });
    }

    if (!legacyStem(pathname)) return nativeFetch(input, init);

    state.intercepted_on_demand += 1;
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Return response headers before DuckDB imports, downloads, queries and serialises the body.
    // This preserves the native fetch contract expected by the V8 engine: its 15 s timer protects
    // response establishment, while response.json() may continue consuming a streamed body.
    state.streamed_responses += 1;
    const encoder = new TextEncoder();
    let bodyController = null;
    let aborted = false;
    const abort = () => {
      aborted = true;
      try { bodyController?.error(new DOMException('Aborted', 'AbortError')); } catch {}
    };
    init?.signal?.addEventListener('abort', abort, { once: true });
    const body = new ReadableStream({
      start(controller) {
        bodyController = controller;
        queryOnDemand(pathname).then(payload => {
          if (aborted || init?.signal?.aborted) return abort();
          const serialised = JSON.stringify(payload);
          sourceCache.delete(pathname);
          state.released_payloads += 1;
          controller.enqueue(encoder.encode(serialised));
          controller.close();
        }).catch(error => {
          sourceCache.delete(pathname);
          state.stream_failures.push({ pathname, message: String(error?.message || error) });
          try { controller.error(error); } catch {}
        });
      },
      cancel() { aborted = true; }
    });
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'private, max-age=3600',
        'X-GridAtlas-Data-Plane': 'V9-PARQUET-DUCKDB-STREAMED-RESPONSE'
      }
    });
  };
})();
