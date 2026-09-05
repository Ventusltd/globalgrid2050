/**
 * sld-sandbox-v9-8, generation 202609050354 (UTC).
 *
 * ASSEMBLED by tools/build-cartridge.mjs from the parts below. Do not edit
 * this file: edit a part and rebuild under a new generation. Each part is
 * hashed in manifests/202609050354-sld-sandbox-v9-8-parts.json.
 *
 *   module                 atlas/modules/202609012040-grid-scope.js
 *   module                 atlas/modules/202609012217-source-registry.js
 *   module                 atlas/modules/202609012128-declared-connections.js
 *   module                 atlas/modules/202609012205-sizing-arithmetic.js
 *   module                 atlas/modules/202609031310-technology-coverage.js
 *   part                   atlas/parts/202609041234-sld-sandbox-technology-buckets.js
 */

/**
 * Module: grid-scope
 *
 * "When you click on a blank space, the user should be able to see grid in
 * the vicinity. Call it the GRID FINDING SCOPE — analysis of what is
 * there, NOT indicative of capacity." — Vikram, 2026-09-01.
 *
 * So this answers exactly one question: WHAT IS MAPPED HERE. It counts
 * what the served payload contains around a point, by voltage class and
 * by distance band, and names the nearest few. It is a census of the map,
 * not a study of the network.
 *
 * WHAT IT WILL NOT DO, EVER
 * It does not say whether a connection is available, likely, cheap or
 * possible. Nothing in a payload of substation positions can support any
 * of that: capacity depends on queue position, committed connections,
 * thermal and fault headroom, consent and commercial terms, and none of
 * those is a distance. A scope that counted substations and implied
 * opportunity would be the most dangerous thing this estate could ship,
 * because it would look like analysis.
 *
 * Pure. No DOM, no network, no state. Depends on: geodesy.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.gridScope) return;

  const geodesy = NS.geodesy;
  if (!geodesy) throw new Error('grid-scope requires the geodesy module');

  /* Bands, not a single radius. A reader asking "what is around here"
     wants the shape of the answer - is the nearest thing on top of me or
     twenty kilometres away - and one number hides that. */
  const DEFAULT_BANDS_KM = [2, 5, 10, 25];
  const CLASSES_KV = [400, 275, 220, 132, 66, 33];

  /* A voltage is classified ONLY as a class it actually is.
     ------------------------------------------------------------------
     The first version walked the classes and returned the first one the
     value exceeded, so it labelled 750 kV as 400, 110 kV as 66 and 50 kV
     as 33 - a false label on anything the list does not contain, which is
     exactly the sort of quiet relabelling this estate exists to avoid.
     Codex caught it on the committed module before it reached a card
     (stop-ship 202609012025).

     Now: membership, within a tolerance for the fractions OSM carries.
     Anything else is UNCLASSIFIED and counted as such, because a voltage
     the standard classes do not contain is a fact about the data, not a
     value to be rounded into the nearest familiar number. */
  const CLASS_TOLERANCE_KV = 0.5;

  function classOf(kv) {
    if (!Number.isFinite(kv)) return null;
    for (const known of CLASSES_KV) {
      if (Math.abs(kv - known) <= CLASS_TOLERANCE_KV) return known;
    }
    return null;
  }

  /**
   * @param origin [lon, lat]
   * @param substations  [{ at:[lon,lat], kv:[numbers], name, operator }]
   * @param options { bandsKm, minimumKv, nearestCount }
   */
  function scope(origin, substations, options) {
    const bandsKm = (options && options.bandsKm) || DEFAULT_BANDS_KM;
    const minimumKv = (options && options.minimumKv) || 0;
    const nearestCount = (options && options.nearestCount) || 5;
    const maximumKm = bandsKm[bandsKm.length - 1];

    const within = [];
    for (const substation of substations || []) {
      if (!substation || !Array.isArray(substation.at)) continue;
      const voltages = (Array.isArray(substation.kv) ? substation.kv : [])
        .filter(Number.isFinite);
      /* Non-finite voltages are dropped BEFORE the maximum.
         ----------------------------------------------------------------
         Codex, 202609012055: Math.max over a NaN gives NaN, and NaN < floor
         is false, so a substation whose voltage did not parse survived a
         132 kV floor and was censused as though it qualified. A voltage
         that is not a number is not a voltage above the floor. */
      const top = voltages.length ? Math.max(...voltages) : 0;
      if (top < minimumKv) continue;
      const km = geodesy.distanceKm(origin[0], origin[1],
        substation.at[0], substation.at[1]);
      if (km > maximumKm) continue;
      within.push({
        name: substation.name || '',
        operator: substation.operator || '',
        kv: top,
        class_kv: classOf(top),
        km,
        at: substation.at
      });
    }
    within.sort((a, b) => a.km - b.km);

    const bands = bandsKm.map((band) => {
      const inBand = within.filter(entry => entry.km <= band);
      const counts = {};
      let unclassified = 0;
      const unclassifiedKv = [];
      for (const entry of inBand) {
        if (entry.class_kv == null) {
          // Counted, never folded into a class it is not.
          unclassified += 1;
          if (Number.isFinite(entry.kv) && !unclassifiedKv.includes(entry.kv)) {
            unclassifiedKv.push(entry.kv);
          }
          continue;
        }
        counts[entry.class_kv] = (counts[entry.class_kv] || 0) + 1;
      }
      const highest = inBand.reduce(
        (best, entry) => (entry.class_kv != null && (best == null || entry.class_kv > best)
          ? entry.class_kv : best), null);
      return {
        within_km: band,
        substations: inBand.length,
        by_class_kv: counts,
        highest_class_kv: highest,
        unclassified_voltage: unclassified,
        unclassified_kv: unclassifiedKv.sort((a, b) => b - a)
      };
    });

    /* Named first, because an unnamed OSM node is a fact about the map
       rather than a place anyone can look up. Both are reported: the
       nearest thing, and the nearest thing with an identity. */
    const named = within.filter(entry => entry.name);
    return {
      schema: 'gridatlas.grid-scope.v1',
      origin: [origin[0], origin[1]],
      radius_km: maximumKm,
      minimum_kv: minimumKv,
      counted: within.length,
      bands,
      nearest: within.slice(0, nearestCount),
      nearest_named: named.slice(0, nearestCount),
      nearest_transmission: within.find(entry => entry.kv >= 275 - 0.5) || null,
      /* Carried in the result itself so it cannot be separated from the
         numbers by a renderer, a screenshot or a quote. */
      what_this_is: 'A census of the substations in the served map payload '
        + 'around this point, by voltage class and distance band.',
      what_this_is_not: 'Not a statement about capacity, headroom, '
        + 'availability or the cost of connecting here. Distance is not '
        + 'capacity: queue position, committed connections, thermal and '
        + 'fault headroom, consent and commercial terms decide that, and '
        + 'none of them is in this payload.',
      method: 'haversine on a single Earth radius of '
        + geodesy.EARTH_RADIUS_KM + ' km, straight line to mapped geometry'
    };
  }

  NS.gridScope = Object.freeze({
    schema: 'gridatlas.module.grid-scope.v2',
    CLASS_TOLERANCE_KV,
    DEFAULT_BANDS_KM,
    CLASSES_KV,
    classOf,
    scope
  });
})();

/**
 * Module: source-registry
 *
 * "Click anywhere on a map and the neons that already work via Pipeline News
 * look for cartridges and code." — Vikram, 2026-09-01.
 *
 * The looking is this module. The Atlas is a composition of cartridges that
 * find each other through `window.__GRIDATLAS_*` globals, and the deep scan
 * of 1 Sep 2026 found fifteen such surfaces ever registered, thirteen live,
 * and nothing anywhere that documents them. Every consumer therefore does
 * its own `window.__GRIDATLAS_NETWORK__?.something` and quietly does less
 * when the answer is undefined. That is how a click on blank space came to
 * report only what OpenStreetMap has mapped, while the cartridge holding
 * NESO's 886 published connection points sat loaded in the same page.
 *
 * So: one registry, declared once, that answers three questions.
 *
 *   WHAT COULD ANSWER      the sources this estate knows about, each with
 *                          what it contributes and whether it is required.
 *   WHAT IS ANSWERING NOW  probed live, by looking for the surface AND the
 *                          specific capability, because a cartridge that
 *                          has loaded but not yet fetched is present and
 *                          not yet useful, and those are different states.
 *   WHAT DID NOT           named, with the reason, in the result itself.
 *
 * The third is the point. A reader who is told "3 of 4 sources answered;
 * NESO's published network did not, because its payload had not loaded" can
 * judge the answer. A reader shown a shorter answer cannot, and will
 * reasonably assume the map has told them everything it knows.
 *
 * It reads. It never fetches, never renders, and never decides what a
 * finding means.
 *
 * Successor to 202609012135 at generation 202609012217: every source that
 * fetches a product declares what it REQUIRES (repository, product, schema)
 * and the survey carries that in every state, because a contract stated
 * only once the load has succeeded is no help to the reader of a failure.
 * The GB price rollup, fetched since v9.41 without a row here, is
 * registered with the loader state the sandbox now publishes.
 *
 * Depends on: nothing.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.sourceRegistry) return;

  /* The registry is DECLARED, not discovered by scanning window.
     ----------------------------------------------------------------------
     Enumerating every __GRIDATLAS_* global would report whatever happens to
     be there, including surfaces this estate has never agreed to consume,
     and would silently start using a new one the day someone adds it. A
     declared list is a contract: adding a source is an edit here, with a
     reason, and a proof that the probe actually works. */
  const SOURCES = [
    {
      id: 'map',
      surface: '__GRIDATLAS_V9_MAP__',
      contributes: 'the map itself: where the click happened, and what is drawn',
      probe: (w) => (w.__GRIDATLAS_V9_MAP__ ? 'ready' : 'absent')
    },
    {
      id: 'mapped-substations',
      surface: '__GRIDATLAS_NEON_LINKS__',
      contributes: 'substations as OpenStreetMap has them mapped, and the '
        + 'measurement the neon links already use',
      probe: (w) => {
        const links = w.__GRIDATLAS_NEON_LINKS__;
        if (!links) return 'absent';
        if (typeof links.measure?.distanceKm !== 'function') return 'loaded, cannot measure';
        if (!links.substations_loaded) return 'loaded, no substations yet';
        return 'ready';
      },
      detail: (w) => ({ substations: w.__GRIDATLAS_NEON_LINKS__?.substations_loaded || 0 })
    },
    {
      id: 'neso-connection-points',
      surface: '__GRIDATLAS_NETWORK__',
      requires: { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/connection-points.v3.json',
        schema: 'data-grid-gb.connection-points.v3' },
      contributes: "NESO's published connection points: circuits, transformers, "
        + 'per-voltage fault current and planned changes',
      probe: (w) => {
        const network = w.__GRIDATLAS_NETWORK__;
        if (!network) return 'absent';
        if (network.failed) return 'failed to load';
        if (!network.loaded) return 'loading';
        return 'ready';
      },
      detail: (w) => ({ connection_points: w.__GRIDATLAS_NETWORK__?.count || null,
        schema: w.__GRIDATLAS_NETWORK__?.schema || null })
    },
    {
      id: 'grid-scope',
      surface: '__GRIDATLAS_MODULES__.gridScope',
      contributes: 'the census of what is mapped around a point, in distance bands',
      probe: (w) => (w.__GRIDATLAS_MODULES__?.gridScope ? 'ready' : 'absent')
    },
    {
      id: 'network-topology',
      surface: '__GRIDATLAS_MODULES__.networkTopology + __GRIDATLAS_TOPOLOGY__',
      requires: { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/gb-transmission-network.v1.json',
        schema: 'data-grid-gb.transmission-network.v1' },
      contributes: 'circuits, transformers, planned changes and neighbouring '
        + 'sites at a named substation, per voltage',
      /* Generation 202609012135: the module alone is not the source. At v9.67
         this probe said "ready" because the module object existed, while
         the ten-megabyte product it indexes had never been fetched by any
         cartridge - the module was on disk and answered nothing. Ready now
         means the product is indexed; idle means it will load on the first
         click that asks; the other states are what the loader says. */
      probe: (w) => {
        if (!w.__GRIDATLAS_MODULES__?.networkTopology) return 'absent';
        const loader = w.__GRIDATLAS_TOPOLOGY__;
        if (!loader) return 'module present, no loader in this composition';
        if (loader.state === 'ready') return 'ready';
        if (loader.state === 'loading') return 'loading';
        if (loader.state === 'failed') return 'failed to load';
        return 'idle, loads on first use';
      },
      detail: (w) => ({ sites: w.__GRIDATLAS_TOPOLOGY__?.sites || null,
        bytes: w.__GRIDATLAS_TOPOLOGY__?.bytes || null,
        schema: w.__GRIDATLAS_TOPOLOGY__?.schema || null })
    },
    {
      id: 'declared-connections',
      surface: '__GRIDATLAS_MODULES__.declaredConnections',
      contributes: 'points of connection bound to a made Order or a published '
        + 'planning document',
      probe: (w) => (w.__GRIDATLAS_MODULES__?.declaredConnections?.count > 0 ? 'ready' : 'absent'),
      detail: (w) => ({ records: w.__GRIDATLAS_MODULES__?.declaredConnections?.count || null })
    },
    {
      id: 'gb-electricity-conditions',
      surface: '__GRIDATLAS_GB_CONDITIONS__',
      contributes: 'the GB wholesale price context a project card carries: '
        + 'negative-price days and the record daily mean, from the owner rollup',
      requires: { repository: 'Ventusltd/data-gb-electricity',
        product: 'derived/price-decade-rollup.json',
        schema: 'data-gb-electricity.price-decade-rollup.v2' },
      /* Withheld is its own state: the product was reached and was not the
         schema this consumer answers, so the panel shows nothing and says
         why. That is neither a failure of the network nor a source ready. */
      probe: (w) => {
        const loader = w.__GRIDATLAS_GB_CONDITIONS__;
        if (!loader) return 'absent';
        if (loader.state === 'ready') return 'ready';
        if (loader.state === 'loading') return 'loading';
        if (loader.state === 'failed') return 'failed to load';
        if (loader.state === 'withheld') return 'withheld: ' + String(loader.reason || 'schema not supported');
        return 'idle, loads on first use';
      },
      detail: (w) => ({ schema: w.__GRIDATLAS_GB_CONDITIONS__?.schema || null,
        renders: w.__GRIDATLAS_GB_CONDITIONS__?.renders || 0 })
    }
  ];

  const READY = 'ready';

  /**
   * Probe every declared source against a window.
   * @param scope  the window to read; defaults to this one. Passing it in is
   *               what lets a proof drive the probe without a browser.
   */
  function survey(scope) {
    const w = scope || window;
    const sources = SOURCES.map((source) => {
      let state = 'absent';
      let detail = null;
      try { state = source.probe(w) || 'absent'; }
      catch (error) { state = `probe threw: ${error && error.message}`; }
      if (state === READY && typeof source.detail === 'function') {
        try { detail = source.detail(w); } catch (_) { detail = null; }
      }
      return { id: source.id, surface: source.surface,
        contributes: source.contributes, requires: source.requires || null,
        state, ready: state === READY, detail };
    });

    const ready = sources.filter(s => s.ready);
    const missing = sources.filter(s => !s.ready);

    return {
      schema: 'gridatlas.module.source-registry.v1',
      sources,
      ready: ready.map(s => s.id),
      missing: missing.map(s => ({ id: s.id, state: s.state })),
      counts: { declared: sources.length, ready: ready.length, missing: missing.length },
      /* Written as a sentence here so a card cannot compose its own and get
         it wrong, and so an absence is never presented as an absence in the
         world rather than in this page. */
      sentence: missing.length === 0
        ? `All ${sources.length} sources answered.`
        : `${ready.length} of ${sources.length} sources answered. Not answering: `
          + missing.map(s => `${s.id} (${s.state})`).join(', ')
          + '. What they would have added is missing from this answer, not '
          + 'absent from the world.'
    };
  }

  /** Is one source usable right now. */
  function ready(id, scope) {
    const source = SOURCES.find(s => s.id === id);
    if (!source) return false;
    try { return source.probe(scope || window) === READY; }
    catch (_) { return false; }
  }

  NS.sourceRegistry = Object.freeze({
    schema: 'gridatlas.module.source-registry.v1',
    declared: SOURCES.map(s => s.id),
    survey,
    ready
  });
})();

/**
 * Module: declared-connections
 *
 * The 400 kV public record: what each DCO-scale scheme has DECLARED as its
 * point of connection, taken from Development Consent Orders, Planning
 * Inspectorate documents and public project statements. The table binds a
 * register identity (REPD ref) to a NAMED substation, and the functions
 * here bind that name to the served payload and measure the distance -
 * measured, never asserted.
 *
 * The rule this exists to keep: bind to the public record or say nothing.
 * A nearest-substations list is a measurement; it was listing closer 33 and
 * 132 kV points under schemes whose Order names a 400 kV connection, which
 * read as connecting them to the wrong network. This table is the answer,
 * and it is data with three small functions, so it lives in a module where
 * a proof can read every record and a cut can hash it on its own.
 *
 * WHAT IT WILL NOT DO
 * It does not say whether a connection is available, likely or adequate. A
 * declared point of connection is a fact about a consent, not a judgement
 * about the network. `poc_status` distinguishes a far end that exists from
 * one not yet built or under construction, because drawing both the same
 * would say something untrue.
 *
 * Extracted from the sld-sandbox body at generation 202609012128 (UTC),
 * record for record; the parity proof reads the previously served bytes
 * and asserts the table is unchanged.
 *
 * Pure. No DOM, no network, no state. Depends on: geodesy.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.declaredConnections) return;

  const geodesy = NS.geodesy;
  if (!geodesy) throw new Error('declared-connections requires the geodesy module');
  const distanceKm = geodesy.distanceKm;

  const RECORDS = Object.freeze({
    '10914': { works: "an up to 400 kV substation collating the satellite sites at 132 kV and site generation at 33 kV (Work No. 4A)",
      poc_works: "reuse of an ex-generation bay: busbars, a 400 kV 3-phase 4000 A breaker, metering and protection (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation consented within the DCO',
      source: 'Cottam Solar Project Order 2024, granted 5 Sep 2024 (EN010133)' },
    '10915': { works: "an up to 400 kV substation collating the satellite sites at 132 kV and site generation at 33 kV (Work No. 4A)",
      poc_works: "reuse of an ex-generation bay: busbars, a 400 kV 3-phase 4000 A breaker, metering and protection (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation consented within the DCO',
      source: 'Cottam Solar Project Order 2024, granted 5 Sep 2024 (EN010133)' },
    '10916': { works: "an up to 400 kV customer substation at West Burton 3 with reactive power units; up to 132 kV site substations at WB1 and WB2 (Works 3A-3C)",
      poc_works: "a new GIS bay by extension of main busbar 4 and reserve busbar 3/4 gas zones (Work No. 4)",
      substation: 'West Burton Substation',
      via: 'a new 400 kV customer substation at West Burton 3 and a 400 kV cable to the former generator bay',
      source: 'West Burton Solar Project Order, granted 24 Jan 2025 (EN010132)' },
    '10917': { works: "an up to 400 kV customer substation at West Burton 3 with reactive power units; up to 132 kV site substations at WB1 and WB2 (Works 3A-3C)",
      poc_works: "a new GIS bay by extension of main busbar 4 and reserve busbar 3/4 gas zones (Work No. 4)",
      substation: 'West Burton Substation',
      via: 'a new 400 kV customer substation at West Burton 3 and a 400 kV cable to the former generator bay',
      source: 'West Burton Solar Project Order, granted 24 Jan 2025 (EN010132)' },
    '9809': { works: "a scheme substation with reactive power units and a 400 kV harmonic filter compound (Work No. 3)",
      poc_works: "one new 400 kV generation bay at Cottam (Work No. 4C)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation and a 7.5 km 400 kV underground cable',
      source: 'Gate Burton Energy Park Order, granted 2024 (EN010131)' },
    '9810': { works: "a scheme substation with reactive power units and a 400 kV harmonic filter compound (Work No. 3)",
      poc_works: "one new 400 kV generation bay at Cottam (Work No. 4C)",
      substation: 'Cottam Substation',
      via: 'a new 400 kV scheme substation and a 7.5 km 400 kV underground cable',
      source: 'Gate Burton Energy Park Order, granted 2024 (EN010131)' },
    '12281': { works: "two scheme substations, each 2 x 400/33 kV 150/75/75 MVA transformers with 400 kV GIS (Works 3A-3B)",
      poc_works: "the standard 400 kV bay kit at a free bay at Cottam (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'an 18.5 km 400 kV underground cable to a free bay',
      source: 'Tillbridge Solar Order 2025 (EN010142)' },
    '12282': { works: "two scheme substations, each 2 x 400/33 kV 150/75/75 MVA transformers with 400 kV GIS (Works 3A-3B)",
      poc_works: "the standard 400 kV bay kit at a free bay at Cottam (Work No. 5)",
      substation: 'Cottam Substation',
      via: 'an 18.5 km 400 kV underground cable to a free bay',
      source: 'Tillbridge Solar Order 2025 (EN010142)' },
    '14806': { poc_status: 'not_built',
      poc_status_note: 'the point of connection is NGET\u2019s new substation beside the existing High Marnham, built as Great Grid Upgrade works; the line is drawn to the existing site',
      substation: 'High Marnham Substation',
      via: "NGET's new substation adjacent to the existing High Marnham (Great Grid Upgrade)",
      source: 'One Earth Solar Farm DCO, consented (EN010159)' },
    '14807': { poc_status: 'not_built',
      poc_status_note: 'the point of connection is NGET\u2019s new substation beside the existing High Marnham, built as Great Grid Upgrade works; the line is drawn to the existing site',
      substation: 'High Marnham Substation',
      via: "NGET's new substation adjacent to the existing High Marnham (Great Grid Upgrade)",
      source: 'One Earth Solar Farm DCO, consented (EN010159)' },
    '13599': { works: "up to four 33-400 kV transformers (160 t, up to 15 x 9.5 x 10.5 m each) in a compound of up to 40,000 m2 (ES Ch.2 s2.8)",
      poc_works: "a National Grid-delivered extension of Bicker Fen, AIS or GIS, sited for multiple customers (s2.13)",
      substation: 'Bicker Fen Substation',
      via: 'a 400 kV cable and a consented extension of Bicker Fen shared with Heckington Fen',
      source: 'Beacon Fen Energy Park DCO, granted Aug 2026 (EN010151)' },
    '13600': { works: "up to four 33-400 kV transformers (160 t, up to 15 x 9.5 x 10.5 m each) in a compound of up to 40,000 m2 (ES Ch.2 s2.8)",
      poc_works: "a National Grid-delivered extension of Bicker Fen, AIS or GIS, sited for multiple customers (s2.13)",
      substation: 'Bicker Fen Substation',
      via: 'a 400 kV cable and a consented extension of Bicker Fen shared with Heckington Fen',
      source: 'Beacon Fen Energy Park DCO, granted Aug 2026 (EN010151)' },
    '9806': { works: "transformers with bunding and blast walls, switchgear, and harmonic filtering reactive power compensation (Work No. 4)",
      poc_works: "a new generation bay plus an AIS-or-GIS extension and a cable sealing end compound at Bicker Fen (Works 6A-6C)",
      substation: 'Bicker Fen Substation',
      via: 'the consented Bicker Fen extension shared with Beacon Fen',
      source: 'Heckington Fen Solar Park DCO, granted (EN010123)' },
    '9807': { works: "transformers with bunding and blast walls, switchgear, and harmonic filtering reactive power compensation (Work No. 4)",
      poc_works: "a new generation bay plus an AIS-or-GIS extension and a cable sealing end compound at Bicker Fen (Works 6A-6C)",
      substation: 'Bicker Fen Substation',
      via: 'the consented Bicker Fen extension shared with Beacon Fen',
      source: 'Heckington Fen Solar Park DCO, granted (EN010123)' },
    '13644': { poc_status: 'under_construction',
      poc_status_note: 'a new 400 kV four-bay substation is under construction at Thorpe Marsh',
      substation: 'Thorpe Marsh Substation',
      via: 'a new 400 kV four-bay substation under construction at Thorpe Marsh',
      source: 'public planning and contractor records; construction under way' },
    '19801': { poc_status: 'under_construction',
      poc_status_note: 'a new 400 kV four-bay substation is under construction at Thorpe Marsh',
      substation: 'Thorpe Marsh Substation',
      via: 'a new 400 kV four-bay substation under construction at Thorpe Marsh',
      source: 'public planning and contractor records; construction under way' },
    /* Little Crow is the counter-archetype and belongs here precisely
       because it is NOT a 400 kV story: no customer transmission
       substation, no long cable, and a point of connection that is a
       circuit crossing the site rather than a substation to draw a line
       to. Stating that plainly is worth more than drawing nothing. */
    '6557': { poc_kind: 'circuit', poc_status: 'existing',
      circuit: 'the Keadby \u2013 Broughton \u2013 Teed \u2013 Scawby Brook overhead 132 kV line circuit (Northern Powergrid)',
      via: 'a looped connection into an existing 132 kV circuit within the site, with 99.9 MW of export capacity secured',
      kv: 132,
      source: 'Little Crow Solar Park Grid Network Constraints Report, EN010101, November 2020' },
    '7175': { poc_kind: 'circuit', poc_status: 'existing',
      circuit: 'the Keadby \u2013 Broughton \u2013 Teed \u2013 Scawby Brook overhead 132 kV line circuit (Northern Powergrid)',
      via: 'a looped connection into an existing 132 kV circuit within the site, with 99.9 MW of export capacity secured',
      kv: 132,
      source: 'Little Crow Solar Park Grid Network Constraints Report, EN010101, November 2020' },
    '11928': { substation: 'West Burton Substation',
      via: 'a 400 kV grid connection at the former power station site (West Burton C); financial close July 2026',
      source: 'public project records' }
  });

  /* Public works at named substations, shown wherever the name is - the
     "customer and NG substations that do not exist yet" half of the logic.
     Descriptions of the network, never advice about a scheme. */

  const SUBSTATION_WORKS = Object.freeze({
    'thorpe marsh substation':
      'A new 400 kV four-bay substation is under construction here (public record).',
    'high marnham substation':
      'NGET is building a new substation adjacent to the existing one (Great Grid Upgrade, public record).',
    'bicker fen substation':
      'A consented extension here will connect Beacon Fen and Heckington Fen (public record).'
  });

  const worksAt = (name) => SUBSTATION_WORKS[String(name || '').toLowerCase()] || null;

  /* What the Order says is known the moment the identity is known: the
     substation, the voltage class, the route, the consented works and the
     citation need no payload, no fetch and no map. The distance is the one
     part that must be measured, so it is the one part marked pending. */
  function provisional(repdRef) {
    const declared = RECORDS[String(repdRef || '')];
    if (!declared) return null;
    if (declared.poc_kind === 'circuit') {
      // Nothing to measure to and nothing to draw: say what is declared.
      return { poc: declared.circuit, kv: declared.kv || null, at: null,
        km: null, pending: false, kind: 'circuit',
        poc_status: declared.poc_status || 'existing',
        via: declared.via, source: declared.source, works: null,
        customer_works: declared.works || null, poc_works: declared.poc_works || null };
    }
    return {
      poc: declared.substation, kv: 400, at: null, km: null, pending: true,
      kind: 'substation', poc_status: declared.poc_status || 'existing',
      poc_status_note: declared.poc_status_note || null,
      via: declared.via, source: declared.source,
      works: worksAt(declared.substation),
      customer_works: declared.works || null,
      poc_works: declared.poc_works || null
    };
  }

  /* Bind the declared name to the served payload. Only a substation of the
     declared class (>= 400 kV) with exactly that name counts; a 132 kV site
     that happens to share the name is not the point of connection. */
  function resolve(repdRef, origin, subs) {
    const declared = RECORDS[String(repdRef || '')];
    if (!declared) return null;
    if (declared.poc_kind === 'circuit') return provisional(repdRef);
    const wanted = declared.substation.toLowerCase();
    const works = SUBSTATION_WORKS[wanted] || null;
    const match = (Array.isArray(subs) ? subs : [])
      .filter(s => String(s.name).toLowerCase() === wanted
        && Array.isArray(s.kv) && s.kv[0] >= 400)
      .sort((a, b) => b.kv[0] - a.kv[0])[0] || null;
    if (!match) {
      return { poc: declared.substation, kv: 400, at: null, km: null,
        kind: 'substation', poc_status: declared.poc_status || 'existing',
        poc_status_note: declared.poc_status_note || null,
        via: declared.via, source: declared.source, works,
        customer_works: declared.works || null,
        poc_works: declared.poc_works || null };
    }
    return { poc: match.name, kv: Math.round(match.kv[0]), at: match.at,
      km: distanceKm(origin[0], origin[1], match.at[0], match.at[1]),
      kind: 'substation', poc_status: declared.poc_status || 'existing',
      poc_status_note: declared.poc_status_note || null,
      via: declared.via, source: declared.source, works,
      customer_works: declared.works || null,
      poc_works: declared.poc_works || null };
  }

  /* The nearest transmission (>= 400 kV) substation in the payload, and
     separately the nearest one WITH A NAME: an unnamed OSM node can win on
     raw distance and the reader still wants an identity. Two measurements,
     no judgement about either. */
  function nearestTransmission(origin, subs) {
    let best = null;
    let bestNamed = null;
    /* The size of the sample this superlative is drawn from. Counted here
       rather than recounted by a caller, because the predicate below is
       what decides eligibility and a second implementation of it would
       drift from this one. */
    let considered = 0;
    for (const s of (Array.isArray(subs) ? subs : [])) {
      if (!(Array.isArray(s.kv) && s.kv[0] >= 400)) continue;
      considered += 1;
      const km = distanceKm(origin[0], origin[1], s.at[0], s.at[1]);
      if (!best || km < best.km) {
        best = { name: s.name || 'Unnamed substation', km, at: s.at };
      }
      if (s.name && (!bestNamed || km < bestNamed.km)) {
        bestNamed = { name: s.name, km, at: s.at };
      }
    }
    if (best) {
      best.considered = considered;
      best.works = worksAt(best.name);
      if (bestNamed && bestNamed.name !== best.name) {
        best.named = bestNamed;
        best.named.works = worksAt(bestNamed.name);
      }
    }
    return best;
  }

  NS.declaredConnections = Object.freeze({
    schema: 'gridatlas.module.declared-connections.v1',
    records: RECORDS,
    substationWorks: SUBSTATION_WORKS,
    count: Object.keys(RECORDS).length,
    isDeclared: (repdRef) => Object.prototype.hasOwnProperty.call(RECORDS, String(repdRef || '')),
    worksAt,
    provisional,
    resolve,
    nearestTransmission
  });
})();

/**
 * Module: sizing-arithmetic
 *
 * The screening arithmetic of the SLD sandbox: physical inputs to array
 * statistics, the three named ratios (design, export, headroom), the
 * string and central topologies with their corrected nameplates, the
 * finance port of gis-sld-v5-finance.js, and the two-variable fit that
 * lands a layout on the capacity the register states.
 *
 * Lifted out of the sld-sandbox body at generation 202609012205 (UTC),
 * expression for expression. The body closed over its state object and
 * its finance defaults; here both are parameters. Nothing else changed,
 * and the parity proof evaluates the last inline copy beside this module
 * on the same inputs and asserts identical values.
 *
 * WHAT IT WILL NOT DO
 * It grades nothing. A ratio below one is stated with its meaning; an
 * export set by the transformers is stated as the design fact it is. The
 * finance figures are a screening model with the reference's own inputs
 * and are labelled as such by the panel that shows them.
 *
 * Pure. No DOM, no network, no state of its own: fitToStatedCapacity
 * mutates the state object it is handed, as the body's did, and says so.
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.sizingArithmetic) return;


  function physicalInputs(inputs) {
    const i = inputs;
    if (i.mode === 'central') {
      return {
        mod_wp: i.mod_wp_c, mod_l: i.mod_l_c, mod_w: i.mod_w_c,
        gcr: i.gcr_c, gross_factor: i.gross_factor_c,
      };
    }
    return {
      mod_wp: i.mod_wp, mod_l: i.mod_l, mod_w: i.mod_w,
      gcr: i.gcr, gross_factor: i.gross_factor,
    };
  }

  function buildStats(inputs, o) {
    const p = physicalInputs(inputs);
    const dcMwp = (o.module_count * p.mod_wp) / 1e6;
    const acMw = o.ac_mw_direct != null ? o.ac_mw_direct
      : (o.dc_ac_ratio > 0 ? dcMwp / o.dc_ac_ratio : 0);
    const netModArea = o.module_count * p.mod_l * p.mod_w;
    const netArrayArea = p.gcr > 0 ? netModArea / p.gcr : 0;
    return {
      total_blocks: o.total_blocks,
      module_count: o.module_count,
      dc_mwp: dcMwp,
      ac_mw: acMw,
      dc_ac_ratio: acMw > 0 ? dcMwp / acMw : o.dc_ac_ratio,
      net_array_area_m2: netArrayArea,
      gross_site_area_m2: netArrayArea * p.gross_factor,
      block_ground_area_m2: o.total_blocks > 0 ? netArrayArea / o.total_blocks : 0,
      production_substation_ac_mva: o.production_substation_ac_mva || 0,
      ring_main_ac_mva: o.ring_main_ac_mva || 0,
      warning: o.warning || 'Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.'
    };
  }

  /* Three numbers that must agree, and did not.
     ----------------------------------------------------------------------
     Measured on the shipped defaults, the panel produced three different
     values for one quantity:

       string   stated DC/AC input        1.200
                reported DC/AC            1.040
                implied by the hardware   0.945

     A DC/AC ratio below one is not a design choice, it is a contradiction: it
     says the array is smaller than the inverters it feeds, which nobody
     builds. And in central mode the reported ratio was 2.402 against an
     inverter ratio of 1.200 — exactly double, because AC had correctly become
     the LIMITING nameplate (the transformers) while the ratio was still being
     read as though it were the inverter nameplate. Both numbers were right
     about different things and both were called DC/AC.

     There are three distinct quantities here and the panel now keeps them
     apart by name:

       DC          the array, MWp
       inverter AC the inverters can convert, MW
       export      the smaller of the inverters and the transformers, MVA

     The DESIGN ratio is DC over inverter AC, which is the number the industry
     means by DC/AC and the one a stated 1.2 refers to. The EXPORT ratio is DC
     over the export limit, which is what determines clipping and curtailment.
     Reporting one of them under the other's name is how a plant ends up
     described as 2.4 when it was specified as 1.2.

     Nothing here changes a layout. It changes what the numbers are called, and
     says so out loud when they disagree with each other. */
  /* There was an auto-reconciler here. It is deleted, not disabled.
     ----------------------------------------------------------------------
     It computed a "consistent" strings-per-inverter count from the stated
     DC/AC ratio and assigned it to sld.inputs.z_strings, on the reasoning that
     the original's 18 gives a block DC/AC of 0.945 and that nobody builds an
     array smaller than its own inverters. That reasoning was wrong: the
     reference documents 28 string inverters at 352 kVA making 9,856 kVA ahead
     of an 8.96 MVA skid, and the oversizing is the design.

     The default was reverted, and the reconciler was left behind uncalled.
     Flagged by the Codex source gate as a stop-ship, and it was right. Dead
     code that ASSIGNS to a reference input is not inert: it is one future
     handler away from silently rewriting the design this cartridge exists to
     reproduce, and it would do so quietly, in a place nobody would look.

     This is the same lesson as the dead .grid-cell grading CSS removed from
     Pipeline News earlier tonight — a rule with no caller is one edit from
     having one — and I repeated the mistake within hours of writing it down.
     Deleted rather than commented out, for the same reason. */


  function consistency(inputs, stats) {
    const i = inputs;
    const string = i.mode === 'string';

    const inverterAcMw = string
      ? (stats.total_blocks * i.y_invs * i.string_inv_kva) / 1000
      : stats.total_blocks * i.inv_ac_mw_c;
    const skidAcMva = string
      ? stats.total_blocks * i.string_skid_mva
      : (i.mv_per_ring_c * i.rings_c) * i.central_skid_mva_c;
    const exportMva = Math.min(inverterAcMw, skidAcMva);

    /* Three ratios, three names. They describe different pairs of things and
       collapsing them is how a plant specified at 1.2 gets reported as 2.4.

         design    array DC MWp / inverter AC MW    what "DC/AC" means
         export    array DC MWp / export MVA        what drives clipping
         headroom  inverter AC MW / export MVA      how hard the inverters are
                                                    pushed against their skids

       The third is the one that says whether the inverters are oversized
       against the transformers, and in this design they deliberately are. */
    const designRatio = inverterAcMw > 0 ? stats.dc_mwp / inverterAcMw : null;
    const exportRatio = exportMva > 0 ? stats.dc_mwp / exportMva : null;
    const headroomRatio = exportMva > 0 ? inverterAcMw / exportMva : null;
    const statedRatio = string ? Number(i.dc_ac_ratio) : (
      i.inv_ac_mw_c > 0 ? i.inv_dc_mw_c / i.inv_ac_mw_c : null);

    const notes = [];
    /* Descriptive, not a verdict.
       An earlier version of this called a design ratio below one a
       contradiction that "nobody builds". That was wrong about this design:
       the reference sandbox documents 28 string inverters at 352 kVA making
       9,856 kVA ahead of an 8.96 MVA skid, and oversizing inverters against
       the transformer is a deliberate choice, not an arithmetic fault. The
       panel states the number and what it means; it does not grade it. */
    if (Number.isFinite(designRatio) && designRatio < 1) {
      notes.push('Array DC divided by inverter AC is ' + designRatio.toFixed(2)
        + ' from the module, string and inverter counts shown.');
    }
    // The stated ratio is an instruction. If the hardware does not honour it,
    // the hardware is what will be built.
    if (Number.isFinite(designRatio) && Number.isFinite(statedRatio)
        && statedRatio > 0 && Math.abs(designRatio - statedRatio) / statedRatio > 0.05) {
      notes.push('Stated DC/AC ' + statedRatio.toFixed(2) + ', but the module '
        + 'and inverter counts give ' + designRatio.toFixed(2)
        + '. The model displays both and does not rewrite either input.');
    }
    // The transformers, not the inverters, set the export.
    if (Number.isFinite(inverterAcMw) && Number.isFinite(skidAcMva)
        && inverterAcMw > skidAcMva * 1.001) {
      // Stated as the design fact it is, with the ratio, not as a fault.
      notes.push('Inverters total ' + inverterAcMw.toFixed(1) + ' MW against '
        + skidAcMva.toFixed(1) + ' MVA of skid transformer, a ratio of '
        + (headroomRatio || 0).toFixed(2) + '. Export is set by the '
        + 'lower nameplate in this screening model. The connection agreement '
        + 'and electrical design determine the applicable export constraint.');
    }
    return {
      dc_mwp: stats.dc_mwp,
      inverter_ac_mw: inverterAcMw,
      skid_ac_mva: skidAcMva,
      export_mva: exportMva,
      design_dc_ac: designRatio,
      export_dc_ac: exportRatio,
      inverter_to_export: headroomRatio,
      stated_dc_ac: Number.isFinite(statedRatio) ? statedRatio : null,
      notes,
    };
  }

  function stringStats(inputs) {
    const i = inputs;
    if (i.mod_wp <= 0 || i.mod_l <= 0 || i.mod_w <= 0 || i.x_mods <= 0) {
      return buildStats(i, { total_blocks: 0, module_count: 0, dc_ac_ratio: i.dc_ac_ratio });
    }
    const total_blocks = i.b_cols * i.s_subs;
    const module_count = total_blocks * i.y_invs * i.z_strings * i.x_mods;
    const inverterAcMaxMva = (i.y_invs * i.string_inv_kva) / 1000;
    const production = i.string_skid_mva;
    let warning;
    if (inverterAcMaxMva > production) {
      warning = 'Inverter ACmax exceeds the skid transformer rating. Verify temperature rating, overload strategy and clipping assumptions.';
    } else if (i.string_inv_kva > 500) {
      warning = 'Large string inverter rating selected. Verify LV switchgear, transformer, cable loading and protection.';
    }
    return buildStats(i, {
      total_blocks, module_count, dc_ac_ratio: i.dc_ac_ratio,
      ac_mw_direct: total_blocks * production,
      production_substation_ac_mva: production,
      ring_main_ac_mva: production * i.s_subs,
      warning
    });
  }

  function centralStats(inputs) {
    const i = inputs;
    if (i.mod_wp_c <= 0 || i.mod_l_c <= 0 || i.mod_w_c <= 0 || i.x_mods_c <= 0) {
      return buildStats(i, { total_blocks: 0, module_count: 0, dc_ac_ratio: 1.2 });
    }
    const strDcKwp = (i.x_mods_c * i.mod_wp_c) / 1000;
    const reqStrings = strDcKwp > 0 ? Math.ceil((i.inv_dc_mw_c * 1000) / strDcKwp) : 0;
    // total_blocks counts INVERTERS: inverters per MV skid, times skids per
    // ring, times rings. The skids are the level above it.
    const total_blocks = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c;
    const skid_count = i.mv_per_ring_c * i.rings_c;
    const module_count = reqStrings * i.x_mods_c * total_blocks;

    /* Two nameplates, and they are not the same number.
       --------------------------------------------------------------------
       The inverters and the MV skid transformers they share are rated
       separately, and the plant can export no more than the smaller of the
       two. On the shipped defaults they are a factor of two apart: 24
       inverters at 4.4 MW is 105.6 MW of inverter, sitting on 12 skids at
       4.4 MVA, which is 52.8 MVA of transformer.

       The figure shown was 211.2 MW -- neither of those, and larger than
       both. `total_blocks` already contains `inv_per_mv_c`, and the AC line
       multiplied by it a second time, so the count of inverters sharing a
       skid entered the answer squared. It also multiplied a count of
       inverters by a TRANSFORMER rating, which is not a quantity that
       exists.

       This is a deliberate divergence from the sandbox this was ported from.
       gis-sld-v5-calculations.js line 147 computes the same expression, so
       the fault is in the original and was carried across faithfully by a
       port whose whole contract was to carry the arithmetic unchanged.
       Reported by the Codex session auditing this estate in parallel;
       confirmed here dimensionally and against those defaults. */
    const inverter_ac_total = total_blocks * i.inv_ac_mw_c;
    const skid_ac_total = skid_count * i.central_skid_mva_c;
    const ac_mw_direct = Math.min(inverter_ac_total, skid_ac_total);

    // A skid carries every inverter fed into it, so the comparison that
    // matters is the whole MV block against its transformer, not one
    // inverter against it. One-to-one it never fires; on the defaults the
    // block is 8.8 MW on a 4.4 MVA skid and it should.
    const block_ac_mw = i.inv_ac_mw_c * i.inv_per_mv_c;
    let warning;
    if (block_ac_mw > i.central_skid_mva_c) {
      warning = `The ${i.inv_per_mv_c} inverters on each MV skid total `
        + `${block_ac_mw.toFixed(2)} MW against a skid rated `
        + `${i.central_skid_mva_c} MVA. Export is limited by the transformer, `
        + `not the inverters. Verify thermal rating, overload strategy and `
        + `the export limit in the connection agreement.`;
    } else if (i.inv_ac_mw_c > 10) {
      warning = 'Large central inverter or power block selected. Verify transformer, MV switchgear, harmonics, thermal loading, protection and grid code compliance.';
    }
    return buildStats(i, {
      total_blocks, module_count,
      dc_ac_ratio: i.inv_ac_mw_c > 0 ? i.inv_dc_mw_c / i.inv_ac_mw_c : 1.2,
      ac_mw_direct,
      // One skid's rating. The label on the control is "Skid MVA", so it is
      // the skid, and multiplying it by the inverters on that skid described
      // no piece of equipment.
      production_substation_ac_mva: i.central_skid_mva_c,
      ring_main_ac_mva: i.central_skid_mva_c * i.mv_per_ring_c,
      central_inverter_ac_total: inverter_ac_total,
      central_skid_ac_total: skid_ac_total,
      warning
    });
  }

  const DEVELOPMENT_STAGES = Object.freeze({
    '0.003': 'Land Option Signed',
    '0.015': 'Grid Connection Application Accepted',
    '0.035': 'Planning Application Submitted',
    '0.055': 'Planning Permission Granted',
    '0.070': 'Grid Connection Terms Reviewed and Agreed',
    '0.080': 'Buyer or Revenue Agreement Reviewed (Power Purchase Agreement (PPA) / Offtaker)',
    '0.100': 'Construction Contract Signed and Finance Committed (Financial Close)',
  });

  const financeNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const DEVELOPMENT_SUCCESS = Object.freeze({
    '0.003': 10,
    '0.015': 15,
    '0.035': 30,
    '0.055': 55,
    '0.070': 70,
    '0.080': 80,
    '0.100': 95,
  });

  const BIFACIAL_BY_GCR = Object.freeze({
    '0.35': 8,
    '0.45': 5,
    '0.75': 2,
  });

  /* The original stage selector is not only a label: its change handler sets
     development cost to the selected GBP/Wp value and success probability to
     a stage-specific percentage. Keep that linked behavior explicit so a
     stage change cannot leave the old stage's costs behind. */
  function applyDevelopmentStageDefaults(financeInputs, stageValue) {
    const stage = String(stageValue);
    if (!Object.prototype.hasOwnProperty.call(DEVELOPMENT_STAGES, stage)) return false;
    financeInputs.dev_stage = stage;
    financeInputs.dev_cost_mw = financeNumber(stage);
    financeInputs.dev_success = DEVELOPMENT_SUCCESS[stage];
    return true;
  }

  /* Original Mounting & GCR presets also set the financial bifacial gain.
     Apply the exact three preset mappings to the active topology only. A
     free-form GCR value does not invent a gain. */
  function applyMountingBifacial(financeByMode, mode, gcrValue) {
    const values = (financeByMode || {})[mode];
    if (!values) return false;
    const key = String(Number(gcrValue));
    if (!Object.prototype.hasOwnProperty.call(BIFACIAL_BY_GCR, key)) return false;
    values.bifacial = BIFACIAL_BY_GCR[key];
    return true;
  }

  /* Direct port of gis-sld-v5-finance.js computeFinance(). The original
     executable fixture is the authority, not this comment. The one deliberate
     divergence is inherited from the corrected electrical port: annual OPEX
     uses the corrected central inverter nameplate, so the inv_per_mv > 1 case
     must match the fixture's explicit corrected surplus rather than repeat the
     original AC double-count. Every unaffected output remains exact. */
  function screeningFinance(financeInputs, stats, context) {
    const f = financeInputs || (context && context.defaults) || {};
    const dcMwp = financeNumber(stats?.dc_mwp);
    // The reference's OPEX input is GBP/MWac/year. In string mode its AC
    // quantity is skid-limited export. In central mode, once the known square
    // is removed, it is inverter count x inverter MWac. Do not silently swap
    // that to transformer-limited export: those are separately named values.
    const centralInverterAc = (stats?.mode || (context && context.fallbackMode)) === 'central'
      ? financeNumber(stats?.consistency?.inverter_ac_mw) : 0;
    const acMw = centralInverterAc > 0 ? centralInverterAc : financeNumber(stats?.ac_mw);
    const price = financeNumber(f.price);
    const other = financeNumber(f.other);
    const yieldVal = financeNumber(f.yield);
    const bifacial = financeNumber(f.bifacial);
    const baseLoss = financeNumber(f.losses);
    const deg = financeNumber(f.deg);
    const opexRate = financeNumber(f.opex);
    const epcEx = financeNumber(f.epc_ex);
    const floodRate = financeNumber(f.flood_rate);
    const floodAdder = f.flood ? floodRate : 0;
    const modules = financeNumber(f.modules);
    const otherCapex = financeNumber(f.other_capex);
    const fixedCapex = financeNumber(f.fixed_capex);
    const cont = financeNumber(f.cont);
    const lossExtras = financeNumber(f.loss_dc_string) + financeNumber(f.loss_lv_dc)
      + financeNumber(f.loss_lv_ac) + financeNumber(f.loss_tx) + financeNumber(f.loss_other);
    const totalLoss = baseLoss + lossExtras;
    const bessMw = financeNumber(f.bess_mw);
    const bessMwh = financeNumber(f.bess_mwh);
    const bessCapexRate = financeNumber(f.bess_capex);
    const bessCycles = financeNumber(f.bess_cycles);
    const bessRevenuePerMwh = financeNumber(f.bess_spread);
    const bessEffPercent = financeNumber(f.bess_eff);
    const safeLoss = Math.min(Math.max(totalLoss, 0), 100);
    const safeBessEff = Math.min(Math.max(bessEffPercent / 100, 0), 1);
    const effectiveYield = yieldVal * (1 + bifacial / 100);
    const year1Gen = dcMwp * effectiveYield * (1 - safeLoss / 100);
    let gen25 = 0;
    let gen35 = 0;
    for (let year = 1; year <= 35; year += 1) {
      const generation = year1Gen * Math.pow(1 - deg / 100, year - 1);
      if (year <= 25) gen25 += generation;
      gen35 += generation;
    }
    const annualSolarRevenue = year1Gen * (price + other);
    const bessAnnualValue = bessMwh * bessCycles * bessRevenuePerMwh * safeBessEff;
    const annualRevenue = annualSolarRevenue + bessAnnualValue;
    const revenue25 = gen25 * (price + other) + bessAnnualValue * 25;
    const revenue35 = gen35 * (price + other) + bessAnnualValue * 35;
    const annualOpex = acMw * opexRate;
    const baseCapexWp = epcEx + modules + otherCapex + floodAdder;
    const baseCapex = dcMwp * 1_000_000 * baseCapexWp;
    const contingency = baseCapex * (cont / 100);
    const bessCapex = bessMwh * bessCapexRate;
    const totalCapex = baseCapex + contingency + fixedCapex + bessCapex;
    const capexPerWp = dcMwp > 0 ? totalCapex / (dcMwp * 1_000_000) : 0;
    const surplus25 = revenue25 - annualOpex * 25 - totalCapex;
    const surplus35 = revenue35 - annualOpex * 35 - totalCapex;
    const devCostPerMw = financeNumber(f.dev_cost_mw);
    const devModulePerMwp = financeNumber(f.dev_module_mwp);
    const devEpcPerMw = financeNumber(f.dev_epc_mw);
    const devOwnerPerMw = financeNumber(f.dev_owner_mw);
    const devGridPerMw = financeNumber(f.dev_grid_mw);
    const devExitPerMwp = financeNumber(f.dev_exit_mwp);
    const devNpvPerMwp = financeNumber(f.dev_npv_mwp);
    const devSuccessPct = financeNumber(f.dev_success);
    const devYears = financeNumber(f.dev_years);
    const devStage = DEVELOPMENT_STAGES[String(f.dev_stage)] || 'Manual';
    const wpCapacity = dcMwp * 1_000_000;
    const devCapitalAtRisk = wpCapacity * devCostPerMw;
    const devModuleCost = wpCapacity * devModulePerMwp;
    const devEpcCost = wpCapacity * devEpcPerMw;
    const devOwnerCost = wpCapacity * devOwnerPerMw;
    const devGridCost = wpCapacity * devGridPerMw;
    const devTotalBuildCost = devCapitalAtRisk + devModuleCost + devEpcCost
      + devOwnerCost + devGridCost;
    const devExitValue = wpCapacity * devExitPerMwp;
    const devOperatingNpv = wpCapacity * devNpvPerMwp;
    const devGrossMargin = devExitValue - devTotalBuildCost;
    const devRiskAdjustedValue = devGrossMargin * (devSuccessPct / 100);
    const devReturnMultiple = devCapitalAtRisk > 0 ? devGrossMargin / devCapitalAtRisk : 0;
    return {
      annualRevenue, revenue25, revenue35, totalCapex, capexPerWp, surplus25, surplus35,
      devStage, devCostPerMw, devModulePerMwp, devEpcPerMw, devOwnerPerMw,
      devGridPerMw, devExitPerMwp, devNpvPerMwp, devSuccessPct, devYears,
      devCapitalAtRisk, devModuleCost, devEpcCost, devOwnerCost, devGridCost,
      devTotalBuildCost, devExitValue, devOperatingNpv, devGrossMargin,
      devRiskAdjustedValue, devReturnMultiple, price, other, yieldVal, bifacial,
      baseLoss, deg, opexRate, epcEx, floodActive: Boolean(f.flood), floodRate,
      modules, otherCapex, fixedCapex, cont, totalLoss, bessMw, bessMwh,
      bessCapexRate, bessCycles, bessSpread: bessRevenuePerMwh,
      bessEff: bessEffPercent, epcIncModules: epcEx + modules,
    };
  }

  function computeStats(inputs, financeByMode, defaults) {
    const stats = inputs.mode === 'string'
      ? stringStats(inputs) : centralStats(inputs);
    // Same object, so nothing can read a capacity without the check that says
    // whether the capacities agree with each other.
    stats.mode = inputs.mode;
    stats.consistency = consistency(inputs, stats);
    stats.finance = screeningFinance((financeByMode || {})[inputs.mode], stats,
      { fallbackMode: inputs.mode, defaults });
    return stats;
  }

  /**
   * Size the array so its capacity lands on the figure the register states.
   *
   * WHAT IS ADJUSTED, AND WHAT IS NOT
   * Two integer topology counts move -- circuits and skids per circuit in
   * string mode, rings and MV skids per ring in central mode. Everything a
   * supplier fixes stays where the user put it:
   * module rating, string length, inverter and skid ratings. That keeps the
   * result buildable rather than a number reverse-engineered into nonsense.
   *
   * Blocks are integers, so an exact hit is usually impossible. The residual
   * is reported rather than hidden, because a layout that quietly lands 7%
   * off the stated capacity is worse than one that says so.
   *
   * WHICH CAPACITY IS BEING MATCHED
   * That is the caller's declared basis, never a guess. REPD's figure is
   * nominally MWelec, but it is reported inconsistently: some schemes state
   * DC, some AC, and the register does not carry the distinction reliably.
   * Matching AC when the figure was DC oversizes the connection by the DC/AC
   * ratio, which is exactly the error that matters for export limitation.
   */
  /* Fit on two variables, because one cannot reach a small project.
     ----------------------------------------------------------------------
     Reported: the numbers do not change when the headline capacity changes.
     Measured, and they do not:

       string   5, 10, 20, 30, 40, 49.9 and 50 MW all produced 44.80 MW
       central  5, 10 and 20 MW all produced 17.60 MW

     The fit moved ONE variable. In string mode that is b_cols, and because
     total_blocks is b_cols x s_subs with s_subs pinned at five, one step of
     b_cols is five blocks — 44.8 MW at the default skid rating. Nothing below
     that is reachable, so a 30 MW solar farm was drawn as a 44.8 MW one, an
     overstatement of half as much again, and every target under 50 MW
     collapsed onto the same layout. The register starts at 1 MW.

     A block is 8.96 MW in string mode and a skid is 4.4 MVA in central. Those
     are the real quanta, and they are reachable as soon as the inner variable
     is allowed to move too. So the search is over both, and it prefers the
     candidate that stays closest to the shape the user already had — a fit
     that reaches the right capacity by rearranging the whole plant is a worse
     answer than one that reaches it by adding a column.

     Bounds are physical rather than generous: a ring main carries a handful of
     skids, not four hundred, so the inner variable stops at twelve. */
  const FIT_OUTER_MAX = 120;
  const FIT_INNER_MAX = 12;

  function fitToStatedCapacity(sld, computeSldStats) {
    sld.fitResidualPct = null;
    sld.fitQuantumMw = null;
    const target = Number(sld.targetMw);
    if (!Number.isFinite(target) || target <= 0) return;
    if (sld.targetBasis !== 'ac' && sld.targetBasis !== 'dc') return;

    const string = sld.inputs.mode === 'string';
    const outerKey = string ? 'b_cols' : 'rings_c';
    const innerKey = string ? 's_subs' : 'mv_per_ring_c';
    const outer0 = sld.inputs[outerKey];
    const inner0 = sld.inputs[innerKey];

    let best = null;
    for (let inner = 1; inner <= FIT_INNER_MAX; inner += 1) {
      sld.inputs[innerKey] = inner;
      for (let outer = 1; outer <= FIT_OUTER_MAX; outer += 1) {
        sld.inputs[outerKey] = outer;
        const s = computeSldStats();
        const got = sld.targetBasis === 'ac' ? s.ac_mw : s.dc_mwp;
        if (!Number.isFinite(got) || got <= 0) continue;
        const error = Math.abs(got - target);
        // Ties, and near-ties, go to the layout closest to the one already on
        // screen. Without this the fit rearranges the plant for a rounding
        // difference and the drawing jumps for no reason the user can see.
        const drift = Math.abs(inner - inner0) + Math.abs(outer - outer0) / 100;
        if (!best
            || error < best.error - 1e-9
            || (Math.abs(error - best.error) <= 1e-9 && drift < best.drift)) {
          best = { outer, inner, error, got, drift };
        }
      }
    }
    if (!best) {
      sld.inputs[outerKey] = outer0;
      sld.inputs[innerKey] = inner0;
      return;
    }
    sld.inputs[outerKey] = best.outer;
    sld.inputs[innerKey] = best.inner;
    sld.fitResidualPct = ((best.got - target) / target) * 100;

    // What one more block would have added. A residual means nothing without
    // it: 10% off a plant whose smallest step is 9 MW is exact, and 10% off
    // one whose step is 0.5 MW is a miss.
    const oneMore = (() => {
      sld.inputs[outerKey] = best.outer + 1;
      const s = computeSldStats();
      sld.inputs[outerKey] = best.outer;
      const got = sld.targetBasis === 'ac' ? s.ac_mw : s.dc_mwp;
      return Number.isFinite(got) ? Math.abs(got - best.got) : null;
    })();
    sld.fitQuantumMw = oneMore;
  }

  NS.sizingArithmetic = Object.freeze({
    generation: '202609012205',
    DEVELOPMENT_STAGES,
    DEVELOPMENT_SUCCESS,
    BIFACIAL_BY_GCR,
    FIT_OUTER_MAX,
    FIT_INNER_MAX,
    financeNumber,
    physicalInputs,
    buildStats,
    consistency,
    stringStats,
    centralStats,
    applyDevelopmentStageDefaults,
    applyMountingBifacial,
    screeningFinance,
    computeStats,
    fitToStatedCapacity
  });
})();

/* ══════════════════════════════════════════════════════════════════════
   technology-coverage - which technologies the measurement runs for, and
   what each measurement is a measurement OF
   ══════════════════════════════════════════════════════════════════════

   WHAT WAS MEASURED BEFORE THIS MODULE WAS WRITTEN.

   The request was to extend the nearest-substation computation to the twenty
   wider-fleet REPD technologies, on the report that it ran only for the
   spine. Driven in Chrome against the live composition (v9.88, generation
   202609030234) on the wider fleet's own MAP link:

     ?repd_ref=8795 ... &technology=biomass   Caledon Green, Landfill Gas
     ?repd_ref=626  ... &technology=biomass   Pitsea Tipp,   Landfill Gas

   Both arrived, flew, opened the card, ticked the Subs control and DREW THE
   LINKS. Caledon Green measured 1.74 km at 132 kV, 2.98 km at 275 kV and
   5.70 km at 33 kV; Pitsea Tipp named Coryton South Substation at 7.70 km
   and printed its 400 kV scope sentence with the denominator in it. So the
   wider fleet was ALREADY computing, and a change that claimed to enable it
   would have been a change that did nothing while saying it did something.

   There IS a four-member technology allow-list in this estate:

     const allowedTechnologies = new Set(['solar','bess','wind_onshore','wind_offshore']);

   It lives at line 805 of the IMMUTABLE SHELL, atlas/releases/
   202608300453-atlas-v9/ventus-corev8engine.js, inside the shell's own
   focusCanonicalProjectDeepLink(). It rejects every value the wider fleet
   can send, because those four are exactly the four types the wider fleet is
   DEFINED as excluding. Its rejection is caught, and its only effects are a
   console line and a flyTo the arrival lane in this cartridge has already
   performed - which is why the measurement runs anyway. The shell is carried
   forward verbatim by contract and this module does not reach into it.

   WHAT THIS MODULE ACTUALLY CHANGES.

   One thing: OFFSHORE WIND NOW MEASURES. It used to open a card and withhold
   the distance, on the reasoning that a turbine in the North Sea does not
   reach the nearest onshore substation by a straight line. The reasoning
   about routes was right and is kept in full below; the conclusion was
   over-cautious. An offshore project's export cable does land at an onshore
   substation, so the distance to the nearest mapped substation is a real
   measurement of a real thing, provided the card says what it measured.

   WHAT "NEAREST" CANNOT BE MADE TO MEAN HERE, MEASURED RATHER THAN ASSUMED.

   The coordinator asked for an onshore-only filter, so that "nearest onshore
   substation" would mean onshore. The pinned substation product cannot carry
   one. Counted over all 5,800 features of

     atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson

   the only properties present are voltage (5,800), name (4,460), operator
   (3,264), brand (1,310), source (684), type (72), capacity (15) and colour
   (3). The OSM `location` tag - the field that would say offshore, platform
   or underwater - is present on ZERO of them.

   That leaves the name, and the name does not separate them either. Fourteen
   features carry "offshore" in their name; read against their coordinates, at
   least four are ONSHORE substations serving an offshore wind farm, which is
   precisely what an offshore project should be measured to - Hornsea
   (-0.2598, 53.6582) and Hornsea Two (-0.2604, 53.6568) at 400/220 kV,
   Thanet's explicitly-named onshore substation (1.3459, 51.3089), and the
   European Offshore Wind Deployment Centre (-2.0650, 57.2158). The rest are
   genuinely platforms at sea: Neart na Gaoithe North and South, Sheringham
   Shoal 1 and 2, Humber Gateway, Westermost Rough, Rampion, Burbo Bank 2.

   So a name filter would drop Hornsea - a landfall connection - from the very
   search it was supposed to sharpen. No onshore filter is applied, and this
   module says so on the card instead of pretending to one. An offshore
   project is measured against the SAME 5,800 features, at the SAME >=33 kV
   floor, by the SAME straight line as every other technology, and the card
   carries two extra sentences: that the line crosses water and is not the
   export cable, and that the set searched contains substations that are
   themselves offshore - named where one is returned, so the reader can see
   which. A stated limit, rather than a hidden one. A filter whose predicate
   is wrong four times in fourteen is worse than no filter, because it looks
   like precision.

   WHAT DOES NOT CHANGE, AND MUST NOT.

     - The straight line stays. It is the measurement, it is first, and the
       corridor-estimate module still sits beside it saying how far off a
       built route typically is. Nothing here replaces it.
     - Every superlative keeps carrying its sample. This module supplies the
       sample LABEL for each policy so the card cannot print "nearest"
       without printing what it searched.
     - The coordinate denominator stays. The operator publishes connection
       points and only a fraction carry coordinates; that count is computed
       at render time by nearestScope() and is not restated here, because a
       literal would go quietly false the day the pinned product moves.
     - Nothing here grades anything. No verdict word appears anywhere in this
       module, not even to disown one: the sandbox proof greps the served
       bytes for them and cannot tell a comment from a card, which is the
       right way round. A distance and a voltage, stated, and the things a
       distance cannot answer named rather than implied.

   THE ROSTER IS BY NAME ON PURPOSE.

   The Atlas never receives a raw REPD technology. Pipeline News' MAP link
   sends `technology=<t>`, the COLOUR BUCKET - so twenty raw types arrive as
   nine bucket values, and "Landfill Gas" reaches this cartridge as
   "biomass". Every one of the twenty is listed below against its bucket, so
   a proof can assert coverage by REPD name rather than by bucket, and so
   anyone reading this can see that the twenty are accounted for rather than
   assumed.
   ══════════════════════════════════════════════════════════════════════ */

(function installTechnologyCoverage() {
  'use strict';

  const SCHEMA = 'gridatlas.technology-coverage.v1';

  /* The twenty wider-fleet REPD technologies, each against the bucket the
     MAP link actually sends. Counts are the live wider-fleet payload,
     202609030009, 1,104 rows - carried so a drift in either side is visible
     rather than silent. Every one of the 1,104 rows carries a usable
     coordinate pair; none is withheld for want of a location. */
  const WIDER_FLEET = Object.freeze([
    Object.freeze({ repd: 'Landfill Gas',                       bucket: 'biomass',    rows: 275 }),
    Object.freeze({ repd: 'Anaerobic Digestion',                bucket: 'biomass',    rows: 253 }),
    Object.freeze({ repd: 'Biomass (dedicated)',                bucket: 'biomass',    rows: 159 }),
    Object.freeze({ repd: 'EfW Incineration',                   bucket: 'biomass',    rows: 122 }),
    Object.freeze({ repd: 'Small Hydro',                        bucket: 'hydro',      rows: 108 }),
    Object.freeze({ repd: 'Hydrogen',                           bucket: 'hydrogen',   rows: 60 }),
    Object.freeze({ repd: 'Advanced Conversion Technologies',   bucket: 'act',        rows: 37 }),
    Object.freeze({ repd: 'Large Hydro',                        bucket: 'hydro',      rows: 28 }),
    Object.freeze({ repd: 'Pumped Storage Hydroelectricity',    bucket: 'hydro',      rows: 15 }),
    Object.freeze({ repd: 'Tidal Stream',                       bucket: 'tidal',      rows: 14 }),
    Object.freeze({ repd: 'Sewage Sludge Digestion',            bucket: 'biomass',    rows: 12 }),
    Object.freeze({ repd: 'Geothermal',                         bucket: 'geothermal', rows: 5 }),
    Object.freeze({ repd: 'Shoreline Wave',                     bucket: 'tidal',      rows: 4 }),
    Object.freeze({ repd: 'Liquid Air Energy Storage',          bucket: 'caes',       rows: 2 }),
    Object.freeze({ repd: 'Biomass (co-firing)',                bucket: 'biomass',    rows: 2 }),
    Object.freeze({ repd: 'Hot Dry Rocks (HDR)',                bucket: 'geothermal', rows: 2 }),
    Object.freeze({ repd: 'Compressed Air Energy Storage',      bucket: 'caes',       rows: 2 }),
    Object.freeze({ repd: 'Fuel Cell (Hydrogen)',               bucket: 'hydrogen',   rows: 2 }),
    Object.freeze({ repd: 'Flywheels',                          bucket: 'flywheel',   rows: 1 }),
    Object.freeze({ repd: 'Unknown',                            bucket: 'other',      rows: 1 })
  ]);

  /* The spine, for completeness: the four the wider fleet is defined as
     excluding, and the four the shell's allow-list accepts. */
  const SPINE = Object.freeze(['solar', 'bess', 'wind_onshore', 'wind_offshore']);

  /* Offshore wind, in every spelling the register and the engine use. This
     is no longer a withholding set - it selects a DIFFERENT NOTE, not a
     different answer. */
  const OFFSHORE_TECHS = Object.freeze([
    'wind_offshore', 'wind_offshore_operational'
  ]);
  const OFFSHORE = new Set(OFFSHORE_TECHS);

  /* Named as offshore in the substation product. Used only to LABEL a
     returned row, never to remove one - see the header for the four onshore
     substations this pattern also matches, which is exactly why it does not
     filter. */
  const OFFSHORE_NAMED = /\boffshore\b/i;
  const ONSHORE_NAMED = /\bonshore\b/i;

  const PRODUCT = Object.freeze({
    features: 5800,
    with_location_tag: 0,
    offshore_in_name: 14,
    of_those_onshore: 4,
    source: 'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson'
  });

  /* The sentence the card prints under an offshore project's distances. It
     keeps every word of the old withholding note that was ABOUT ROUTES,
     because none of that reasoning was wrong; it drops only the conclusion
     that therefore nothing should be measured. */
  const OFFSHORE_NOTE =
    'This is a straight line from the project to the nearest mapped '
    + 'substation, and for an offshore project that line crosses water. It is '
    + 'not the export cable and not its length. An offshore project reaches an '
    + 'offshore substation, an export cable and a landfall before anything '
    + 'onshore, and the route inland is then chosen for consent and ground '
    + 'conditions rather than for distance, so the built length is longer than '
    + 'this by an amount no distance can tell you.';

  const OFFSHORE_SET_NOTE =
    'The set searched is the same 5,800 mapped substations used for every '
    + 'other technology. It carries no field saying which of them are onshore: '
    + 'the OSM location tag is absent from all 5,800, and of the 14 whose name '
    + 'contains "offshore" at least 4 are onshore substations serving an '
    + 'offshore wind farm. No onshore filter is applied, because one built on '
    + 'the name would drop those 4 - including Hornsea at 400/220 kV, which is '
    + 'a landfall connection. Where a result is itself named as an offshore '
    + 'substation it is marked below.';

  /* The label under which a measurement is made. The card must never print
     the word "nearest" without one of these beside it. */
  const SAMPLE = Object.freeze({
    mapped_substations: 'nearest of the mapped substations at or above the '
      + 'voltage floor that this search could see'
  });

  function bucketOf(tech) {
    return String(tech == null ? '' : tech).trim();
  }

  /**
   * What the measurement is, for one technology id.
   *
   * There is no `measure: false` branch. Every technology the register or
   * the wider fleet can send is measured; what differs is the note that
   * goes with it. A technology this module has never heard of is measured
   * too - the arrival lane already continues past an unknown id, and
   * refusing arithmetic over two coordinates because a string was
   * unfamiliar is how 109 offshore projects got nothing at all.
   */
  function policy(tech) {
    const id = bucketOf(tech);
    const offshore = OFFSHORE.has(id);
    return Object.freeze({
      technology: id || null,
      measure: true,
      offshore,
      sample: SAMPLE.mapped_substations,
      /* Both notes, in order, for offshore; nothing extra for the rest.
         The generic straight-line-is-not-a-route caveat is the card's own
         and is printed for every technology either way. */
      notes: Object.freeze(offshore ? [OFFSHORE_NOTE, OFFSHORE_SET_NOTE] : [])
    });
  }

  /**
   * Is this substation NAME one of the ones the product calls offshore?
   * Labelling only. A true here marks a row; it never removes one.
   */
  function namedOffshore(name) {
    const text = String(name == null ? '' : name);
    return OFFSHORE_NAMED.test(text) && !ONSHORE_NAMED.test(text);
  }

  /** The roster, by REPD name, for a proof to assert against. */
  function widerFleetNames() {
    return WIDER_FLEET.map(entry => entry.repd);
  }

  /** The bucket values the wider fleet's MAP link can actually send. */
  function widerFleetBuckets() {
    return [...new Set(WIDER_FLEET.map(entry => entry.bucket))].sort();
  }

  /** Every wider-fleet technology measures. Stated as a function so a proof
      cannot pass by reading a literal that stopped being true. */
  function measuredCount() {
    return WIDER_FLEET.filter(entry => policy(entry.bucket).measure).length;
  }

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  NS.technologyCoverage = Object.freeze({
    schema: SCHEMA,
    wider_fleet: WIDER_FLEET,
    spine: SPINE,
    offshore_techs: OFFSHORE_TECHS,
    product: PRODUCT,
    offshore_note: OFFSHORE_NOTE,
    offshore_set_note: OFFSHORE_SET_NOTE,
    sample: SAMPLE,
    policy,
    namedOffshore,
    widerFleetNames,
    widerFleetBuckets,
    measuredCount,
    /* Said once, here, so no caller has to phrase it and none can soften it. */
    not_a_connection: 'A distance to a mapped substation is not a connection, '
      + 'a capacity, a queue position or an offer, for any technology on this '
      + 'list.',
    shell_allow_list_note: 'The four-member technology allow-list in the '
      + 'immutable shell rejects every wider-fleet value and is caught; the '
      + 'arrival lane in this cartridge has already flown and carded by then, '
      + 'so it costs a console line and nothing else. The shell is carried '
      + 'forward verbatim and is not edited here.'
  });
})();

/**
 * GridAtlas cartridge — neon substation links and the SLD layout sandbox.
 *
 * Assembled under the generation named in the header above; this part
 * states no generation of its own, because a second identity inside the
 * same file is one that can disagree with the first. Slot: replace-script for
 * 202608292126-pre-snapped-config-adapter.js.
 *
 * WHAT IT DOES
 * ------------
 * Select a solar, battery or onshore wind project and the map draws animated
 * neon lines from it to the nearest substations at 33 kV and above. The same
 * distances are written onto the project card the engine has just opened,
 * marked BETA, with the reasons a distance is not a connection stated on the
 * card itself rather than hidden in a tooltip.
 *
 * WHY IT REPLACES THE CONFIG ADAPTER RATHER THAN ADDING A SCRIPT
 * -------------------------------------------------------------
 * The composer in atlas/index.html supports exactly one slot, `replace-script`.
 * There is no append slot, and inventing one would mean changing the composer,
 * which is a larger contract change than this feature is worth. So this
 * cartridge carries the pre-snapped config adapter's behaviour VERBATIM -- same
 * layer ids, same closure assertion, same failure mode, same public state
 * object -- and adds the link layer beside it. The immutable shell is not
 * touched, and `__GRIDATLAS_PRE_SNAPPED_CONFIG__` still reports exactly what it
 * reported before, so anything asserting on it keeps working.
 *
 * HOW IT HOOKS IN WITHOUT SHELL MUTATION
 * --------------------------------------
 * Two decorators, both of things the engine has already published by the time
 * this script runs:
 *
 *   window.initVentusMap  wrapped for the pre-snap config, as before.
 *   maplibregl.Map        wrapped to capture the instance, because the engine
 *                         keeps `map` in a closure and returns nothing. The
 *                         engine constructs its map inside initVentusMap, which
 *                         runs after this file, so the constructor is still
 *                         ours to wrap.
 *
 * THE MEASUREMENT
 * ---------------
 * Haversine on R = 6378.137 km, the same constant as ventus-corev8engine.js,
 * pipelinenews and Ventusltd/grid-distance-maths, so a distance read here
 * equals the same distance read there. Substations are mapped as points AND as
 * polygons; a polygon is reduced to its ring mean, because its first vertex is
 * a corner rather than the site.
 *
 * Scope is 33 kV and above. 11 kV is rare for utility-scale export and where it
 * occurs is often a private network behind the meter, so it is not a screening
 * signal. `voltage` is written `33000`, `33000;11000` for two voltages, and
 * `33000:11000` for a transformer ratio -- a 33/11 primary still carries 33 kV.
 *
 * WHAT A LINE IS NOT
 * ------------------
 * A straight line to mapped geometry. Not a cable route, not a connection
 * length, no wayleave, crossing, terrain or consent content. A mapped
 * substation does not confirm capacity, voltage suitability or connection
 * rights, and fault level and thermal headroom cannot be inferred from distance
 * at all -- they need DNO network data such as source impedance and a
 * connection study, alongside right of way, wayleaves and easements, land
 * control and consent. The card says all of that on screen.
 */
(() => {
  'use strict';

  const SLD_STYLES = (window.__GRIDATLAS_MODULES__ || {}).sldStyles;
  if (SLD_STYLES?.schema !== 'gridatlas.module.sld-styles.v1') {
    throw new Error('sld-sandbox requires the sld-styles module');
  }

  const GENERATION = '202609012045';

  /* ══════════════════════════════════════════════════════════════════════
     PART 1 — the pre-snapped config adapter, carried forward unchanged.
     ══════════════════════════════════════════════════════════════════════ */

  const PRE_SNAPPED_LAYER_IDS = new Set(['400', '275', '220', '132', '66']);
  const originalInit = window.initVentusMap;

  if (typeof originalInit !== 'function') {
    throw new Error('V8 engine init function is unavailable before map-ready adapter');
  }

  const state = {
    schema: 'gridatlas.pre-snapped-config-adapter.v1',
    generation: '202608292126',
    applied: false,
    changed_layer_ids: [],
    preserved_preload_flags: true,
    failures: []
  };
  window.__GRIDATLAS_PRE_SNAPPED_CONFIG__ = state;

  window.initVentusMap = function gridAtlasMapReadyInit(options) {
    try {
      const changed = [];
      const config = options.config.map(group => ({
        ...group,
        layers: group.layers.map(layer => {
          if (!PRE_SNAPPED_LAYER_IDS.has(String(layer.id))) return layer;
          if (layer.snap !== true) {
            throw new Error(`expected V8 snap=true for topology layer ${layer.id}`);
          }
          changed.push(String(layer.id));
          return { ...layer, snap: false };
        })
      }));

      const expected = [...PRE_SNAPPED_LAYER_IDS].sort();
      if (JSON.stringify([...changed].sort()) !== JSON.stringify(expected)) {
        throw new Error(`pre-snapped layer closure mismatch: ${JSON.stringify(changed)}`);
      }

      state.applied = true;
      state.changed_layer_ids = changed;
      return originalInit({ ...options, config });
    } catch (error) {
      state.failures.push(String(error?.message || error));
      throw error;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     PART 2 — neon substation links.
     ══════════════════════════════════════════════════════════════════════ */

  /* ONE geodesy, and it is the module's.
     ----------------------------------------------------------------------
     This file used to declare R_ATLAS = 6378.137 and its own distanceKm,
     four hundred lines from a second geodesy section, while the assembled
     cartridge ALSO carried the geodesy module in front of it. Two radii and
     two haversines in one served file, agreeing only because nobody had
     changed one of them yet - and on 1 Sep 2026 the all-versions proof
     found that they had in fact stopped agreeing in the last bit.

     The Grid Finding Scope already did this correctly: it calls its module
     and computes nothing itself. Geodesy was the exception. It is not now.
     A missing module is a hard failure at load, not a fallback: a fallback
     would silently restore exactly the duplication this removes. */
  const GEODESY = (window.__GRIDATLAS_MODULES__ || {}).geodesy;
  if (!GEODESY) throw new Error('sld-sandbox requires the geodesy module');
  const R_ATLAS = GEODESY.EARTH_RADIUS_KM;
  const DEG = Math.PI / 180;
  const MIN_KV = 33;
  const LINK_COUNT = 5;              // how many substations to reach for
  const MAX_LINK_KM = 40;            // beyond this, silence is more honest
  const SUBS_URL = 'data/grid_substations.geojson';
  const SUBS_LAYER_ID = 'l-subs';    // engine convention: layer `l-<id>`, source `src-<id>`

  // Project technologies this fires for. Onshore only: an offshore turbine's
  // export route is nothing like a straight line to the nearest onshore
  // substation, so drawing one would be a picture of a lie.
  /* Every technology the register actually uses, and then some.
     ----------------------------------------------------------------------
     This set was solar, bess and two spellings of wind, and it silently
     rejected the rest. Counted against the shipped register: 2,399 onshore
     wind projects and 109 offshore, so 2,508 of 7,680 — a third of the
     register — had a MAP button that did nothing at all. Not an error, not a
     message, nothing: the deep link tested membership and returned.

     The register writes `wind_onshore`. The engine has had a `wind_onshore`
     layer the whole time. Only this list disagreed with both.

     So it no longer decides alone. The list below is the fast path, and
     anything the ENGINE has a layer control for is accepted too — the engine
     owns the layers, so the engine's vocabulary is the authority and this
     stops being a place a technology can be forgotten. */
  const PROJECT_TECHS = new Set([
    'solar', 'solar_operational', 'solar_roof',
    'bess', 'bess_operational',
    'wind', 'wind_onshore', 'wind_onshore_operational',
    'wind_offshore', 'wind_offshore_operational',
    // The rest of the engine's own generation and storage dashboard, read off
    // the live page rather than guessed. Note wind_onshore is NOT among the
    // engine's layer ids -- it has `wind` and `wind_onshore_operational` --
    // yet the register writes wind_onshore for 2,399 projects. Asking the
    // engine alone would still have missed every one of them, which is why the
    // explicit entry above is not redundant with the lookup below.
    'biomass', 'hydro', 'hydrogen', 'tidal', 'geothermal',
    'flywheel', 'caes', 'act',
    /* `other` is what the register writes for a category it has no
       bucket for. Over the 11,069-row REPD product this Atlas's search
       lane reads, 25 DESNZ categories normalise to 14 ids and `other` was
       the only one missing here - 4 projects, 2 Unknown and 2 Air Source
       Heat Pumps. Not many; not zero; and written again the next time the
       register gains a category. */
    'other'
  ]);

  /* Which technologies measure, and what each measurement is OF, is owned by
     the technology-coverage module rather than by this file. It is assembled
     into this cartridge ahead of this part, so it is here by the time any of
     this runs; the fallback below exists only so a proof can load this part
     alone, and it reproduces the module's answer rather than a different one.

     Offshore NO LONGER WITHHOLDS. It used to open a card and draw nothing, on
     reasoning about export cables and landfalls that was right about routes
     and wrong about whether to measure at all. An offshore project's export
     cable does land at an onshore substation, so the distance is a
     measurement of something real. What changed is the answer; what did not
     change is a single word of the route reasoning, which the module now
     prints beside the number instead of instead of it. */
  const coverage = (() => {
    try {
      const module = window.__GRIDATLAS_MODULES__?.technologyCoverage;
      if (module && typeof module.policy === 'function') return module;
    } catch (_) { /* fall through to the local reproduction */ }
    const OFF = new Set(['wind_offshore', 'wind_offshore_operational']);
    return {
      policy: (tech) => ({ technology: tech || null, measure: true,
        offshore: OFF.has(String(tech || '')),
        sample: 'nearest of the mapped substations at or above the voltage '
          + 'floor that this search could see',
        notes: [] }),
      namedOffshore: () => false
    };
  })();
  const OFFSHORE_TECHS = new Set(['wind_offshore', 'wind_offshore_operational']);

  function isProjectTech(tech) {
    if (!tech) return false;
    if (PROJECT_TECHS.has(tech)) return true;
    // Ask the engine. If it has a control for this layer, it is a technology
    // this map knows about, whatever this cartridge was written knowing.
    try {
      return Boolean(document.querySelector(
        'input[type=checkbox][data-layer-id="' + String(tech).replace(/"/g, '') + '"]'));
    } catch (error) {
      return false;
    }
  }

  /* Pipeline News' MAP link sends a technology BUCKET, not a layer id, and
     the two are not the same vocabulary. There are exactly thirteen buckets
     it can send -- the four-member spine solar/bess/wind_onshore/
     wind_offshore, plus the nine wider-fleet buckets biomass/hydro/
     hydrogen/act/tidal/geothermal/caes/flywheel/other -- see
     atlas/modules/202609031310-technology-coverage.js SPINE and
     widerFleetBuckets(), which is the one place that list is owned.

     isProjectTech() above tests membership of PROJECT_TECHS, which
     deliberately contains wind_onshore, wind_offshore and other so that an
     arrival for one of them is not abandoned. That membership test answers
     "is this a technology the map recognises", not "is there a layer
     control with this exact id" -- and those are different questions here:

       - wind_onshore and wind_offshore are not layer ids. The engine
         publishes one combined `wind` layer, filtered on tech === 'wind',
         which is inclusive of both orientations and every status (see
         ukConfig's REPD layer group); wind_onshore_operational and
         wind_offshore_operational are narrower operational-only subsets,
         not the general layer. A deep link for either bucket wants the
         general layer switched on, so both resolve to 'wind'.
       - other has never had a layer control at all. 25 DESNZ categories
         normalise to 14 register ids and `other` is the one bucket that
         genuinely has nothing to switch on -- not a bug to retry, a fact
         to state.

     Measured live on v9.107: because isProjectTech('wind_onshore') is
     true, the arrival's own technology_layer.enabled read true while the
     DOM search for a control literally named "wind_onshore" failed every
     time -- 2,508 of 7,680 register rows, a third of it. One table here,
     consulted at the one place a control is actually looked up, so a
     bucket cannot go missing from it the way these three did while still
     passing the membership test that was supposed to catch that. */
  const LAYER_ID_FOR_BUCKET = Object.freeze({
    wind_onshore: 'wind',
    wind_offshore: 'wind',
    other: null   // no layer exists; the caller must say so, not search for one
  });

  function layerIdForBucket(tech) {
    const id = String(tech == null ? '' : tech);
    return Object.prototype.hasOwnProperty.call(LAYER_ID_FOR_BUCKET, id)
      ? LAYER_ID_FOR_BUCKET[id] : id;
  }

  // SCADA on a dark map, not arcade neon. These are the muted siblings of the
  // engine's own layer colours: enough saturation to read as live, low enough
  // not to shout over the basemap or the grid layers underneath.
  const TECH_COLOUR = {
    solar: '#d8c96a', solar_operational: '#d8c96a', solar_roof: '#d8c96a',
    bess: '#d9963c', bess_operational: '#d9963c',
    wind: '#6fb582', wind_onshore: '#6fb582', wind_onshore_operational: '#6fb582',
    // Offshore reads cooler than onshore: it is the one technology here whose
    // links are deliberately not drawn, and it should not look like the others.
    wind_offshore: '#5f9fb5', wind_offshore_operational: '#5f9fb5',
    biomass: '#b58f6f', hydro: '#6f9fd8', hydrogen: '#a98fd8',
    tidal: '#5fb5a8', geothermal: '#b57f6f',
    flywheel: '#9f9fb5', caes: '#9f9fb5', act: '#9f9fb5'
  };
  const SUBSTATION_COLOUR = '#5fbdc2';   // teal, the substation end of a link

  /* ── the 400 kV public record ────────────────────────────────────────
     The nearest-substations list is a measurement and nothing more. But
     the DCO-scale schemes each carry a PUBLIC declared point of connection
     at 400 kV - usually through a new customer substation consented within
     the scheme itself - and this card used to say nothing about it while
     listing closer 33 and 132 kV points, which read as connecting them to
     the wrong network. The rule holds: bind to the public record or say
     nothing. Every entry below is sourced from Development Consent Orders,
     Planning Inspectorate documents, or public project statements; the
     table binds a register identity to a NAMED substation in the served
     payload, and the distance shown is measured, never asserted. */
  const DECLARED_COLOUR = '#d8b64a';   // gold: declared, and the far end exists today
  /* Pink: declared, and the thing at the far end has not been built. One
     Earth's point of connection is a National Grid substation that does not
     exist yet; Thorpe Marsh's is under construction. Drawing those in the
     same gold as a connection into a live substation would say something
     untrue about the network, so they get their own colour and the card
     says which it is. The distinction is taken from the public record, not
     from the map: an unbuilt substation can be absent from OSM, or present
     because someone mapped the consented site. */
  const DECLARED_UNBUILT_COLOUR = '#d87aa8';
  /* The table itself, and the three functions that bind it to the payload,
     moved to the declared-connections module at generation 202609012128.
     The body keeps the colours (rendering) and the state; the record is
     read from the module, which a proof can open on its own and a cut
     hashes on its own. A missing module is a hard failure at load, for
     the same reason as geodesy: a fallback would quietly restore a second
     copy of the table. */
  const DECLARED = (window.__GRIDATLAS_MODULES__ || {}).declaredConnections;
  if (!DECLARED) throw new Error('sld-sandbox requires the declared-connections module');

  let currentRepdRef = null;
  let currentDeclared = null;
  let currentNearest400 = null;
  /* The coverage policy for the CURRENT selection. It carries no arithmetic
     and changes no result - it decides only which sentences go under the
     distances. The measurement itself is coordinates, a candidate set and a
     distance, and reads no technology at all. */
  let currentPolicy = null;
  /* The capacity Pipeline News sent, kept where the network card can
     reach it. Without this the powerflow answer would have to invent a
     figure, and an invented megawatt is exactly the kind of number that
     gets quoted back as the project's own. */
  let currentCapacityMw = null;

  /* What the Order says is known the moment the identity is known: the
     substation, the voltage class, the route, the consented works and the
     citation need no payload, no fetch and no map. On a phone that is the
     difference between a card that answers and a card that waits. The
     distance is the one part that must be measured, so it is the one part
     marked pending until it has been. */
  function provisionalDeclaredConnection(repdRef) {
    return DECLARED.provisional(repdRef);
  }

  function resolveDeclaredConnection(repdRef, origin, subs) {
    return DECLARED.resolve(repdRef, origin, subs);
  }

  function nearestTransmission(origin, subs) {
    return DECLARED.nearestTransmission(origin, subs);
  }

  /* EVERY SUPERLATIVE CARRIES ITS SAMPLE.
     --------------------------------------------------------------------
     "Nearest 400 kV substation" is nearest among what this search could
     see, and two different things limit that. The search runs over the
     substation features the map has loaded, so the first number is how
     many of them were actually eligible - counted by the measurement
     itself, not assumed. And the operator's own published list is only
     partly located: ETYS names substations and does not place them, so
     the geometry comes from OpenStreetMap through a GridAtlas release and
     a fraction of the network is invisible to any search by distance.

     Both numbers are COMPUTED at render time from what was fetched. A
     literal would go quietly false the day the pinned product moves -
     Codex's join correction alone takes located points from 502 to 489 -
     and a stale denominator under the word "nearest" is worse than none.

     It states the sample. It does not grade the result. */
  /* A straight line is not a route, and the card said nothing about it.
     --------------------------------------------------------------------
     ADDITIVE. The straight-line distance is unchanged, still first, still
     the measurement; the corridor figure sits beside it and is labelled an
     estimate every time it appears.

     Only for a CABLE question. The factor is calibrated on cable circuits,
     which follow the highway network; overhead line crosses open country
     and measures 1.13. The module publishes that number and deliberately
     offers no forOverhead(), so this cannot quietly become the answer to a
     question it was not measured on.

     Under about a kilometre the module withholds the estimate rather than
     scaling, and the card says why: at that separation the straight line
     between two site centroids is not measuring route factor at all. */
  function corridorBeside(km) {
    const module = (() => {
      try { return window.__GRIDATLAS_MODULES__?.corridorEstimate || null; }
      catch (_) { return null; }
    })();
    if (!module) return '';
    const estimate = module.forCable(km);
    if (!estimate) return '';
    const basis = module.basis;
    if (estimate.withheld) {
      return ` <span class="neon-caveat">No corridor estimate at this `
        + `separation: ${escapeHtml(estimate.withheld)}.</span>`;
    }
    return ` &middot; ~${estimate.km.toFixed(1)} km corridor estimate `
      + `(&times;${estimate.factor}, ${basis.within_15_pct}% of GB transmission `
      + `cable circuits within 15% of published length, `
      + `${basis.distinct_site_pairs} distinct site pairs). `
      + `<span class="neon-caveat">${escapeHtml(module.caveat)} `
      + `${escapeHtml(module.not_for_overhead)}</span>`;
  }

  /* A 44 px action, and a sheet that is the corridor figures in full.
     --------------------------------------------------------------------
     The card line beside each distance is one sentence. A reader who wants
     the basis - what the factor was calibrated on, how wrong it typically
     is, and what it is not for - should not have to take that from a
     sentence, and on a phone there is no room to print it inline.

     44 px because that is the smallest target a thumb hits reliably; the
     estate's own layers toggle was widened to the same at 202609030116.

     The sheet is opened three ways and all of them end in one function:
     the button, a right-click on the map (the engine binds no contextmenu
     - measured, zero occurrences in the shell, in index.html and in every
     composed part), and a long press.

     THE LONG PRESS DEFERS TO EVERYTHING. It arms on touchstart, and it is
     cancelled by a movement of more than 10 px, by a second finger, by
     touchend, and by an SLD drag already being in progress - the sandbox
     binds its own touchstart for dragging the array, its handle and its
     route pins, so this must never fire during one. A pan is a movement;
     a pinch is a second finger; both cancel before the 500 ms is up. */
  const CORRIDOR_SHEET = 'gridatlas-corridor-sheet';
  let corridorSheetInstalled = false;

  function corridorTargets() {
    const rows = [];
    if (currentDeclared && currentDeclared.kind !== 'circuit'
      && Number.isFinite(currentDeclared.km)) {
      rows.push({ name: currentDeclared.poc, km: currentDeclared.km,
        note: 'declared point of connection, from the public record' });
    }
    if (currentNearest400) {
      rows.push({ name: currentNearest400.name, km: currentNearest400.km,
        note: 'nearest mapped substation at 400 kV or above' });
      if (currentNearest400.named && currentNearest400.named.name !== currentNearest400.name) {
        rows.push({ name: currentNearest400.named.name, km: currentNearest400.named.km,
          note: 'nearest NAMED substation at 400 kV or above' });
      }
    }
    return rows;
  }

  function corridorAction() {
    if (!corridorTargets().length) return '';
    /* The card can render before the map is wired, and the button is
       useless without the delegated listener. Installing here as well is
       idempotent and removes the ordering dependency entirely. */
    installCorridorSheet();
    return `<button type="button" class="gridatlas-corridor-open" `
      + `data-gridatlas-corridor="1" `
      + `aria-haspopup="dialog">Explore route corridors \u203a</button>`;
  }

  function installCorridorSheet() {
    if (corridorSheetInstalled) return;
    corridorSheetInstalled = true;

    const style = document.createElement('style');
    style.textContent =
      '.gridatlas-corridor-open{display:block;width:100%;min-height:44px;margin:8px 0 2px;'
      + 'font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;'
      + 'text-align:left;padding:12px 14px;border-radius:6px;cursor:pointer;'
      + 'background:#0d1117;color:#7fe3d0;border:1px solid #2b3a44;}'
      + '.gridatlas-corridor-open:focus-visible{outline:2px solid #7fe3d0;outline-offset:2px;}'
      + '#' + CORRIDOR_SHEET + '{position:fixed;left:0;right:0;bottom:0;z-index:10000;'
      + 'max-height:min(70vh,560px);overflow:auto;transform:translateY(101%);'
      + 'transition:transform .18s ease-out;background:#070d11;color:#cfe6e8;'
      + 'border-top:1px solid #0b5f63;padding:14px 16px calc(16px + env(safe-area-inset-bottom));'
      + 'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;}'
      + '#' + CORRIDOR_SHEET + '[data-open="1"]{transform:translateY(0);}'
      + '#' + CORRIDOR_SHEET + ' h4{margin:0 0 8px;font-size:13px;color:#7fe3d0;}'
      + '#' + CORRIDOR_SHEET + ' .r{padding:8px 0;border-top:1px solid #14252b;}'
      + '#' + CORRIDOR_SHEET + ' .c{color:#8fa6ab;}'
      + '#' + CORRIDOR_SHEET + ' button{min-height:44px;min-width:44px;cursor:pointer;'
      + 'background:#0d1117;color:#7fe3d0;border:1px solid #2b3a44;border-radius:6px;'
      + 'padding:10px 14px;font:600 12px/1 ui-monospace,monospace;}'
      + '@media (prefers-reduced-motion:reduce){#' + CORRIDOR_SHEET + '{transition:none;}}';
    document.head.appendChild(style);

    const sheet = document.createElement('div');
    sheet.id = CORRIDOR_SHEET;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Route corridor estimates');
    sheet.dataset.open = '0';
    sheet.hidden = true;
    document.body.appendChild(sheet);

    const close = () => { sheet.dataset.open = '0'; sheet.hidden = true; };

    window.__GRIDATLAS_CORRIDOR_SHEET__ = {
      get open() { return sheet.dataset.open === '1'; },
      close,
      open: () => openCorridorSheet(sheet)
    };

    document.addEventListener('click', (event) => {
      const opener = event.target?.closest?.('[data-gridatlas-corridor]');
      if (opener) { event.preventDefault(); openCorridorSheet(sheet); return; }
      if (event.target?.closest?.('[data-gridatlas-corridor-close]')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && sheet.dataset.open === '1') close();
    });
  }

  function openCorridorSheet(sheet) {
    const module = (() => {
      try { return window.__GRIDATLAS_MODULES__?.corridorEstimate || null; }
      catch (_) { return null; }
    })();
    const rows = corridorTargets();
    if (!rows.length) return;
    const body = rows.map(row => {
      const estimate = module ? module.forCable(row.km) : null;
      const corridor = estimate && estimate.km !== null
        ? `~${estimate.km.toFixed(1)} km corridor estimate`
        : (estimate ? 'no corridor estimate at this separation' : '');
      return `<div class="r"><b>${escapeHtml(row.name)}</b><br>`
        + `${row.km.toFixed(2)} km straight`
        + (corridor ? ` &middot; ${corridor}` : '')
        + `<br><span class="c">${escapeHtml(row.note)}`
        + (estimate && estimate.withheld
          ? `. ${escapeHtml(estimate.withheld)}` : '')
        + `</span></div>`;
    }).join('');
    const basis = module ? module.basis : null;
    sheet.innerHTML = `<h4>Route corridors</h4>${body}`
      + (basis
        ? `<div class="r c">Straight-line distance is measured. The corridor `
          + `figure is that distance times ${basis.factor}, calibrated on the `
          + `${basis.source}: median absolute error `
          + `${basis.median_absolute_error_pct}%, `
          + `${basis.within_15_pct}% within 15%, over `
          + `${basis.distinct_site_pairs} distinct site pairs. `
          + `${escapeHtml(module.caveat)} ${escapeHtml(module.not_for_overhead)} `
          + `${escapeHtml(module.not_an_assessment)}</div>`
        : `<div class="r c">The corridor module is not loaded, so only the `
          + `measured straight-line distances are shown.</div>`)
      + `<div class="r"><button type="button" data-gridatlas-corridor-close="1">`
      + `Close</button></div>`;
    sheet.hidden = false;
    sheet.dataset.open = '1';
  }

  /* Right-click on desktop, long press on touch. Both end in the sheet. */
  function armCorridorGestures(map) {
    installCorridorSheet();
    try {
      map.on('contextmenu', (event) => {
        if (!corridorTargets().length) return;
        event.preventDefault?.();
        openCorridorSheet(document.getElementById(CORRIDOR_SHEET));
      });
    } catch (_) { /* a shimmed map in a proof */ }

    const canvas = (() => {
      try { return map.getCanvas ? map.getCanvas() : null; } catch (_) { return null; }
    })();
    if (!canvas) return;
    let timer = null;
    let from = null;
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; from = null; };
    canvas.addEventListener('touchstart', (event) => {
      cancel();
      /* Never during an SLD drag: this cartridge binds its own touchstart
         for the array, the rotate handle and the route pins. */
      if (sld && sld.dragging) return;
      if (event.touches.length !== 1) return;
      if (!corridorTargets().length) return;
      from = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      timer = setTimeout(() => {
        timer = null;
        if (sld && sld.dragging) return;
        openCorridorSheet(document.getElementById(CORRIDOR_SHEET));
      }, 500);
    }, { passive: true });
    canvas.addEventListener('touchmove', (event) => {
      if (!timer || !from) return;
      const touch = event.touches[0];
      if (!touch) { cancel(); return; }
      /* A pan is a movement. Ten pixels is below the threshold a deliberate
         press produces and above the jitter a still thumb produces. */
      if (Math.abs(touch.clientX - from.x) > 10
        || Math.abs(touch.clientY - from.y) > 10) cancel();
    }, { passive: true });
    canvas.addEventListener('touchend', cancel, { passive: true });
    canvas.addEventListener('touchcancel', cancel, { passive: true });
  }

  function nearestScope(n) {
    const considered = Number(n && n.considered);
    const network = (() => {
      try { return window.__GRIDATLAS_NETWORK__?.coverage?.(400) || null; }
      catch (_) { return null; }
    })();
    if (!Number.isFinite(considered) && !network) return '';
    const said = [];
    if (Number.isFinite(considered)) {
      said.push(`nearest of the ${considered.toLocaleString('en-GB')} mapped `
        + `substation${considered === 1 ? '' : 's'} at 400 kV or above that this `
        + `search could see`);
    }
    if (network && network.published) {
      said.push(`the operator publishes ${network.published.toLocaleString('en-GB')} `
        + `connection point${network.published === 1 ? '' : 's'} at that class and `
        + `${network.located.toLocaleString('en-GB')} of them carry coordinates, so `
        + `${network.unlocated.toLocaleString('en-GB')} cannot be measured to at all`);
    }
    return `<p class="neon-caveat">Scope: ${said.join('; ')}. A nearer one may `
      + `exist that nothing here can see.</p>`;
  }

  function declaredBlockHtml(toSubstations) {
    if (!toSubstations) return '';
    let out = '';
    if (currentDeclared) {
      const d = currentDeclared;
      const unbuiltPoc = d.poc_status === 'not_built'
        || d.poc_status === 'under_construction';
      const stateLabel = d.poc_status === 'not_built' ? 'Not built yet'
        : (d.poc_status === 'under_construction' ? 'Under construction' : '');
      out += `<div class="neon-hd">Declared connection`
        + (stateLabel ? `<span class="neon-beta" style="background:#d87aa8;color:#1a0b13">`
          + `${stateLabel}</span>` : '')
        + `<span class="neon-beta">Public record</span></div>`
        + `<ol><li>`
        + (d.at ? `<span class="neon-km">${d.km.toFixed(2)} km</span>` : '')
        + `<span class="neon-name">${escapeHtml(d.poc)}</span>`
        + (d.kv ? `<span class="neon-kv">${d.kv} kV</span>` : '')
        + `</li></ol>`
        + `<p class="neon-caveat">Via ${escapeHtml(d.via)}. `
        + `Source: ${escapeHtml(d.source)}.`
        + (d.works ? ` ${escapeHtml(d.works)}` : '')
        + (d.poc_status_note ? ` This point of connection is not yet in service: `
          + `${escapeHtml(d.poc_status_note)}.` : '')
        + (d.at ? ''
          : (d.kind === 'circuit'
            ? ' The point of connection is a circuit rather than a substation, so no line is drawn and no distance is measured.'
            : (d.pending
              ? ' The distance is being measured now.'
              : ' This substation is not in the mapped payload, so no distance is measured.')))
        + `</p>`;
      // Quotations of consented works from the made Order or Environmental
      // Statement - the DCO's own illustration of the customer substation
      // and the interface at the point of connection. Never design advice.
      if (d.customer_works) {
        out += `<p class="neon-caveat"><b>Customer substation (consented):</b> `
          + `${escapeHtml(d.customer_works)}</p>`;
      }
      if (d.poc_works) {
        out += `<p class="neon-caveat"><b>Works at the point of connection:</b> `
          + `${escapeHtml(d.poc_works)}</p>`;
      }
    }
    /* What the system operator publishes about the substation this card
       names. The sandbox asks; the substation cartridge answers from
       Ventusltd/data-grid-gb, which is ETYS restated. Absent is absent:
       no sentence at all rather than an empty one. */
    const networkName = currentDeclared?.kind !== 'circuit'
      ? (currentDeclared?.poc || currentNearest400?.name) : currentNearest400?.name;
    /* Tell it the voltage the connection is actually made at: the declared
       point of connection's class where there is one, otherwise the class
       of the substation being measured to. Without this the answer can
       only be a site-wide envelope. */
    const connectionKv = currentDeclared?.kind !== 'circuit'
      ? (currentDeclared?.kv || currentNearest400?.kv || null)
      : null;
    /* connection-points counts LANDINGS: a transformer's windings are both
       at the site, so Cowley's five read as ten and 484 of 525 sites were
       1.90x over. Only the node/branch model holds the pairs. */
    const publishedUnits = (() => {
      if (topology.state !== 'ready' || !topology.index) return null;
      try {
        const point = window.__GRIDATLAS_NETWORK__?.byName?.(networkName);
        if (!point?.site_code) return null;
        const facts = topology.index.at(point.site_code);
        if (!facts?.counts) return null;
        return { circuits: facts.counts.circuits,
          transformers: facts.counts.transformers };
      } catch (_) { return null; }
    })();
    const published = (() => {
      try {
        return window.__GRIDATLAS_NETWORK__?.summarise?.(
          networkName, { connectionKv, units: publishedUnits }) || null;
      } catch (_) { return null; }
    })();
    /* The envelope is built HERE and appended BELOW the measurement.
       ---------------------------------------------------------------------
       WHY THE ORDER CHANGED. Driven on a verified iPhone-class device
       (393x852, pointer:coarse, hover:none, 5 touch points), 101 MAP taps
       across all 25 technologies: the distance was on the page 99 times out
       of 99 and on the first screen zero times. Measured here, it landed at
       y=907 in an 852px viewport with about 270px of published-envelope
       detail above it. The envelope is neither deleted nor shortened; it
       moves below the answer it is context for. The measurement paragraph
       names the substation, so nothing above it is needed to read it. It is
       still built before the block is emitted, because link.network_published
       and the topology block both depend on it having been asked for. */
    const publishedHtml = (() => {
      if (!published) return '';
      link.network_published = { name: networkName, site: published.site_code };
      /* The scope label goes FIRST. A site-wide envelope printed under a
         400 kV declared connection reads as a 400 kV result unless the
         reader is told otherwise before the numbers, not after. */
      return `<div class="neon-hd">${escapeHtml(networkName)}`
        + (published.fault_scope === 'bus'
          ? `<span class="neon-beta" style="background:#12323a;color:#8fd8e0">`
            + `${published.fault_kv} kV bus</span>`
          : (published.site_wide
            ? `<span class="neon-beta" style="background:#3a3a2a;color:#d8c96a">Site-wide</span>`
            : ''))
        + `<span class="neon-beta">NESO published</span></div>`
        + `<p class="neon-caveat"><b>${escapeHtml(published.scope_label)}.</b></p>`
        + `<p class="neon-caveat">${escapeHtml(published.sentence)}.</p>`
        + `<p class="neon-caveat">${escapeHtml(published.metrics_not_interchangeable)} `
        + `${escapeHtml(published.attribution)}. `
        + `${escapeHtml(published.not_an_assessment)}</p>`;
    })();
    if (currentNearest400) {
      const n = currentNearest400;
      /* The measurement and everything that makes it honest are ONE element,
         which is why nearestScope(n) is inside the wrapper rather than
         appended after it. Whatever a layout does to this block - move it,
         dock it, put it in a sheet - the number cannot arrive without the
         word "straight", without the corridor estimate's own caveat, and
         without the sentence naming the sample the superlative searched. */
      out += `<div class="neon-answer">`
        + `<p class="neon-caveat"><b>Nearest 400 kV substation:</b> `
        + `${escapeHtml(n.name)} · ${n.km.toFixed(2)} km straight`
        + corridorBeside(n.km)
        + (n.works ? `. ${escapeHtml(n.works)}` : '')
        + (n.named
          ? ` (nearest named: ${escapeHtml(n.named.name)} · ${n.named.km.toFixed(2)} km`
            + (n.named.works ? `. ${escapeHtml(n.named.works)}` : '') + `)`
          : '')
        + `</p>`
        + nearestScope(n)
        + `</div>`;
    }
    out += publishedHtml;
    if (networkName) {
      out += topologyBlockHtml([{ name: networkName, kv: connectionKv }]);
    }
    out += corridorAction();
    return out;
  }

  /* ── the transmission network, on demand ─────────────────────────────
     Vikram: click anywhere and the neons should "look for cartridges and
     code". Until this generation the looking stopped at NESO's connection
     points - one row per site. The node/branch model behind them (ETYS
     Appendix B as Ventusltd/data-grid-gb's gb-transmission-network.v1) was
     indexed by the network-topology module, proven 47/47, and composed
     into nothing: the module was on disk and not in any served cartridge.
     The deep scan of 202609012230 listed it as alive; it was alive the way
     a book on a shelf is.

     The product is ten megabytes. It is NOT fetched at load: a phone on a
     hillside should not pay for it until a click asks a question it
     answers. Fetched once, indexed once by the module, every state on
     __GRIDATLAS_TOPOLOGY__ so the source registry can say whether this
     source answered, and the cards fill in when it arrives rather than
     waiting for it.

     The join from a mapped substation to a published site is BY NAME,
     through the connection-points cartridge's own join, and the block says
     which site it joined to - Codex's WBUR finding stands: exact text
     equality is not exact identity, so the reader is shown the identity. */
  /* Pinned; the table and the reasoning are in the pinned-products module. */
  const PINS = (window.__GRIDATLAS_MODULES__ || {}).pinnedProducts || null;
  const TOPOLOGY_ID = 'gb-transmission-network.v1';
  const TOPOLOGY_PRODUCT = PINS ? PINS.url(TOPOLOGY_ID) : null;
  const TOPOLOGY_BLOCK = 'gridatlas-topology';
  const topology = { state: 'idle', product: TOPOLOGY_PRODUCT, schema: null,
    schema_required: topologyModule()?.accepts || null,
    bytes: null, sites: null, index: null, error: null,
    started_at: null, ready_at: null, blocks_filled: 0 };
  window.__GRIDATLAS_TOPOLOGY__ = topology;

  /* Published so a reviewer can ask the page how many cards the traversal
     actually answered, and how many published branches it refused to walk.
     A refusal is a finding about the data, not a failure of the page. */
  const electrical = { answered: 0, refusals: 0 };
  window.__GRIDATLAS_ELECTRICAL__ = electrical;

  /* How many cards quoted a seasonal rating, and how many placeholder
     values the published record turned out to contain. */
  const rating = { answered: 0, flagged: 0 };
  window.__GRIDATLAS_RATINGS__ = rating;

  /* Published so a reviewer can ask the page whether any answer it gave
     failed its own conservation check. A solve that has not converged
     produces plausible-looking flows that are wrong, so the error is
     surfaced rather than trusted. */
  const powerflow = { answered: 0, refused: 0, worst_kirchhoff_error: 0 };
  window.__GRIDATLAS_POWERFLOW__ = powerflow;

  /* How many point queries the reader ran. A feature nobody can reach is
     indistinguishable from a feature that does not work, and this is the
     number that tells them apart. */
  const pointQuery = { answered: 0 };
  window.__GRIDATLAS_POINT_QUERY__ = pointQuery;

  /* How many cards reported published plans, and how many rows they came
     from. A count of zero where the product has 2,230 rows would mean the
     wiring is broken, not that nothing is planned. */
  const plannedState = { answered: 0, rows: 0 };
  window.__GRIDATLAS_PLANNED__ = plannedState;

  /* How many cards named an owner, and how many seams they found. */
  const ownerState = { answered: 0, seams: 0 };
  window.__GRIDATLAS_OWNERSHIP__ = ownerState;

  /* The layers dash collapses without entering fullscreen.
     ---------------------------------------------------------------------
     The dash is 816 px tall on a desktop and takes most of a phone, and
     the only way past it has been fullscreen - a different mode with a
     different layout, which is a large thing to ask of a reader who just
     wants to see the map. This collapses it in place and leaves a tab to
     bring it back.

     The choice is remembered per browser and every storage access is
     wrapped: a private window, cleared site data or a browser set to
     block storage all throw here, and a thrown error must not take the
     control with it. */
  (function dashCollapse() {
    const KEY = 'gridatlas.dash.collapsed';
    /* HIDE LAYERS collapsed `.dashboard`, which is the whole app: in the
       shipped shell it opens at index.html:22 and holds BOTH
       `.map-container` (line 36, containing #map) and `.scada-wrapper`
       (line 112, the layer keys and legend), so max-height:0 took the WebGL
       canvas down with the checkboxes - and the choice is remembered, so
       the reload a reader reaches for blanked the page again.

       It targets `.scada-wrapper` now, with NO fallback: the last fallback
       is what blanked the map. It also hides itself in fullscreen, because
       the keeper below MOVES the panel into the fullscreen element. */
    const dash = document.querySelector('.scada-wrapper');
    if (!dash) {
      /* `link` is declared further down this file and is in its temporal
         dead zone here, so the refusal is published on its own surface
         rather than through the failure ledger. */
      window.__GRIDATLAS_DASH__ = { installed: false, target: '.scada-wrapper',
        reason: 'no .scada-wrapper in this shell; the control was not installed '
          + 'rather than pointed at .dashboard, which contains the map' };
      return;
    }
    if (document.getElementById('gridatlas-dash-toggle')) return;

    const style = document.createElement('style');
    style.textContent = '.scada-wrapper[data-gridatlas-collapsed="1"]{max-height:0;'
      + 'overflow:hidden;padding-top:0;padding-bottom:0;border:0;}'
      + '#gridatlas-dash-toggle{position:fixed;right:12px;bottom:12px;z-index:9999;'
      + 'min-height:44px;min-width:44px;'
      + 'font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;'
      + 'letter-spacing:.08em;padding:8px 12px;border-radius:6px;cursor:pointer;'
      + 'background:#0d1117;color:#7fe3d0;border:1px solid #2b3a44;}'
      + '#gridatlas-dash-toggle[hidden]{display:none !important;}'
      + '#gridatlas-dash-toggle:focus-visible{outline:2px solid #7fe3d0;outline-offset:2px;}';
    document.head.appendChild(style);

    const toggle = document.createElement('button');
    toggle.id = 'gridatlas-dash-toggle';
    toggle.type = 'button';

    /* Closed on a FIRST arrival ON A PHONE only - measured, the panel held
       31.6% of a 393x852 screen against the map's 29.3%, which is the wrong
       trade on the surface most readers arrive on. A desktop has the room and
       opens with the panel showing, exactly as v8 always did: that is the
       product surface, and hiding it made the Atlas look less capable than the
       version it replaced. A choice once made still wins over both defaults.

       An UNKNOWN width is not a phone - the width has to be a real positive
       number before it argues for starting collapsed, so a host that publishes
       no width gets the desktop default rather than an empty-looking page. */
    const width = Number(window.innerWidth);
    const coarse = (() => {
      try { return !!(window.matchMedia
        && window.matchMedia('(pointer: coarse)').matches); } catch (_) { return false; }
    })();
    let collapsed = coarse || (isFinite(width) && width > 0 && width <= 700);
    try {
      const v = window.localStorage.getItem(KEY);
      if (v !== null) collapsed = v === '1';
    } catch (_) { /* the width-derived default above stands */ }

    if (new URLSearchParams(location.search).has('repd_ref')) collapsed = true;

    function reflect() {
      if (collapsed) dash.setAttribute('data-gridatlas-collapsed', '1');
      else dash.removeAttribute('data-gridatlas-collapsed');
      toggle.textContent = collapsed ? '\u25b4 LAYERS' : '\u25be HIDE LAYERS';
      toggle.setAttribute('aria-pressed', String(collapsed));
      toggle.setAttribute('aria-label', collapsed
        ? 'Show the layers panel' : 'Hide the layers panel');
      /* MapLibre sizes itself to its container and will not notice the
         page reflowing under it. */
      try { if (window.map && typeof window.map.resize === 'function') window.map.resize(); }
      catch (_) { /* the control still works without the resize */ }
    }

    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      try { window.localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (_) { /* per-viewer nicety only */ }
      reflect();
    });

    document.body.appendChild(toggle);
    reflect();

    const reflectFullscreen = () => {
      const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
      toggle.hidden = full;
    };
    document.addEventListener('fullscreenchange', reflectFullscreen);
    document.addEventListener('webkitfullscreenchange', reflectFullscreen);
    reflectFullscreen();

    window.__GRIDATLAS_DASH__ = {
      /* Named so a reader - and a proof - can see WHAT collapses. */
      installed: true,
      target: '.scada-wrapper',
      get collapsed() { return collapsed; },
      get hidden_by_fullscreen() { return toggle.hidden; },
      toggle: () => { toggle.click(); return collapsed; }
    };
  }());
  let topologyPromise = null;

  function topologyModule() {
    try { return window.__GRIDATLAS_MODULES__?.networkTopology || null; }
    catch (_) { return null; }
  }

  function ensureTopology() {
    if (topologyPromise) return topologyPromise;
    const module = topologyModule();
    if (!module) {
      topology.state = 'failed';
      topology.error = 'network-topology module absent from this composition';
      noteFailure('transmission network: ' + topology.error);
      return Promise.resolve(null);
    }
    topology.state = 'loading';
    topology.started_at = Date.now();
    if (!TOPOLOGY_PRODUCT) {
      topology.state = 'failed';
      topology.error = 'no pinned ref: pinned-products is not composed';
      noteFailure('transmission network: ' + topology.error);
      return Promise.resolve(null);
    }
    topologyPromise = fetch(TOPOLOGY_PRODUCT)
      .then(async response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const text = await response.text();
        topology.bytes = text.length;
        topology.pin = await PINS.verify(TOPOLOGY_ID, text);
        if (topology.pin.state === 'MISMATCH') throw new Error(topology.pin.detail);
        return JSON.parse(text);
      })
      .then(product => {
        const index = module.index(product);
        if (!index) {
          throw new Error('schema ' + String(product?.schema || 'absent')
            + ' is not ' + module.accepts + '; this cartridge answers nothing from it');
        }
        topology.index = index;
        /* the buses the declared DC model is built over. 400 kV only:
           a DC model that walks a transformer without its tap position
           is modelling something the product does not describe, and the
           taps are not published. */
        /* Kept because the planned-change and owner-boundary readers
           take the PRODUCT, not the graph - graph() withholds planned
           rows by design and does not carry transmission_owner. This is
           one reference to an object already in memory, not a copy. */
        topology.parsedProduct = product;
        topology.nodes400 = (product.nodes || [])
          .filter(n => n && n.voltage_consistent_with_site === true && n.voltage_kv === 400)
          .map(n => n.node);
        topology.schema = product.schema;
        topology.sites = index.counts.sites;
        topology.state = 'ready';
        topology.ready_at = Date.now();
        return index;
      })
      .catch(error => {
        topology.state = 'failed';
        topology.error = String(error?.message || error);
        noteFailure('transmission network: ' + topology.error);
        return null;
      });
    return topologyPromise;
  }

  /* Render for a list of { name, kv } queries: the mapped substation's
     name and the voltage the question is about. Every card that names a
     substation gets one of these; it is a placeholder until the product
     is indexed and is filled in place, so no card holds a reference to
     another card. */
  /* The electrical-distance module, read the same way the topology
     module is read: absent is absent, never an excuse to guess. */
  function distanceModule() {
    try { return window.__GRIDATLAS_MODULES__?.electricalDistance || null; }
    catch (_) { return null; }
  }

  /* The planned-change module takes the PRODUCT, not the topology
     index: graph() deliberately withholds planned rows, which is the
     right default and the reason this needs its own reader. The parsed
     product is not kept alive after indexing, so the index is built once
     and cached here beside the others. */
  let ownerIndex;
  function ownerModule() {
    try { return window.__GRIDATLAS_MODULES__?.ownerBoundary || null; }
    catch (_) { return null; }
  }

  let plannedIndex;
  function plannedModule() {
    try { return window.__GRIDATLAS_MODULES__?.plannedChange || null; }
    catch (_) { return null; }
  }

  function flowModule() {
    try { return window.__GRIDATLAS_MODULES__?.injectionResponse || null; }
    catch (_) { return null; }
  }

  /* The 400 kV model is built once per session and kept: assembling it
     walks every published node, and a card that rebuilt it per click
     would be doing that work again for an answer it already had.

     The node list comes from topology.nodes400, which ensureTopology
     records while it already has the parsed product in hand. Rebuilding
     it here would mean either keeping a second copy of the 10 MB payload
     alive or asking the graph for something it does not expose. */
  let flowModel = null;
  function flowModelFor(index) {
    if (flowModel) return flowModel;
    const mod = flowModule();
    if (!mod || !index || typeof index.graph !== 'function') return null;
    const names = topology.nodes400;
    if (!Array.isArray(names) || !names.length) return null;
    try {
      flowModel = mod.assemble(index.graph(), names,
        { voltageKv: 400, includeTransformers: false });
      return flowModel;
    } catch (_) { return null; }
  }

  function ratingModule() {
    try { return window.__GRIDATLAS_MODULES__?.ratingEnvelope || null; }
    catch (_) { return null; }
  }

  /* The published network at an arbitrary point.
     ---------------------------------------------------------------------
     The connection-points cartridge already resolves a position to the
     nearest published sites, so this does not measure anything itself -
     a second distance implementation in this file is exactly the drift
     that put two geodesies in one cartridge. It resolves, states the
     limit of what "nearest" can mean here, and hands the nearest name to
     the block that already renders circuits, ratings, hops and flow. */
  async function runGridAtPoint(map, lon, lat) {
    const gl = window.maplibregl;
    if (!gl?.Popup) return;
    const network = window.__GRIDATLAS_NETWORK__ || null;
    const show = (html) => {
      try {
        return new gl.Popup({ maxWidth: '380px', closeOnClick: false })
          .setLngLat([lon, lat]).setHTML(html).addTo(map);
      } catch (error) {
        noteFailure('grid at point: ' + String(error?.message || error));
        return null;
      }
    };

    if (!network || typeof network.nearest !== 'function' || !network.loaded) {
      show('<p class="neon-caveat"><b>Grid at point:</b> the connection-points '
        + 'cartridge has not loaded, so no published site can be named. '
        + 'Nothing is inferred from its absence.</p>');
      return;
    }

    /* nearest() returns { point, km } pairs, sorted. It owns the distance;
       measuring again here would be the second implementation that put
       two geodesies in one cartridge earlier tonight. */
    let found = [];
    try { found = network.nearest(lon, lat, { limit: 5 }) || []; }
    catch (_) { found = []; }
    if (!Array.isArray(found)) found = found ? [found] : [];

    const points = Number(network.points || 0);
    const located = Number(network.located || 0);
    const unlocated = points - located;

    if (!found.length) {
      show('<p class="neon-caveat"><b>Grid at point:</b> no published connection '
        + 'point with coordinates resolved here. ' + unlocated + ' of the '
        + points + ' published points carry no coordinates at all, so this is '
        + 'a statement about the mapped set and not about the network.</p>');
      pointQuery.answered += 1;
      return;
    }

    const rows = found.map(entry => escapeHtml(String(entry.point?.name || '?'))
      + (Number.isFinite(entry.km) ? ' \u00b7 ' + entry.km.toFixed(1) + ' km' : ''));

    const popup = show('<div class="neon-hd">Grid at this point'
      + '<span class="neon-beta">published network</span></div>'
      + '<p class="neon-caveat"><b>Nearest mapped connection points:</b> '
      + rows.join(', ') + '.</p>'
      + '<p class="neon-caveat">Straight-line distance from where you clicked - '
      + 'not a cable route, and not a statement that anything can connect at any '
      + 'of them. ' + unlocated + ' of the ' + points + ' published connection '
      + 'points have no coordinates, so the nearest <i>mapped</i> point may not '
      + 'be the nearest point.</p>'
      /* fillTopologyBlocks() selects by CLASS, not by a data attribute.
         Getting that wrong would have produced a block that renders its
         loading line forever and never fills. */
      + '<div class="' + TOPOLOGY_BLOCK + '" data-queries="'
      + escapeHtml(JSON.stringify([{ name: String(found[0].point?.name || ''), kv: null }])) + '">'
      + '<p class="neon-caveat"><b>Transmission network:</b> loading\u2026</p></div>');

    pointQuery.answered += 1;
    if (!popup) return;
    try { await ensureTopology(); } catch (_) { /* the block reports its own state */ }
    fillTopologyBlocks();
  }

  function topologyBlockHtml(queries) {
    const wanted = (queries || []).filter(q => q && q.name);
    if (!wanted.length) return '';
    const attr = escapeHtml(JSON.stringify(wanted.map(q => ({ name: q.name, kv: q.kv ?? null }))));
    if (topology.state === 'idle' || topology.state === 'loading') {
      ensureTopology().then(() => fillTopologyBlocks());
    }
    return `<div class="${TOPOLOGY_BLOCK}" data-queries="${attr}">`
      + topologyInnerHtml(wanted) + `</div>`;
  }

  function fillTopologyBlocks() {
    document.querySelectorAll('.' + TOPOLOGY_BLOCK).forEach(node => {
      try {
        node.innerHTML = topologyInnerHtml(JSON.parse(node.getAttribute('data-queries') || '[]'));
        topology.blocks_filled += 1;
      } catch (error) {
        noteFailure('topology block: ' + String(error?.message || error));
      }
    });
  }

  function topologyInnerHtml(queries) {
    const caveat = (text) => `<p class="neon-caveat">${text}</p>`;
    if (topology.state === 'idle' || topology.state === 'loading') {
      return caveat(`<b>Transmission network:</b> loading the published node/branch `
        + `model (about 10 MB, once per session). This card fills in when it arrives.`);
    }
    if (topology.state === 'failed') {
      return caveat(`<b>Transmission network:</b> not available - `
        + `${escapeHtml(topology.error || 'unknown failure')}. Nothing here is inferred from its absence.`);
    }
    const network = window.__GRIDATLAS_NETWORK__ || null;
    if (!network?.loaded) {
      return caveat(`<b>Transmission network:</b> indexed (${topology.sites} sites), but the `
        + `connection-points cartridge that joins a mapped name to a published site `
        + `${network?.failed ? 'failed to load' : 'has not loaded yet'}, so no site is named.`);
    }
    let out = '';
    let shown = 0;
    const module = topologyModule();
    for (const q of queries) {
      const kv = Number.isFinite(q.kv) ? q.kv : null;
      let point = null;
      try { point = network.byName(q.name); } catch (_) { point = null; }
      if (!point?.site_code) continue;
      const facts = topology.index.at(point.site_code, kv != null ? { voltageKv: kv } : undefined);
      if (!facts) continue;
      shown += 1;
      out += `<div class="neon-hd">${escapeHtml(facts.site.name)}`
        + `<span class="neon-beta">ETYS topology</span></div>`
        + caveat(`Joined by name from <i>${escapeHtml(q.name)}</i> to NESO site `
          + `${escapeHtml(facts.site.code)}`
          + (facts.site.transmission_owner ? ` (${escapeHtml(facts.site.transmission_owner)})` : '')
          + `; declared voltages ${facts.site.voltages_kv.length
            ? escapeHtml(facts.site.voltages_kv.join(', ')) + ' kV' : 'not stated'}.`);
      if (!facts.by_voltage.length) {
        out += caveat(kv != null
          ? `No published branch lands at ${kv} kV at this site.`
          : `No published branch lands at this site.`);
      } else {
        /* Site totals are UNITS; the lines below are landings and will
           not add up, because a transformer with both windings here
           appears under each of its voltages. */
        const c = facts.counts;
        out += caveat(`<b>At the site:</b> ${c.circuits} circuit`
          + `${c.circuits === 1 ? '' : 's'} and ${c.transformers} transformer`
          + `${c.transformers === 1 ? '' : 's'}, counted as units. `
          + `The per-voltage lines below count landings, one for each end held `
          + `here, so a transformer with both windings at this site appears `
          + `under both of its voltages.`);
      }
      for (const band of facts.by_voltage) {
        const label = band.voltage_kv == null ? 'an undeclared voltage' : `${band.voltage_kv} kV`;
        const years = [...new Set(band.planned_changes.map(c => c.year).filter(Boolean))].sort();
        out += caveat(`<b>At ${label}:</b> ${band.circuits.length} circuit${band.circuits.length === 1 ? '' : 's'}, `
          + `${band.transformers.length} transformer${band.transformers.length === 1 ? '' : 's'}`
          + (band.planned_changes.length
            ? `, ${band.planned_changes.length} published change${band.planned_changes.length === 1 ? '' : 's'}`
              + (years.length ? ` (${escapeHtml(years.join(', '))})` : '')
            : '')
          + `.`);
      }
      /* Seasonal ratings, per circuit, never added together.
         ---------------------------------------------------------------
         The lowest and the highest are two REAL published values, not a
         range around a mean, and each is labelled with the season it
         belongs to. Where the operator publishes a placeholder rather
         than a rating, the card says so rather than quietly carrying the
         larger number into the maximum. */
      const ratings = (() => {
        const mod = ratingModule();
        if (!mod) return null;
        try { return mod.at(topology.index, point.site_code, kv != null ? { voltageKv: kv } : undefined); }
        catch (_) { return null; }
      })();
      if (ratings && ratings.circuits.length) {
        const said = [];
        for (const season of ['winter', 'summer']) {
          const band = ratings.by_season[season];
          if (!band || !band.circuits) continue;
          said.push(`${season} ${band.lowest_circuit_mva === band.highest_circuit_mva
            ? band.lowest_circuit_mva
            : `${band.lowest_circuit_mva}-${band.highest_circuit_mva}`} MVA`);
        }
        if (said.length) {
          const flagged = ratings.counts.with_a_flagged_value;
          out += caveat(`<b>Circuit ratings:</b> ${escapeHtml(said.join(', '))}, `
            + `across ${ratings.counts.circuits} circuit${ratings.counts.circuits === 1 ? '' : 's'}. `
            + `Each figure is one circuit's rating in that season. They are not added `
            + `together: the sum of the circuits at a site is not a quantity that exists `
            + `in the network, and a rating is not what is free on the circuit.`
            + (flagged ? ` ${flagged} circuit${flagged === 1 ? ' publishes a value' : 's publish values'} `
              + `at or above 9,999 MVA on spans of a kilometre or less; `
              + `${flagged === 1 ? 'it reads' : 'they read'} as a placeholder and `
              + `${flagged === 1 ? 'is' : 'are'} excluded from the range above.` : ''));
          rating.answered += 1;
          rating.flagged += flagged;
        }
      }

      /* Who owns what lands here, and whether two owners meet.
         ---------------------------------------------------------------
         Printed before the planned sentence because it is a fact about
         what is there now. A single owner is a small fact; two owners on
         one circuit is a seam, and a connection across a seam involves
         more than one party. */
      const ownership = (() => {
        const mod = ownerModule();
        if (!mod || !topology.parsedProduct) return null;
        try {
          if (ownerIndex === undefined) ownerIndex = mod.index(topology.parsedProduct);
          if (!ownerIndex) return null;
          return ownerIndex.at(point.site_code, kv != null ? { voltageKv: kv } : undefined);
        } catch (_) { return null; }
      })();
      if (ownership && Array.isArray(ownership.owners_present) && ownership.owners_present.length) {
        const owners = ownership.owners_present.map((o) => escapeHtml(String(o)));
        const seams = (ownership.boundary_circuits || []).length
          + (ownership.boundary_transformers || []).length;
        const counts = ownership.counts || {};
        out += caveat(`<b>Transmission owner${owners.length === 1 ? '' : 's'}:</b> `
          + `${owners.join(', ')}.`
          + (seams
            ? ` ${seams} branch${seams === 1 ? '' : 'es'} here ${seams === 1 ? 'is' : 'are'} `
              + `a boundary: the two ends are published under different owners.`
            : '')
          + (counts.nodes_with_unknown_owner
            ? ` ${counts.nodes_with_unknown_owner} node here publishes no owner and is `
              + `reported as unknown, never taken from the site.`
            : '')
          + (counts.asset_owner_differs_from_both_ends
            ? ` ${counts.asset_owner_differs_from_both_ends} asset carries an owner `
              + `matching neither of its ends; that is reported as itself, not as a boundary.`
            : '')
          + ` Ownership is a published fact about an asset. It is not a statement `
          + `about who a project would contract with, which depends on connection `
          + `agreements and commercial terms no appendix contains.`);
        ownerState.answered += 1;
        ownerState.seams += seams;
      }

      /* What is published as planned, in its own sentence.
         ---------------------------------------------------------------
         Never folded into the counts above. A row published for 2030 is
         a statement about a future year; presenting it beside today's
         circuits would let a reader take it for one. */
      const planned = (() => {
        const mod = plannedModule();
        if (!mod || !topology.parsedProduct) return null;
        try {
          if (plannedIndex === undefined) plannedIndex = mod.index(topology.parsedProduct);
          if (!plannedIndex) return null;
          return plannedIndex.at(point.site_code, kv != null ? { voltageKv: kv } : undefined);
        } catch (_) { return null; }
      })();
      if (planned && planned.counts && planned.counts.planned_changes) {
        /* by_year is an ORDERED ARRAY of { year, by_status: [{ status,
           entries }] }, not a map - the module keeps publication order
           rather than letting object key order decide what the reader
           sees first. */
        const years = (planned.by_year || []).map((band) => {
          const parts = (band.by_status || []).map((s) =>
            `${(s.entries || []).length} ${escapeHtml(String(s.status).toLowerCase())}`);
          return `<b>${escapeHtml(String(band.year))}</b> ${parts.join(', ')}`;
        });
        if (years.length) {
          out += caveat(`<b>Published as planned:</b> ${years.join('; ')}. `
            + `These are rows NESO publishes for a future year. None of them is a `
            + `circuit today, a commitment, a consent, or a connection date, and `
            + `none is counted among the circuits above.`);
          plannedState.answered += 1;
          plannedState.rows += planned.counts.planned_changes;
        }
      }

      /* Where the project's own power would go.
         ---------------------------------------------------------------
         Pipeline News sends capacity_mw on every deep link, so the
         question "where would MY output flow" is answerable the moment a
         project is selected. The slack is NAMED in the sentence: a
         transfer has two ends and quoting one of them is meaningless.
         What is deliberately absent is any statement about room. */
      const injection = (() => {
        const mod = flowModule();
        if (!mod || kv !== 400) return null;
        /* The project's own stated capacity where the deep link carried
           one, and a declared 100 MW probe otherwise - labelled as such in
           the sentence, never presented as the project's figure. */
        const mw = Number.isFinite(currentCapacityMw) && currentCapacityMw > 0
          ? currentCapacityMw : 100;
        const model = flowModelFor(topology.index);
        if (!model) return null;
        try {
          const graph = topology.index.graph();
          const here = graph.nodesOfSite(point.site_code)
            .filter(n => graph.nodeVoltageKv(n) === 400).sort()[0];
          if (!here) return null;
          /* The withdrawal bus is DECLARED, not the first one to hand.
             ------------------------------------------------------------
             This took model.buses.find(b => b !== injection), which on a
             network with 238 components is almost always a bus the
             injection cannot reach. Codex found it at 202609020030. The
             module now publishes the rule it uses and the component it
             solved in, and refuses a cross-component transfer outright. */
          const slackNode = typeof mod.sinkFor === 'function'
            ? mod.sinkFor(model, here) : null;
          if (!slackNode) return null;
          const r = mod.respond(model, { atNode: here, slackNode, mw, minimumShare: 0.05 });
          /* publishable, not validation.passes: a disconnected pair can
             balance at the injection bus while the solve has not converged
             at all, and the old gate would have let that print. */
          return r && r.publishable === true ? r : (r || null);
        } catch (_) { return null; }
      })();
      if (injection && injection.publishable !== true) {
        /* Saying nothing looks identical to having nothing to say. When
           the model cannot solve this transfer the reader is told, with
           the reason, rather than left with a card that quietly lost a
           section. */
        out += caveat(`<b>Where the power would flow:</b> not available here. `
          + escapeHtml(String(injection.reason
            || 'the solve did not meet its acceptance conditions'))
          + ` No figure is shown rather than one that has not converged.`);
        powerflow.refused += 1;
      }
      if (injection && injection.publishable === true && injection.branches.length) {
        const top = injection.branches.slice(0, 3);
        out += caveat(`<b>Where ${injection.injected_mw} MW would flow</b> `
          + `(declared DC model, 100 MVA base, transfer to ${escapeHtml(injection.slack_node)}, `
          + `solved in a component of ${injection.component
            ? injection.component.buses_in_component : '?'} buses): `
          + top.map(b => `${escapeHtml(b.from_node)}-${escapeHtml(b.to_node)} `
            + `${Math.round(Math.abs(b.share_of_injection) * 100)}%`
            + (b.published_ratings_mva && b.published_ratings_mva.summer
              ? ` (summer rating ${b.published_ratings_mva.summer} MVA)` : '')).join(', ')
          + `. Flat 1.0 pu voltages, small angles, no losses, no taps, intact network. `
          + `This is the response to a NEW injection, not a loading: what is already `
          + `flowing on these circuits is published nowhere, so whether there is room `
          + `for it cannot be computed here by anyone.`);
        powerflow.answered += 1;
        powerflow.worst_kirchhoff_error = Math.max(powerflow.worst_kirchhoff_error,
          injection.validation.kirchhoff_error);
      }

      /* Electrical distance, beside the one-hop view.
         ---------------------------------------------------------------
         "Circuits reach" above is one hop. This is the second, and it is
         reported as a COUNT of sites at each hop rather than as a claim
         about any of them: naming a site two hops away and nothing else
         would read as a recommendation, which no published appendix
         supports. The hop count is never called a distance. */
      const reach = (() => {
        const mod = distanceModule();
        if (!mod) return null;
        try { return mod.within(topology.index, point.site_code, { hops: 2, voltageKv: kv }); }
        catch (_) { return null; }
      })();
      if (reach && reach.sites.length) {
        const atOne = reach.counts.by_hop[1] || 0;
        const atTwo = reach.counts.by_hop[2] || 0;
        out += caveat(`<b>On the published network:</b> ${atOne} site${atOne === 1 ? '' : 's'} `
          + `one circuit away${atTwo ? `, ${atTwo} more at two` : ''}. `
          + `A hop is a published circuit, not a distance - a site one hop away may be a `
          + `hundred kilometres away.${reach.refusals.length
            ? ` ${reach.refusals.length} branch${reach.refusals.length === 1 ? ' was' : 'es were'} `
              + `not walked because a circuit cannot change voltage; only a transformer can.`
            : ''}`);
        electrical.answered += 1;
        electrical.refusals += reach.refusals.length;
      }
      if (facts.neighbours.length) {
        const shownNeighbours = facts.neighbours.slice(0, 6);
        out += caveat(`<b>Circuits reach:</b> `
          + shownNeighbours.map(n => `${escapeHtml(n.site_name || n.site_code)} (${n.circuits})`).join(', ')
          + (facts.neighbours.length > shownNeighbours.length
            ? ` and ${facts.neighbours.length - shownNeighbours.length} more` : '')
          + `.`);
      }
    }
    if (!shown) {
      return caveat(`<b>Transmission network:</b> none of the substations named here joins by `
        + `name to a published NESO site, so nothing is stated about their circuits.`);
    }
    link.topology = { shown, sites: topology.sites, bytes: topology.bytes };
    out += caveat(`${escapeHtml(module ? module.not_an_assessment : '')} `
      + `Counts are branches landing on this site's nodes at the stated voltage, from `
      + `ETYS Appendix B via Ventusltd/data-grid-gb.`);
    return out;
  }

  const FLOW_COLOUR = '#bfe9ee';         // pale cyan travelling pulse, not white

  // The flow. MapLibre repeats a dash array along the line, so a short period
  // puts several electrons on the wire at once instead of one dot going round.
  // Two layers half a period apart double the density without doubling the
  // speed, which would only look frantic.
  const FLOW_PERIOD = 1.5;
  const FLOW_SPEED = 0.055;
  const FLOW_PULSE = 0.42;

  /* A fixed set of dash patterns, cycled — not a new one every frame.
     ----------------------------------------------------------------------
     MapLibre rasterises every distinct line-dasharray into a texture atlas
     (its LineAtlas) and keeps it for the lifetime of the map. A continuously
     varying dasharray therefore asks for a NEW entry sixty times a second,
     and the atlas fills: it runs out of space in about twenty seconds, after
     which lines stop drawing correctly and the renderer spends its time
     managing a texture nobody will reuse.

     Reported by the Codex session's LineAtlas cardinality gate, which counted
     five continuously varying writes and refused to call the storm fixed. It
     was right: the glyph fault in v9.21 and v9.22 was a different fault with a
     similar symptom, and fixing one did not fix the other.

     The animation only needs to LOOK continuous. Twenty-four phases around the
     cycle is finer than the eye resolves on a moving dash at this speed, and
     it bounds the atlas at twenty-four entries forever. The patterns are built
     once, at module load, so the running loop only ever hands back an array it
     has already handed back before, and MapLibre reuses the raster.

     Interpolating the phase against a frame index rather than a clock also
     makes the flow independent of frame rate, which it was not: a slow phone
     ran the electrons slower than a desktop. */
  const FLOW_STEPS = 24;

  const FLOW_PATTERNS = (() => {
    const patterns = [];
    for (let step = 0; step < FLOW_STEPS; step += 1) {
      const phase = (step / FLOW_STEPS) * FLOW_PERIOD;
      const lead = Math.max(0.001, phase);
      const tail = Math.max(0.001, FLOW_PERIOD - phase);
      // Frozen: a caller that mutated one of these would poison every frame
      // that reuses it, and the reuse is the whole point.
      patterns.push(Object.freeze([0.001, lead, FLOW_PULSE, tail]));
    }
    return Object.freeze(patterns);
  })();

  // Quantise to one of the prepared patterns. Same input band, same array
  // identity, so the atlas never grows past FLOW_STEPS.
  /* Write a dash only when it changes.
     ----------------------------------------------------------------------
     Bounding the atlas to twenty-four patterns stopped it filling, but the
     call sites still handed MapLibre a value sixty times a second, and
     twenty-three of every twenty-four of those were the value it already had.

     Codex's cardinality gate went on failing on exactly that, and it was
     asking the right question: a paint-property write per frame is a promise
     to the renderer that something changed, and it is cheaper not to make it
     when nothing has.

     MEASURED, and smaller than it looks. At FLOW_SPEED 0.055 over a period of
     1.5 the phase advances 3.7% of the cycle per frame while a step is 4.2%,
     so the pattern really does change on most frames: 3,168 writes in 3,600
     frames, a reduction of 1.1x rather than the 3.5x this comment first
     claimed. The saving grows with frame rate, which is the case it is for --
     at 120 Hz half the frames become redundant, and on a slow phone almost
     none do.

     The bound on the atlas is the substantive fix. This is tidiness on top of
     it, and worth having because it is free.

     The index is remembered per layer, because the two flow layers run half a
     period apart and would otherwise fight over one memo. */
  const lastDashIndex = new Map();

  function setFlowDash(map, layerId, phase) {
    const index = flowIndex(phase);
    if (lastDashIndex.get(layerId) === index) return false;
    lastDashIndex.set(layerId, index);
    map.setPaintProperty(layerId, 'line-dasharray', FLOW_PATTERNS[index]);
    return true;
  }

  // Forgotten when the layers go, or a rebuilt layer keeps a stale memo and
  // misses its first write.
  function forgetDashMemo() { lastDashIndex.clear(); }

  function flowIndex(phase) {
    const wrapped = ((phase % FLOW_PERIOD) + FLOW_PERIOD) % FLOW_PERIOD;
    return Math.floor((wrapped / FLOW_PERIOD) * FLOW_STEPS) % FLOW_STEPS;
  }

  function flowDash(phase) {
    return FLOW_PATTERNS[flowIndex(phase)];
  }
  flowDash.patterns = FLOW_PATTERNS;

  const SRC = 'gridatlas-neon-links';
  const SRC_NODES = 'gridatlas-neon-nodes';
  const L_GLOW = 'l-neon-glow';
  const L_CORE = 'l-neon-core';
  const L_FLOW = 'l-neon-flow';
  const L_FLOW_B = 'l-neon-flow-b';
  const L_NODE = 'l-neon-node';
  const L_NODE_RING = 'l-neon-node-ring';
  const L_LABEL = 'l-neon-label';

  const link = {
    schema: 'gridatlas.neon-substation-links.v1',
    generation: GENERATION,
    minimum_kv: MIN_KV,
    map_captured: false,
    installed: false,
    substations_loaded: 0,
    substations_qualifying: 0,
    last_selection: null,
    links_drawn: 0,
    deep_linked: false,
    boot_trigger: null,
    layer_controls_ready_ms: null,
    layer_controls_arrived_late: false,
    status_message: null,
    labels_drawn: null,
    gb_panel_installed: false,
    version_ledger: null,
    gb_conditions: null,
    project_layer_enabled: null,
    // iOS Safari background-tab fix: the arrival never starts until the
    // document is visible, and is re-run on visibilitychange if it has not
    // yet produced a visible outcome (see attemptArrival below).
    arrival_deferred_for_visibility: false,
    arrival_attempts: 0,
    arrival_resumed_on_visibility: 0,
    project_pin: { shown: false, name: null },
    substation_layer_enabled: false,
    reduced_motion: false,
    failures: [],
    /* Codex supervision, 202609011446: entries that later recovered stayed
       in `failures`, making a recovered event indistinguishable from a
       terminal fault. Recovery moves an entry here, at the moment the late
       control actually arrives - the entry is preserved as history, and
       `failures` speaks only for what is still failing. */
    recovered: [],
    grid_scope: null,
    grid_scope_armed: false
  };
  window.__GRIDATLAS_NEON_LINKS__ = link;

  /* One entry per distinct active failure. A retry loop used to append the
     same sentence on every attempt, so three tries read as three faults
     and a reader could not tell repetition from spread. Deduplicated
     against what is CURRENTLY failing, never against what has already
     recovered - a fault that comes back deserves to be recorded again. */
  function noteFailure(message) {
    if (!link.failures.includes(message)) link.failures.push(message);
    return false;
  }

  function recoverFailures(pattern) {
    const kept = [];
    for (const entry of link.failures) {
      if (pattern.test(entry)) link.recovered.push(entry);
      else kept.push(entry);
    }
    link.failures = kept;
  }

  /* ── geodesy ─────────────────────────────────────────────────────────── */

  /* Delegated, not reimplemented. Kept as a function declaration rather
     than a const binding so that hoisting behaves exactly as it did before
     - callers earlier in the file are unchanged. */
  function distanceKm(lon1, lat1, lon2, lat2) {
    return GEODESY.distanceKm(lon1, lat1, lon2, lat2);
  }

  /* ── substation layer ────────────────────────────────────────────────── */

  // `33000`, `33000;11000` (two voltages) and `33000:11000` (a transformer
  // ratio) all mean 33 kV is present. Splitting only on ';' drops the ratios.
  /* The unit comes from the property, never from the size of the number.
     ----------------------------------------------------------------------
     This guessed: anything over 1,000 was volts, anything under was already
     kilovolts. That is not what the source says. OSM's `voltage` tag is in
     VOLTS throughout, including its small values, while an explicit `kv`
     property is already kilovolts. Magnitude is not the unit.

     Audited by the Codex session against the pinned 5,800-feature substation
     payload: all 5,800 use `voltage`, 229 of them (3.95%) carry a token below
     1,000, and every one of those was misread. 204 then displayed a primary
     voltage ABOVE 400 kV, which does not exist anywhere on this network. The
     low tokens are 230 (10), 240 (1), 400 (14), 415 (2) and 750 (202) volts —
     the 750s are DC traction supplies at railway depots, so a depot's third
     rail was being shown as a 750 kV substation.

     Measured project impact, from that audit:

       19709  Selhurst Traincare Depot     33000;750       750 kV  ->  33 kV
       18128  Thames Way, Northfleet       33000;750       750 kV  ->  33 kV
       14596  Ford Halewood Transmissions  33000;11000;415 415 kV  ->  33 kV

     Each of those is a real project whose nearest displayed candidate carried
     an impossible voltage, on a card that also carries a distance. A wrong
     voltage beside a right distance is worse than either alone, because the
     distance lends it credibility.

     A bare `33` under `voltage` is therefore 33 volts and correctly falls out
     of a 33 kV-and-above scope. That reads oddly until you remember it is the
     source's own unit; and Codex confirmed the pinned payload contains no such
     token, so nothing real is lost by obeying the contract rather than
     second-guessing it. */
  function voltagesKv(properties) {
    const out = [];
    const push = (raw, divisor) => {
      for (const token of String(raw ?? '').split(/[;,|:\s]+/)) {
        if (!token) continue;
        const value = Number(token);
        if (!Number.isFinite(value) || value <= 0) continue;
        out.push(value / divisor);
      }
    };
    // OSM `voltage` is volts. Always, at every magnitude.
    push(properties?.voltage, 1000);
    // An explicit `kv` is already kilovolts.
    if (!out.length) push(properties?.kv, 1);
    return out;
  }

  // A polygon's first ring vertex is a corner, not the site.
  function representativePoint(geometry) {
    if (!geometry) return null;
    const { type, coordinates } = geometry;
    if (type === 'Point') return [coordinates[0], coordinates[1]];
    const ring = type === 'Polygon' ? coordinates[0]
      : type === 'MultiPolygon' ? coordinates[0]?.[0] : null;
    if (!Array.isArray(ring) || !ring.length) return null;
    let x = 0; let y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    return [x / ring.length, y / ring.length];
  }

  // Exposed so a proof can check this arithmetic against
  // Ventusltd/grid-distance-maths rather than trusting the comment above it.
  // Pure functions only; nothing here touches the map or the DOM.
  link.measure = { distanceKm, voltagesKv, representativePoint };

  /* The receiver decision is pure and exported because Pipeline News owns
     the complete link corpus. The product path below consumes this exact
     plan; the corpus proof can therefore pass all 8,756 derived source
     points (8,753 served coordinate rows and 8,743 clickable actions)
     through the same decision without booting a map or a 35.7 MB register. */
  function deepLinkPlan(rawLon, rawLat, rawRepdRef) {
    const longitude = rawLon === null ? NaN : Number(rawLon);
    const latitude = rawLat === null ? NaN : Number(rawLat);
    const repdRef = String(rawRepdRef || '').trim();
    const coordinatesUsable = Number.isFinite(longitude) && Number.isFinite(latitude)
      && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90
      && !(Math.abs(longitude) < 1e-9 && Math.abs(latitude) < 1e-9);
    return Object.freeze({
      longitude, latitude, repd_ref: repdRef, coordinates_usable: coordinatesUsable,
      route: coordinatesUsable ? 'MEASURE_LINK_FIRST'
        : (repdRef ? 'WAIT_FOR_REGISTER' : 'NO_USABLE_POINT')
    });
  }
  link.measure.deepLinkPlan = deepLinkPlan;

  /* A resolved register identity is an asynchronous continuation of one
     particular arrival, not permission to take the map back later. User
     selection and clear paths invalidate the token. The same coordinator is
     exported so the generation proof can resolve a deliberately late promise
     through the production gate rather than restating this race in a mock. */
  function createArrivalGate() {
    let epoch = 0;
    let activeKey = null;
    const invalidations = [];
    return Object.freeze({
      begin(key = null) {
        const candidate = key == null ? null : String(key);
        /* The search owner and the measurement owner claim the same URL
           independently as their scripts boot. A keyed claim is idempotent,
           so whichever starts first gives both halves one cancellation
           epoch rather than making the second half stale immediately. */
        if (candidate && candidate === activeKey) return epoch;
        epoch += 1;
        activeKey = candidate;
        return epoch;
      },
      invalidate(reason) {
        epoch += 1;
        activeKey = null;
        invalidations.push({ epoch, reason: String(reason || 'unspecified') });
        return epoch;
      },
      isCurrent(candidate) { return candidate === epoch; },
      snapshot() { return Object.freeze({ epoch, activeKey,
        invalidations: [...invalidations] }); }
    });
  }
  async function continueVerifiedArrival(gate, epoch, verification, apply) {
    const result = await verification;
    if (!gate.isCurrent(epoch)) return false;
    await apply(result);
    return gate.isCurrent(epoch);
  }
  const arrivalGate = createArrivalGate();
  function arrivalKey(search = window.location.search) {
    return 'deep-link:' + String(search || '');
  }
  function claimPendingArrival(search = window.location.search) {
    return arrivalGate.begin(arrivalKey(search));
  }
  function invalidatePendingArrival(reason) {
    const epoch = arrivalGate.invalidate(reason);
    link.arrival_reconciliation = { status: 'INVALIDATED', reason, epoch };
    try {
      window.dispatchEvent(new CustomEvent('gridatlas:arrival-invalidated', {
        detail: { reason: String(reason || 'unspecified'), epoch }
      }));
    } catch (_) { /* cancellation still lives in the shared gate */ }
    return epoch;
  }
  link.measure.createArrivalGate = createArrivalGate;
  link.measure.continueVerifiedArrival = continueVerifiedArrival;
  link.measure.arrivalGate = arrivalGate;
  link.measure.arrivalKey = arrivalKey;
  link.measure.claimPendingArrival = claimPendingArrival;
  link.measure.invalidatePendingArrival = invalidatePendingArrival;
  link.enableSubstationLayer = () => enableSubstationLayer();
  link.armGridScope = (on) => { scopeArmed = Boolean(on); return scopeArmed; };
  link.clearGridScope = () => clearScope();
  link.noteFailure = (message) => noteFailure(message);

  /* A browser-history move is a user navigation, not permission for the
     asynchronous identity query from the URL being left to reclaim the map.
     replaceState used by the owner does not emit these events. */
  window.addEventListener('popstate', () => invalidatePendingArrival('history-navigation'));
  window.addEventListener('hashchange', () => invalidatePendingArrival('history-navigation'));

  let substationsPromise = null;
  function loadSubstations() {
    if (substationsPromise) return substationsPromise;
    substationsPromise = (async () => {
      // The engine may already hold the layer; prefer that over a second fetch.
      const response = await fetch(new URL(SUBS_URL, document.baseURI), { cache: 'force-cache' });
      if (!response.ok) throw new Error(`substations HTTP ${response.status}`);
      const collection = await response.json();
      const features = Array.isArray(collection?.features) ? collection.features : [];
      link.substations_loaded = features.length;
      const out = [];
      for (const feature of features) {
        const kv = voltagesKv(feature.properties);
        if (!kv.length || Math.max(...kv) < MIN_KV - 0.5) continue;
        const at = representativePoint(feature.geometry);
        if (!at) continue;
        out.push({
          at,
          kv: kv.filter(v => v >= MIN_KV - 0.5).sort((a, b) => b - a),
          name: feature.properties?.name || '',
          operator: feature.properties?.operator
            || feature.properties?.['operator:short'] || ''
        });
      }
      link.substations_qualifying = out.length;
      return out;
    })().catch(error => {
      link.failures.push(String(error?.message || error));
      substationsPromise = null;
      return [];
    });
    return substationsPromise;
  }

  function nearestSubstations(lon, lat, subs) {
    const scored = [];
    for (const sub of subs) {
      const km = distanceKm(lon, lat, sub.at[0], sub.at[1]);
      if (km > MAX_LINK_KM) continue;
      scored.push({ ...sub, km });
    }
    scored.sort((a, b) => a.km - b.km);
    return scored.slice(0, LINK_COUNT);
  }

  // The mirror of nearestSubstations: given a substation, the projects around
  // it. Read from the loaded source rather than the viewport, so panning the
  // map does not change the answer -- querySourceFeatures returns what the
  // GeoJSON source holds, queryRenderedFeatures returns only what is on screen.
  function nearestProjects(map, lon, lat) {
    let features = [];
    try { features = map.querySourceFeatures('src-repd') || []; }
    catch (_) { return { loaded: false, links: [] }; }
    // querySourceFeatures reads loaded tiles. With every project layer switched
    // off there are none, and returning an empty list here made the card say
    // "no mapped project within 40 km" of a substation with a 840 MW scheme
    // beside it. Absence from a layer that is not loaded is not absence on the
    // ground, and this is exactly where that rule has to hold.
    if (!features.length) return { loaded: false, links: [] };
    const seen = new Set();
    const scored = [];
    for (const feature of features) {
      const properties = feature.properties || {};
      const tech = String(properties.tech || properties.type || '');
      if (!isProjectTech(tech)) continue;
      const at = representativePoint(feature.geometry);
      if (!at) continue;
      // One source, many tiles: the same project surfaces more than once.
      const key = properties.repd_ref || properties.repdRef
        || `${at[0].toFixed(5)},${at[1].toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const km = distanceKm(lon, lat, at[0], at[1]);
      if (km > MAX_LINK_KM) continue;
      const capacity = parseFloat(properties.capacity);
      scored.push({
        at, km, tech,
        kv: [],
        name: properties.name || properties.SiteName || properties['Site Name'] || '',
        mw: Number.isFinite(capacity) ? capacity : null
      });
    }
    scored.sort((a, b) => a.km - b.km);
    return { loaded: true, links: scored.slice(0, LINK_COUNT) };
  }

  link.measure.nearestSubstations = nearestSubstations;
  link.measure.MIN_KV = MIN_KV;
  link.measure.MAX_LINK_KM = MAX_LINK_KM;
  link.measure.LINK_COUNT = LINK_COUNT;
  link.measure.PROJECT_TECHS = PROJECT_TECHS;
  link.measure.flowDash = flowDash;
  link.measure.flowIndex = flowIndex;
  link.measure.OFFSHORE_TECHS = OFFSHORE_TECHS;
  link.measure.isProjectTech = isProjectTech;
  link.measure.LAYER_ID_FOR_BUCKET = LAYER_ID_FOR_BUCKET;
  link.measure.layerIdForBucket = layerIdForBucket;
  /* Exposed so a proof can hold the coordinates constant, vary the technology
     and assert the measurement does not move. nearestSubstations() takes a
     longitude, a latitude and a candidate set and reads no technology at all;
     coverage.policy() takes a technology and produces only sentences. That
     separation IS the invariant, and it is checkable from here. */
  link.measure.coverage = coverage;

  /* ── the project card ────────────────────────────────────────────────── */

  const BLOCK_CLASS = 'gridatlas-neon-block';
  const CSS_ID = 'gridatlas-neon-css';

  // The distances belong ON the card the user just opened, not in a separate
  // panel they have to notice. The engine builds that card with openPopup(),
  // which is a closure, so this appends to the rendered popup instead --
  // matching the engine's own idiom: monospace on black, cyan heading, amber
  // for a figure, grey for provenance.
  function installStyles() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = SLD_STYLES.neonBlock(BLOCK_CLASS);
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // BETA here marks SCOPE, not doubt about the arithmetic. The measurement is
  // published and checked; what it does not cover is stated, and the things a
  // distance cannot answer at any precision are named rather than implied.
  function caveatHtml() {
    return `<div class="neon-caveat">`
      + `<b>Beta analytics, not an actual grid connection.</b> Straight-line distance to mapped `
      + `geometry &mdash; not a cable route, not a connection length, and no route has been `
      + `walked. A real connection depends on factors that must be studied: network impedance `
      + `and fault level, thermal headroom, existing committed connections and queue position, `
      + `right of way, wayleaves and easements, crossings, terrain, land control and consent. `
      + `None of those can be inferred from a distance. A mapped substation does not confirm `
      + `capacity, voltage suitability or acceptance by any network party, and absence from a `
      + `mapped layer is not absence on the ground.`
      + `</div>`;
  }

  // Remembered so the LAYOUT button knows what it was opened from.
  let lastSelection = null;

  /* The offshore note used to live here and to be the reason there was no
     number. It now lives in the technology-coverage module and is the caveat
     BESIDE the number. Nothing was deleted: the route reasoning is quoted
     there in full, and the module adds the second sentence this file could
     not have written - what the candidate set does and does not say about
     onshore, counted over the pinned product rather than assumed. */
  const OFFSHORE_NOTE = null;

  /* What a voltage class means, on the card, beside the number.
     ----------------------------------------------------------------------
     A distance to a "132 kV" substation is not the same proposition as a
     distance to a "66 kV" one, and the register's reader usually knows that
     while the map does not say it. These are descriptions of the network as it
     is, not advice about any scheme:

       400 / 275 kV  transmission, bulk power
       220 kV        transmission, and the class being built out for offshore
                     wind landfalls
       132 kV        distribution in England and Wales, transmission in
                     Scotland - the same number meaning two different things
                     depending on where you are standing
       66 kV         largely legacy industrial distribution, much of it being
                     reinforced to 132 kV and above as old heavy load is
                     replaced and offshore wind arrives
       33 kV         primary distribution, and the usual class for a
                     utility-scale solar or storage connection

     Deliberately descriptive. It says what a class generally is, never what a
     particular project should do with it, because the estate's rule is that
     the maths and the tools do the talking. */
  const KV_CONTEXT = {
    400: 'transmission, bulk power',
    275: 'transmission, bulk power',
    220: 'transmission; the class being built out for offshore wind landfalls',
    132: 'distribution in England and Wales, transmission in Scotland',
    66: 'largely legacy industrial distribution, much of it being reinforced '
        + 'to 132 kV and above',
    33: 'primary distribution; the usual class for a utility-scale solar or '
        + 'storage connection',
  };

  function kvContext(kv) {
    const n = Number(kv);
    return Number.isFinite(n) ? (KV_CONTEXT[n] || null) : null;
  }

  /* The sentences a policy adds under the distances.
     ----------------------------------------------------------------------
     ADDITIVE ONLY, and deliberately so. These change no number, no ordering
     and no candidate set; they say what the number is a measurement OF. The
     card printed nothing here for every technology until offshore stopped
     withholding, and an offshore straight line is the one that most needs
     saying out loud - it crosses water. */
  function policyNotesHtml() {
    const notes = (currentPolicy && Array.isArray(currentPolicy.notes))
      ? currentPolicy.notes : [];
    if (!notes.length) return '';
    return notes.map(text => `<p class="neon-caveat">${escapeHtml(text)}</p>`)
      .join('');
  }

  function cardBlockHtml(links, direction, layerLoaded = true) {
    installStyles();
    const toSubstations = direction !== 'from-substation';
    const title = toSubstations
      ? `Nearest substations &ge;${MIN_KV} kV`
      : 'Nearest projects';
    const fallbackName = toSubstations ? 'Unnamed substation' : 'Unnamed project';
    const head = `<div class="neon-hd">${title}<span class="neon-beta">Beta</span></div>`;
    const declaredHtml = declaredBlockHtml(toSubstations);
    if (!links.length) {
      const nothing = toSubstations
        ? `No mapped substation at ${MIN_KV} kV or above within ${MAX_LINK_KM} km of this point.`
        : (layerLoaded
          ? `No mapped project within ${MAX_LINK_KM} km of this substation.`
          : `The project layers are switched off, so there is nothing to measure `
            + `against. Turn on Solar PV, Wind or Battery Storage and click again. `
            + `This is not a statement that no project is here.`);
      return `<div class="${BLOCK_CLASS}">${declaredHtml}${head}`
        + `<div class="neon-caveat">${nothing}</div>${policyNotesHtml()}`
        + `${caveatHtml()}</div>`;
    }
    const rows = links.map(l => {
      const kv = l.kv && l.kv.length ? l.kv[0] : null;
      const tail = kv != null ? `${kv} kV`
        : (l.mw != null ? `${l.mw} MW` : '');
      // What the class generally IS, on hover, beside the number. A distance
      // to 132 kV is not the same proposition as a distance to 66 kV, and the
      // reader of a register usually knows that while the map does not say it.
      const context = kvContext(kv);
      const titled = context
        ? ` title="${escapeHtml(kv + ' kV: ' + context)}"` : '';
      /* A result that is ITSELF named as an offshore substation is marked,
         never removed. The product has no field that separates a platform at
         sea from the onshore substation for an offshore farm, so the honest
         move is to hand the reader the name and the flag rather than to
         filter on a predicate that is wrong four times in fourteen. */
      const offshoreNamed = (() => {
        try { return Boolean(coverage.namedOffshore(l.name)); }
        catch (_) { return false; }
      })();
      const flag = offshoreNamed
        ? `<span class="neon-kv" title="Named as an offshore substation in the `
          + `mapped product. That product carries no field saying whether this `
          + `is a platform at sea or the onshore substation for an offshore `
          + `farm, so it is marked rather than filtered.">named offshore</span>`
        : '';
      return `<li><span class="neon-km">${l.km.toFixed(2)} km</span>`
        + `<span class="neon-name">${escapeHtml(l.name || fallbackName)}</span>`
        + (tail ? `<span class="neon-kv"${titled}>${escapeHtml(tail)}</span>` : '')
        + flag
        + `</li>`;
    }).join('');

    /* One line naming the classes actually present, rather than a legend for
       classes that are not. If every substation found is 33 kV, a paragraph
       about 400 kV transmission is noise. */
    const classes = [...new Set(links
      .map(l => (l.kv && l.kv.length ? Number(l.kv[0]) : null))
      .filter(kv => Number.isFinite(kv) && kvContext(kv)))]
      .sort((a, b) => b - a);
    const classNote = classes.length
      ? `<p class="neon-caveat neon-kvnote">`
        + classes.map(kv => `<b>${kv} kV</b> ${escapeHtml(kvContext(kv))}`).join('. ')
        + '. Descriptions of the network, not advice about this scheme.</p>'
      : '';
    // The way into the layout. Without this there is no route from a project
    // to the sandbox at all, which is exactly how it felt to use.
    const kvNoteHtml = classNote;
    const button = toSubstations
      ? `<button class="neon-pin" type="button" aria-pressed="${pinVisible}">`
        + `${pinVisible ? 'Hide' : 'Show'} the project ring</button>`
        + `<button class="neon-layout" type="button">Lay out a scheme here &#9656;</button>`
      : '';
    return `<div class="${BLOCK_CLASS}">${declaredHtml}${head}<ol>${rows}</ol>${kvNoteHtml}`
      + `${policyNotesHtml()}${button}${caveatHtml()}</div>`;
  }

  // The engine opens its popup in its own click handler. This one is registered
  // afterwards, so by the time it runs the popup is in the DOM and can be
  // extended rather than replaced.
  // A grab bar with a minimise and a close, added to whatever card is open.
  // MapLibre gives a popup one hairline cross and no way to move it, which on a
  // map is the difference between a card and an obstruction.
  // Bound the card to the map it lives in. The Atlas gives the map roughly a
  // third of a desktop window, so a viewport-relative cap is not enough.
  /**
   * Fit the open card to the room it actually has.
   *
   * The container height is the wrong number: a card anchored two thirds of
   * the way down a 319px map has 159px beneath it, not 319. Measured live, a
   * cap taken from the container still left 127px hanging below the map.
   *
   * So the cap is the distance from where the card is anchored to the bottom
   * of the map. Where that is too small to be usable the card is freed from
   * its anchor instead and parked at the top of the map, which is the honest
   * answer: a 90px scrolling window is not a card, it is a slot.
   */
  const MIN_ANCHORED_CARD = 200;

  /**
   * Where to put a card that has been freed from its anchor.
   *
   * Not the map's top left. The Atlas keeps its own tool stack there -- Export
   * CSV, Radius Search, Radius Area, Poly Zone, Status Colours, Measure --
   * measured live at x 15 to 137, and parking on top of it trades one
   * obstruction for another. The stack is queried rather than assumed, so the
   * card still lands correctly if those buttons move or change.
   */
  function parkingSpot(map) {
    let x = map.left + 12;
    try {
      const controls = document.querySelector('.map-controls');
      if (controls) {
        const rect = controls.getBoundingClientRect();
        if (rect.width > 0 && rect.right > x) x = rect.right + 12;
      }
    } catch (_) { /* the default is still inside the map */ }
    return { x, y: map.top + 12 };
  }

  /* The sheet height is not a taste. Measured live at 393x852 with the
     answer at the top of the block: grab bar 55px, the identity the engine
     renders 134px, the measurement paragraph with the corridor estimate and
     its caveat 108px, the scope sentence with the coverage denominator 67px.
     364px that must arrive together or not at all, because a measurement may
     not appear without the sample its superlative searched or without the
     word "straight". 58dvh is 494px at 852 and 464px at 800, so all of it
     clears the fold; capped in pixels too, because 58dvh of a tall tablet is
     most of the screen and the map is what the sheet stands on. */
  const SHEET_MIN = 320;
  function sheetTarget() {
    try { return trayTarget(); } catch (_) { return false; }
  }
  function dockAsSheet(popup, content) {
    const viewport = window.visualViewport?.height || window.innerHeight || 0;
    /* Minimised, the sheet is its bar and nothing else, so the stack on it
       comes back down. Measured off the bar, not assumed: it is 55px with a
       44px control in it, and a hard-coded 44 would overlap by eleven. */
    const height = popup.classList.contains('gridatlas-min')
      ? Math.max(44, Math.round(
        popup.querySelector('.gridatlas-card-bar')?.getBoundingClientRect().height || 55) + 12)
      : Math.max(SHEET_MIN, Math.min(520, Math.round(viewport * 0.58)));
    popup.classList.add('gridatlas-sheet');
    popup.classList.remove('gridatlas-free');
    popup.style.removeProperty('--gx');
    popup.style.removeProperty('--gy');
    content.style.removeProperty('max-height');
    document.documentElement.classList.add('gridatlas-sheet-open');
    document.documentElement.style.setProperty('--gridatlas-sheet-h', height + 'px');
  }
  function undockSheet() {
    document.documentElement.classList.remove('gridatlas-sheet-open');
    document.documentElement.style.removeProperty('--gridatlas-sheet-h');
    document.querySelectorAll('.maplibregl-popup.gridatlas-sheet')
      .forEach(node => node.classList.remove('gridatlas-sheet'));
  }

  function boundCardToMap() {
    if (document.documentElement.classList.contains("testcode-arrival")) return;
    try {
      const container = capturedMap?.getContainer();
      if (!container) return;
      const map = container.getBoundingClientRect();
      const popup = document.querySelector('.maplibregl-popup');
      const content = popup?.querySelector('.maplibregl-popup-content');
      if (!popup || !content) {
        undockSheet();
        document.documentElement.style.setProperty(
          '--gridatlas-card-max', Math.max(160, map.height - 60) + 'px');
        return;
      }
      if (sheetTarget()) { dockAsSheet(popup, content); return; }
      undockSheet();
      if (popup.classList.contains('gridatlas-free')) {
        // A freed card is wherever the user put it, and the same
        // anchor-blindness applies: dragging it low while minimised and then
        // restoring it made it 277px tall starting 88px above the bottom of
        // the map, so it hung 189px underneath. Cap to the room below where it
        // now sits, and if that is not enough, lift it rather than shrink it
        // into a slot.
        const rect = popup.getBoundingClientRect();
        let available = map.bottom - rect.top - 12;
        if (available < MIN_ANCHORED_CARD) {
          const lifted = Math.max(map.top + 12, map.bottom - MIN_ANCHORED_CARD - 12);
          popup.style.setProperty('--gy', lifted + 'px');
          available = map.bottom - lifted - 12;
        }
        content.style.maxHeight = Math.max(120, Math.min(available, map.height - 48)) + 'px';
        return;
      }
      const rect = popup.getBoundingClientRect();
      const available = map.bottom - rect.top - 12;
      if (available < MIN_ANCHORED_CARD) {
        popup.classList.add('gridatlas-free');
        const parked = parkingSpot(map);
        popup.style.setProperty('--gx', parked.x + 'px');
        popup.style.setProperty('--gy', parked.y + 'px');
        content.style.maxHeight = Math.max(160, map.height - 48) + 'px';
        return;
      }
      content.style.maxHeight = available + 'px';
    } catch (_) { /* leave the CSS default */ }
  }

  function addCardBar(content) {
    if (!content) return;
    // The bar is built once and kept, but the fit is not: a card that already
    // has a bar is a card being reused for a different project, and its height
    // is the one thing that must be measured again.
    if (content.querySelector('.gridatlas-card-bar')) { boundCardToMap(); return; }
    const popup = content.closest('.maplibregl-popup');
    if (!popup) return;
    boundCardToMap();

    // Carry the card's own title into the bar. Minimised, the bar is all that
    // is left, and a nameless strip on a map is a puzzle rather than a card you
    // put down on purpose.
    const heading = content.querySelector('b, strong, h1, h2, h3');
    const title = (heading?.textContent || 'Card').replace(/\s+/g, ' ').trim();

    const bar = document.createElement('div');
    bar.className = 'gridatlas-card-bar';
    bar.innerHTML = '<span class="grip">&#8942;&#8942;</span>'
      + `<span class="label">${escapeHtml(title)}</span>`
      + '<span class="spacer"></span>'
      + '<button type="button" class="min" title="Minimise">&minus;</button>'
      + '<button type="button" class="close" title="Close">&times;</button>';
    content.insertBefore(bar, content.firstChild);

    bar.querySelector('.min').addEventListener('click', (event) => {
      event.stopPropagation();
      popup.classList.toggle('gridatlas-min');
      bar.querySelector('.min').innerHTML = popup.classList.contains('gridatlas-min')
        ? '&plus;' : '&minus;';
      // Restoring gives the card its height back, which is exactly when it can
      // fall off the bottom of the map again.
      requestAnimationFrame(boundCardToMap);
    });
    bar.querySelector('.close').addEventListener('click', (event) => {
      event.stopPropagation();
      clearLinks();
      popup.remove();
      // The sheet is what lifted the control stack and hid the credit strip.
      // Closing the card has to put the map back exactly as it was, or the
      // reader is left with a gap where a card used to be.
      undockSheet();
    });

    // Dragging frees the popup from its anchor. Fixed positioning with an
    // explicit left/top beats MapLibre's transform, which it rewrites on every
    // map move; without that the card would snap back the moment you panned.
    let dragging = null;
    bar.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      /* A docked sheet is not dragged. Dragging the bar was the only route
         to the measurement, and it slid the bar - with the minus and the
         close on it - under the map's search box: tapping the close focused
         the search field and opened the keyboard, 3 times out of 3. On a
         sheet the answer is already on screen, so there is nothing to drag
         for, and the bar is pinned where nothing can be laid over it. */
      if (popup.classList.contains('gridatlas-sheet')) return;
      event.stopPropagation();
      event.preventDefault();
      const rect = popup.getBoundingClientRect();
      dragging = {
        pointerId: event.pointerId,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
      };
      bar.setPointerCapture?.(event.pointerId);
      popup.classList.add('gridatlas-free');
      popup.style.setProperty('--gx', rect.left + 'px');
      popup.style.setProperty('--gy', rect.top + 'px');
    });
    const move = (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      event.preventDefault();
      const map = capturedMap?.getContainer()?.getBoundingClientRect()
        || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      const card = popup.getBoundingClientRect();
      const minX = map.left + 4;
      const maxX = Math.max(minX, map.right - card.width - 4);
      const minY = map.top + 4;
      // Keep the whole width and at least the 44px drag bar inside the map.
      const maxY = Math.max(minY, map.bottom - Math.min(44, Math.max(1, card.height)) - 4);
      const x = Math.max(minX, Math.min(maxX, event.clientX - dragging.dx));
      const y = Math.max(minY, Math.min(maxY, event.clientY - dragging.dy));
      popup.style.setProperty('--gx', x + 'px');
      popup.style.setProperty('--gy', y + 'px');
    };
    const up = (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      try { bar.releasePointerCapture?.(event.pointerId); } catch (_) { /* already released */ }
      if (dragging) requestAnimationFrame(boundCardToMap);
      dragging = null;
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  }

  /* A second project gets a second card, not the first one's shape.
     ----------------------------------------------------------------------
     Reported: arrive from Pipeline News, then click another solar pixel, and
     the card is the wrong size.

     The popup element is reused between selections, and everything this
     cartridge does to a card was written onto it and never taken off -- the
     max-height computed for the previous card's contents, the gridatlas-free
     class if that one had been freed, the --gx/--gy it was parked at, and the
     minimised state. A card for Botley West would open at the height of the
     card before it, in the place the card before it had been dragged to.

     Worse, addCardBar returns early once the bar exists, and the only call to
     boundCardToMap on that path was inside it. So on every selection after the
     first, nothing measured anything: the stale numbers were not merely
     inherited, they were never recomputed.

     Geometry is per selection. The content is not: the bar, its listeners and
     the drag handlers are kept, because rebuilding them would drop the
     listeners and cost a card that could no longer be moved. */
  function resetCardGeometry(content) {
    const popup = content?.closest?.('.maplibregl-popup');
    if (!popup) return;
    popup.classList.remove('gridatlas-free');
    popup.classList.remove('gridatlas-min');
    popup.style.removeProperty('--gx');
    popup.style.removeProperty('--gy');
    content.style.removeProperty('max-height');
    content.style.removeProperty('display');
    // The bar's own control has to agree with the class it toggles, or a card
    // restored by this reset still shows a plus that no longer minimises
    // anything. The control is .min and it carries an HTML entity, not text.
    const toggle = content.querySelector('.gridatlas-card-bar .min');
    if (toggle) toggle.innerHTML = '&minus;';
  }

  function injectIntoCard(links, direction, layerLoaded = true) {
    const content = document.querySelector('.maplibregl-popup-content');
    if (!content) return false;
    resetCardGeometry(content);
    addCardBar(content);
    content.querySelector('.testcode-location-source')?.remove();
    const provenance=window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.location_provenance;
    if(provenance && content.textContent.includes(window.__GRIDATLAS_PLACE_SEARCH__.deep_link.name)){
      const note=document.createElement('p');note.className='testcode-location-source';note.style.cssText='color:#ffd18a;padding:8px;border:1px solid #97783f';note.textContent=provenance.notice+' ';
      const a=document.createElement('a');a.href=provenance.source_item;a.target='_blank';a.rel='noopener';a.textContent='Source';note.append(a);content.insertBefore(note,content.children[1]||null);
    }
    content.querySelectorAll(`.${BLOCK_CLASS}`).forEach(node => node.remove());
    const holder = document.createElement('div');
    holder.innerHTML = cardBlockHtml(links, direction, layerLoaded);
    const block = holder.firstElementChild;
    if (!block) return false;
    // Straight onto the content, never onto firstElementChild. Once the grab
    // bar exists it IS the first element, and appending there put the whole
    // block inside the bar: measured live, a bar that should be 30px tall came
    // out at 401px with the card's contents crammed into a flex row.
    content.appendChild(block);
    // The card only has its real height once the block is in it.
    requestAnimationFrame(boundCardToMap);
    block.querySelector?.('.neon-pin')?.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const shown = togglePin();
      const control = block.querySelector('.neon-pin');
      if (control) {
        control.textContent = `${shown ? 'Hide' : 'Show'} the project ring`;
        control.setAttribute('aria-pressed', String(shown));
      }
    });
    block.querySelector?.('.neon-layout')?.addEventListener('click', (event) => {
      // The card sits inside the map container, so without this the click
      // carries on to the map, lands on the substation underneath and the
      // substation handler overwrites the layout that was just opened.
      event.stopPropagation();
      event.preventDefault();
      if (!lastSelection || !capturedMap) return;
      // The array goes at the project and the cable runs to the nearest
      // substation found for it, which is the direction a scheme is actually
      // built: generation first, then the route to the network.
      openSldFromProject(capturedMap, lastSelection);
    });
    return true;
  }

  /* ── the card keeper ─────────────────────────────────────────────────
     The measurement block lives inside the popup, and the popup is not
     ours: the search lane creates it when identity resolution completes,
     which on a phone can be seconds after the links were drawn. Watched
     live on the Pipeline News MAP journey: five links on the map, and a
     card with no distances, because the popup that had been decorated was
     replaced by the one that arrived late. The lines live in map layers
     and survived; the block died with the popup.

     So the block is kept, not just written: while a selection is active,
     an observer re-attaches it whenever the current card lacks it. The
     payload is per selection - a new selection re-arms it, a cleared
     selection disarms it, so a radius or measure popup after deselection
     is never decorated with another project's distances. */
  /* ── the arrival card ────────────────────────────────────────────────
     The card on a deep-link arrival was the identity lane's popup, and the
     identity lane resolves against a register that deliberately excludes
     dead-pipeline statuses - Refused, Revised, Withdrawn, Expired,
     Abandoned. Pipeline News rightly reports on exactly those schemes. In
     the exact 0144 corpus, 2,430 of 8,743 unique clickable REPD refs are
     absent from the active snapshot while 6,313 match it; absent arrivals
     drew links and no card at all, which on a phone reads as nothing working.

     The link itself carries the project - name, technology, capacity,
     coordinates - so when no card has appeared by the end of the arrival,
     this cartridge opens one from those fields. It says where it came
     from, and if the register's own card lands later, the fallback yields
     to it rather than standing beside it. */
  let arrivalFallbackPopup = null;

  function removeArrivalFallback() {
    if (!arrivalFallbackPopup) return;
    try { arrivalFallbackPopup.remove(); } catch (_) { /* already gone */ }
    arrivalFallbackPopup = null;
  }

  function markArrivalIdentityState(status, repdRef, message = '') {
    const node = document.querySelector('.gridatlas-arrival-identity');
    if (!node) return;
    const ref = String(repdRef || '').trim();
    node.dataset.state = String(status || 'UNKNOWN');
    if (status === 'NOT_IN_ACTIVE_REGISTER') {
      node.textContent = 'REPD ' + ref + ' · not in the active-register snapshot; '
        + 'project details and point are from the arrival link.';
    } else if (status === 'FAILED') {
      node.textContent = 'REPD ' + ref + ' · active-register check failed'
        + (message ? ': ' + message : '') + '; supplied point retained.';
    } else if (status === 'RESOLVED' || status === 'VERIFIED') {
      node.textContent = 'REPD ' + ref + ' · verified in the active-register snapshot.';
    }
  }

  function ensureArrivalCard(lon, lat, name, tech, statedMw, repdRef, suppliedStatus) {
    if (document.querySelector('.maplibregl-popup-content')) return;
    const gl = window.maplibregl;
    if (!gl?.Popup || !capturedMap) return;
    try {
      const cap = Number.isFinite(statedMw) && statedMw > 0
        ? `${statedMw} MW` : '';
      const ref = String(repdRef || '').trim();
      const status = String(suppliedStatus || '').trim();
      arrivalFallbackPopup = new gl.Popup({ maxWidth: '340px', closeOnClick: false })
        .setLngLat([lon, lat])
        .setHTML('<div style="font-family:monospace;background:#000;padding:6px">'
          + `<b style="color:#00ffff;font-size:13px">${escapeHtml(name)}</b><br>`
          + `<span style="color:#888">${escapeHtml(tech)}</span>`
          + (cap ? `<br><span style="color:#ffae00">${escapeHtml(cap)}</span>` : '')
          + (ref ? `<br><span class="gridatlas-arrival-identity" data-state="PENDING" style="color:#8fb3b8;font-size:10px">REPD ${escapeHtml(ref)} · checking the active-register snapshot</span>` : '')
          + (status ? `<br><span class="gridatlas-arrival-status" style="color:#888;font-size:10px">Status supplied by arrival link: ${escapeHtml(status)}</span>` : '')
          + '<br><span style="color:#555;font-size:9px">Card and point built from the arrival link.</span></div>')
        .addTo(capturedMap);
      link.arrival_card = 'from-link-fields';
      link.arrival_card_identity = {
        repd_ref: ref || null,
        name: String(name || ''),
        technology: String(tech || ''),
        capacity_mw: Number.isFinite(statedMw) && statedMw > 0 ? statedMw : null,
        supplied_status: status || null,
        provenance: 'ARRIVAL_LINK'
      };
    } catch (error) {
      link.failures.push('arrival card: ' + String(error?.message || error));
    }
  }

  function injectDeclaredOnly() {
    const content = document.querySelector('.maplibregl-popup-content');
    if (!content || !currentDeclared) return false;
    if (content.querySelector(`.${BLOCK_CLASS}`)) return false;  // never over a measured block
    try {
      installStyles();
      resetCardGeometry(content);
      addCardBar(content);
    content.querySelector('.testcode-location-source')?.remove();
    const provenance=window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.location_provenance;
    if(provenance && content.textContent.includes(window.__GRIDATLAS_PLACE_SEARCH__.deep_link.name)){
      const note=document.createElement('p');note.className='testcode-location-source';note.style.cssText='color:#ffd18a;padding:8px;border:1px solid #97783f';note.textContent=provenance.notice+' ';
      const a=document.createElement('a');a.href=provenance.source_item;a.target='_blank';a.rel='noopener';a.textContent='Source';note.append(a);content.insertBefore(note,content.children[1]||null);
    }
      const holder = document.createElement('div');
      holder.innerHTML = `<div class="${BLOCK_CLASS}">`
        + declaredBlockHtml(true) + caveatHtml() + `</div>`;
      const block = holder.firstElementChild;
      if (!block) return false;
      content.appendChild(block);
      requestAnimationFrame(boundCardToMap);
      link.declared_shown_before_measurement = true;
      return true;
    } catch (error) {
      link.failures.push('provisional card: ' + String(error?.message || error));
      return false;
    }
  }

  let cardKeeper = null;
  let cardKeeperPayload = null;

  function armCardKeeper(links, direction, layerLoaded) {
    cardKeeperPayload = { links, direction, layerLoaded };
    if (cardKeeper || typeof MutationObserver !== 'function') return;
    try {
      cardKeeper = new MutationObserver(() => {
        const payload = cardKeeperPayload;
        if (!payload) return;
        // If the register's own card has landed beside the fallback, the
        // fallback yields: one card, and the resolved one wins.
        if (arrivalFallbackPopup
            && document.querySelectorAll('.maplibregl-popup-content').length > 1) {
          removeArrivalFallback();
        }
        const content = document.querySelector('.maplibregl-popup-content');
        if (!content || content.querySelector(`.${BLOCK_CLASS}`)) return;
        injectIntoCard(payload.links, payload.direction, payload.layerLoaded);
      });
      cardKeeper.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      link.failures.push('card keeper: ' + String(error?.message || error));
      cardKeeper = null;
    }
  }

  function disarmCardKeeper() {
    cardKeeperPayload = null;
  }

  function removeCardBlock() {
    document.querySelectorAll(`.${BLOCK_CLASS}`).forEach(node => node.remove());
  }

  /* ── the map layers ──────────────────────────────────────────────────── */

  let capturedMap = null;
  let animationHandle = null;
  let dashPhase = 0;

  function emptyCollection() {
    return { type: 'FeatureCollection', features: [] };
  }

  function ensureLayers(map) {
    if (map.getSource(SRC)) return;

    map.addSource(SRC, { type: 'geojson', data: emptyCollection() });
    map.addSource(SRC_NODES, { type: 'geojson', data: emptyCollection() });

    // Three stacked strokes make the neon: a wide soft glow, a bright core, and
    // a dashed overlay whose offset is animated so the line reads as flowing
    // towards the substation.
    map.addLayer({
      id: L_GLOW, type: 'line', source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 12],
        'line-opacity': 0.10,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 8]
      }
    });
    map.addLayer({
      id: L_CORE, type: 'line', source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 12, 1.8],
        'line-opacity': ['get', 'strength']
      }
    });
    // Two flow layers, half a period apart, so a link reads as a stream of
    // electrons rather than one dot going round.
    map.addLayer({
      id: L_FLOW, type: 'line', source: SRC,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': FLOW_COLOUR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.4],
        'line-opacity': 0.8,
        'line-dasharray': [0.2, 3.2]
      }
    });
    map.addLayer({
      id: L_FLOW_B, type: 'line', source: SRC,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': FLOW_COLOUR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 12, 1.8],
        'line-opacity': 0.45,
        'line-dasharray': [0.2, 3.2]
      }
    });

    map.addLayer({
      id: L_NODE_RING, type: 'circle', source: SRC_NODES,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 13],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': SUBSTATION_COLOUR,
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.4
      }
    });
    map.addLayer({
      id: L_NODE, type: 'circle', source: SRC_NODES,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.2, 12, 4],
        'circle-color': SUBSTATION_COLOUR,
        'circle-opacity': 0.8
      }
    });
    const neonFont = styleTextFont(map);
    if (!neonFont) {
      link.labels_drawn = false;
      link.failures.push('the basemap serves no glyphs, so link labels are omitted');
    } else {
      // Defer until a glyph range actually comes back. Nothing waits on
      // labels: the links are already drawn and the distances are on the
      // card.
      addLabelLayerWhenDrawable(map, neonFont, {
          id: L_LABEL, type: 'symbol', source: SRC_NODES,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-offset': [0, -1.5],
            'text-anchor': 'bottom',
            'text-allow-overlap': false,
            'text-font': neonFont
          },
          paint: {
            'text-color': '#a9c4c9',
            'text-halo-color': '#000c10',
            'text-halo-width': 1.5,
            'text-opacity': 0.9
          }
        }, 'link');
    }
        link.installed = true;
  }

  function stopAnimation() {
    forgetDashMemo();
    if (animationHandle !== null) {
      cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
  }

  function startAnimation(map) {
    stopAnimation();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    link.reduced_motion = reduced;
    if (reduced) {
      // Motion is a preference, not a requirement. The lines, the nodes and
      // every number stay; only the travelling dash stops.
      try {
        map.setPaintProperty(L_FLOW, 'line-opacity', 0);
        map.setPaintProperty(L_FLOW_B, 'line-opacity', 0);
      } catch (_) { /* layer gone */ }
      return;
    }
    const step = () => {
      dashPhase = (dashPhase + FLOW_SPEED) % FLOW_PERIOD;
      const half = (dashPhase + FLOW_PERIOD / 2) % FLOW_PERIOD;
      try {
        setFlowDash(map, L_FLOW, dashPhase);
        setFlowDash(map, L_FLOW_B, half);
      } catch (_) {
        stopAnimation();
        return;
      }
      animationHandle = requestAnimationFrame(step);
    };
    animationHandle = requestAnimationFrame(step);
  }

  function clearLinks() {
    invalidatePendingArrival('clear');
    stopAnimation();
    const map = capturedMap;
    if (map && map.getSource(SRC)) {
      setSourceData(map, SRC, emptyCollection());
      setSourceData(map, SRC_NODES, emptyCollection());
    }
    disarmCardKeeper();
    removeArrivalFallback();
    removeCardBlock();
    clearPin(capturedMap);
    link.links_drawn = 0;
    link.last_selection = null;
    currentRepdRef = null;
    currentDeclared = null;
    currentNearest400 = null;
  }

  function drawLinks(map, origin, name, tech, links, direction, statedMw, layerLoaded = true) {
    ensureLayers(map);
    // A link takes the colour of the project end, whichever end was clicked.
    const colour = direction === 'from-substation'
      ? SUBSTATION_COLOUR
      : (TECH_COLOUR[tech] || SUBSTATION_COLOUR);

    const lines = links.map((l, index) => ({
      type: 'Feature',
      properties: {
        colour,
        // The nearest link burns brightest; the rest fade back in order, so
        // rank is legible without reading the numbers.
        strength: Math.max(0.20, 0.62 - index * 0.10),
        km: l.km
      },
      geometry: { type: 'LineString', coordinates: [origin, l.at] }
    }));

    const nodes = links.map(l => {
      const tail = l.kv && l.kv.length ? `${l.kv[0]} kV`
        : (l.mw != null ? `${l.mw} MW` : '');
      return {
        type: 'Feature',
        properties: {
          colour,
          label: tail ? `${l.km.toFixed(2)} km · ${tail}` : `${l.km.toFixed(2)} km`
        },
        geometry: { type: 'Point', coordinates: l.at }
      };
    });

    if (direction === 'to-substation' && currentDeclared?.at) {
      // The declared link is public record, drawn in its own colour so it
      // never reads as one more nearest-neighbour measurement.
      const unbuilt = currentDeclared.poc_status === 'not_built'
        || currentDeclared.poc_status === 'under_construction';
      const declaredColour = unbuilt ? DECLARED_UNBUILT_COLOUR : DECLARED_COLOUR;
      lines.push({ type: 'Feature',
        properties: { colour: declaredColour, strength: 0.85, km: currentDeclared.km },
        geometry: { type: 'LineString', coordinates: [origin, currentDeclared.at] } });
      nodes.push({ type: 'Feature',
        properties: { colour: declaredColour,
          label: `PoC \u00b7 ${currentDeclared.km.toFixed(2)} km \u00b7 ${currentDeclared.kv} kV` },
        geometry: { type: 'Point', coordinates: currentDeclared.at } });
    }
    setSourceData(map, SRC, { type: 'FeatureCollection', features: lines });
    setSourceData(map, SRC_NODES, { type: 'FeatureCollection', features: nodes });

    // The popup is built by the engine and rendered synchronously in its own
    // click handler, but MapLibre attaches it on the next frame in some paths.
    // One retry covers that without polling forever.
    armCardKeeper(links, direction, layerLoaded);
    if (!injectIntoCard(links, direction, layerLoaded)) {
      requestAnimationFrame(() => injectIntoCard(links, direction, layerLoaded));
    }
    startAnimation(map);

    link.links_drawn = links.length;
    link.last_selection = { name, tech, direction, count: links.length,
      nearest_km: links.length ? Number(links[0].km.toFixed(3)) : null };
    lastSelection = { origin, name, tech, direction, links, statedMw: statedMw || null };
    if (new URLSearchParams(location.search).has('repd_ref')) {
      if (!map.__testcodeUserMovementBound) {
        map.__testcodeUserMovementBound=true;
        for (const event of ['dragstart','zoomstart','rotatestart']) map.on(event,e=>{if(e.originalEvent)map.__testcodeUserMoved=true;});
      }
      const frame = (force=false) => {
        if (!lastSelection || (!force && map.__testcodeUserMoved)) return;
        const points=[lastSelection.origin,...lastSelection.links.map(l=>l.at),currentNearest400?.at,currentDeclared?.at].filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
        if (!points.length) return;
        map.resize();
        const narrow=innerWidth<=700, h=map.getContainer().clientHeight;
        const padding=narrow?{left:28,right:28,top:125,bottom:Math.min(h*.5,innerHeight*.4+90)}:{left:380,right:70,top:85,bottom:70};
        map.fitBounds([[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]],{padding,maxZoom:lastSelection.tech==='wind_offshore'?8.5:13,duration:700});
        link.context_frame={points:points.length,coordinates:points.map(p=>p.slice()),padding,project:lastSelection.name};
      };
      requestAnimationFrame(()=>frame());
      let button=document.getElementById('testcode-fit');
      if(!button){button=document.createElement('button');button.id='testcode-fit';button.type='button';button.textContent='Fit connections';map.getContainer().parentElement.append(button);}
      button.onclick=()=>frame(true);
    }
    if (direction !== 'from-substation') setPin(map, origin, name, tech);
  }

  /* ── selection ───────────────────────────────────────────────────────── */

  // Tick the engine's own Subs control. Going through the checkbox means the
  // engine hydrates the layer, updates its UI state and stays the owner of it;
  // adding the source here instead would leave its panel lying about what is on.
  function enableSubstationLayer() {
    try {
      /* The engine tags its own controls with data-layer-id, and that is
         what enableTechnologyLayer and the mobile tray have both used for
         generations. This searched LABEL TEXT for "subs " instead, which
         is the one part of a control guaranteed to change: the labels
         carry live counts and a [WAIT]/[OK]/[LOAD] state. Attribute
         first; the label stays only as a fallback for a control that
         somehow lacks it. Codex, 202609011823. */
      const box = document.querySelector('input[type=checkbox][data-layer-id="subs"]')
        || [...document.querySelectorAll('input[type=checkbox]')].find((input) => {
          const label = (input.closest('label') || input.parentElement)?.textContent || '';
          return label.replace(/\s+/g, ' ').trim().toLowerCase().startsWith('subs ');
        });
      if (!box) { noteFailure('subs: control not found'); return false; }
      if (!box.checked) box.click();
      link.substation_layer_enabled = true;
      recoverFailures(/^subs: control not found$/);
      return true;
    } catch (error) {
      link.failures.push('subs: ' + String(error?.message || error));
      return false;
    }
  }

  // True when a click came from one of our own surfaces -- the card block or
  // the layout panel -- rather than from the map itself. MapLibre delivers
  // container clicks as map clicks, so without this every button we add fires
  // whatever is under it.
  function fromOwnUi(event) {
    const target = event?.originalEvent?.target;
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('.maplibregl-popup')
      || target.closest('#gridatlas-sld-panel'));
  }

  // The engine's own layer control for a technology. Arriving from Pipeline
  // News the project itself was invisible: the deep link switched the
  // substations on and left the project's layer off, so the card described a
  // scheme with no pixel under it and the links appeared to start from nowhere.
  // The engine tags each layer control with the layer it drives:
  //   <input type=checkbox data-layer-id="solar">
  // so the technology IS the hook, and no mapping table is needed. Matching on
  // the label text worked, but the labels carry live counts -- "Solar PV [2819
  // | 52.3GW]" -- so it was matching prose that changes with the data. The
  // label match stays as a fallback for a control the engine has not tagged.
  const TECH_LABEL_FALLBACK = {
    solar: "Solar PV [", solar_operational: "Solar PV (Operational",
    solar_roof: "Solar Roof [",
    bess: "Battery Storage [", bess_operational: "Battery Storage (Operational",
    wind: "Wind [", wind_onshore_operational: "Onshore Wind (Operational",
  };

  /* ── say what is happening ────────────────────────────────────────────
     Vikram, tonight: "the map feature from pipelinenews doesnt load on
     iphone". Reproduced in kind on the desktop: a black rectangle, no
     controls, and a deep link waiting for substations that could not arrive.
     Nothing on screen said so. A black map is indistinguishable from a broken
     one, and the reader is left to guess which they have.

     The Atlas boots a 35.7 MB query engine before it can answer anything. On
     a phone over cellular that is a long wait and sometimes not a wait at all,
     and the honest thing is to say which. This chip says what is being waited
     for, and when the wait has failed it says that too, with a way to try
     again -- because a retry after the network recovers is usually all it
     needs, and a reload throws away the deep link.

     It removes itself the moment the controls arrive, so a working Atlas is
     never decorated with news about itself. */

  const STATUS_ID = 'gridatlas-boot-status';

  function statusHost() {
    return document.querySelector('.maplibregl-map') || document.body;
  }

  function showStatus(message, kind) {
    try {
      let el = document.getElementById(STATUS_ID);
      if (!el) {
        el = document.createElement('div');
        el.id = STATUS_ID;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        statusHost().appendChild(el);
      }
      el.dataset.kind = kind || 'waiting';
      el.textContent = message;
      if (kind === 'failed') {
        const again = document.createElement('button');
        again.type = 'button';
        again.textContent = 'Try again';
        again.addEventListener('click', (event) => {
          event.stopPropagation();
          event.preventDefault();
          retryArrival();
        });
        el.appendChild(again);
      }
      link.status_message = message;
    } catch (error) {
      link.failures.push('status: ' + String(error?.message || error));
    }
  }

  function clearStatus() {
    document.getElementById(STATUS_ID)?.remove();
    link.status_message = null;
  }

  // Re-run the arrival rather than reloading: a reload on a phone repeats the
  // whole 35.7 MB boot, and the deep link is in the URL either way.
  let retryArrival = () => {};
  let rerunDeepLink = null;

  async function retryIdentityOwnerThenArrival() {
    clearStatus();
    const owner = window.__GRIDATLAS_PLACE_SEARCH__;
    if (typeof owner?.retry_exact_deep_link !== 'function') {
      showStatus('The active-register identity owner cannot retry in this composition.',
        'failed');
      return false;
    }
    const invalidatedEpoch = invalidatePendingArrival('identity-retry');
    const retryEpoch = claimPendingArrival(window.location.search);
    link.arrival_retry = {
      status: 'OWNER_PENDING', invalidated_epoch: invalidatedEpoch,
      owner_epoch: retryEpoch, measurement_epoch: retryEpoch
    };
    try {
      await owner.retry_exact_deep_link(retryEpoch);
    } catch (error) {
      link.arrival_retry.status = 'FAILED';
      showStatus('The active-register identity retry failed: '
        + String(error?.message || error), 'failed');
      return false;
    }
    const terminal = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link;
    if (!arrivalGate.isCurrent(retryEpoch)
        || terminal?.owner_epoch !== retryEpoch
        || terminal?.status === 'CANCELLED') {
      link.arrival_retry.status = 'CANCELLED';
      return false;
    }
    if (terminal?.status === 'FAILED') {
      link.arrival_retry.status = 'FAILED';
      showStatus('The active-register identity check failed: '
        + String(terminal.message || 'identity loader unavailable'), 'failed');
      return false;
    }
    if (typeof rerunDeepLink !== 'function') {
      link.arrival_retry.status = 'FAILED';
      showStatus('The grid measurement owner cannot retry in this composition.',
        'failed');
      return false;
    }
    link.arrival_retry.status = 'MEASUREMENT_PENDING';
    const completed = await rerunDeepLink(retryEpoch);
    if (!arrivalGate.isCurrent(retryEpoch)) {
      link.arrival_retry.status = 'CANCELLED';
      return false;
    }
    link.arrival_retry.status = terminal.status === 'NOT_IN_ACTIVE_REGISTER'
      ? 'NOT_IN_ACTIVE_REGISTER' : (completed === false ? 'FAILED' : 'RESOLVED');
    return completed !== false;
  }

  function injectStatusStyle() {
    if (document.getElementById(STATUS_ID + '-style')) return;
    const style = document.createElement('style');
    style.id = STATUS_ID + '-style';
    style.textContent = SLD_STYLES.bootStatus(STATUS_ID);
    document.head.appendChild(style);
  }

  // Resolve when the engine has rendered its layer dashboard, or when the
  // wait is up. Returning false is a fact worth having, not an error: it says
  // the engine had not finished, which is a different problem from the layer
  // being missing.
  /* Watch for the controls; do not guess how long they will take.
     ----------------------------------------------------------------------
     A fixed budget is always the wrong number. Twelve seconds was generous on
     one load and hopeless on the next: the engine builds its layer dashboard
     from its own data, and that has been measured arriving in two seconds and
     not arriving at all in eighty-six.

     Giving up after a budget also gave up permanently. If the dashboard
     appeared at thirteen seconds -- which it often does -- the layers the
     arrival depends on stayed off for the rest of the session, with a card on
     screen saying the grid data had not loaded while the controls sat there.

     So: the wait still bounds how long the user is asked to look at a spinner,
     because that is a promise about the interface. But an observer keeps
     watching afterwards, and switches the layers on whenever they arrive,
     however late. The status line is cleared at the same moment, because a
     failure notice that outlives the failure is its own bug.

     The observer disconnects the first time it fires. It is not a subscription
     to the page; it is one deferred question. */

  const LAYER_CONTROL = 'input[type=checkbox][data-layer-id]';
  let layerWatcher = null;

  function watchForLayerControls(onReady) {
    if (layerWatcher || typeof MutationObserver !== 'function') return;
    try {
      layerWatcher = new MutationObserver(() => {
        if (!document.querySelector(LAYER_CONTROL)) return;
        layerWatcher.disconnect();
        layerWatcher = null;
        link.layer_controls_arrived_late = true;
        recoverFailures(/^the engine had not rendered its layer controls within/);
        clearStatus();
        try { onReady(); } catch (error) {
          link.failures.push('late layers: ' + String(error?.message || error));
        }
      });
      layerWatcher.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      link.failures.push('layer watcher: ' + String(error?.message || error));
      layerWatcher = null;
    }
  }

  /* iOS Safari, reported live by the architect and reproduced independently
     against a page opened hidden: this budget used to be charged in WALL
     CLOCK time regardless of whether anyone could see the result of
     spending it. Pipeline News' MAP control opens on touch devices with
     target="_blank", and on iOS Safari a background tab is not guaranteed
     to be composited while the reader is still looking at the page they
     tapped from -- requestAnimationFrame does not tick there, so the
     engine's own dashboard build (which the boot trigger gates behind
     style.load/load, both paint-driven) can stall for the WHOLE budget
     without ever having had a real chance. Elapsed time while hidden buys
     nothing observable and is not charged against the budget; only time
     the tab was actually visible counts down. */
  async function waitForLayerControls(budgetMs) {
    let elapsed = 0;
    const started = Date.now();
    /* Visible time governs the BUDGET; wall clock still bounds the WAIT.
       ----------------------------------------------------------------------
       Charging the budget in visible time is what stops a background tab
       spending it before anyone can see the result. But a tab that is never
       made visible would then poll every 200ms forever, which is a hang by any
       honest definition and costs battery on the device least able to afford
       it. So an absolute ceiling backstops the visible-time budget: whichever
       runs out first ends the wait. Ten minutes matches the last-resort stop
       the arrival lane already uses for a lane that died silently. */
    const HARD_CEILING_MS = 600000;
    if (!document.querySelector(LAYER_CONTROL)) {
      injectStatusStyle();
      showStatus('Switching the grid layers on as soon as the map\u2019s own '
        + 'controls appear. The distances do not wait for them.', 'waiting');
    }
    while (elapsed < budgetMs && Date.now() - started < HARD_CEILING_MS) {
      if (document.querySelector(LAYER_CONTROL)) {
        /* Both clocks are published, because they answer different questions:
           visible time is what the budget was actually spent from, wall time
           is what the reader sat through. Reporting only one of them makes a
           background arrival look instant or a foreground one look slow. */
        link.layer_controls_ready_ms = Date.now() - started;
        link.layer_controls_ready_visible_ms = elapsed;
        clearStatus();
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      if (document.visibilityState === 'visible') elapsed += 200;
    }
    link.layer_controls_ready_ms = null;
    link.failures.push(
      'the engine had not rendered its layer controls within '
      + Math.round(budgetMs / 1000) + 's; still watching, and the layers will '
      + 'be switched on if they arrive');
    if (link.links_drawn > 0) {
      // The answer is already on the map. Late layers are not a failure the
      // reader has to act on, and a red notice over a working map is noise.
      clearStatus();
    } else {
      injectStatusStyle();
      showStatus('The grid data has not finished loading yet. The distances '
        + 'below are already measured; the layers will switch on by themselves '
        + 'if it arrives.', 'failed');
    }
    return false;
  }

  function enableTechnologyLayer(tech) {
    if (!tech) return false;
    // Resolved through the ONE table above. 'wind_onshore' and
    // 'wind_offshore' are Pipeline buckets, not layer ids -- searching the
    // DOM for a control literally named that always failed. 'other' has no
    // layer at all, and is said plainly rather than searched for.
    const layerId = layerIdForBucket(tech);
    if (layerId === null) {
      link.technology_layer = Object.assign({}, link.technology_layer, {
        requested: tech, layer_id: null, enabled: false,
        reason: 'GridAtlas has no map layer for the "' + tech + '" technology; '
          + 'nothing to switch on. The card and the distances above it are '
          + 'unaffected.'
      });
      return false;
    }
    try {
      const boxes = [...document.querySelectorAll('input[type=checkbox]')];
      let box = boxes.find((input) => input.dataset?.layerId === layerId);
      if (!box) {
        const label = TECH_LABEL_FALLBACK[layerId];
        if (label) {
          box = boxes.find((input) => {
            const text = (input.closest('label') || input.parentElement)?.textContent || "";
            return text.replace(/\s+/g, " ").trim().toLowerCase()
              .startsWith(label.toLowerCase());
          });
        }
      }
      if (!box) { noteFailure('layer control not found: ' + layerId); return false; }
      if (!box.checked) box.click();
      link.project_layer_enabled = layerId;
      // The field a reader (and every prior proof) actually trusted must
      // say what happened, not what the request's bucket merely belonged
      // to. Set here, on the ONE path that turns a control on, rather than
      // synthesised from set membership before this ever ran.
      link.technology_layer = Object.assign({}, link.technology_layer, {
        requested: tech, layer_id: layerId, enabled: true, reason: null
      });
      recoverFailures(new RegExp('^layer control not found: '
        + String(layerId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
      return true;
    } catch (error) {
      link.failures.push('layer: ' + String(error?.message || error));
      return false;
    }
  }

  /* ── the project pin ─────────────────────────────────────────────────
     A marker for the selected project, drawn by this cartridge rather than
     borrowed from a layer.

     The engine's technology layers are hydrated on demand and can be switched
     off by the user, so a project arriving by deep link may have no pixel at
     all. This one does not depend on any of that: it is the thing the card is
     about, and while a card is open its subject should be visible on the map.
     It toggles, because a pin over the site is exactly what you want out of the
     way when you are looking at the site. */

  const SRC_PIN = 'gridatlas-project-pin';
  const L_PIN_HALO = 'l-project-pin-halo';
  const L_PIN = 'l-project-pin';
  let pinVisible = true;

  function ensurePinLayers(map) {
    // addSource throws if the style is not loaded, and a source that failed to
    // add reads back as null. The pin is a convenience: it may not be the
    // reason a card fails to open.
    if (!map || typeof map.addSource !== 'function') return false;
    if (map.getSource(SRC_PIN)) return true;
    try {
    map.addSource(SRC_PIN, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    /* A ring around the site, not a dot on it.
       ------------------------------------------------------------------
       A filled dot in the technology colour was invisible: it sat under the
       engine's own pixel for the same project, and the neon links converging
       on it are drawn in that same colour, so it disappeared into its own
       arrival point. Seen in Chrome at zoom 12 on Botley West -- position
       exactly right, nothing to look at.

       A ring solves all three. It does not duplicate the engine's pixel,
       because it surrounds it. It reads against the links, because it crosses
       them rather than joining them. And it answers the question the marker
       exists for -- which of these is the one the card is about -- which a
       second dot among dots cannot. */
    map.addLayer({
      id: L_PIN_HALO, type: 'circle', source: SRC_PIN,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 11, 14, 26],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['get', 'colour'],
        'circle-stroke-width': 6,
        'circle-stroke-opacity': 0.13,
        'circle-blur': 0.4,
      },
    });
    map.addLayer({
      id: L_PIN, type: 'circle', source: SRC_PIN,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 11, 14, 26],
        // Hollow: whatever the engine draws for this project stays readable
        // inside it.
        'circle-color': 'rgba(0,0,0,0)',
        // Pale, not white. It has to separate from the technology colour it
        // encircles without becoming the loudest thing on a dark map.
        'circle-stroke-color': '#cfe9ed',
        'circle-stroke-width': 1.6,
        'circle-stroke-opacity': 0.85,
      },
    });
    } catch (error) {
      link.failures.push('pin: ' + String(error?.message || error));
      return false;
    }
    return Boolean(map.getSource(SRC_PIN));
  }

  function setPin(map, origin, name, tech) {
    if (!ensurePinLayers(map)) return;
    const source = map.getSource(SRC_PIN);
    if (!source || typeof source.setData !== 'function') return;
    const colour = TECH_COLOUR[tech] || SUBSTATION_COLOUR;
    source.setData({
      type: 'FeatureCollection',
      features: origin && pinVisible ? [{
        type: 'Feature',
        properties: { colour, name: name || '' },
        geometry: { type: 'Point', coordinates: origin },
      }] : [],
    });
    link.project_pin = { shown: Boolean(origin && pinVisible), name: name || null };
  }

  function clearPin(map) {
    const source = map && map.getSource && map.getSource(SRC_PIN);
    if (source && typeof source.setData === 'function') {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
    link.project_pin = { shown: false, name: null };
  }

  function togglePin() {
    pinVisible = !pinVisible;
    if (capturedMap && lastSelection) {
      setPin(capturedMap, lastSelection.origin, lastSelection.name, lastSelection.tech);
    }
    return pinVisible;
  }
  link.togglePin = togglePin;

  /* ── labels need glyphs, and glyphs can be absent ─────────────────────
     A symbol layer cannot draw text without a glyph atlas, and maplibre does
     not degrade when it cannot build one: it throws reading `width` off a null
     atlas, and it does it again on the NEXT frame, and the next. Both of us
     watching this estate tonight found the same storm from different ends --
     Codex counted 50+ in about 20 seconds on mounting the layout, and a cold
     load here produced 4,218. Same exception, and the two symbol layers in
     this cartridge are the only text it draws.

     Two ways to have no atlas: the style carries no `glyphs` endpoint at all,
     or it has one and the named font is not served by it. The font name here
     was assumed -- 'Open Sans Bold' -- rather than taken from the style that
     has to serve it, so a basemap with a different font family produced text
     that could never resolve.

     So: ask the style. No glyphs endpoint means no labels, which is a quiet
     map rather than a broken one. Otherwise use a font the style already uses
     for its own labels, because that one is definitely served.

     This matters most on a phone. An exception per frame is a main thread that
     never idles, and on a phone that is heat, battery and a page that stops
     answering touches. */
  function styleTextFont(map) {
    try {
      const style = map.getStyle?.();
      if (!style || !style.glyphs) return null;
      for (const layer of style.layers || []) {
        const font = layer?.layout?.['text-font'];
        if (Array.isArray(font) && font.length && typeof font[0] === 'string') {
          return font;
        }
      }
      // A glyph endpoint with no symbol layer to learn from. This is the
      // Mapbox/MapLibre default family and the one CARTO serves.
      return ['Open Sans Bold', 'Arial Unicode MS Bold'];
    } catch (error) {
      link.failures.push('glyphs: ' + String(error?.message || error));
      return null;
    }
  }

  /* Having a glyphs endpoint is not the same as being able to reach it.
     ----------------------------------------------------------------------
     Naming a font the style serves fixed one half. The other half was watched
     live and is worse: the style declared

       https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf

     on the same CDN that had just returned 200 for style.json and then served
     no vector tiles at all. A declared endpoint that cannot be reached gives
     exactly the same null atlas as no endpoint, and 5,362 exceptions in thirty
     seconds. Checking that the property exists proves nothing; the only honest
     test is to ask for a range and see.

     So fetch one - the first 256 codepoints, a few kilobytes, the same request
     the renderer would make. If it does not come back, there are no labels.
     That is a map without text, which is a great deal better than a map that
     throws on every frame it ever draws.

     Deferring the labels costs nothing: they are decoration over links that
     are already on screen, and the distances they annotate are on the card. */
  async function glyphsReachable(map, font) {
    let template;
    try { template = map.getStyle?.()?.glyphs; } catch (error) { template = null; }
    if (!template || !font) return false;
    const url = String(template)
      .replace('{fontstack}', encodeURIComponent(font.join(',')))
      .replace('{range}', '0-255');
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) {
        link.failures.push('glyph range ' + response.status + '; labels omitted');
        return false;
      }
      return true;
    } catch (error) {
      link.failures.push('glyph range unreachable; labels omitted');
      return false;
    }
  }

  // Add a symbol layer only once its text can actually be drawn. Callers do
  // not await this: the labels arrive when they arrive, or never, and nothing
  // else waits on them.
  function addLabelLayerWhenDrawable(map, font, spec, what) {
    glyphsReachable(map, font).then((ok) => {
      link.labels_drawn = ok;
      if (!ok) return;
      try {
        if (!map.getLayer(spec.id)) map.addLayer(spec);
      } catch (error) {
        link.failures.push(what + ' labels: ' + String(error?.message || error));
      }
    });
  }

  /* ── GB grid conditions, from the tracker that already measures them ───
     The estate already has an application that tracks GB electricity:
     globalgrid2050.com/uk_energy_tracking_v6, backed by Ventusltd/
     data-gb-electricity. The Atlas had no idea it existed, so a map of where
     the country is building generation could not tell you what the system was
     doing.

     This does not port that application. It is 49 MB, and the Atlas already
     boots a 35.7 MB query engine before it can answer anything -- adding a
     second one would be a way of making both worse. It reads the small
     published feeds the tracker writes, one to four kilobytes each, and links
     to the full application for everything else. The tracker stays the place
     the analysis lives.

     HONESTY ABOUT AGE. Measured when this was written, those feeds were
     stamped 2026-06-18: about ten weeks old. A panel that prints a price with
     no date implies it is current, and a stale number presented as live is
     worse than no number. So the age is always shown, and past a day it is
     labelled as not current rather than merely dated. If the feeds start
     updating again the same panel gets better on its own.

     Mobile first: it opens collapsed, sized against the viewport, and is a
     single column on a narrow screen. */

  /* What a megawatt hour has been worth in the available historic record.
     ----------------------------------------------------------------------
     A map of where the country is building generation should be able to say
     what the system has been doing while it was built.

     IT READS THE DATA REPOSITORY, NOT A COPY. The governing rule in the
     estate's migration scope is "data before charts": a consumer must read a
     data product that already sits clean, and must never own source data or
     become a second source of truth. So this reads
     Ventusltd/data-gb-electricity, which owns the Parquet and publishes a
     browser-sized rollup derived from it. An earlier version of this panel read a
     copy derived inside globalgrid2050; that copy was a second definition of
     the same numbers and has been retired in favour of this one.

     A ROLLUP, NOT A HUNDRED MEGABYTES. Settlement-period history is the right
     size for a chart someone chose to open and the wrong size for a panel
     inside a map on a phone, which is where most readers arrive.

     THE MEASUREMENT STOPS WHERE THE PRODUCT STOPS. A negative system price is
     an observed market value. It does not by itself establish a local network
     constraint, curtailment, connection capacity, a usable charging window or
     the economics of any project on this map.

     SOLAR IS ABSENT, AND SAYS SO. PVLive has not been decided into the data
     repository, so the product declares solar absent rather than carrying a
     series from somewhere else. A panel that quietly filled that gap from a
     second source would be the exact thing the discipline forbids. */

  const GB_PIN_ID = 'price-decade-rollup';
  const GB_ROLLUP = PINS ? PINS.url(GB_PIN_ID) : null;
  const GB_APP = 'https://globalgrid2050.com/uk_energy_tracking_v6/';
  const GB_ID = 'gridatlas-gb-conditions';
  const GB_SCHEMA = 'data-gb-electricity.price-decade-rollup.v2';
  /* Loader state on the window, as the topology loader's is, so the source
     registry can say whether this product answered, was withheld (reached,
     not the schema this consumer answers) or failed - generation 202609012217. */
  const gbLoader = { state: 'idle', product: GB_ROLLUP, schema_required: GB_SCHEMA,
    schema: null, reason: null, error: null, renders: 0 };
  window.__GRIDATLAS_GB_CONDITIONS__ = gbLoader;

  const gbNumber = (value, digits) =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '--';

  function gbRow(label, value, unit) {
    return `<div class="gb-row"><span class="gb-k">${label}</span>`
      + `<span class="gb-v">${value}<em>${unit || ''}</em></span></div>`;
  }

  function gbProductError(product) {
    if (!product || product.schema !== GB_SCHEMA) return 'owner product v2 is not available';
    const price = product.price || {};
    const derived = product.derived_from || {};
    const years = Array.isArray(price.by_year) ? price.by_year : [];
    if (!years.length) return 'year rows are absent';
    const included = years.reduce((sum, row) => sum + Number(row.days_included), 0);
    const negative = years.reduce((sum, row) =>
      sum + Number(row.days_with_a_negative_settlement_period), 0);
    if (included !== Number(derived.included_days)) return 'included-date total disagrees';
    if (negative !== Number(price.days_with_a_negative_settlement_period)) {
      return 'negative-date total disagrees';
    }
    const validYears = years.every(row => {
      const days = Number(row.days_included);
      const calendarDays = Number(row.calendar_days);
      const status = days === calendarDays ? 'FULL_DATE_COVERAGE' : 'PARTIAL_DATE_COVERAGE';
      const coverage = 100 * days / calendarDays;
      const share = 100 * Number(row.days_with_a_negative_settlement_period) / days;
      return days === Number(row.days)
        && calendarDays >= days
        && row.calendar_date_coverage === status
        && Math.abs(Number(row.calendar_date_coverage_pct) - coverage) < 0.011
        && Math.abs(Number(row.negative_period_day_share_pct) - share) < 0.011;
    });
    if (!validYears) return 'year coverage or share disagrees';
    if (Math.abs(Number(price.negative_period_day_share_pct)
      - (100 * negative / included)) >= 0.011) return 'record share disagrees';
    for (const extreme of [price.lowest_settlement_period, price.highest_settlement_period]) {
      if (!Number.isInteger(extreme?.settlement_period)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(extreme?.period_start_utc)) {
        return 'extreme-period identity is incomplete';
      }
    }
    return '';
  }

  async function renderGbConditions(body) {
    let product = null;
    gbLoader.state = 'loading';
    try {
      /* no-cache, not force-cache. Watched live on v9.41's first minutes:
         the owner had published v2, a fresh fetch returned v2, and the panel
         showed its withheld state - because force-cache handed back the v1
         this browser had fetched hours earlier and never revalidated. A
         consumer that gates on a product's version must not pin itself to
         whichever version it saw first. no-cache revalidates every open,
         which costs a 304 when nothing changed and correctness when it did. */
      const response = await fetch(GB_ROLLUP, { cache: 'no-cache' });
      if (response.ok) {
        const text = await response.text();
        gbLoader.pin = await PINS.verify(GB_PIN_ID, text);
        if (gbLoader.pin.state === 'MISMATCH') gbLoader.error = gbLoader.pin.detail;
        else product = JSON.parse(text);
      }
    } catch (error) {
      product = null;
      gbLoader.error = String(error && error.message || error);
    }
    if (!product) {
      gbLoader.state = 'failed';
      body.innerHTML = '<p class="gb-note">The price rollup could not be '
        + 'reached. This says nothing about the grid, only about the network '
        + 'between here and the data repository.</p>';
      link.gb_conditions = { reached: false };
      return;
    }

    const productError = gbProductError(product);
    if (productError) {
      gbLoader.state = 'withheld';
      gbLoader.reason = productError;
      gbLoader.schema = product.schema || null;
      body.innerHTML = '<p class="gb-note">The owner price product did not pass '
        + `the v2 evidence gate (${productError}), so no values are shown.</p>`;
      link.gb_conditions = { reached: true, schema_supported: false,
        source: 'data-gb-electricity', reason: productError, project_bindings: 0 };
      return;
    }

    const price = product.price || {};
    const years = Array.isArray(price.by_year) ? price.by_year : [];
    const latest = years.length ? years[years.length - 1] : null;
    const low = price.lowest_settlement_period || null;
    const includedDays = Number((product.derived_from || {}).included_days);
    const negativeDays = Number(price.days_with_a_negative_settlement_period);
    const partialYears = years.filter(row =>
      row.calendar_date_coverage === 'PARTIAL_DATE_COVERAGE');

    const rows = [];
    rows.push(gbRow('Available-record daily mean',
      gbNumber(price.available_record_daily_mean, 2), ' &pound;/MWh'));
    rows.push(gbRow('Dates with a negative period',
      gbNumber(price.negative_period_day_share_pct, 2) + '%',
      ` ${negativeDays} of ${includedDays}`));
    if (latest) {
      const partial = latest.calendar_date_coverage === 'PARTIAL_DATE_COVERAGE';
      rows.push(gbRow(latest.year + (partial ? ' partial' : ''),
        gbNumber(latest.mean_gbp_per_mwh, 2), ' &pound;/MWh'));
    }

    const lowLine = low && Number.isFinite(Number(low.value))
      ? '<p class="gb-note gb-point">Lowest observed settlement price: '
        + `<b>${gbNumber(low.value, 2)} &pound;/MWh</b>, SP ${low.settlement_period}, `
        + `${low.period_start_utc}. This is a historic GB system-price `
        + 'observation, not evidence about a project on this map.</p>'
      : '';

    // Absent by decision, so it is stated rather than left as a silent gap.
    const solarLine = product.solar && product.solar.present === false
      ? '<p class="gb-note">Solar is not in this product yet: the data '
        + 'repository has not taken PVLive, and filling the gap from somewhere '
        + 'else would make a second source of truth.</p>'
      : '';

    const span = Array.isArray(price.span) ? price.span.join('–') : '';
    body.innerHTML = rows.join('')
      + lowLine
      + solarLine
      + `<p class="gb-note">GB system sell price ${span}, included daily means `
      + `from dates with at least ${product.grain.minimum_periods_per_day} available `
      + 'settlement periods. Included does not mean all 48 are present. '
      + `${partialYears.length} year${partialYears.length === 1 ? '' : 's'} have `
      + 'partial calendar-date coverage. Elexon, via Ventusltd/data-gb-electricity. '
      + 'Historic system conditions only: not a forecast, not a price '
      + 'expectation, and not a statement about any project on this map. The '
      + 'count and share do not measure local network constraint, curtailment, '
      + 'connection capacity, a usable charging window or project revenue.</p>'
      + `<a class="gb-more" href="${GB_APP}" target="_blank" rel="noopener">`
      + 'Open the full GB energy tracker &#8599;</a>';

    gbLoader.state = 'ready';
    gbLoader.schema = product.schema;
    gbLoader.renders += 1;
    link.gb_conditions = {
      reached: true,
      schema_supported: true,
      source: 'data-gb-electricity',
      schema: product.schema,
      span: price.span || null,
      available_record_daily_mean: price.available_record_daily_mean ?? null,
      negative_date_share_pct: price.negative_period_day_share_pct ?? null,
      negative_dates: negativeDays,
      included_dates: includedDays,
      lowest: low ? { value: low.value, settlement_period: low.settlement_period,
        period_start_utc: low.period_start_utc } : null,
      solar_present: product.solar ? product.solar.present : null,
      project_bindings: 0,
    };
  }


  /* ── the version ledger, on the page ──────────────────────────────────
     The estate's whole method is sealed, timestamped compositions - build a
     new one, never edit the last - and in one overnight session that produced
     twenty-four of them, each a correction with a one-line scope. Pipeline
     News ledgers its releases on the homepage; the Atlas's generations were
     visible only in git, which a visitor does not have.

     The ledger below is extracted from git at BUILD time: every composition
     manifest that ever existed, read at its last commit. It is pinned history
     carried by the page, not prose about it, and nothing is fetched at
     runtime. Rollback doctrine, stated where the versions are: a bad
     composition is never repaired in place - an earlier one is composed
     again under a new timestamp.

     Mobile first, like everything since Vikram said the link travels by
     WhatsApp: a collapsed chip, viewport-sized body, newest first. */
  /* The ledger itself is a module now, in the cartridge with room for it -
     see atlas/modules/202609030157-version-ledger.js. The name is kept so
     every reader below is unchanged, and an absent module gives an empty
     ledger the panel reports rather than a throw that costs the session. */
  const VERSION_LEDGER =
    (window.__GRIDATLAS_MODULES__ || {}).versionLedger?.entries || [];
  const PRE_SCOPE_COMPOSITIONS = 16;
  const LEDGER_ID = 'gridatlas-version-ledger';
  const LEDGER_DOCTRINE = 'Each row is immutable audit evidence, not a promise '
    + 'that it was live. REJECTED_PRE_PROMOTION entries were never live and are '
    + 'not rollback targets. A deployed bad composition is never repaired in place; '
    + 'an earlier deployed one is composed again under a new timestamp.';

  function ledgerStamp(generation) {
    return generation.slice(0, 4) + '-' + generation.slice(4, 6) + '-'
      + generation.slice(6, 8) + ' ' + generation.slice(8, 10) + ':'
      + generation.slice(10, 12) + ' UTC';
  }

  function installVersionLedger() {
    if (document.getElementById(LEDGER_ID)) return;
    const stack = document.querySelector('.map-controls');
    if (!stack) { link.failures.push('no map-controls for the ledger'); return; }

    const style = document.createElement('style');
    style.id = LEDGER_ID + '-style';
    style.textContent = SLD_STYLES.versionLedger(LEDGER_ID);
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = LEDGER_ID;
    panel.dataset.open = '0';
    const button = document.createElement('button');
    button.type = 'button';
    const newest = VERSION_LEDGER[VERSION_LEDGER.length - 1];
    button.textContent = 'Versions \u00b7 ' + newest.v + ' \u25b8';
    button.setAttribute('aria-expanded', 'false');
    const body = document.createElement('div');
    body.className = 'vl-body';

    const rows = [...VERSION_LEDGER].reverse().map(entry =>
      '<div class="vl-row"><div class="vl-head">'
      + '<span class="vl-ver">' + entry.v
      + (entry.status ? '<span class="vl-status">' + entry.status + '</span>' : '')
      + '</span>'
      + '<span class="vl-when">' + ledgerStamp(entry.g) + '</span></div>'
      + '<div class="vl-scope">' + entry.s + '</div>'
      + (entry.reason ? '<div class="vl-reason">' + entry.reason + '</div>' : '')
      + '</div>').join('');
    body.innerHTML = rows
      + '<p class="vl-note">' + LEDGER_DOCTRINE + ' ' + PRE_SCOPE_COMPOSITIONS
      + ' earlier compositions predate '
      + 'the scope line. Extracted from the repository history at build time; '
      + 'nothing here is fetched or editable at runtime.</p>';

    panel.appendChild(button);
    panel.appendChild(body);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const open = panel.dataset.open === '1';
      panel.dataset.open = open ? '0' : '1';
      button.textContent = 'Versions \u00b7 ' + newest.v + (open ? ' \u25b8' : ' \u25be');
      button.setAttribute('aria-expanded', String(!open));
    });
    panel.addEventListener('click', (event) => event.stopPropagation());
    stack.appendChild(panel);
    link.version_ledger = { entries: VERSION_LEDGER.length, newest: newest.v,
      rejected_pre_promotion: VERSION_LEDGER
        .filter(entry => entry.status === 'REJECTED_PRE_PROMOTION').map(entry => entry.v) };
  }



  /* ── the Grid Finding Scope ───────────────────────────────────────────
     Vikram: clicking blank space should show what grid is in the
     vicinity. Until v9.62 a blank click cleared the map, which treated
     everywhere that is not a consented project as empty. It is not empty;
     it is unexamined.

     The computation is the grid-scope module: this half only arms it,
     draws it and writes it down. The neon project path is untouched and
     remains the anchor - a scope never runs where a project or substation
     was hit. */
  const SCOPE_SRC = 'gridatlas-scope-src';
  const SCOPE_RING_LAYER = 'gridatlas-scope-rings';
  const SCOPE_DOT_LAYER = 'gridatlas-scope-dots';
  const SCOPE_COLOUR = '#7fb5d8';        // cool blue: neither project nor declared
  let scopeArmed = false;
  /* Armed explicitly, like the scope. Published on the link object so a
     reviewer can ask the page which modes are live. */
  let pointArmed = false;
  let scopeResult = null;

  function scopeModule() {
    try { return window.__GRIDATLAS_MODULES__?.gridScope || null; }
    catch (_) { return null; }
  }

  function ensureScopeLayers(map) {
    if (map.getSource(SCOPE_SRC)) return true;
    if (!guardedAddSource(map, SCOPE_SRC, { type: 'geojson', data: emptyCollection() })) {
      return false;
    }
    map.addLayer({ id: SCOPE_RING_LAYER, type: 'circle', source: SCOPE_SRC,
      filter: ['==', ['get', 'kind'], 'band'],
      paint: { 'circle-radius': ['get', 'pixels'], 'circle-color': 'transparent',
        'circle-stroke-color': SCOPE_COLOUR, 'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.5 } });
    map.addLayer({ id: SCOPE_DOT_LAYER, type: 'circle', source: SCOPE_SRC,
      filter: ['==', ['get', 'kind'], 'site'],
      paint: { 'circle-radius': 4, 'circle-color': SCOPE_COLOUR,
        'circle-stroke-color': '#04141c', 'circle-stroke-width': 1 } });
    return true;
  }

  function clearScope() {
    scopeResult = null;
    const map = capturedMap;
    if (map && map.getSource(SCOPE_SRC)) setSourceData(map, SCOPE_SRC, emptyCollection());
    document.querySelectorAll('.' + SCOPE_BLOCK).forEach(node => node.remove());
    link.grid_scope = null;
  }

  const SCOPE_BLOCK = 'gridatlas-scope-block';

  function scopeHtml(result) {
    const bands = result.bands.map(band => {
      const classes = Object.keys(band.by_class_kv)
        .map(Number).sort((a, b) => b - a)
        .map(kv => `${band.by_class_kv[kv]} \u00d7 ${kv} kV`).join(', ');
      return `<li><span class="neon-km">${band.within_km} km</span>`
        + `<span class="neon-name">${band.substations
          ? escapeHtml(classes) : 'nothing mapped'}</span></li>`;
    }).join('');
    const nearest = result.nearest_named.slice(0, 3).map(entry =>
      `<li><span class="neon-km">${entry.km.toFixed(2)} km</span>`
      + `<span class="neon-name">${escapeHtml(entry.name)}</span>`
      + `<span class="neon-kv">${entry.kv} kV</span></li>`).join('');
    /* Which cartridges answered, on the card, not in a console.
       ------------------------------------------------------------------
       Vikram: a click anywhere should make the neons "look for cartridges
       and code". The looking is the source-registry module; this prints
       what it found. A reader told that five of six sources answered and
       which one did not can judge the answer in front of them. A reader
       shown a quietly shorter answer cannot, and will reasonably assume
       the map has told them everything it knows. */
    const survey = result.sources || null;
    const sourcesLine = survey
      ? `<p class="neon-caveat"><b>Sources:</b> ${escapeHtml(survey.sentence)}</p>`
      : '';
    return `<div class="${SCOPE_BLOCK} ${BLOCK_CLASS}">`
      + `<div class="neon-hd">Grid finding scope<span class="neon-beta">Beta</span></div>`
      + `<p class="neon-caveat">${escapeHtml(result.what_this_is)}</p>`
      + `<ol>${bands}</ol>`
      + (nearest ? `<div class="neon-hd">Nearest named</div><ol>${nearest}</ol>` : '')
      + topologyBlockHtml(result.nearest_named.slice(0, 3).map(entry => ({ name: entry.name, kv: entry.kv })))
      + `<p class="neon-caveat"><b>${escapeHtml(result.what_this_is_not)}</b></p>`
      + sourcesLine
      + `<p class="neon-caveat">${escapeHtml(result.method)}. `
      + `Substations as mapped in this release's payload; an absence here is `
      + `an absence from the map, not from the ground.</p></div>`;
  }

  async function runGridScope(map, origin) {
    const scope = scopeModule();
    if (!scope) { noteFailure('grid scope: module unavailable'); return; }
    if (!link.substations_qualifying) {
      injectStatusStyle();
      showStatus('Reading the substation data for this area.', 'waiting');
    }
    const subs = await loadSubstations();
    if (!subs.length) {
      injectStatusStyle();
      showStatus('The substation data did not load, so nothing can be counted '
        + 'here. This is usually the network rather than the place.', 'failed');
      return;
    }
    clearStatus();
    const result = scope.scope(origin, subs, { nearestCount: 5 });

    /* Ask what could have answered, before saying what did.
       ------------------------------------------------------------------
       The deep scan of 202609012230 found this path reporting only what
       OpenStreetMap has mapped while the cartridge holding NESO's 886
       published connection points sat loaded in the same page. The scope
       still counts only what it can count - widening the computation is a
       separate, provable change - but it no longer stays silent about the
       sources it did not use. */
    const registry = window.__GRIDATLAS_MODULES__?.sourceRegistry || null;
    if (registry) {
      try { result.sources = registry.survey(window); }
      catch (error) { noteFailure('source registry: ' + String(error?.message || error)); }
    }

    scopeResult = result;
    link.grid_scope = { counted: result.counted, radius_km: result.radius_km,
      nearest_km: result.nearest[0]?.km ?? null,
      sources_ready: result.sources?.ready || null,
      sources_missing: result.sources?.missing || null };

    if (ensureScopeLayers(map)) {
      /* The bands are drawn in metres-per-pixel at the current zoom, so a
         ring means the distance it says at the zoom it was drawn. */
      const metresPerPixel = 156543.03392
        * Math.cos(origin[1] * Math.PI / 180) / Math.pow(2, map.getZoom());
      const features = result.bands.map(band => ({
        type: 'Feature',
        properties: { kind: 'band', pixels: (band.within_km * 1000) / metresPerPixel },
        geometry: { type: 'Point', coordinates: origin }
      })).concat(result.nearest.map(entry => ({
        type: 'Feature', properties: { kind: 'site' },
        geometry: { type: 'Point', coordinates: entry.at }
      })));
      setSourceData(map, SCOPE_SRC, { type: 'FeatureCollection', features });
    }

    const gl = window.maplibregl;
    if (gl?.Popup) {
      try {
        new gl.Popup({ maxWidth: '360px', closeOnClick: false })
          .setLngLat(origin)
          .setHTML(scopeHtml(result))
          .addTo(map);
      } catch (error) {
        noteFailure('grid scope card: ' + String(error?.message || error));
      }
    }
  }

  /* ── the mobile tray ──────────────────────────────────────────────────
     Vikram's phone acceptance, 2026-09-01: the six shell tool buttons at
     44px touch height are the right size to hit and the wrong size to keep
     on screen - a third of a portrait map behind buttons - and the switches
     that turn the grid lines and substations on live below the map, where a
     phone never looks. Both are composition faults, not engine faults: the
     44px rule is this cartridge's own coarse-pointer override, and the
     engine's switches work - toggled live in Chrome, the lines drew at once.

     So on a touch screen or a narrow window the six tool buttons collapse
     behind one chip, and two first-class chips - GRID and SUBS - stand on
     the map itself. They drive the engine's own checkboxes with real
     clicks, the same path enableTechnologyLayer has used all along, so the
     scada panel, the fullscreen curtain and these chips cannot disagree. */
  const TRAY_ID = 'gridatlas-mobile-tray';
  const GRID_LINE_LAYERS = ['400', '275', '220', '132', '66'];

  function trayTarget() {
    try {
      return matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700;
    } catch (_) { return false; }
  }

  function engineLayerBox(id) {
    return document.querySelector(
      '#scada-ui-container input[type=checkbox][data-layer-id="' + id + '"]');
  }

  function installMobileTray() {
    if (document.getElementById(TRAY_ID)) return;
    if (!trayTarget()) {
      link.mobile_tray = { installed: false, reason: 'fine pointer, wide window' };
      return;
    }
    const stack = document.querySelector('.map-controls');
    if (!stack) { link.failures.push('no map-controls for the tray'); return; }

    const style = document.createElement('style');
    style.id = TRAY_ID + '-style';
    style.textContent = SLD_STYLES.mobileTray(TRAY_ID);
    document.head.appendChild(style);

    stack.classList.add('gm-tools-collapsed');

    const tray = document.createElement('div');
    tray.id = TRAY_ID;

    const tools = document.createElement('button');
    tools.type = 'button';
    tools.textContent = 'Tools \u25b8';
    tools.setAttribute('aria-expanded', 'false');
    tools.addEventListener('click', (event) => {
      event.stopPropagation();
      const collapsed = stack.classList.toggle('gm-tools-collapsed');
      tools.textContent = collapsed ? 'Tools \u25b8' : 'Tools \u25be';
      tools.setAttribute('aria-expanded', String(!collapsed));
    });

    function quickChip(labelText, ids) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = labelText;
      chip.disabled = true;
      chip.setAttribute('aria-pressed', 'false');
      if (new URLSearchParams(location.search).has('repd_ref')) collapsed = true;

    function reflect() {
        const boxes = ids.map(engineLayerBox).filter(Boolean);
        chip.disabled = boxes.length === 0;
        chip.setAttribute('aria-pressed',
          String(boxes.length > 0 && boxes.every((box) => box.checked)));
      }
      chip.addEventListener('click', (event) => {
        event.stopPropagation();
        const boxes = ids.map(engineLayerBox).filter(Boolean);
        if (!boxes.length) return;
        const turnOn = boxes.some((box) => !box.checked);
        boxes.forEach((box) => { if (box.checked !== turnOn) box.click(); });
        reflect();
      });
      chip.gmReflect = reflect;
      return chip;
    }

    /* The tray tool. The shell owns .map-controls and the shell is
       immutable, so the button is added by this cartridge at runtime and
       removed again if the cartridge is not composed - there is no orphan
       control left behind claiming a feature that is not present. */
    (function addGridPointTool() {
      const tray = document.querySelector('.map-controls');
      if (!tray || document.getElementById('btn-gridpoint')) return;
      const button = document.createElement('button');
      button.className = 'map-ctrl-btn';
      button.id = 'btn-gridpoint';
      button.type = 'button';
      button.textContent = '\u25c8 Grid At Point';
      button.setAttribute('aria-pressed', 'false');
      button.title = 'Click anywhere on the map for the published network at the nearest mapped connection point';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        pointArmed = !pointArmed;
        button.setAttribute('aria-pressed', String(pointArmed));
        button.style.outline = pointArmed ? '1px solid currentColor' : '';
        link.grid_point_armed = pointArmed;
        if (!pointArmed) clearScope();
      });
      tray.appendChild(button);
    }());

    const grid = quickChip('\u26a1 Grid', GRID_LINE_LAYERS);
    const subs = quickChip('\u25c9 Subs', ['subs']);

    /* Arming is explicit. A map that analysed every stray tap would put a
       card over the thing the reader was trying to look at. */
    const scopeChip = document.createElement('button');
    scopeChip.type = 'button';
    scopeChip.textContent = '\u25ce Scope';
    scopeChip.setAttribute('aria-pressed', 'false');
    scopeChip.addEventListener('click', (event) => {
      event.stopPropagation();
      scopeArmed = !scopeArmed;
      scopeChip.setAttribute('aria-pressed', String(scopeArmed));
      if (!scopeArmed) clearScope();
      link.grid_scope_armed = scopeArmed;
    });

    const clearChip = document.createElement('button');
    clearChip.type = 'button';
    clearChip.textContent = '\u2715 Clear';
    clearChip.addEventListener('click', (event) => {
      event.stopPropagation();
      clearScope();
      clearLinks();
    });

    tray.appendChild(tools);
    tray.appendChild(grid);
    tray.appendChild(subs);
    tray.appendChild(scopeChip);
    tray.appendChild(clearChip);
    tray.addEventListener('click', (event) => event.stopPropagation());
    stack.insertBefore(tray, stack.firstChild);

    // The engine builds its switches only after the map loads; the chips
    // wake when the switches exist and follow them wherever they are
    // toggled from - scada panel, fullscreen curtain, or a deep link.
    document.addEventListener('change', (event) => {
      if (event.target?.dataset?.layerId) { grid.gmReflect(); subs.gmReflect(); }
    });
    let polls = 0;
    const poll = setInterval(() => {
      grid.gmReflect(); subs.gmReflect(); polls += 1;
      if (!grid.disabled || polls > 200) clearInterval(poll);
    }, 300);

    link.mobile_tray = {
      installed: true,
      tools_collapsed: true,
      grid_quick_layers: GRID_LINE_LAYERS.length,
      subs_quick: true
    };
  }

  function installGbConditions() {
    if (document.getElementById(GB_ID)) return;
    const stack = document.querySelector('.map-controls');
    if (!stack) { link.failures.push('no map-controls for the GB panel'); return; }

    const style = document.createElement('style');
    style.id = GB_ID + '-style';
    style.textContent = SLD_STYLES.gbConditions(GB_ID);
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = GB_ID;
    panel.dataset.open = '0';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'GB prices · historic ▸';
    button.setAttribute('aria-expanded', 'false');
    const body = document.createElement('div');
    body.className = 'gb-body';
    panel.appendChild(button);
    panel.appendChild(body);

    let loaded = false;
    button.addEventListener('click', (event) => {
      // The panel lives inside the map container, so without this the click
      // carries on to the map underneath and selects whatever is there.
      event.stopPropagation();
      event.preventDefault();
      const open = panel.dataset.open === '1';
      panel.dataset.open = open ? '0' : '1';
      button.textContent = open ? 'GB prices · historic ▸' : 'GB prices · historic ▾';
      button.setAttribute('aria-expanded', String(!open));
      // Fetched on first open, never at boot: nothing about the map should
      // wait on a third party, and most sessions never open this.
      if (!open && !loaded) {
        loaded = true;
        body.innerHTML = '<p class="gb-note">Reading the decade…</p>';
        renderGbConditions(body);
      }
    });
    panel.addEventListener('click', (event) => event.stopPropagation());
    stack.appendChild(panel);
    link.gb_panel_installed = true;
  }

  /* Never dereference a source without checking it is there.
     ----------------------------------------------------------------------
     addSource throws if the style is not loaded, and a source that failed to
     add reads back as null. Both happen: the basemap CDN served style.json and
     then no tiles at all on this estate tonight, and the cartridge now boots on
     the style rather than a painted frame precisely so it can work in that
     condition.

     The pin was guarded when that was found. Five call sites were not, and
     they are the ones that draw the links, the nodes and the whole layout — so
     the guarded convenience survived while the substance would have thrown.
     Codex's gate has been finding this class all night; this is the last of it
     in this file.

     Returning false rather than throwing means a missing source costs the
     drawing, not the card, the distances or the session. */
  function setSourceData(map, id, data) {
    try {
      const source = map?.getSource?.(id);
      if (!source || typeof source.setData !== 'function') {
        link.failures.push('source missing, nothing drawn: ' + id);
        return false;
      }
      source.setData(data);
      return true;
    } catch (error) {
      link.failures.push('source ' + id + ': ' + String(error?.message || error));
      return false;
    }
  }

  function interactiveLayerIds(map) {
    // Whatever the engine has made visible and interactive. Reading the style
    // rather than hard-coding ids keeps this working as layers come and go.
    try {
      return map.getStyle().layers
        .filter(layer => /^l-/.test(layer.id) && layer.type !== 'background')
        .map(layer => layer.id)
        .filter(id => {
          try { return map.getLayoutProperty(id, 'visibility') !== 'none'; }
          catch (_) { return false; }
        });
    } catch (_) {
      return [];
    }
  }

  function install(map) {
    installStyles();
    ensureLayers(map);

    /* Warm the substation payload immediately. It is 1.2 MB and every
       measurement needs it; until v9.54 it was first requested only after
       the arrival had finished waiting for the engine's layer controls,
       so a phone paid for the wait AND the fetch in series. The promise is
       cached, so the arrival reuses whatever this started. */
    try { loadSubstations(); } catch (_) { /* the arrival will retry */ }

    // The lines belong to the card. When the card closes, they go with it --
    // leaving neon on the map with nothing explaining it is how a screenshot
    // ends up quoted without its caveat.
    const popupWatcher = new MutationObserver(() => {
      if (link.links_drawn > 0 && !document.querySelector('.maplibregl-popup')) clearLinks();
    });
    try {
      popupWatcher.observe(map.getContainer(), { childList: true, subtree: true });
    } catch (error) {
      link.failures.push(String(error?.message || error));
    }

    // Registered after the engine's own click handler, so the engine's popup
    // opens first and this decorates it rather than racing it.
    // Measure and draw for one selection. Split out of the click handler so a
    // deep link, which opens a card without anybody clicking, goes through
    // exactly the same path.
    async function selectAt(origin, name, tech, fromSubstation, statedMw,
      expectedArrivalEpoch = null) {
      const fromCurrentArrival = Number.isInteger(expectedArrivalEpoch);
      if (fromCurrentArrival) {
        if (!arrivalGate.isCurrent(expectedArrivalEpoch)) return false;
      } else {
        invalidatePendingArrival('new-selection');
      }
      clearScope();
      // Keep a provisional declared block standing until the measured one
      // replaces it; clearing here would blank the card mid-arrival.
      if (!currentDeclared?.pending) currentDeclared = null;
      currentNearest400 = null;
      currentPolicy = null;
      if (fromSubstation) {
        // No fetch needed: the projects are already in the engine's own
        // source, and reading them there keeps one set of coordinates.
        const found = nearestProjects(map, origin[0], origin[1]);
        drawLinks(map, origin, name, tech, found.links, 'from-substation',
          null, found.loaded);
        return;
      }
      /* OFFSHORE MEASURES NOW.
         --------------------------------------------------------------------
         This used to return here with an empty link list and a card that
         explained why nothing was measured. It measures instead. An offshore
         project reaches an offshore substation, an export cable and a
         landfall before anything onshore - every word of that is still true
         and still printed - but the export cable does land at an onshore
         substation, so the distance to the nearest mapped one is a
         measurement of a real thing rather than a number with nothing behind
         it. Withholding it was over-caution.

         The route reasoning is not deleted; it moves from being the reason
         there is no number to being the caveat beside the number, which is
         where the estate puts every other thing a distance cannot answer.

         No onshore-only filter is applied, and the card says so. The pinned
         substation product carries the OSM `location` tag on zero of its
         5,800 features, and of the 14 whose NAME contains "offshore" at least
         4 are onshore substations serving an offshore farm - Hornsea at
         400/220 kV among them, which is exactly a landfall connection. A
         name-based filter would drop those four from the search it was meant
         to sharpen. Measured, not assumed; the module carries the counts. */
      const policy = coverage.policy(tech);
      currentPolicy = policy;
      if (!link.substations_qualifying) {
        injectStatusStyle();
        showStatus('Loading the substation data \u2014 the links need it.',
          'waiting');
      }
      const subs = await loadSubstations();
      if (fromCurrentArrival && !arrivalGate.isCurrent(expectedArrivalEpoch)) return false;
      if (!subs.length) {
        /* The register carries 5,800 substations; zero qualifying means the
           payload did not arrive, not that the map is empty here. Drawing
           nothing silently is how this looked broken on a phone. */
        injectStatusStyle();
        showStatus('The substation data did not load, so no links can be '
          + 'drawn. This is usually the network rather than the project.',
          'failed');
        return;
      }
      clearStatus();
      currentDeclared = resolveDeclaredConnection(currentRepdRef, origin, subs);
      currentNearest400 = nearestTransmission(origin, subs);
      drawLinks(map, origin, name, tech,
        nearestSubstations(origin[0], origin[1], subs), 'to-substation', statedMw);
      return true;
    }
    link.selectAt = selectAt;

    map.on('click', async (event) => {
      try {
        if (fromOwnUi(event)) return;
        const ids = interactiveLayerIds(map);
        if (!ids.length) return;
        let features = [];
        try { features = map.queryRenderedFeatures(event.point, { layers: ids }); }
        catch (_) { return; }
        if (!features.length) { clearLinks(); return; }

        // Either end of a link is a valid place to start. Whichever pixel was
        // clicked, the card that came up is the one the distances are written
        // onto, and the lines run to the other end.
        const hit = features.find(feature => {
          const properties = feature.properties || {};
          const tech = String(properties.tech || properties.type || '');
          return isProjectTech(tech) || feature.layer?.id === SUBS_LAYER_ID;
        });
        if (!hit) {
          /* The anchor is untouched: a project or substation click still
             draws the neons. Only a click that hit NEITHER reaches here,
             and only then if the reader armed the scope. */
          clearLinks();
          if (pointArmed) await runGridAtPoint(map, event.lngLat.lng, event.lngLat.lat);
          if (scopeArmed) await runGridScope(map, [event.lngLat.lng, event.lngLat.lat]);
          return;
        }

        const properties = hit.properties || {};
        const fromSubstation = hit.layer?.id === SUBS_LAYER_ID;
        const tech = String(properties.tech || properties.type || '');
        const origin = representativePoint(hit.geometry)
          || [event.lngLat.lng, event.lngLat.lat];
        const name = properties.name || properties.SiteName || properties['Site Name']
          || (fromSubstation ? 'Unnamed substation' : 'Unnamed project');
        const stated = Number(properties.capacity);
        currentRepdRef = fromSubstation
          ? null : String(properties.repd_ref || properties.repdRef || '');
        await selectAt(origin, name, tech, fromSubstation,
          Number.isFinite(stated) && stated > 0 ? stated : null);
      } catch (error) {
        link.failures.push(String(error?.message || error));
      }
    });

  /* ── arrival by identity ─────────────────────────────────────────────
     The search cartridge resolves repd_ref against the register - DuckDB
     over the pinned parquet - flies there and opens the card. When a link
     carries only that identity, this lane used to stop at its URL guards
     while the card opened anyway, which reads as a broken map. The register
     knows the coordinates and technology better than any URL restatement,
     so when the identity lane has resolved, its published result is the
     arrival. One resolver per composition; this lane only consumes.

     The budget is generous because the identity lane boots a 35.7 MB query
     engine first on a cold phone. Terminal failure or absence returns null
     and is the caller's decision to record. */
  async function waitForResolvedIdentity(options = {}) {
    const announce = options.announce !== false;
    /* v9.44 gave this a fixed 120s budget and Vikram's phone exceeded it:
       the identity lane boots a 35.7 MB query engine first, the budget
       expired, this lane gave up permanently, and the card then opened
       anyway - a resolved identity with nothing computed for it. The
       estate's own late-layers lesson, relearned: a fixed budget is always
       the wrong number. RESOLVED, FAILED and ABSENT are terminal; the only
       unbounded case is "still working", and waiting through it is the
       correct behaviour. The user is told what is being waited for; ten
       minutes is kept as a last-resort stop for a lane that died silently. */
    const started = Date.now();
    let told = false;
    for (;;) {
      const dl = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link;
      if (dl) {
        if (dl.status === 'RESOLVED') { if (told) clearStatus(); return dl; }
        if (dl.status === 'FAILED' || dl.status === 'ABSENT'
            || dl.status === 'NOT_IN_ACTIVE_REGISTER' || dl.status === 'IDENTIFIED_NO_GEOMETRY'
            || dl.status === 'CANCELLED') {
          if (told) clearStatus();
          return dl;
        }
      }
      const waited = Date.now() - started;
      if (announce && !told && waited > 6000) {
        told = true;
        injectStatusStyle();
        showStatus('Resolving the project against the register \u2014 a cold '
          + 'phone boots the query engine first, and this can take a minute.',
          'waiting');
      }
      if (waited > 600000) {
        link.failures.push('identity lane still not terminal after 10 minutes');
        if (told) clearStatus();
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

    // A deep link opens the project card on its own, with no click anywhere.
    // Arriving that way is how most people reach the Atlas -- the MAP button in
    // Pipeline News sends them here -- so the measurement has to run for it
    // too, or the card that brought them arrives with nothing on it.
    async function runDeepLink(expectedArrivalEpoch = null) {
      try {
        const q = new URLSearchParams(window.location.search);
        const epoch = Number.isInteger(expectedArrivalEpoch)
          ? expectedArrivalEpoch : claimPendingArrival(window.location.search);
        if (!arrivalGate.isCurrent(epoch)) return false;
        link.arrival_reconciliation = {
          status: 'MEASUREMENT_CLAIMED', epoch,
          owner_epoch: window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.owner_epoch ?? null
        };
        /* Number(null) is 0, not NaN, so a link with no coordinates used to
           pass the finite guard as Null Island and only the technology
           guard stopped it. Absent now means absent. */
        const rawLon = q.get('longitude');
        const rawLat = q.get('latitude');
        const receiverPlan = deepLinkPlan(rawLon, rawLat, q.get('repd_ref'));
        let lon = receiverPlan.longitude;
        let lat = receiverPlan.latitude;
        const repdRef = receiverPlan.repd_ref;
        let tech = String(q.get('technology') || '');
        let name = q.get('project') || (repdRef ? 'REPD ' + repdRef : 'Shared map point');
        let stated = Number(q.get('capacity_mw'));
        const suppliedStatus = String(q.get('status') || '').trim();
        currentCapacityMw = Number.isFinite(stated) && stated > 0 ? stated : null;

        /* zoom: set on every deep link, and until now read by nobody.
           ------------------------------------------------------------------
           The deep scan of 202609012230 compared both sides of the contract:
           Pipeline News sets seven parameters and GridAtlas read six. There is
           no get('zoom') anywhere in this repository. Arrival zoom came from
           `map.flyTo({ zoom: 12 })` hard-coded in the immutable shell, and
           Pipeline News happens to send 12 - so the two agreed by coincidence,
           and the day somebody tuned the sending side nothing would have moved.

           The shell cannot be edited, so the cartridge honours the parameter
           after the shell has finished its own move. Bounded to what MapLibre
           and the payload can actually render, and a value outside that range
           is recorded rather than clamped silently. */
        const rawZoom = q.get('zoom');
        const requestedZoom = rawZoom === null ? null : Number(rawZoom);
        const zoomUsable = requestedZoom !== null && Number.isFinite(requestedZoom)
          && requestedZoom >= 3 && requestedZoom <= 18;
        if (rawZoom !== null && !zoomUsable) {
          link.failures.push('deep link: unusable zoom "' + rawZoom + '"');
        }
        link.requested_zoom = zoomUsable ? requestedZoom : null;

        /* 12 shows 3.6x more ground at 1400 px than at 393, so a shared
           link opens wide on a desktop. Frame by viewport, not by number. */
        const framed = () => Math.min(18, Math.max(3, requestedZoom
          + Math.log2(Math.max(innerWidth, 320) / 393)));
        function honourRequestedZoom(map) {
          if (repdRef) return; // Frame the project and connection endpoints after selection.
          if (!zoomUsable) return;
          /* One shot, after the shell's own flyTo has settled. Racing it
             would be a fight the shell wins, and re-applying on every idle
             would take the map away from a user who has since zoomed. */
          let done = false;
          const apply = () => {
            if (done) return;
            done = true;
            try {
              map.off('idle', apply);
              if (Math.abs(map.getZoom() - framed()) < 0.01) {
                link.zoom_applied = 'already there';
                return;
              }
              map.easeTo({ zoom: framed(), duration: 400 });
              link.zoom_applied = framed();
            } catch (error) {
              noteFailure('deep link zoom: ' + String(error?.message || error));
            }
          };
          try { map.once('idle', apply); } catch (_) { /* shimmed map in a proof */ }
          // A map that never goes idle must not swallow the request.
          setTimeout(apply, 2600);
        }
        const coordsUsable = () => Number.isFinite(lon) && Number.isFinite(lat)
          && Math.abs(lon) <= 180 && Math.abs(lat) <= 90
          && !(Math.abs(lon) < 1e-9 && Math.abs(lat) < 1e-9);

        /* Vikram, phone acceptance 13:01: "arrive in full screen mode from
           pipeline news with all the clutter minimised". On a touch screen
           the normal page is a small map fighting a popup, chips, a HUD and
           a panel below; fullscreen is the only honest arrival surface. The
           shell's own control does it - CSS classes, and on an iPhone the
           element fullscreen API simply does not exist, so nothing here is
           gesture-gated - and the tray keeps the tool buttons collapsed. */
        if ((q.get('repd_ref') !== null || coordsUsable()) && trayTarget()) {
          try {
            // Full-viewport arrival CSS keeps controls visible without automatic element fullscreen.
            link.arrival_fullscreen = false;
            setTimeout(() => { try { map.resize(); } catch (_) { /* cosmetic */ } }, 120);
          } catch (error) {
            link.failures.push('arrival fullscreen: ' + String(error?.message || error));
          }
        }

        /* A VALID LINK POINT ANSWERS FIRST; THE REGISTER VERIFIES IT.
           ---------------------------------------------------------
           v9.91 put `await waitForResolvedIdentity()` before selectAt for every
           repd_ref. Across Pipeline News that serialized a 35.7 MB query
           engine ahead of 8,743 links that already carried a usable point;
           2,430 then waited only to fall back to that same point. Coordinates
           are enough for a geometric measurement. They are therefore used at
           once, explicitly as link-supplied, while the one identity owner
           verifies them concurrently. A different resolved point replaces the
           selection and is measured again; FAILED/ABSENT never erases a valid
           supplied point. A ref-only link still waits because it has no point
           from which an honest measurement can be made. */
        let identityVerification = null;
        if (receiverPlan.route === 'MEASURE_LINK_FIRST' && repdRef) {
          link.origin_source = 'link-supplied';
          link.deep_link_identity = 'verifying-concurrently';
          link.identity_verification = {
            status: 'PENDING', repd_ref: repdRef, supplied_coordinates_used: true
          };
          identityVerification = waitForResolvedIdentity({ announce: false })
            .then((owner) => ({
              resolved: owner?.status === 'RESOLVED' ? owner : null,
              terminal: owner?.status || 'UNKNOWN'
            }))
            .catch((error) => ({ resolved: null, terminal: 'FAILED', error }));
        } else if (receiverPlan.route === 'WAIT_FOR_REGISTER') {
          /* A ref-only link has no safe provisional geometry. This is the one
             case that must await the identity owner before measuring. */
          const owner = await waitForResolvedIdentity();
          if (!arrivalGate.isCurrent(epoch) || owner?.status === 'CANCELLED') return;
          if (owner?.status === 'RESOLVED') {
            const resolved = owner;
            const rLon = Number(resolved.longitude);
            const rLat = Number(resolved.latitude);
            if (Number.isFinite(rLon) && Number.isFinite(rLat)
              && Math.abs(rLon) <= 180 && Math.abs(rLat) <= 90
              && !(Math.abs(rLon) < 1e-9 && Math.abs(rLat) < 1e-9)) {
              lon = rLon;
              lat = rLat;
              link.origin_source = 'register';
            }
            if (typeof resolved.technology === 'string' && resolved.technology) {
              tech = resolved.technology;
            }
            if (resolved.name) name = String(resolved.name);
            const cap = Number(resolved.capacity_mw);
            if (Number.isFinite(cap) && cap > 0) stated = cap;
            currentCapacityMw = Number.isFinite(stated) && stated > 0 ? stated : null;
            link.deep_link_identity = 'resolved-by-search-lane';
          } else if (owner?.status === 'IDENTIFIED_NO_GEOMETRY') {
            link.deep_link_identity = 'identified-no-geometry';
            link.identity_verification = {status:owner.status, repd_ref:repdRef, name:owner.name, identity_source:owner.identity_source};
            injectStatusStyle();
            // The identity owner displays the named missing-location details once.
            return;
          } else if (owner?.status === 'NOT_IN_ACTIVE_REGISTER') {
            link.origin_source = 'not-in-active-register-no-supplied-point';
            link.deep_link_identity = 'terminal-not-in-active-register';
            link.identity_verification = {
              status: 'NOT_IN_ACTIVE_REGISTER', repd_ref: repdRef,
              supplied_coordinates_kept: false,
              official_active_register_match: false
            };
            injectStatusStyle();
            showStatus('REPD ' + repdRef + ' is not in the active-register '
              + 'snapshot, and this link supplies no coordinates from which '
              + 'to measure. No official status or location is inferred.',
              'unavailable');
            return;
          } else {
            injectStatusStyle();
            const message = String(owner?.message || 'identity loader unavailable');
            showStatus('The active-register identity check failed: ' + message
              + '. No location was supplied, so the grid measurement cannot '
              + 'start until the check succeeds.', 'failed');
            retryArrival = retryIdentityOwnerThenArrival;
            return;
          }
        } else {
          link.origin_source = 'link-supplied';
        }

        if (!coordsUsable()) return;

        /* Put the supplied point on screen with the supplied-point answer.
           The old rule flew only links without repd_ref and therefore left a
           valid coordinate link waiting for the register just to move the
           camera. If verification later finds a different point, the identity
           lane and the reconciliation below replace it together. */
        try {
          const arrivalZoom = zoomUsable ? requestedZoom : 12;
          map.flyTo({ center: [lon, lat], zoom: arrivalZoom,
            duration: 1200, essential: true });
          link.camera_from_link = { longitude: lon, latitude: lat,
            zoom: arrivalZoom, reason: identityVerification
              ? 'supplied coordinates while register verification runs'
              : (repdRef ? 'resolved repd_ref coordinates'
                : 'no repd_ref, so no other lane flies') };
        } catch (error) {
          noteFailure('deep link camera: ' + String(error?.message || error));
        }
        honourRequestedZoom(map);
        /* An unrecognised technology used to abandon the whole arrival.
           `return` cost the card, the ring, the nearest-substation
           measurement, the declared connection and the substation layer -
           all arithmetic over two coordinates and a register row. Only the
           one technology layer needs the id, so that is all it costs now.
           PROJECT_TECHS accepts 11,065 of the 11,069 ids the register
           writes. What the guard really catches is a link that omits or
           garbles the parameter, or carries an id from a newer register,
           and for all three the answer is the map, not a blank. Recorded on
           its own surface, not in `link.failures`, which since 202609011434
           means the arrival lost something. This one did not. */
        let technologyKnown = isProjectTech(tech);
        /* enabled starts false and STAYS false until enableTechnologyLayer()
           actually turns a control on -- that is the one place the truth
           lives. It used to read `enabled: technologyKnown`, which is
           membership of PROJECT_TECHS, not the state of any control: for
           wind_onshore, wind_offshore and other, that set says true while
           no such data-layer-id has ever existed, so the field read green
           on 2,508 of 7,680 register rows while the layer sat off. A field
           nothing else corrects is a field that lies for as long as the
           page is open, and this was read by every prior proof. */
        link.technology_layer = {
          requested: tech || null,
          layer_id: technologyKnown ? layerIdForBucket(tech) : null,
          enabled: false,
          reason: technologyKnown ? null
            : 'deep link: unknown technology "' + tech + '" - the arrival '
              + 'continues and this layer alone is not switched on'
        };
        // Turn the substations on. Arriving from the MAP button in Pipeline
        // News, the whole point is to see the project against the network, and
        // a user who has to find a checkbox first has been handed a puzzle
        // rather than an answer. The engine owns the layer, so this ticks its
        // own control rather than reaching past it into the map.
        // The dashboard is built from the engine's own data and does not
        // exist yet on a cold load -- measured at zero checkboxes twenty
        // seconds in. Ticking a control that has not been rendered silently
        // did nothing, and the layers the arrival depends on stayed off.
        // Named, so Try again re-runs exactly the arrival rather than
        // reloading and paying for the whole engine a second time.
        let currentArrival = Object.freeze({ lon, lat, name, tech, stated, repdRef, suppliedStatus });
        const enableBoth = () => {
          if (!arrivalGate.isCurrent(epoch)) return false;
          enableSubstationLayer();
          link.technology_layer.reason = 'Other projects are available in Layers; arrival shows the selected project and connections.';
          return true;
        };
        const arrive = async () => {
          clearStatus();
          const ready = await waitForLayerControls(12000);
          enableBoth();
          // Late is not never. If the dashboard turns up after the budget, the
          // layers still go on, without the user having to do anything.
          if (!ready) watchForLayerControls(enableBoth);
          return ready;
        };
        retryArrival = () => { runDeepLink(); };
        /* Measure first. The distances are arithmetic over substation
           coordinates and need no layer control, no dashboard and no
           painted basemap; only the layers need the engine's controls.
           Until v9.54 this awaited arrive() - up to twelve seconds - before
           the measurement was even attempted, and Vikram's West Burton
           journey on a phone showed exactly what that buys: a card, and
           nothing beside it, for long enough to conclude the map is
           broken. The layer switch-on runs alongside and finishes whenever
           the engine is ready. */
        const layersReady = arrive();
        async function runArrivalSelection(arrival, waitForOwnerCard = false,
          expectedArrivalEpoch = epoch) {
          if (!arrivalGate.isCurrent(expectedArrivalEpoch)) return false;
          /* A ref-only arrival already paid for canonical identity, so it can
             briefly yield to that owner's richer card. A supplied coordinate
             arrival must not wait for a card before it can measure: it creates
             the explicit link-provenance card below on the same turn. */
          if (waitForOwnerCard) {
            for (let i = 0; i < 40; i += 1) {
              if (document.querySelector('.maplibregl-popup-content')) break;
              const idStatus = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.status;
              if (idStatus === 'FAILED' || idStatus === 'ABSENT') break;
              await new Promise(resolve => setTimeout(resolve, 250));
              if (!arrivalGate.isCurrent(expectedArrivalEpoch)) return false;
            }
          }
          /* The card must exist BEFORE the lines. The popup watcher enforces
             "the lines belong to the card" and clears any drawing standing
             with no card on screen - watched live: a register-absent arrival
             drew five links and the watcher wiped them in the same breath,
             because the fallback card was opened after the measurement.
             ensureArrivalCard is a no-op when a card is already up, so the
             resolved-register path is unchanged. */
          currentRepdRef = arrival.repdRef;
          ensureArrivalCard(arrival.lon, arrival.lat, arrival.name,
            arrival.tech, arrival.stated, arrival.repdRef, arrival.suppliedStatus);
          /* Answer now, measure next. Everything in this block came from
             the made Order and the link; nothing here waits on a network. */
          currentDeclared = provisionalDeclaredConnection(currentRepdRef);
          if (currentDeclared) injectDeclaredOnly();
          try {
            if (capturedMap) setPin(capturedMap,
              [arrival.lon, arrival.lat], arrival.name, arrival.tech);
          }
          catch (_) { /* the measurement will draw it */ }
          link.deep_linked = true;
          const selected = await selectAt([arrival.lon, arrival.lat], arrival.name,
            arrival.tech, false,
            Number.isFinite(arrival.stated) && arrival.stated > 0
              ? arrival.stated : null, expectedArrivalEpoch);
          return selected !== false && arrivalGate.isCurrent(expectedArrivalEpoch);
        }
        const firstStarted = performance.now();
        const firstSelectionCurrent = await runArrivalSelection(currentArrival,
          Boolean(repdRef && !identityVerification), epoch);
        if (!firstSelectionCurrent) return;
        link.first_coordinate_answer_ms = Math.round((performance.now() - firstStarted) * 10) / 10;
        link.first_coordinate_origin = link.origin_source;

        if (identityVerification) {
          /* Attach reconciliation only after the supplied-point selection has
             completed. A warm identity can resolve on the first microtask;
             sequencing it here prevents two selections racing each other. */
          continueVerifiedArrival(arrivalGate, epoch, identityVerification,
            async ({ resolved, terminal, error }) => {
            if (!resolved) {
              const ownerState = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link || null;
              const message = error ? String(error?.message || error)
                : String(ownerState?.message || '');
              link.origin_source = terminal === 'NOT_IN_ACTIVE_REGISTER'
                ? 'link-supplied-not-in-active-register'
                : 'link-supplied-register-' + String(terminal).toLowerCase();
              link.deep_link_identity = 'terminal-' + String(terminal).toLowerCase();
              link.identity_verification = {
                status: terminal, repd_ref: repdRef,
                supplied_coordinates_kept: true,
                arrival_fields: {
                  name: currentArrival.name,
                  technology: currentArrival.tech,
                  capacity_mw: Number.isFinite(currentArrival.stated)
                    ? currentArrival.stated : null,
                  supplied_status: currentArrival.suppliedStatus || null
                },
                official_active_register_match: false,
                message: message || null
              };
              markArrivalIdentityState(terminal, repdRef, message);
              if (terminal === 'FAILED') {
                injectStatusStyle();
                retryArrival = retryIdentityOwnerThenArrival;
                showStatus('The active-register identity check failed'
                  + (message ? ': ' + message : '.')
                  + ' The supplied point and measurement remain on the map.',
                  'failed');
              }
              return;
            }

            const rLon = Number(resolved.longitude);
            const rLat = Number(resolved.latitude);
            const resolvedPointUsable = Number.isFinite(rLon) && Number.isFinite(rLat)
              && Math.abs(rLon) <= 180 && Math.abs(rLat) <= 90
              && !(Math.abs(rLon) < 1e-9 && Math.abs(rLat) < 1e-9);
            if (!resolvedPointUsable) {
              link.origin_source = 'link-supplied-register-without-point';
              link.deep_link_identity = 'resolved-without-usable-point';
              link.identity_verification = {
                status: 'RESOLVED_WITHOUT_USABLE_POINT', repd_ref: repdRef,
                supplied_coordinates_kept: true
              };
              return;
            }

            const discrepancyKm = Math.round(
              distanceKm(currentArrival.lon, currentArrival.lat, rLon, rLat) * 1000
            ) / 1000;
            link.origin_discrepancy_km = discrepancyKm;
            link.deep_link_identity = 'resolved-by-search-lane';
            if (discrepancyKm <= 0.001 && resolved.name === currentArrival.name && resolved.technology === currentArrival.tech && Number(resolved.capacity_mw) === Number(currentArrival.stated)) {
              link.origin_source = 'link-supplied-register-verified';
              markArrivalIdentityState('VERIFIED', repdRef);
              link.identity_verification = {
                status: 'VERIFIED', repd_ref: repdRef,
                discrepancy_km: discrepancyKm, recomputed: false
              };
              return;
            }

            const rTech = typeof resolved.technology === 'string' && resolved.technology
              ? resolved.technology : currentArrival.tech;
            const rName = resolved.name ? String(resolved.name) : currentArrival.name;
            const rCap = Number(resolved.capacity_mw);
            const rStated = Number.isFinite(rCap) && rCap > 0 ? rCap : currentArrival.stated;
            const verifiedArrival = Object.freeze({
              lon: rLon, lat: rLat, name: rName, tech: rTech,
              stated: rStated, repdRef, suppliedStatus: currentArrival.suppliedStatus
            });
            currentArrival = verifiedArrival;
            technologyKnown = isProjectTech(verifiedArrival.tech);
            currentCapacityMw = Number.isFinite(verifiedArrival.stated)
              && verifiedArrival.stated > 0 ? verifiedArrival.stated : null;
            link.origin_source = 'register-corrected-after-link';
            link.identity_verification = {
              status: 'RECOMPUTING', repd_ref: repdRef,
              discrepancy_km: discrepancyKm, recomputed: false
            };
            try {
              map.flyTo({ center: [verifiedArrival.lon, verifiedArrival.lat],
                zoom: zoomUsable ? requestedZoom : 12,
                duration: 800, essential: true });
              await runArrivalSelection(verifiedArrival, false, epoch);
              enableBoth();
              link.identity_verification.status = 'RECOMPUTED';
              link.identity_verification.recomputed = true;
            } catch (reconcileError) {
              link.identity_verification.status = 'RECOMPUTE_FAILED';
              link.identity_verification.message =
                String(reconcileError?.message || reconcileError);
              noteFailure('deep link identity reconciliation: '
                + link.identity_verification.message);
            }
          }).catch((reconcileError) => {
            if (!arrivalGate.isCurrent(epoch)) return;
            link.identity_verification = {
              status: 'RECONCILIATION_FAILED', repd_ref: repdRef,
              supplied_coordinates_kept: true,
              message: String(reconcileError?.message || reconcileError)
            };
            noteFailure('deep link identity reconciliation: '
              + link.identity_verification.message);
          });
        }
        await layersReady;
        return arrivalGate.isCurrent(epoch);
      } catch (error) {
        link.failures.push('deep link: ' + String(error?.message || error));
        return false;
      }
    }
    rerunDeepLink = runDeepLink;

    /* THE ARRIVAL MUST NEVER RUN WHILE NOBODY CAN SEE IT, AND MUST NEVER
       BE ONE-SHOT.
       --------------------------------------------------------------------
       Reported live by the architect on his own iPhone, twice, on two
       different projects: menu bar fine, attribution fine, basemap fully
       painted -- and the camera sat at the default UK-wide view, no card,
       no links. Both arrivals were opened from Pipeline News' MAP control,
       which carries target="_blank" on touch devices. An independent audit
       today reproduced the mechanism exactly: a deep link loaded with
       document.hidden === true drew zero layer controls at 40s, the camera
       never left its default position, and it recovered 2.5s after being
       made visible -- because MapLibre's flyTo() and the engine's own
       paint-driven boot both depend on requestAnimationFrame, which iOS
       Safari does not tick in a tab that is not composited. Calling
       map.flyTo() there does not throw and is not a failure this cartridge
       can see: the animation is simply never given a frame to advance, so
       the camera stays exactly where it started, forever, even once the
       tab is later brought to the front -- because this function had
       already run to its own conclusion and nothing called it again.

       So: never START the arrival until the document is actually visible,
       and never leave an arrival that has not produced a visible outcome
       stranded -- run it again the first time the tab is genuinely seen. */
    let arrivalAttempts = 0;
    const MAX_AUTO_ARRIVAL_ATTEMPTS = 5;   // a real, non-visibility failure must still stop retrying
    function arrivalHasVisibleOutcome() {
      // Both already-published, already-relied-upon fields: links_drawn is
      // read the same way by the electron-flow visibility listener just
      // below, and the not-in-active-register message is this cartridge's
      // own genuine "nothing more to show" terminal state.
      return link.links_drawn > 0
        || link.origin_source === 'not-in-active-register-no-supplied-point';
    }
    function attemptArrival() {
      if (document.visibilityState !== 'visible') return;
      arrivalAttempts += 1;
      link.arrival_attempts = arrivalAttempts;
      void runDeepLink();
    }
    if (document.visibilityState === 'visible') {
      attemptArrival();
    } else {
      link.arrival_deferred_for_visibility = true;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (arrivalHasVisibleOutcome()) return;
      if (arrivalAttempts >= MAX_AUTO_ARRIVAL_ATTEMPTS) return;
      link.arrival_resumed_on_visibility = (link.arrival_resumed_on_visibility || 0) + 1;
      attemptArrival();
    });

    // Escape clears, the way a game HUD does.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') clearLinks();
    });

    installGbConditions();
    installVersionLedger();
    installMobileTray();

    window.addEventListener('resize', boundCardToMap);
    map.on('resize', boundCardToMap);
    boundCardToMap();

    // A backgrounded tab should not keep an animation frame loop alive.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAnimation();
      else if (link.links_drawn > 0 && capturedMap) startAnimation(capturedMap);
    });
  }

  /* ── capture the map ─────────────────────────────────────────────────── */

  function attach(map) {
    if (capturedMap) return;
    capturedMap = map;
    link.map_captured = true;
    const boot = () => {
      try { install(map); }
      catch (error) { link.failures.push(String(error?.message || error)); }
      try { installSld(map); }
      catch (error) { link.failures.push('sld: ' + String(error?.message || error)); }
    };
    /* Boot when the style is ready, not when a frame has painted.
       ------------------------------------------------------------------
       This waited on map.once('load'), which maplibre fires only after the
       first frame is on screen -- and that needs basemap tiles. Watched live:
       the CARTO style.json, tiles.json and sprite all returned 200 and then
       not one vector tile was fetched, so the map stayed black, 'load' never
       came, and the whole grid-maths layer never installed. The bare shell
       failed identically, which is how the cartridge was ruled out.

       Nothing here needs a painted frame. Sources and layers need a parsed
       STYLE, and the distances need no map at all: they are arithmetic over
       substation coordinates. Tying them to the basemap made an unrelated CDN
       a single point of failure for the measurement.

       So: whichever of style.load or load arrives first, and failing both, a
       timer. A basemap that never paints is a bad map, not a reason to have
       no maths. */
    if (map.isStyleLoaded?.()) { link.boot_trigger = 'already-loaded'; boot(); }
    else {
      let booted = false;
      const bootOnce = (trigger) => {
        if (booted) return;
        booted = true;
        link.boot_trigger = trigger;
        boot();
      };
      map.once('style.load', () => bootOnce('style.load'));
      map.once('load', () => bootOnce('load'));
      setTimeout(() => {
        // Only if a style is actually there to hang layers on. Booting without
        // one would fail on the first addSource and lose the real reason.
        if (booted) return;
        let hasStyle = false;
        try { hasStyle = Boolean(map.getStyle?.()); } catch (error) { hasStyle = false; }
        if (hasStyle) {
          link.failures.push('basemap never finished painting; booted on the style alone');
          bootOnce('timeout');
        } else {
          link.failures.push('no style after 8s; the grid maths cannot install');
        }
      }, 8000);
    }
  }

  // The engine keeps its map in a closure and returns nothing, so the only
  // clean handle is the constructor -- and the engine builds its map inside
  // initVentusMap, which runs after this file, so it is still ours to wrap.
  try {
    const gl = window.maplibregl;
    if (gl && typeof gl.Map === 'function' && !gl.Map.__gridatlasNeonWrapped) {
      const OriginalMap = gl.Map;
      function PatchedMap(...args) {
        const instance = new OriginalMap(...args);
        try { attach(instance); }
        catch (error) { link.failures.push(String(error?.message || error)); }
        return instance;
      }
      PatchedMap.prototype = OriginalMap.prototype;
      PatchedMap.__gridatlasNeonWrapped = true;
      Object.setPrototypeOf(PatchedMap, OriginalMap);
      gl.Map = PatchedMap;
    } else if (!gl) {
      link.failures.push('maplibregl unavailable when the neon cartridge loaded');
    }
  } catch (error) {
    link.failures.push(String(error?.message || error));
  }

  /* ══════════════════════════════════════════════════════════════════════
     PART 3 — the SLD sandbox, ported from
     globalgrid2050/solar-bess-topology-v7/gis-sld-financial-sandbox.

     WHAT CHANGED IN THE PORT, AND WHY
     ---------------------------------
     The sandbox is a working engine and the arithmetic below is its
     arithmetic, carried across unchanged. Three things are deliberately
     different.

     1. ONE EARTH RADIUS. The sandbox measures cable length with
        atlasHaversineKm on R = 6378.137 but builds every rectangle, offset
        and projection with turf.destination, whose default is 6371.0088. It
        therefore mixes two radii inside one drawing: a 0.112% disagreement
        between where a thing IS and how far away it is said to be. That is
        the exact defect Ventusltd/grid-distance-maths was created to end.
        The Atlas ships no turf, so every geometric operation here is the
        canonical one on R_ATLAS and the mixture cannot recur.

     2. GRAB, DO NOT MODE-SWITCH. The sandbox moves the array by arming a
        mode and clicking a destination, and edits a route by dropping pins
        and committing them. Here the array is dragged by grabbing it, the
        rotation has a handle on its boundary, and route vertices are
        dragged, inserted on a segment and removed with a double click.
        Everything recomputes live while the pointer is down.

     3. THE ELECTRON FLOW CARRIES THROUGH. The travelling pulse used for the
        substation links runs along the 33 kV collectors and the export cable
        too, in the direction power actually flows: block, to customer
        substation, to grid node.

     WHAT IT STILL IS NOT
     --------------------
     A layout, not a design. Straight-line geometry with no wayleave,
     crossing, terrain, ground condition or consent content, and no
     confirmation that any of it can connect. The caveat block travels with
     it.
     ══════════════════════════════════════════════════════════════════════ */

  const SLD = {
    M2_PER_ACRE: 4046.86,
    BESS_M2_PER_MWH: 85,
    BESS_ASPECT: 2.5,
    BLOCK_SPACING_KM: 0.01,
    BOUNDARY_BUFFER_KM: 0.02,
    ARRAY_OFFSET_KM: 0.2
  };

  const SRC_SLD = 'gridatlas-sld';
  const SLD_LAYERS = {
    boundary: 'l-sld-boundary',
    boundaryLine: 'l-sld-boundary-line',
    block: 'l-sld-block',
    bess: 'l-sld-bess',
    radial: 'l-sld-radial',
    radialFlow: 'l-sld-radial-flow',
    cable: 'l-sld-cable',
    cableGlow: 'l-sld-cable-glow',
    cableFlow: 'l-sld-cable-flow',
    cableFlowB: 'l-sld-cable-flow-b',
    node: 'l-sld-node',
    pin: 'l-sld-pin',
    handle: 'l-sld-handle',
    label: 'l-sld-label'
  };

  // Muted SCADA, same family as the substation links.
  const SLD_COLOUR = {
    boundary: '#3f7fbf',
    block: '#5fbdc2',
    bess: '#b06ac0',
    radial: '#6fb582',
    cable: '#d9963c',
    node: '#e0b050',
    pin: '#bfe9ee',
    handle: '#d8c96a'
  };

  /* Financial inputs are kept per topology because that is how the original
     sandbox works. These are its post-migration defaults: the old HTML stores
     several development values as GBP/MW and migrateFinanceUnitsToWp converts
     them to GBP/Wp before the first calculation. Keeping the converted values
     here makes the units visible and avoids a hidden one-million multiplier. */
  const FINANCE_DEFAULTS = Object.freeze({
    price: 65, other: 0, yield: 1000, bifacial: 5, losses: 2, deg: 0.4,
    opex: 25000, epc_ex: 0.30, flood: false, flood_rate: 0.03,
    modules: 0.15, other_capex: 0.20, fixed_capex: 1500000, cont: 7,
    loss_dc_string: 0, loss_lv_dc: 0, loss_lv_ac: 0, loss_tx: 0,
    loss_other: 0, bess_mw: 0, bess_mwh: 0, bess_capex: 0,
    bess_cycles: 0, bess_spread: 0, bess_eff: 88,
    dev_stage: '0.100', dev_cost_mw: 0.1, dev_module_mwp: 0.15,
    dev_epc_mw: 0.5, dev_owner_mw: 0.1, dev_grid_mw: 0.1,
    dev_exit_mwp: 1.35, dev_npv_mwp: 1.2, dev_success: 15, dev_years: 4,
  });
  const freshFinanceInputs = () => ({ ...FINANCE_DEFAULTS });

  const sld = {
    active: false,
    gridNode: null,          // the substation the scheme connects to
    gridNodeName: '',
    gridNodeVoltage: '',
    arrayCentre: null,       // null = derived from the grid node and array size
    rotationDeg: 0,
    routePins: [],           // user vertices between customer substation and grid node
    stats: null,
    projectName: null,
    // The capacity the register states for this project, and what that figure
    // is taken to mean. REPD does not reliably distinguish, which is why the
    // basis is a user choice and not an assumption.
    targetMw: null,
    targetBasis: 'unstated',
    fitResidualPct: null,
    financeOpen: false,
    cableKm: 0,
    straightKm: 0,
    dragging: null,
    inputs: {
      mode: 'string',
      mod_wp: 660, mod_l: 2.38, mod_w: 1.30, gcr: 0.45, gross_factor: 1.35,
      // 18 strings, which is the ORIGINAL sandbox's own default. It was briefly
    // changed to 23 here on the reasoning that 18 gives a block DC/AC of
    // 0.945 - an array smaller than its inverters. That reasoning was applied
    // without checking the reference, and the reference is explicit: "28
    // string inverters rated at 352 kVA create a skid block of approximately
    // 9,856 kVA BEFORE TRANSFORMER AND GRID LIMITATIONS". Oversizing the
    // inverters against an 8.96 MVA skid is the design, not an error in it.
    // A port does not get to improve its reference by guessing.
    x_mods: 28, z_strings: 18, y_invs: 28, s_subs: 5, b_cols: 6,
      dc_ac_ratio: 1.20, string_inv_kva: 352, string_skid_mva: 8.96,
      // The original has a complete second physical-input set for central
      // topology. Editing one tab must not rewrite the other tab's module,
      // mounting, land or BESS case.
      mod_wp_c: 660, mod_l_c: 2.38, mod_w_c: 1.30, gcr_c: 0.45,
      gross_factor_c: 1.35,
      inv_ac_mw_c: 4.4, inv_dc_mw_c: 5.28, central_skid_mva_c: 4.4,
      x_mods_c: 28, str_per_cb_c: 24, inv_per_mv_c: 1, mv_per_ring_c: 4, rings_c: 4
    },
    finance: {
      string: freshFinanceInputs(),
      central: freshFinanceInputs(),
    }
  };
  window.__GRIDATLAS_SLD__ = sld;

  /* ── geodesy the layout needs, all on R_ATLAS ────────────────────────── */

  /* Both moved into the geodesy module, where the radius lives. Delegated
     here so every existing caller in the layout is untouched. */
  function destinationPoint(lon, lat, km, bearingDeg) {
    return GEODESY.destinationPoint(lon, lat, km, bearingDeg);
  }

  function initialBearingDeg(lon1, lat1, lon2, lat2) {
    return GEODESY.initialBearingDeg(lon1, lat1, lon2, lat2);
  }

  function pathLengthKm(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += distanceKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }

  function normBearing(deg) { return ((deg % 360) + 360) % 360; }

  // Scale factors from the WGS84 radii of curvature at a latitude, so a local
  // tangent plane is correct rather than merely convenient.
  function localScaleKm(latDeg) {
    /* The semi-major axis, taken from the module rather than written again.
       It is the same number as the haversine radius for a good reason - the
       estate measures on the WGS-84 equatorial axis - and writing it twice
       is how the two stop being the same number. */
    const a = R_ATLAS;
    const e2 = (1 / 298.257223563) * (2 - 1 / 298.257223563);
    const s = Math.sin(latDeg * DEG);
    const t = 1 - e2 * s * s;
    return {
      kx: (a / Math.sqrt(t)) * Math.cos(latDeg * DEG) * DEG,
      ky: ((a * (1 - e2)) / t ** 1.5) * DEG
    };
  }

  // Perpendicular distance to a SEGMENT, and the foot of that perpendicular.
  // Measuring to an endpoint instead can only overstate; this is the function
  // whose absence caused the original circuit_km defect, and it is what
  // replaces turf.nearestPointOnLine in the ported layout.
  function distanceToSegmentKm(lon, lat, aLon, aLat, bLon, bLat) {
    const { kx, ky } = localScaleKm(lat);
    const ax = (aLon - lon) * kx; const ay = (aLat - lat) * ky;
    const bx = (bLon - lon) * kx; const by = (bLat - lat) * ky;
    const dx = bx - ax; const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = -(ax * dx + ay * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    const foot = [aLon + (bLon - aLon) * t, aLat + (bLat - aLat) * t];
    return { km: distanceKm(lon, lat, foot[0], foot[1]), foot, t };
  }

  // The sandbox's getRectPolygon, on one radius.
  function rectPolygon(centre, widthKm, lengthKm, rotationDeg) {
    const axis = normBearing(rotationDeg);
    const n = destinationPoint(centre[0], centre[1], lengthKm / 2, axis);
    const s = destinationPoint(centre[0], centre[1], lengthKm / 2, axis + 180);
    const nw = destinationPoint(n[0], n[1], widthKm / 2, axis - 90);
    const ne = destinationPoint(n[0], n[1], widthKm / 2, axis + 90);
    const se = destinationPoint(s[0], s[1], widthKm / 2, axis + 90);
    const sw = destinationPoint(s[0], s[1], widthKm / 2, axis - 90);
    return [[nw, ne, se, sw, nw]];
  }

  // The sandbox uses turf.nearestPointOnLine to drop each block onto the
  // collector trunk. distanceToSegmentKm already returns that foot.
  function footOnSegment(lon, lat, a, b) {
    return distanceToSegmentKm(lon, lat, a[0], a[1], b[0], b[1]).foot;
  }

  /* ── the sizing arithmetic, in its module ────────────────────────────
     Lifted out at 202609012205 into atlas/modules/202609012205-sizing-
     arithmetic.js, proven value-for-value against the last inline copy.
     These delegations keep every caller's name; the module is handed the
     state and the defaults the body used to close over. Absent module:
     fail by name, never quietly compute nothing. */
  const SIZING = (window.__GRIDATLAS_MODULES__ || {}).sizingArithmetic;
  if (!SIZING) throw new Error('sld-sandbox: the sizing-arithmetic module is not composed');
  const { DEVELOPMENT_STAGES, financeNumber } = SIZING;

  function activePhysicalInputs() { return SIZING.physicalInputs(sld.inputs); }
  function applyDevelopmentStageDefaults(financeInputs, stageValue) {
    return SIZING.applyDevelopmentStageDefaults(financeInputs, stageValue);
  }
  function applyMountingBifacial(mode, gcrValue) {
    return SIZING.applyMountingBifacial(sld.finance, mode, gcrValue);
  }
  function computeScreeningFinance(financeInputs, stats) {
    return SIZING.screeningFinance(financeInputs, stats,
      { fallbackMode: sld.inputs.mode, defaults: FINANCE_DEFAULTS });
  }
  const computeSldStats = () => SIZING.computeStats(sld.inputs, sld.finance, FINANCE_DEFAULTS);
  sld.computeFinance = computeScreeningFinance;
  sld.applyDevelopmentStage = applyDevelopmentStageDefaults;
  sld.applyMountingBifacial = applyMountingBifacial;

  function fitToStatedCapacity() { return SIZING.fitToStatedCapacity(sld, computeSldStats); }
  sld.fitToStatedCapacity = fitToStatedCapacity;

  /* ── the layout ──────────────────────────────────────────────────────── */

  function buildLayout() {
    const stats = computeSldStats();
    sld.stats = stats;
    if (!sld.gridNode || stats.total_blocks === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    const axis = normBearing(sld.rotationDeg);
    const N = stats.total_blocks;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);
    const blockAreaKm2 = stats.block_ground_area_m2 / 1e6;
    const physical = activePhysicalInputs();
    const aspect = physical.gcr === 0.45 ? 1 / 1.4 : physical.gcr === 0.75 ? 1.0 : 1.4;
    const blockW = Math.sqrt(blockAreaKm2 / aspect);
    const blockL = blockW * aspect;
    const gap = SLD.BLOCK_SPACING_KM;
    const gridW = cols * blockW + (cols - 1) * gap;
    const gridL = rows * blockL + (rows - 1) * gap;

    const gridNode = sld.gridNode;
    const offset = gridL / 2 + SLD.ARRAY_OFFSET_KM;
    const centre = sld.arrayCentre
      || destinationPoint(gridNode[0], gridNode[1], offset, axis);
    // The customer substation sits on the array edge nearest the grid node.
    const customerSub = destinationPoint(centre[0], centre[1], gridL / 2, axis + 180);

    const features = [];
    const push = (geometry, properties) =>
      features.push({ type: 'Feature', geometry, properties });

    // Site boundary, and the grab surface for dragging.
    push({ type: 'Polygon', coordinates: rectPolygon(centre, gridW + SLD.BOUNDARY_BUFFER_KM, gridL + SLD.BOUNDARY_BUFFER_KM, axis) },
      { kind: 'boundary', colour: SLD_COLOUR.boundary });

    // Blocks, laid out from the north-west corner along the axis.
    const ptN = destinationPoint(centre[0], centre[1], gridL / 2, axis);
    const ptNW = destinationPoint(ptN[0], ptN[1], gridW / 2, axis - 90);
    const blocks = [];
    let placed = 0;
    for (let r = 0; r < rows && placed < N; r += 1) {
      for (let c = 0; c < cols && placed < N; c += 1) {
        const across = destinationPoint(ptNW[0], ptNW[1],
          c * blockW + c * gap + blockW / 2, axis + 90);
        const at = destinationPoint(across[0], across[1],
          r * blockL + r * gap + blockL / 2, axis + 180);
        push({ type: 'Polygon', coordinates: rectPolygon(at, blockW, blockL, axis) },
          { kind: 'block', colour: SLD_COLOUR.block });
        blocks.push(at);
        placed += 1;
      }
    }

    // 33 kV collectors: each block drops onto a trunk running up the axis
    // from the customer substation, and the trunk is clipped to the furthest
    // block rather than drawn to the far edge of nothing.
    if (blocks.length) {
      const trunkEnd = destinationPoint(customerSub[0], customerSub[1], gridL, axis);
      let furthest = 0;
      const branches = [];
      for (const at of blocks) {
        const foot = footOnSegment(at[0], at[1], customerSub, trunkEnd);
        furthest = Math.max(furthest,
          distanceKm(customerSub[0], customerSub[1], foot[0], foot[1]));
        branches.push([at, foot]);
      }
      if (furthest > 0) {
        const clipped = destinationPoint(customerSub[0], customerSub[1], furthest, axis);
        push({ type: 'LineString', coordinates: [customerSub, clipped] },
          { kind: 'radial', role: 'collector_trunk', colour: SLD_COLOUR.radial });
      }
      for (const [at, foot] of branches) {
        push({ type: 'LineString', coordinates: [at, foot] },
          { kind: 'radial', role: 'block_branch', colour: SLD_COLOUR.radial });
      }
    }

    // BESS compound alongside the customer substation.
    // The original drawing reads the same topology-local financial BESS MWh
    // that drives CAPEX and revenue. There is no second layout-BESS input.
    const bessMwh = financeNumber(sld.finance[sld.inputs.mode]?.bess_mwh);
    if (bessMwh > 0) {
      const areaKm2 = (bessMwh * SLD.BESS_M2_PER_MWH) / 1e6;
      const w = Math.sqrt(areaKm2 * SLD.BESS_ASPECT);
      const l = areaKm2 / w;
      const at = destinationPoint(customerSub[0], customerSub[1], w / 2 + 0.05, axis - 90);
      push({ type: 'Polygon', coordinates: rectPolygon(at, w, l, axis) },
        { kind: 'bess', colour: SLD_COLOUR.bess });
      push({ type: 'LineString', coordinates: [at, customerSub] },
        { kind: 'radial', role: 'bess_tie', colour: SLD_COLOUR.radial });
    }

    // Export cable: customer substation, through the user's vertices, to the
    // grid node. Measured along its own path, and against the straight line
    // so the detour is visible rather than implied.
    const route = [customerSub, ...sld.routePins, gridNode];
    sld.cableKm = pathLengthKm(route);
    sld.straightKm = distanceKm(customerSub[0], customerSub[1], gridNode[0], gridNode[1]);
    push({ type: 'LineString', coordinates: route },
      { kind: 'cable', colour: SLD_COLOUR.cable, km: sld.cableKm });

    sld.routePins.forEach((at, index) => {
      push({ type: 'Point', coordinates: at },
        { kind: 'pin', index, colour: SLD_COLOUR.pin });
    });

    push({ type: 'Point', coordinates: customerSub },
      { kind: 'node', role: 'customer_substation', colour: SLD_COLOUR.node,
        label: `CUSTOMER SUB · ${stats.production_substation_ac_mva.toFixed(2)} MVA` });
    push({ type: 'Point', coordinates: gridNode },
      { kind: 'node', role: 'grid_node', colour: SLD_COLOUR.node,
        label: `${sld.gridNodeName || 'GRID NODE'}${sld.gridNodeVoltage ? ` · ${sld.gridNodeVoltage}` : ''}` });

    // Rotation handle, off the far edge of the array.
    const handle = destinationPoint(centre[0], centre[1], gridL / 2 + 0.12, axis);
    push({ type: 'Point', coordinates: handle },
      { kind: 'handle', colour: SLD_COLOUR.handle });
    push({ type: 'LineString', coordinates: [centre, handle] },
      { kind: 'radial', role: 'handle_stem', colour: SLD_COLOUR.handle });

    sld.geometry = { centre, customerSub, gridW, gridL, axis, handle, blocks: blocks.length };
    return { type: 'FeatureCollection', features };
  }

  function ensureSldLayers(map) {
    if (map.getSource(SRC_SLD)) return;
    map.addSource(SRC_SLD, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({ id: SLD_LAYERS.boundary, type: 'fill', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'boundary'],
      paint: { 'fill-color': SLD_COLOUR.boundary, 'fill-opacity': 0.07 } });
    map.addLayer({ id: SLD_LAYERS.boundaryLine, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'boundary'],
      paint: { 'line-color': SLD_COLOUR.boundary, 'line-width': 1.2, 'line-opacity': 0.65 } });
    map.addLayer({ id: SLD_LAYERS.block, type: 'fill', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'block'],
      paint: { 'fill-color': SLD_COLOUR.block, 'fill-opacity': 0.16,
        'fill-outline-color': SLD_COLOUR.block } });
    map.addLayer({ id: SLD_LAYERS.bess, type: 'fill', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'bess'],
      paint: { 'fill-color': SLD_COLOUR.bess, 'fill-opacity': 0.22,
        'fill-outline-color': SLD_COLOUR.bess } });

    map.addLayer({ id: SLD_LAYERS.radial, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'radial'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'colour'], 'line-width': 0.9, 'line-opacity': 0.5 } });
    // The electron flow, on the collectors.
    map.addLayer({ id: SLD_LAYERS.radialFlow, type: 'line', source: SRC_SLD,
      filter: ['all', ['==', ['get', 'kind'], 'radial'], ['!=', ['get', 'role'], 'handle_stem']],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOUR, 'line-width': 1.3, 'line-opacity': 0.65,
        'line-dasharray': [0.2, 3.2] } });

    map.addLayer({ id: SLD_LAYERS.cableGlow, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': SLD_COLOUR.cable, 'line-width': 8, 'line-opacity': 0.12,
        'line-blur': 5 } });
    map.addLayer({ id: SLD_LAYERS.cable, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': SLD_COLOUR.cable, 'line-width': 1.8, 'line-opacity': 0.85 } });
    map.addLayer({ id: SLD_LAYERS.cableFlow, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOUR, 'line-width': 2.4, 'line-opacity': 0.9,
        'line-dasharray': [0.2, 3.2] } });
    map.addLayer({ id: SLD_LAYERS.cableFlowB, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOUR, 'line-width': 1.6, 'line-opacity': 0.55,
        'line-dasharray': [0.2, 3.2] } });

    map.addLayer({ id: SLD_LAYERS.node, type: 'circle', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'node'],
      paint: { 'circle-radius': 5, 'circle-color': SLD_COLOUR.node,
        'circle-stroke-color': '#000c10', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: SLD_LAYERS.pin, type: 'circle', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'pin'],
      paint: { 'circle-radius': 5, 'circle-color': SLD_COLOUR.pin, 'circle-opacity': 0.9,
        'circle-stroke-color': '#04343a', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: SLD_LAYERS.handle, type: 'circle', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'handle'],
      paint: { 'circle-radius': 6, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': SLD_COLOUR.handle, 'circle-stroke-width': 1.8 } });
    const sldFont = styleTextFont(map);
    if (!sldFont) {
      link.failures.push('the basemap serves no glyphs, so layout labels are omitted');
    } else {
      addLabelLayerWhenDrawable(map, sldFont, { id: SLD_LAYERS.label, type: 'symbol', source: SRC_SLD,
        filter: ['==', ['get', 'kind'], 'node'],
        layout: { 'text-field': ['get', 'label'], 'text-size': 9.5,
          'text-offset': [0, -1.4], 'text-anchor': 'bottom',
          'text-font': sldFont },
        paint: { 'text-color': '#a9c4c9', 'text-halo-color': '#000c10',
          'text-halo-width': 1.5 } }, 'layout');
    }
  }

  let sldFlowHandle = null;
  let sldPhase = 0;
  function animateSld(map) {
    if (sldFlowHandle !== null) cancelAnimationFrame(sldFlowHandle);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      try {
        map.setPaintProperty(SLD_LAYERS.cableFlow, 'line-opacity', 0);
        map.setPaintProperty(SLD_LAYERS.cableFlowB, 'line-opacity', 0);
        map.setPaintProperty(SLD_LAYERS.radialFlow, 'line-opacity', 0);
      } catch (_) { /* layer gone */ }
      return;
    }
    const step = () => {
      sldPhase = (sldPhase + FLOW_SPEED) % FLOW_PERIOD;
      const half = (sldPhase + FLOW_PERIOD / 2) % FLOW_PERIOD;
      try {
        setFlowDash(map, SLD_LAYERS.cableFlow, sldPhase);
        setFlowDash(map, SLD_LAYERS.cableFlowB, half);
        setFlowDash(map, SLD_LAYERS.radialFlow, sldPhase);
      } catch (_) { sldFlowHandle = null; return; }
      sldFlowHandle = requestAnimationFrame(step);
    };
    sldFlowHandle = requestAnimationFrame(step);
  }

  function redrawSld(map, { fit = false } = {}) {
    ensureSldLayers(map);
    const data = buildLayout();
    setSourceData(map, SRC_SLD, data);
    renderSldPanel();
    if (data.features.length) animateSld(map);
    if (fit && data.features.length && sld.geometry) {
      const lons = []; const lats = [];
      for (const f of data.features) {
        const walk = (c) => {
          if (typeof c[0] === 'number') { lons.push(c[0]); lats.push(c[1]); return; }
          c.forEach(walk);
        };
        walk(f.geometry.coordinates);
      }
      map.fitBounds([[Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)]], { padding: 70, duration: 700 });
    }
  }

  /* ── dragging ────────────────────────────────────────────────────────── */

  function attachSldDragging(map) {
    const canvas = map.getCanvas();
    const grabbable = [SLD_LAYERS.handle, SLD_LAYERS.pin, SLD_LAYERS.boundary];

    map.on('mousemove', (event) => {
      if (!sld.active || sld.dragging) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: grabbable.filter(id => map.getLayer(id)) });
      canvas.style.cursor = hits.length ? 'grab' : '';
    });

    const beginDrag = (event) => {
      if (!sld.active || sld.dragging || fromOwnUi(event)) return;
      const layers = grabbable.filter(id => map.getLayer(id));
      if (!layers.length) return;
      const hits = map.queryRenderedFeatures(event.point, { layers });
      if (!hits.length) return;
      const kind = hits[0].properties?.kind;
      let nextDrag = null;
      if (kind === 'handle') nextDrag = { what: 'rotate' };
      else if (kind === 'pin') nextDrag = { what: 'pin', index: Number(hits[0].properties.index) };
      else if (kind === 'boundary') nextDrag = { what: 'array' };
      else return;
      nextDrag.dragPanWasEnabled = map.dragPan.isEnabled?.() !== false;
      nextDrag.touchWasEnabled = map.touchZoomRotate?.isEnabled?.() !== false;
      sld.dragging = nextDrag;
      event.preventDefault();
      map.dragPan.disable();
      map.touchZoomRotate?.disable();
      canvas.style.cursor = 'grabbing';
    };
    map.on('mousedown', beginDrag);
    map.on('touchstart', beginDrag);

    const moveDrag = (event) => {
      if (!sld.dragging) return;
      event.preventDefault();
      const at = [event.lngLat.lng, event.lngLat.lat];
      if (sld.dragging.what === 'array') {
        sld.arrayCentre = at;
      } else if (sld.dragging.what === 'rotate') {
        const c = sld.geometry?.centre;
        if (c) sld.rotationDeg = initialBearingDeg(c[0], c[1], at[0], at[1]);
      } else if (sld.dragging.what === 'pin') {
        sld.routePins[sld.dragging.index] = at;
      }
      redrawSld(map);
    };
    map.on('mousemove', moveDrag);
    map.on('touchmove', moveDrag);

    const release = () => {
      if (!sld.dragging) return;
      const finished = sld.dragging;
      sld.dragging = null;
      if (finished.dragPanWasEnabled) map.dragPan.enable();
      if (finished.touchWasEnabled) map.touchZoomRotate?.enable();
      canvas.style.cursor = '';
    };
    map.on('mouseup', release);
    map.on('touchend', release);
    map.on('mouseout', release);
    canvas.addEventListener?.('pointercancel', release);

    // Click the cable to insert a vertex where you clicked; double-click a
    // vertex to remove it. No modes, no commit step.
    map.on('click', (event) => {
      if (fromOwnUi(event)) return;
      if (!sld.active || !map.getLayer(SLD_LAYERS.cable)) return;
      const onPin = map.queryRenderedFeatures(event.point, { layers: [SLD_LAYERS.pin] });
      if (onPin.length) return;
      const onCable = map.queryRenderedFeatures(event.point, { layers: [SLD_LAYERS.cable] });
      if (!onCable.length) return;
      const at = [event.lngLat.lng, event.lngLat.lat];
      const route = [sld.geometry.customerSub, ...sld.routePins, sld.gridNode];
      let best = 0; let bestKm = Infinity;
      for (let i = 0; i < route.length - 1; i += 1) {
        const km = distanceToSegmentKm(at[0], at[1], route[i][0], route[i][1],
          route[i + 1][0], route[i + 1][1]).km;
        if (km < bestKm) { bestKm = km; best = i; }
      }
      sld.routePins.splice(best, 0, at);
      redrawSld(map);
    });

    map.on('dblclick', (event) => {
      if (!sld.active || !map.getLayer(SLD_LAYERS.pin)) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: [SLD_LAYERS.pin] });
      if (!hits.length) return;
      event.preventDefault();
      sld.routePins.splice(Number(hits[0].properties.index), 1);
      redrawSld(map);
    });
  }

  /* ── the panel ───────────────────────────────────────────────────────── */

  const PANEL_ID = 'gridatlas-sld-panel';

  function installSldStyles() {
    if (document.getElementById('gridatlas-sld-css')) return;
    const style = document.createElement('style');
    style.id = 'gridatlas-sld-css';
    style.textContent = SLD_STYLES.sldPanel(PANEL_ID);
    document.head.appendChild(style);
  }

  function sldPanel() {
    let el = document.getElementById(PANEL_ID);
    if (el) return el;
    installSldStyles();
    el = document.createElement('div');
    el.id = PANEL_ID;
    (capturedMap?.getContainer() || document.body).appendChild(el);
    return el;
  }

  const ELECTRICAL_RULES = Object.freeze({
    mod_wp: { min: 1, step: 1, integer: true },
    mod_l: { min: 0.01, step: 0.01 },
    mod_w: { min: 0.01, step: 0.01 },
    gcr: { min: 0.01, max: 1, step: 0.01 },
    gross_factor: { min: 1, step: 0.05 },
    x_mods: { min: 1, step: 1, integer: true },
    z_strings: { min: 1, step: 1, integer: true },
    y_invs: { min: 1, step: 1, integer: true },
    s_subs: { min: 1, step: 1, integer: true },
    b_cols: { min: 1, step: 1, integer: true },
    string_inv_kva: { min: 1, step: 1 },
    string_skid_mva: { min: 0.1, step: 0.01 },
    dc_ac_ratio: { min: 0.01, step: 0.05 },
    mod_wp_c: { min: 1, step: 1, integer: true },
    mod_l_c: { min: 0.01, step: 0.01 },
    mod_w_c: { min: 0.01, step: 0.01 },
    gcr_c: { min: 0.01, max: 1, step: 0.01 },
    gross_factor_c: { min: 1, step: 0.05 },
    x_mods_c: { min: 1, step: 1, integer: true },
    str_per_cb_c: { min: 1, step: 1, integer: true },
    inv_ac_mw_c: { min: 0.1, max: 20, step: 0.01 },
    inv_dc_mw_c: { min: 0.1, max: 30, step: 0.01 },
    central_skid_mva_c: { min: 0.1, max: 25, step: 0.01 },
    inv_per_mv_c: { min: 1, step: 1, integer: true },
    mv_per_ring_c: { min: 1, step: 1, integer: true },
    rings_c: { min: 1, step: 1, integer: true },
  });

  function normalizeElectricalInput(key, rawValue) {
    const rule = ELECTRICAL_RULES[key];
    const value = Number(rawValue);
    if (!rule || !Number.isFinite(value)) return null;
    if (value < rule.min || (rule.max != null && value > rule.max)) return null;
    if (rule.integer && !Number.isInteger(value)) return null;
    return value;
  }

  function electricalInputAttributes(key) {
    const rule = ELECTRICAL_RULES[key];
    return `min="${rule.min}"${rule.max == null ? '' : ` max="${rule.max}"`} step="${rule.step}"`;
  }
  sld.normalizeElectricalInput = normalizeElectricalInput;

  const FIELDS_STRING = [
    ['mod_wp', 'Module rating Wp'], ['mod_l', 'Module length m'], ['mod_w', 'Module width m'],
    ['gcr', 'Ground cover ratio'], ['gross_factor', 'Gross site factor'],
    ['x_mods', 'Modules / string'], ['z_strings', 'Strings / inverter'],
    ['y_invs', 'Inverters / skid'], ['s_subs', 'Skids / ring main'], ['b_cols', 'Ring main circuits'],
    ['string_inv_kva', 'String inverter kVA'], ['string_skid_mva', 'Skid transformer MVA'],
    ['dc_ac_ratio', 'DC/AC ratio']
  ];
  const FIELDS_CENTRAL = [
    ['mod_wp_c', 'Module rating Wp'], ['mod_l_c', 'Module length m'], ['mod_w_c', 'Module width m'],
    ['gcr_c', 'Ground cover ratio'], ['gross_factor_c', 'Gross site factor'],
    ['x_mods_c', 'Modules / string'], ['str_per_cb_c', 'Strings / combiner'],
    ['inv_ac_mw_c', 'Inverter AC MW'], ['inv_dc_mw_c', 'Inverter DC MWp'],
    ['central_skid_mva_c', 'Skid MVA'], ['inv_per_mv_c', 'Inverters / MV'],
    ['mv_per_ring_c', 'MV / ring'], ['rings_c', 'Rings']
  ];

  const FINANCE_FIELDS = [
    ['@', 'Revenue and operating case'],
    ['price', 'Energy price GBP/MWh'], ['other', 'Other income GBP/MWh'],
    ['yield', 'Base yield kWh/kWp'], ['bifacial', 'Bifacial gain %'],
    ['losses', 'Base losses %'], ['deg', 'Degradation %'], ['opex', 'OPEX GBP/MWac/yr'],
    ['@', 'CAPEX'],
    ['modules', 'Modules GBP/Wp'], ['epc_ex', 'EPC ex modules GBP/Wp'],
    ['flood', 'Flood resilience', 'checkbox'], ['flood_rate', 'Flood adder GBP/Wp'],
    ['other_capex', 'Other CAPEX GBP/Wp'], ['fixed_capex', 'Fixed CAPEX GBP'],
    ['cont', 'Contingency %'],
    ['@', 'Electrical loss allowances'],
    ['loss_dc_string', 'DC string loss %'], ['loss_lv_dc', 'LV main DC loss %'],
    ['loss_lv_ac', 'LV AC loss %'], ['loss_tx', 'Transformer loss %'],
    ['loss_other', 'Other electrical loss %'],
    ['@', 'BESS finance'],
    ['bess_mw', 'BESS power MW'], ['bess_mwh', 'BESS energy MWh'],
    ['bess_capex', 'BESS CAPEX GBP/MWh'], ['bess_cycles', 'BESS cycles / year'],
    ['bess_spread', 'BESS revenue GBP/MWh'], ['bess_eff', 'BESS efficiency %'],
    ['@', 'Development case'],
    ['dev_stage', 'Development stage', 'stage'], ['dev_cost_mw', 'Development cost GBP/Wp'],
    ['dev_module_mwp', 'Module supply GBP/Wp'], ['dev_epc_mw', 'EPC cost GBP/Wp'],
    ['dev_owner_mw', 'Owner costs GBP/Wp'], ['dev_grid_mw', 'Grid connection GBP/Wp'],
    ['dev_exit_mwp', 'Target exit value GBP/Wp'], ['dev_npv_mwp', 'Operating NPV GBP/Wp'],
    ['dev_success', 'Success probability %'], ['dev_years', 'Development years'],
  ];

  const financeFieldHtml = (field, values) => {
    const [key, label, kind] = field;
    if (key === '@') return `<div class="sld-fin-section">${escapeHtml(label)}</div>`;
    if (kind === 'checkbox') {
      return `<label for="sld_fin_${key}">${escapeHtml(label)}</label>`
        + `<input id="sld_fin_${key}" data-fin-key="${key}" type="checkbox" ${values[key] ? 'checked' : ''}>`;
    }
    if (kind === 'stage') {
      const options = Object.entries(DEVELOPMENT_STAGES).map(([value, text]) =>
        `<option value="${value}" ${String(values[key]) === value ? 'selected' : ''}>${escapeHtml(text)}</option>`
      ).join('');
      return `<label for="sld_fin_${key}">${escapeHtml(label)}</label>`
        + `<select id="sld_fin_${key}" data-fin-key="${key}">${options}</select>`;
    }
    const maximum = key === 'bess_eff' || key === 'dev_success' ? ' max="100"' : '';
    return `<label for="sld_fin_${key}">${escapeHtml(label)}</label>`
      + `<input id="sld_fin_${key}" data-fin-key="${key}" type="number" min="0"${maximum} step="any" value="${values[key]}">`;
  };

  const moneyText = value => `GBP ${Math.round(financeNumber(value)).toLocaleString('en-GB')}`;

  function renderSldPanel() {
    const el = sldPanel();
    const s = sld.stats;
    const fields = sld.inputs.mode === 'string' ? FIELDS_STRING : FIELDS_CENTRAL;
    const financeInputs = sld.finance[sld.inputs.mode];
    const finance = s?.finance;
    const detour = sld.straightKm > 0 ? sld.cableKm / sld.straightKm : 1;
    const acres = s ? s.gross_site_area_m2 / SLD.M2_PER_ACRE : 0;

    el.innerHTML = `
      <h4 class="sld-drag">Layout sandbox<span class="sld-beta">Beta</span>
        <button class="sld-min" title="Minimise">&minus;</button>
        <button class="sld-close" title="Close">&times;</button></h4>
      <div class="sld-site">${escapeHtml(sld.projectName || sld.gridNodeName || 'Grid node')}</div>
      ${sld.projectName ? `<div class="sld-to">to ${escapeHtml(sld.gridNodeName || 'grid node')}`
        + `${sld.gridNodeVoltage ? ` &middot; ${escapeHtml(sld.gridNodeVoltage)}` : ''}</div>` : ''}
      <div class="sld-tabs">
        <button data-mode="string" data-on="${sld.inputs.mode === 'string'}">String</button>
        <button data-mode="central" data-on="${sld.inputs.mode === 'central'}">Central</button>
      </div>
      ${sld.targetMw ? `
      <div class="sld-target">
        <div class="sld-target-row"><span>Register states</span><b>${sld.targetMw} MW</b></div>
        <div class="sld-basis">
          <span>That figure is</span>
          <select id="sld_basis">
            <option value="unstated" ${sld.targetBasis === 'unstated' ? 'selected' : ''}>not stated</option>
            <option value="ac" ${sld.targetBasis === 'ac' ? 'selected' : ''}>AC export MW</option>
            <option value="dc" ${sld.targetBasis === 'dc' ? 'selected' : ''}>DC MWp</option>
          </select>
        </div>
        ${sld.targetBasis === 'unstated'
          ? `<div class="sld-danger">REPD does not reliably distinguish AC from DC.
               Its figure is nominally MWelec, but schemes report it both ways and the
               register does not carry the distinction. Nothing is fitted until you say
               which this is: matching AC when the figure was DC oversizes the
               connection by the DC/AC ratio, and that is the error that drives export
               limitation, curtailment and the size of the offer.</div>`
          : `<div class="sld-fitted">Fitted to ${sld.targetBasis === 'ac' ? 'AC export' : 'DC'} by
               ${sld.inputs.mode === 'string' ? 'ring main circuits' : 'rings'}
               ${sld.fitResidualPct != null
                 ? `&middot; <b class="${Math.abs(sld.fitResidualPct) > 5 ? 'sld-off' : ''}">${sld.fitResidualPct >= 0 ? '+' : ''}${sld.fitResidualPct.toFixed(1)}%</b> against the stated figure`
                 : ''}.
               Ratings, string length and module choice are untouched.</div>`}
      </div>` : ''}
      <div class="sld-grid">
        ${fields.map(([key, label]) =>
          `<label for="sld_${key}">${label}</label>`
          + `<input id="sld_${key}" data-key="${key}" type="number" ${electricalInputAttributes(key)} value="${sld.inputs[key]}">`
        ).join('')}
      </div>
      <div class="sld-out">
        <span>Array DC</span><b>${s ? s.dc_mwp.toFixed(1) : '0.0'} MWp</b>
        <span>Inverter AC</span><b>${s?.consistency?.inverter_ac_mw != null
          ? s.consistency.inverter_ac_mw.toFixed(1) : '0.0'} MW</b>
        <span>Export limit</span><b>${s?.consistency?.export_mva != null
          ? s.consistency.export_mva.toFixed(1) : '0.0'} MVA</b>
        <span>Design DC/AC</span><b>${s?.consistency?.design_dc_ac != null
          ? s.consistency.design_dc_ac.toFixed(2) : '0.00'}</b>
        <span>DC / export</span><b>${s?.consistency?.export_dc_ac != null
          ? s.consistency.export_dc_ac.toFixed(2) : '0.00'}</b>
        <span>Inverter / export</span><b>${s?.consistency?.inverter_to_export != null
          ? s.consistency.inverter_to_export.toFixed(2) : '0.00'}</b>
        <span>Modules</span><b>${s ? s.module_count.toLocaleString('en-GB') : '0'}</b>
        <span>Blocks</span><b>${s ? s.total_blocks : 0}</b>
        <span>Gross site</span><b>${acres.toFixed(0)} acres</b>
        <span>Ring main</span><b>${s ? s.ring_main_ac_mva.toFixed(2) : '0.00'} MVA</b>
        <span class="lit">Export cable</span><b class="lit">${sld.cableKm.toFixed(3)} km</b>
        <span>Straight line</span><b>${sld.straightKm.toFixed(3)} km</b>
        <span>Detour factor</span><b>${detour.toFixed(2)}&times;</b>
        <span>Route vertices</span><b>${sld.routePins.length}</b>
        <span>Rotation</span><b>${normBearing(sld.rotationDeg).toFixed(0)}&deg;</b>
      </div>
      ${(() => {
        const c = s?.consistency;
        if (!(c?.stated_dc_ac > 0) || !(c?.design_dc_ac > 0)) return '';
        if (Math.abs(c.design_dc_ac - c.stated_dc_ac) / c.stated_dc_ac <= 0.05) return '';
        return `<div class="sld-ratio-note">Entered DC/AC ${c.stated_dc_ac.toFixed(2)}; `
          + `the equipment counts and ratings shown give ${c.design_dc_ac.toFixed(2)}. `
          + `Both values remain visible and no input is changed automatically.</div>`;
      })()}
      ${s && s.warning ? `<div class="sld-warn">${escapeHtml(s.warning)}</div>` : ''}
      <details class="sld-finance" ${sld.financeOpen ? 'open' : ''}>
        <summary>Financial screening inputs and outputs</summary>
        <div class="sld-fin-out">
          <span>Year 1 revenue</span><b>${moneyText(finance?.annualRevenue)}</b>
          <span>25-year revenue</span><b>${moneyText(finance?.revenue25)}</b>
          <span>35-year revenue</span><b>${moneyText(finance?.revenue35)}</b>
          <span>Total CAPEX</span><b>${moneyText(finance?.totalCapex)}</b>
          <span>CAPEX / Wp</span><b>GBP ${financeNumber(finance?.capexPerWp).toFixed(2)}</b>
          <span>25-year surplus</span><b>${moneyText(finance?.surplus25)}</b>
          <span>35-year surplus</span><b>${moneyText(finance?.surplus35)}</b>
          <span>Development capital at risk</span><b>${moneyText(finance?.devCapitalAtRisk)}</b>
          <span>Total build cost</span><b>${moneyText(finance?.devTotalBuildCost)}</b>
          <span>Target exit value</span><b>${moneyText(finance?.devExitValue)}</b>
          <span>Operating NPV</span><b>${moneyText(finance?.devOperatingNpv)}</b>
          <span>Gross development margin</span><b>${moneyText(finance?.devGrossMargin)}</b>
          <span>Risk-adjusted value</span><b>${moneyText(finance?.devRiskAdjustedValue)}</b>
          <span>Equity money multiple</span><b>${financeNumber(finance?.devReturnMultiple).toFixed(2)}x</b>
        </div>
        <div class="sld-fin-grid">${FINANCE_FIELDS.map(field => financeFieldHtml(field, financeInputs)).join('')}</div>
        <div class="sld-fin-note"><b>Screening values only, not financial advice.</b> Revenue, CAPEX,
          OPEX, development value and BESS outputs depend entirely on the visible assumptions. They do
          not replace project-specific yield, degradation, route-to-market, tax, debt, grid, EPC,
          insurance, degradation, augmentation or investment-committee models.</div>
      </details>
      <div class="sld-hint">Drag the site to move it. Drag the handle to rotate. Click the
        cable to add a vertex, drag a vertex to shape the route, double-click one to remove it.</div>
      <div class="sld-caveat"><b>Beta analytics, not an actual grid connection.</b> A layout, not
        a design. Every length is straight-line between the points shown, with no wayleave,
        easement, right of way, crossing, terrain, ground condition or consent content, and no
        route has been walked. A real connection depends on factors that must be studied:
        network impedance and fault level, thermal headroom, existing committed connections and
        queue position, and land control. A mapped substation does not confirm capacity, voltage
        suitability or acceptance by any network party.</div>`;

    el.dataset.open = 'true';
    // Optional throughout: a panel that cannot find its own controls must not
    // take the layout down with it. The geometry is the product; the panel is
    // how it is driven.
    el.querySelector?.('.sld-close')?.addEventListener('click', closeSld);
    el.querySelector?.('.sld-min')?.addEventListener('click', () => {
      const min = el.dataset.min === 'true';
      el.dataset.min = min ? 'false' : 'true';
      const button = el.querySelector('.sld-min');
      if (button) button.innerHTML = min ? '&minus;' : '&plus;';
    });
    // The panel is draggable by its heading for the same reason the card is:
    // on a map, anything fixed in a corner is eventually in the way.
    const heading = el.querySelector?.('h4.sld-drag');
    if (heading && !heading.dataset.bound) {
      heading.dataset.bound = '1';
      let drag = null;
      heading.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        event.preventDefault();
        const rect = el.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          dx: event.clientX - rect.left,
          dy: event.clientY - rect.top,
        };
        heading.setPointerCapture?.(event.pointerId);
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        const map = capturedMap?.getContainer()?.getBoundingClientRect();
        if (map) el.style.maxHeight = Math.max(120, map.bottom - rect.top - 8) + 'px';
      });
      heading.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        const map = capturedMap?.getContainer()?.getBoundingClientRect()
          || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const panel = el.getBoundingClientRect();
        const minX = map.left + 4;
        const maxX = Math.max(minX, map.right - panel.width - 4);
        const minY = map.top + 4;
        const maxY = Math.max(minY, map.bottom - 44 - 4);
        const left = Math.max(minX, Math.min(maxX, event.clientX - drag.dx));
        const top = Math.max(minY, Math.min(maxY, event.clientY - drag.dy));
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.maxHeight = Math.max(120, map.bottom - top - 8) + 'px';
      });
      const finish = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        try { heading.releasePointerCapture?.(event.pointerId); } catch (_) { /* already released */ }
        drag = null;
      };
      heading.addEventListener('pointerup', finish);
      heading.addEventListener('pointercancel', finish);
    }
    (el.querySelectorAll?.('.sld-tabs button') || []).forEach(button => {
      button.addEventListener('click', () => {
        sld.inputs.mode = button.dataset.mode;
        if (capturedMap) redrawSld(capturedMap);
      });
    });
    el.querySelector?.('#sld_basis')?.addEventListener('change', (event) => {
      sld.targetBasis = event.target.value;
      fitToStatedCapacity();
      if (capturedMap) redrawSld(capturedMap, { fit: true });
    });
    el.querySelector?.('details.sld-finance')?.addEventListener('toggle', (event) => {
      sld.financeOpen = Boolean(event.currentTarget.open);
    });
    (el.querySelectorAll?.('[data-fin-key]') || []).forEach(input => {
      input.addEventListener('change', () => {
        const values = sld.finance[sld.inputs.mode];
        if (input.type === 'checkbox') values[input.dataset.finKey] = Boolean(input.checked);
        else if (input.dataset.finKey === 'dev_stage') {
          applyDevelopmentStageDefaults(values, input.value);
        } else if (input.tagName === 'SELECT') values[input.dataset.finKey] = input.value;
        else {
          const value = Number(input.value);
          if (Number.isFinite(value)) values[input.dataset.finKey] = value;
        }
        if (capturedMap) redrawSld(capturedMap);
      });
    });
    (el.querySelectorAll?.('input[data-key]') || []).forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.key;
        const value = normalizeElectricalInput(key, input.value);
        if (value == null) {
          input.value = String(sld.inputs[key]);
          return;
        }
        sld.inputs[key] = value;
        if (key === 'gcr' || key === 'gcr_c') {
          applyMountingBifacial(sld.inputs.mode, value);
        }
        // Editing by hand wins. Re-fitting here would silently undo the change
        // the user just made; the residual simply moves and says so.
        if (sld.targetBasis === 'ac' || sld.targetBasis === 'dc') {
          const s = computeSldStats();
          const got = sld.targetBasis === 'ac' ? s.ac_mw : s.dc_mwp;
          sld.fitResidualPct = sld.targetMw > 0
            ? ((got - sld.targetMw) / sld.targetMw) * 100 : null;
        }
        if (capturedMap) redrawSld(capturedMap);
      });
    });
  }

  function closeSld() {
    sld.active = false;
    sld.projectName = null;
    sld.routePins = [];
    sld.arrayCentre = null;
    sld.rotationDeg = 0;
    if (sldFlowHandle !== null) { cancelAnimationFrame(sldFlowHandle); sldFlowHandle = null; }
    const el = document.getElementById(PANEL_ID);
    if (el) el.dataset.open = 'false';
    if (capturedMap && capturedMap.getSource(SRC_SLD)) {
      setSourceData(capturedMap, SRC_SLD, { type: 'FeatureCollection', features: [] });
    }
  }

  // Opened from the substation card the neon links already produce, so the
  // sandbox is one click from the thing it connects to.
  function openSldAt(map, gridNode, name, voltage) {
    sld.active = true;
    sld.projectName = null;
    sld.targetMw = null;
    sld.targetBasis = 'unstated';
    sld.fitResidualPct = null;
    sld.gridNode = gridNode;
    sld.gridNodeName = name;
    sld.gridNodeVoltage = voltage;
    sld.arrayCentre = null;
    sld.rotationDeg = 0;
    sld.routePins = [];
    redrawSld(map, { fit: true });
  }
  sld.openAt = openSldAt;

  // Opened from a project card. The scheme sits at the project and the export
  // cable runs to the nearest substation the links already found, which is the
  // order a scheme is actually built: generation first, then the route to the
  // network. Falls back to the project's own point if nothing was in range, so
  // the button never does nothing.
  function openSldFromProject(map, selection) {
    const nearest = selection.links && selection.links[0];
    if (!nearest) {
      sld.active = false;
      link.failures.push('layout: no substation within '
        + `${MAX_LINK_KM} km of ${selection.name}`);
      return;
    }
    sld.active = true;
    sld.gridNode = nearest.at;
    sld.gridNodeName = nearest.name || 'Grid node';
    sld.gridNodeVoltage = nearest.kv && nearest.kv.length ? `${nearest.kv[0]} kV` : '';
    sld.projectName = selection.name;
    sld.targetMw = selection.statedMw || null;
    // Unstated until the user says. The register's figure is not self-describing
    // and the layout must not pretend otherwise.
    sld.targetBasis = 'unstated';
    // The array starts on the project, not offset from the substation, because
    // the project is the thing that exists.
    sld.arrayCentre = selection.origin;
    sld.rotationDeg = initialBearingDeg(
      nearest.at[0], nearest.at[1], selection.origin[0], selection.origin[1]);
    sld.routePins = [];
    enableSubstationLayer();
    redrawSld(map, { fit: true });
  }
  sld.openFromProject = openSldFromProject;

  /**
   * Keep the layer controls reachable in fullscreen.
   *
   * The shell fullscreens the map element alone, so on desktop every layer
   * checkbox -- the whole dashboard below the map -- vanishes the moment you
   * maximise, and there is no way to turn anything on until you come back out.
   * Mobile carries its own drop-down curtain inside #map-container. When that
   * container is already fullscreen, moving its dashboard ancestor into it
   * would create a DOM cycle and throw HierarchyRequestError.
   *
   * The dashboard node is MOVED into the fullscreen element and moved back on
   * exit, rather than cloned. A clone would look right and do nothing, because
   * every checkbox listener belongs to the original.
   */
  function keepLayersInFullscreen() {
    const dashboard = document.getElementById('dashboard')
      || document.querySelector('.dashboard');
    if (!dashboard) { link.failures.push('fullscreen: dashboard not found'); return; }
    let home = null;

    const onChange = () => {
      const full = document.fullscreenElement;
      /* Relocate only between disjoint trees. If either element contains the
         other, the dashboard is already represented in the fullscreen tree;
         appending an ancestor to its descendant is invalid DOM. */
      if (full && !full.contains(dashboard) && !dashboard.contains(full)) {
        home = { parent: dashboard.parentNode, next: dashboard.nextSibling };
        dashboard.classList.add('gridatlas-fs-layers');
        full.appendChild(dashboard);
      } else if (!full && home) {
        dashboard.classList.remove('gridatlas-fs-layers');
        home.parent.insertBefore(dashboard, home.next);
        home = null;
      }
      boundCardToMap();
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);

    const style = document.createElement('style');
    style.textContent = SLD_STYLES.fullscreenLayers();
    document.head.appendChild(style);
  }

  function installSld(map) {
    installSldStyles();
    ensureSldLayers(map);
    attachSldDragging(map);
    try { keepLayersInFullscreen(); }
    catch (error) { link.failures.push('fullscreen: ' + String(error?.message || error)); }
    try { armCorridorGestures(map); }
    catch (error) { link.failures.push('corridor sheet: ' + String(error?.message || error)); }
    // A substation click offers the layout; the neon links still draw.
    map.on('click', (event) => {
      if (fromOwnUi(event)) return;
      if (!map.getLayer(SUBS_LAYER_ID)) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: [SUBS_LAYER_ID] });
      if (!hits.length) return;
      const properties = hits[0].properties || {};
      const at = representativePoint(hits[0].geometry);
      if (!at) return;
      openSldAt(map, at, properties.name || 'Grid node',
        (voltagesKv(properties)[0] ? `${voltagesKv(properties)[0]} kV` : ''));
    });
  }
})();
