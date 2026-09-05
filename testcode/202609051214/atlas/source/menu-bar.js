/* GridAtlas menu bar.

   v9.94 proved that the conventional menu is the right shape and the wrong
   implementation can still strand the product. That version enumerated only
   direct children of .map-controls and then hid the whole owner container.
   Scope, Clear and their result surfaces were nested, so they disappeared.

   This successor has a stricter admission rule:

   - it installs nothing until the engine's 60 layer controls and the three
     Pipeline News controls are all present and uniquely identified;
   - the Grid menu proxies those 63 ORIGINAL inputs, so their delegated engine
     handlers remain the only implementation of behaviour;
   - action buttons are moved as the same DOM nodes, preserving listeners and
     state, while result panels stay with the map that owns them;
   - legacy containers collapse only after the complete inventory is built.
     A missing control leaves the old interface reachable and is published as
     a failure instead of being silently skipped.

   The six names are the architect's current vocabulary. In particular Grid
   is not exposed through the abandoned "Select layers" alias. */
(function gridAtlasMenuBar() {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var SCHEMA = 'gridatlas.menu-bar.v2';
  var BAR_ID = 'gridatlas-menu-bar';
  var STYLE_ID = BAR_ID + '-css';
  var FAILURE_ID = BAR_ID + '-failure';
  var MENUS = ['File', 'Edit', 'View', 'Scope', 'Grid', 'About'];
  var EXPECTED_ENGINE_LAYERS = 60;
  var EXPECTED_PIPELINE_LAYERS = 3;
  var EXPECTED_LAYER_CONTROLS = 63;
  var MAX_TRIES = 160;             // 40 s: the register UI is built after map load

  var NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.menuBar && NS.menuBar.schema === SCHEMA) return;

  var state = {
    schema: SCHEMA,
    menus: MENUS.slice(),
    bar_id: BAR_ID,
    installed: false,
    controls_moved: 0,
    layer_controls: 0,
    engine_layer_controls: 0,
    pipeline_layer_controls: 0,
    expected_layer_controls: EXPECTED_LAYER_CONTROLS,
    panel_counts: {},
    failure: null,
    tries: 0,
    listeners: 0,
    closed_at_rest: true,
    one_identity_surface: false
  };
  NS.menuBar = state;

  var bar = null;
  var panels = {};
  var titles = [];
  var layerTargets = Object.create(null);
  var layerProxies = Object.create(null);
  var forwardingLayerChoice = false;
  var observer = null;
  var timer = null;
  var brandSlot = null;    // holds the v8 .hud-header (VENTUS wordmark), fused into the bar itself
  var gridHead = null;     // holds the v8 .scada-brand + .status-legend, restored at the top of Grid
  var gridBody = null;     // holds the layer groups, so gridHead never enters the 2-column flow

  function array(value) {
    return Array.prototype.slice.call(value || []);
  }

  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function layerKey(input) {
    if (!input || !input.getAttribute) return '';
    var engine = input.getAttribute('data-layer-id');
    if (engine) return 'engine:' + engine;
    var pipeline = input.getAttribute('data-pn-layer');
    return pipeline ? 'pipeline:' + pipeline : '';
  }

  function layerLabel(input) {
    var label = input && input.closest ? input.closest('label') : null;
    var span = label && label.querySelector
      ? label.querySelector('[data-base-label], [data-pn-label], span') : null;
    var base = span && span.getAttribute ? span.getAttribute('data-base-label') : '';
    /* The V8 panel exposes WAIT/LOAD/OK/FAIL beside every layer.  The first
       menu implementation preferred data-base-label, which deliberately
       strips that live suffix.  That made a successful load and a failed
       load indistinguishable in the only layer surface left on a phone. */
    var text = cleanText((span && span.textContent) || base
      || (label && label.textContent) || layerKey(input).split(':').slice(1).join(':'));
    return text || layerKey(input);
  }

  function layerGroup(input) {
    var group = input && input.closest ? input.closest('.key-group') : null;
    var title = group && group.querySelector ? group.querySelector('.key-title') : null;
    return cleanText(title && title.textContent) || 'Other layers';
  }

  function inventory(doc) {
    var host = doc.getElementById('scada-ui-container');
    var engine = host ? array(host.querySelectorAll(
      'input[type="checkbox"][data-layer-id]')) : [];
    var pipeline = host ? array(host.querySelectorAll(
      'input[type="checkbox"][data-pn-layer]')) : [];
    var controls = engine.concat(pipeline);
    var keys = controls.map(layerKey);
    var unique = new Set(keys);
    return {
      host: host,
      engine: engine,
      pipeline: pipeline,
      controls: controls,
      keys: keys,
      complete: engine.length === EXPECTED_ENGINE_LAYERS
        && pipeline.length === EXPECTED_PIPELINE_LAYERS
        && controls.length === EXPECTED_LAYER_CONTROLS
        && unique.size === EXPECTED_LAYER_CONTROLS
        && !keys.includes('')
    };
  }

  state.inspect = function () {
    var found = inventory(document);
    return {
      engine: found.engine.length,
      pipeline: found.pipeline.length,
      total: found.controls.length,
      unique: new Set(found.keys).size,
      complete: found.complete
    };
  };

  function required(doc) {
    var found = inventory(doc);
    var nodes = {
      host: doc.querySelector('.map-container'),
      stack: doc.querySelector('.map-controls'),
      search: doc.querySelector('.search-bar-wrapper'),
      header: doc.querySelector('.hud-header'),
      exportButton: doc.getElementById('btn-export'),
      statusButton: doc.getElementById('btn-status'),
      fullscreenButton: doc.getElementById('btn-fullscreen'),
      radiusButton: doc.getElementById('btn-radius'),
      radiusAreaButton: doc.getElementById('btn-radius-area'),
      zoneButton: doc.getElementById('btn-zonedraw'),
      measureButton: doc.getElementById('btn-measure')
    };
    var missing = Object.keys(nodes).filter(function (key) { return !nodes[key]; });
    if (!found.complete) missing.push('63 unique layer controls');
    return { found: found, nodes: nodes, missing: missing };
  }

  function installStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + BAR_ID + '{position:absolute;top:0;left:0;right:0;height:36px;z-index:10020;',
      'display:flex;align-items:stretch;gap:0;padding-left:env(safe-area-inset-left);',
      'padding-right:env(safe-area-inset-right);box-sizing:border-box;',
      'background:rgba(4,10,13,.95);border-bottom:1px solid rgba(80,220,240,.3);',
      'font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
      '-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);',
      'isolation:isolate;pointer-events:auto}',
      '#' + BAR_ID + ' .gm-menu{position:relative;min-width:0}',
      '#' + BAR_ID + ' .gm-title{appearance:none;border:0;background:transparent;color:#cfeef6;',
      'min-height:36px;padding:0 11px;cursor:pointer;font:inherit;letter-spacing:.05em;',
      'text-transform:uppercase;white-space:nowrap}',
      '#' + BAR_ID + ' .gm-title:hover,#' + BAR_ID + ' .gm-title:focus-visible,',
      '#' + BAR_ID + ' .gm-menu.gm-open>.gm-title{background:rgba(80,220,240,.16);color:#fff}',
      '#' + BAR_ID + ' .gm-title:focus-visible,#' + BAR_ID + ' .gm-panel :focus-visible{',
      'outline:2px solid #6bebff;outline-offset:-2px}',
      '#' + BAR_ID + ' .gm-side{display:flex;align-items:stretch;flex:1 1 0;min-width:0}',
      '#' + BAR_ID + ' .gm-side-left{justify-content:flex-start}',
      '#' + BAR_ID + ' .gm-side-right{justify-content:flex-end}',
      /* The VENTUS masthead, fused into the centre of this same 36px strip
         (see buildBar) rather than a second row, so it costs no map height
         on a phone and can never be torn out into a closed panel again. */
      /* "The VENTUS logo is the best part" -- the architect's own words.
         It is the hero of this strip: sized and weighted to outrank the
         six menu titles either side of it, not a corner credit shrunk to
         fit. Same face, tracking and two-line lockup as the v8 masthead
         and the fullscreen letterhead it is carried from verbatim. */
      '#' + BAR_ID + ' .gm-brand-slot{flex:0 1 auto;min-width:0;max-width:64%;',
      'display:flex;align-items:center;justify-content:center;overflow:hidden;',
      'padding:0 6px;text-align:center}',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header{display:flex!important;',
      'position:static!important;width:auto!important;align-items:center;',
      'justify-content:center;gap:11px;margin:0!important;padding:0!important;',
      'background:none!important;border:0!important}',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header>div{flex:0 0 auto;line-height:1.05}',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header small{font-size:6.5px;white-space:nowrap}',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header .hud-val{font-size:10.5px;',
      'text-shadow:none}',
      '#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:14px;font-weight:800;',
      'letter-spacing:.2em;margin:0;color:#fff}',
      '#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:5.5px;letter-spacing:.14em}',
      '#' + BAR_ID + ' .gm-panel{position:absolute;top:100%;left:0;min-width:240px;',
      'max-width:min(92vw,420px);max-height:min(72dvh,620px);overflow:auto;',
      'overscroll-behavior:contain;padding:6px;background:rgba(4,10,13,.98);',
      'border:1px solid rgba(80,220,240,.32);border-top:0;',
      'box-shadow:0 12px 34px rgba(0,0,0,.68);box-sizing:border-box}',
      '#' + BAR_ID + ' .gm-panel[hidden]{display:none!important}',
      /* Right-align every panel whose title lives in the right-hand group,
         not "the last two of six flat siblings" -- that positional rule is
         what let the About panel resolve to a negative x once the six
         titles stopped being one undifferentiated row (measured live:
         x=-95 at 1568px, a quarter of its own Versions control
         unreachable). clampPanel() below is the second, JS-measured
         guarantee: this CSS is the common case, not the only defence. */
      '#' + BAR_ID + ' .gm-side-right .gm-panel{left:auto;right:0}',
      '#' + BAR_ID + ' .gm-panel button,#' + BAR_ID + ' .gm-panel [role="button"]{',
      'display:flex;align-items:center;width:100%;min-height:44px;box-sizing:border-box;',
      'position:static!important;inset:auto!important;transform:none!important;margin:0 0 3px;',
      'padding:7px 10px;border:0;border-radius:2px;background:transparent;color:#cfeef6;',
      'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:left;',
      'letter-spacing:.03em;text-transform:none;cursor:pointer}',
      '#' + BAR_ID + ' .gm-panel button:hover,#' + BAR_ID + ' .gm-panel [role="button"]:hover{',
      'background:rgba(80,220,240,.14);color:#fff}',
      /* The estate links are anchors so they are real links -- middle-click,
         copy, open in a new tab all work -- and they take the panel's own
         button look rather than a second one. Only the underline has to go. */
      '#' + BAR_ID + ' .gm-panel a[data-gm-estate],#' + BAR_ID + ' .gm-panel a[data-gm-engine],',
      '#' + BAR_ID + ' .gm-panel a[data-gm-study]',
      '{text-decoration:none}',
      /* Module paths are long. They stay on one row and lose their middle
         rather than wrapping a 44px control into three lines on a phone. */
      '#' + BAR_ID + ' .gm-panel a[data-gm-engine]{white-space:nowrap;overflow:hidden;',
      'text-overflow:ellipsis;display:block;line-height:30px;min-height:44px}',
      /* The attribution, once moved into About, is prose in a panel of
         controls: it keeps its own small type and wraps rather than being
         clipped to one 44px row. */
      '#' + BAR_ID + ' .gm-panel .custom-map-attrib{position:static!important;',
      'inset:auto!important;margin:4px 0 2px;padding:6px 8px;max-width:none;',
      'background:transparent;border:0;white-space:normal;line-height:1.45;',
      'font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fb6c0}',
      '#' + BAR_ID + ' .gm-layer-group{margin:5px 0 2px;padding:6px 8px 3px;',
      'border-top:1px solid #19343b;color:#6fa2ae;font-size:10px;letter-spacing:.08em;',
      'text-transform:uppercase}',
      /* Every layer control's OWN <input> covers its whole label (see
         layerCheckbox / buildLayerControls): a measured audit found the raw
         v8 checkboxes at 17x17px, the input element itself and not just a
         padded label, so a re-measurement of the input's own rect is the
         bar this has to clear, not only a centre-point hit test. */
      '#' + BAR_ID + ' .gm-layer{position:relative;display:flex;align-items:center;gap:10px;',
      'min-height:44px;box-sizing:border-box;padding:7px 9px;color:#cfeef6;cursor:pointer;',
      'line-height:1.35}',
      '#' + BAR_ID + ' .gm-layer:hover{background:rgba(80,220,240,.12)}',
      '#' + BAR_ID + ' .gm-layer input{position:absolute;inset:0;width:100%;height:100%;',
      'margin:0;opacity:0;cursor:pointer;z-index:1}',
      '#' + BAR_ID + ' .gm-layer-box{width:20px;height:20px;flex:0 0 auto;',
      'border:1.5px solid #4a8b96;border-radius:4px;position:relative;',
      'background:rgba(255,255,255,.04)}',
      '#' + BAR_ID + ' .gm-layer input:checked~.gm-layer-box{background:#4fd7ee;',
      'border-color:#4fd7ee}',
      '#' + BAR_ID + ' .gm-layer input:checked~.gm-layer-box::after{content:"";',
      'position:absolute;left:6px;top:2px;width:5px;height:10px;',
      'border:solid #04141a;border-width:0 2px 2px 0;transform:rotate(38deg)}',
      '#' + BAR_ID + ' .gm-layer input:focus-visible~.gm-layer-box{outline:2px solid #6bebff;',
      'outline-offset:2px}',
      '#' + BAR_ID + ' .gm-layer-name{overflow-wrap:anywhere}',
      /* The restored SCADA panel: a branded head (the real .scada-brand and
         .status-legend nodes, moved in once -- see install()) above a
         scrollable body that never mixes with the head's own layout. */
      '#' + BAR_ID + ' .gm-panel-grid{padding:0;overflow:hidden;display:flex;',
      'flex-direction:column;min-width:min(94vw,360px);max-width:min(96vw,900px)}',
      '#' + BAR_ID + ' .gm-panel-head{flex:0 0 auto;padding:8px 8px 0}',
      '#' + BAR_ID + ' .gm-panel-head .scada-brand{padding:0 0 6px;margin:0 0 6px}',
      '#' + BAR_ID + ' .gm-panel-head .status-legend{padding:0 0 8px;margin:0;border:0}',
      '#' + BAR_ID + ' .gm-panel-body{flex:1 1 auto;overflow:auto;',
      'overscroll-behavior:contain;padding:6px;min-height:0}',
      '@media(min-width:560px){#' + BAR_ID + ' .gm-panel-body{column-count:2;',
      'column-gap:14px}',
      '#' + BAR_ID + ' .gm-panel-body .gm-layer-group{break-inside:avoid}',
      '#' + BAR_ID + ' .gm-panel-body .gm-layer{break-inside:avoid}}',
      '@media(min-width:900px){#' + BAR_ID + ' .gm-panel-body{column-count:3}}',
      '#' + BAR_ID + ' .search-bar-wrapper{position:static!important;display:grid!important;',
      'grid-template-columns:minmax(150px,1fr) auto;width:min(82vw,390px);gap:5px;margin:2px 0 6px}',
      '#' + BAR_ID + ' .search-bar-wrapper>div{position:relative}',
      '#' + BAR_ID + ' .search-input{width:100%!important;min-height:44px;box-sizing:border-box}',
      '#' + BAR_ID + ' .search-results{position:static!important;max-height:42vh;overflow:auto}',
      '#' + BAR_ID + ' .disclaimer-box,#' + BAR_ID + ' .podcast-shoutout{',
      'display:block!important;position:static!important;max-width:380px;padding:8px;',
      'box-sizing:border-box;text-align:left;pointer-events:auto}',
      '.gridatlas-menu-hosted .map-controls[data-gridatlas-menu-emptied="1"]{display:none!important}',
      /* The v8 SCADA layers panel STAYS. It was hidden here unconditionally,
         and the reasoning that justified it was circular: this rule set
         display:none!important, which is why "the container height never
         changes", which was then cited as evidence the panel's own toggle was
         inert, which justified the rule. Measured on the live page at
         202609041957, with the toggle un-hidden and clicked: the label does
         flip (LAYERS -> HIDE LAYERS) and data-gridatlas-collapsed does clear.
         The toggle was never inert. Only its effect was invisible.

         The cost of the rule was the whole product surface: all 60 engine
         layer switches sat in a container measured at 0x0, on desktop AND
         phone, with the page unable to scroll to it -- zero of 120 layer
         controls reachable without opening a menu. The register, the
         voltages, the supermarkets, the transit and the EV layers were all
         still in the DOM and none of them could be touched.

         "One identity surface" is still honoured, and it was always about the
         VENTUS wordmark rather than the switches: the real .scada-brand node
         is MOVED into the Grid panel head by install(), not cloned, so the
         restored panel has no second wordmark to show. The Grid dropdown and
         this panel drive the SAME 63 original inputs -- the dropdown proxies
         them -- so the two cannot disagree about what is on.

         Requested directly by the architect, whose product this is, on
         2026-09-04: "restore v8 panels but keep dropdowns file, edit, scope,
         grid, about". Both, not either. */
      '.gridatlas-menu-hosted .scada-wrapper{display:flex!important}',
      /* At phone widths the panel starts collapsed and the toggle opens it:
         measured, an expanded panel held 31.6% of a 393x852 screen against
         the map's 29.3%, which is the wrong trade on the surface most
         readers arrive on. Desktop has the room and gets the panel open, as
         v8 always did. Either way the toggle is now visible, so the reader
         decides rather than the stylesheet. */
      '#gridatlas-dash-toggle{display:inline-flex!important}',
      /* v9.90 made the mobile project card a fixed, full-width bottom sheet.
         The old SCADA layer panel remained underneath it, so a visible layer
         checkbox could lose the hit test to text in the project card. Keep the
         conventional menu and its fixed phone panel in the higher, interactive
         stacking context whenever that sheet is open. */
      'html.gridatlas-sheet-open #' + BAR_ID + '{z-index:10020!important;pointer-events:auto!important}',
      'html.gridatlas-sheet-open #' + BAR_ID + ' .gm-panel{pointer-events:auto!important}',
      'body:not(.fs-active) #' + BAR_ID + ' #btn-fullscreen-exit{display:none!important}',
      'body.fs-active #' + BAR_ID + ' #btn-fullscreen-exit{display:flex!important}',
      /* The shell's own .custom-map-attrib (OpenStreetMap / CARTO / Open
         Charge Map credit) only ever cleared this bar while body.fs-active
         was set. At rest -- and on every Pipeline News deep-link arrival,
         which does not always reach fs-active -- the credit painted at its
         default top:10px and sat directly under the bar, invisible under
         the ABOUT title. A licence credit that is painted but covered is
         not attribution. Clear it whenever this bar is hosted, not only in
         fullscreen; --gridatlas-menu-bar-clear is kept in step with the
         bar's own rendered height (see syncAttribClearance) rather than a
         second hard-coded constant, because the bar itself drops from 36px
         to 34px under the @media rule below and a fixed number sized for
         one breakpoint would leave the credit covered, or needlessly far
         down, at the other. 44px is only the pre-JS fallback. Z-INDEX, not
         only top: measured live, an open dropdown panel painted over the
         credit's right two-thirds (elementFromPoint at 50/70/90% of its
         width resolved to the panel's own button) even though the credit's
         TOP already cleared the bar -- the two are siblings in the same
         stacking context and the panel simply painted after it. The credit
         must outrank every panel this bar can ever open, present or future,
         so its z-index is set once here rather than chased per panel. */
      '.gridatlas-menu-hosted .custom-map-attrib{',
      'top:var(--gridatlas-menu-bar-clear,44px)!important;z-index:10025!important}',
      /* The v8 fullscreen letterhead stands down once this bar hosts the
         brand. #fs-letterhead is painted only under body.fs-active, and
         fs-active is set by exactly one caller: the deep-link arrival's
         enterFullscreen(), which runs when trayTarget() is true. That is
         every phone and no desktop -- so the duplicate was invisible to
         every desktop check and present on every phone arrival. Measured
         on an iPhone 13 viewport at 202609041250: the fused masthead sat
         correctly at x=165 (11px) while this one painted at x=254 (15px),
         over the SCOPE, GRID and ABOUT titles in the right side group.
         The brand is not lost by hiding it -- it is the same wordmark,
         still on screen, now in the bar at every width and in every
         fullscreen state, which is what fusing it there was for. */
      '.gridatlas-menu-hosted #fs-letterhead{display:none!important}',
      '@media(max-width:700px){#' + BAR_ID + '{height:34px}',
      '#' + BAR_ID + ' .gm-title{min-height:34px;padding:0 6px;font-size:9px;letter-spacing:.025em}',
      '#' + BAR_ID + ' .gm-brand-slot{max-width:48%;padding:0 2px}',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header>div:first-child,',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header>div:last-child{display:none}',
      '#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:11px;letter-spacing:.14em}',
      '#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:4.5px}',
      '#' + BAR_ID + ' .gm-panel{position:fixed;top:34px;left:4px!important;right:4px!important;',
      'width:auto;max-width:none;max-height:calc(100dvh - 40px);padding-bottom:',
      'calc(6px + env(safe-area-inset-bottom))}',
      '#' + BAR_ID + ' .gm-panel-grid{max-width:none}}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
  }

  function syncAttribClearance(doc) {
    /* Measured, not asserted: the bar is 36px at rest and 34px under the
       @media(max-width:700px) rule in installStyle, and either number could
       change again. Reading the live box keeps the credit clear of the bar
       at whatever height it actually rendered, on the phone width the
       fixture failed on as much as on desktop. Guarded so the DOM-fixture
       proof, which stubs neither getBoundingClientRect nor a CSSOM style
       object, runs through this as a no-op. */
    if (!bar || typeof bar.getBoundingClientRect !== 'function') return;
    var root = doc.documentElement;
    if (!root || !root.style || typeof root.style.setProperty !== 'function') return;
    var rect = bar.getBoundingClientRect();
    var height = Math.ceil(rect.height) || 36;
    var clearance = height + 8;   // clear of the bar's own border-bottom, not flush against it
    root.style.setProperty('--gridatlas-menu-bar-clear', clearance + 'px');
    state.attrib_clearance_px = clearance;
  }

  function closeAll(focusTitle) {
    if (!bar) return;
    array(bar.querySelectorAll('.gm-menu.gm-open')).forEach(function (menu) {
      menu.classList.remove('gm-open');
      var title = menu.querySelector('.gm-title');
      var panel = menu.querySelector('.gm-panel');
      if (title) title.setAttribute('aria-expanded', 'false');
      if (panel) panel.hidden = true;
    });
    state.closed_at_rest = true;
    openPanelRefs = null;
    if (focusTitle && typeof focusTitle.focus === 'function') focusTitle.focus();
  }

  function syncLayer(key) {
    var original = layerTargets[key];
    var proxy = layerProxies[key];
    if (!original || !proxy) return;
    proxy.checked = !!original.checked;
    proxy.disabled = !!original.disabled;
    proxy.setAttribute('aria-label', layerLabel(original));
    var name = proxy.parentNode && proxy.parentNode.querySelector
      ? proxy.parentNode.querySelector('.gm-layer-name') : null;
    if (name) {
      var nextLabel = layerLabel(original);
      if (name.textContent !== nextLabel) name.textContent = nextLabel;
    }
  }

  function syncAll() {
    Object.keys(layerTargets).forEach(syncLayer);
  }

  /* Measured live: the About panel resolved to x=-95 at 1568px width, a
     quarter of its own control off the left edge of the window -- the CSS
     right:0 anchor (now scoped to the right-hand group, see installStyle)
     covers the common case, but this is the second, JS-measured guarantee
     that no panel this bar ever opens can resolve outside the viewport,
     regardless of how its title happens to be positioned. Runs after the
     panel is laid out (post layout, not pre-measured), clears any earlier
     override before measuring so a panel that no longer overflows is not
     left pinned from a previous, narrower viewport. */
  function clampPanel(doc, menu, panel) {
    if (!panel || typeof panel.getBoundingClientRect !== 'function') return;
    if (!menu || typeof menu.getBoundingClientRect !== 'function') return;
    panel.style.left = '';
    panel.style.right = '';
    var view = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    var vw = (view && view.innerWidth) || doc.documentElement.clientWidth;
    if (!vw) return;
    var margin = 4;
    var panelRect = panel.getBoundingClientRect();
    var desiredLeft = panelRect.left;
    if (panelRect.left < margin) desiredLeft = margin;
    else if (panelRect.right > vw - margin) desiredLeft = Math.max(margin, vw - margin - panelRect.width);
    if (Math.round(desiredLeft) === Math.round(panelRect.left)) return;
    var menuRect = menu.getBoundingClientRect();
    panel.style.left = (desiredLeft - menuRect.left) + 'px';
    panel.style.right = 'auto';
  }

  var openPanelRefs = null;    // {menu, panel} while a panel is open, so a resize can re-clamp it

  function openMenu(menu, title, panel) {
    var wasOpen = menu.classList.contains('gm-open');
    closeAll();
    if (wasOpen) { openPanelRefs = null; return; }
    if (title.textContent === 'Grid') syncAll();
    menu.classList.add('gm-open');
    title.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    state.closed_at_rest = false;
    openPanelRefs = { menu: menu, panel: panel };
    clampPanel(title.ownerDocument || document, menu, panel);
  }

  function buildBar(doc) {
    var nav = doc.createElement('nav');
    nav.id = BAR_ID;
    nav.setAttribute('aria-label', 'Atlas menu');

    /* Three zones, not six flat siblings. The architect's complaint was
       that the VENTUS identity had been torn out of view -- moved into a
       closed About panel, so the reader saw the v8 masthead for the first
       ~1.5s of every arrival and then watched it vanish. Fusing the brand
       into the CENTRE of the same 36px strip the menu titles already live
       in restores it permanently, at every width, with no extra row and
       therefore no map height stolen on a phone. Two flex:1 side groups
       keep the brand visually centred regardless of the (unequal) width
       of "File Edit View" versus "Scope Grid About", and give every panel
       a real left- or right-hand anchor to resolve against -- the flat
       row's "last two of six" rule is what let the About panel resolve to
       a negative x once the titles no longer filled the bar edge to edge. */
    var left = doc.createElement('div');
    left.className = 'gm-side gm-side-left';
    var right = doc.createElement('div');
    right.className = 'gm-side gm-side-right';
    var brand = doc.createElement('div');
    brand.className = 'gm-brand-slot';
    brandSlot = brand;

    MENUS.forEach(function (name, index) {
      var menu = doc.createElement('div');
      menu.className = 'gm-menu';
      var title = doc.createElement('button');
      title.type = 'button';
      title.className = 'gm-title';
      title.textContent = name;
      title.id = BAR_ID + '-title-' + index;
      title.setAttribute('aria-haspopup', 'menu');
      title.setAttribute('aria-expanded', 'false');
      title.setAttribute('aria-controls', BAR_ID + '-panel-' + index);
      var panel = doc.createElement('div');
      panel.className = 'gm-panel';
      panel.id = BAR_ID + '-panel-' + index;
      panel.hidden = true;
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', title.id);
      if (name === 'Grid') {
        /* The real v8 SCADA panel, restored: a branded head (Ventus /
           Cables & Connectivity(r) / the status legend -- the exact shell
           nodes, moved in rather than cloned) above a scrollable body that
           carries the layer groups in the two-column shape v8 used. The
           head never enters that column flow. */
        var head = doc.createElement('div');
        head.className = 'gm-panel-head';
        var body = doc.createElement('div');
        body.className = 'gm-panel-body';
        panel.appendChild(head);
        panel.appendChild(body);
        panel.classList.add('gm-panel-grid');
        gridHead = head;
        gridBody = body;
      }
      title.addEventListener('click', function (event) {
        event.stopPropagation();
        openMenu(menu, title, panel);
      });
      menu.appendChild(title);
      menu.appendChild(panel);
      (index < 3 ? left : right).appendChild(menu);
      panels[name] = panel;
      titles.push(title);
    });

    nav.appendChild(left);
    nav.appendChild(brand);
    nav.appendChild(right);

    nav.addEventListener('keydown', function (event) {
      var active = doc.activeElement;
      var index = titles.indexOf(active);
      if (event.key === 'Escape') {
        var owner = active && active.closest ? active.closest('.gm-menu') : null;
        var ownerTitle = owner && owner.querySelector ? owner.querySelector('.gm-title') : null;
        closeAll(ownerTitle);
        event.preventDefault();
        return;
      }
      if (index < 0) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        var delta = event.key === 'ArrowRight' ? 1 : -1;
        titles[(index + delta + titles.length) % titles.length].focus();
        event.preventDefault();
      } else if (event.key === 'Home' || event.key === 'End') {
        titles[event.key === 'Home' ? 0 : titles.length - 1].focus();
        event.preventDefault();
      } else if (event.key === 'ArrowDown') {
        var ownerMenu = active.closest('.gm-menu');
        var ownerPanel = ownerMenu.querySelector('.gm-panel');
        openMenu(ownerMenu, active, ownerPanel);
        var first = ownerPanel.querySelector('button,input,[role="button"]');
        if (first && first.focus) first.focus();
        event.preventDefault();
      }
    });
    return nav;
  }

  function appendGroup(panel, text) {
    var heading = document.createElement('div');
    heading.className = 'gm-layer-group';
    heading.textContent = text;
    panel.appendChild(heading);
  }

  /* The estate's other published surfaces, reachable from About.
     ------------------------------------------------------------------------
     These are method, not client material, and the publication boundary is
     explicit that method is never withheld: "the mathematics, the method and
     the derivations; the schemas, the object models and the contracts; the
     code, the solvers and the validation suites" are published openly in all
     cases (seed-data/07_CRITICALITY_AND_PUBLICATION_BOUNDARY.md, section 6).
     The engine graph is the first of them: it is where a reader, human or
     machine, sees which engine owns a calculation and which copies of it
     exist elsewhere in the estate.

     They are anchors carrying role="button" so they inherit the panel's own
     button styling rather than introducing a second look, and they open in a
     new tab so a reader never loses the map they were reading. */
  var ESTATE_LINKS = [
    { href: 'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph',
      text: 'Grid engine · the maths' },
    { href: 'https://ventusltd.github.io/data-federation-map-for-globalgrid2050-all-repos/dashboard/sandbox/spider_full_po_test.html',
      text: 'Federation map' },
    { href: 'https://ventusltd.github.io/spiders/spider_printer_v1/',
      text: 'Spider printer' }
  ];

  /* The engine's own modules, listed in File, each linking into the graph.
     ------------------------------------------------------------------------
     "we are heading towards a grid OS in our website the menus must be neat,
     it should allow AI and humans to develop and use" -- the architect,
     2026-09-05. A File menu that lists the mathematics an application runs on,
     and opens each one, is the first honest step towards that: it is what an
     IDE's File menu is for, and the publication boundary already says the
     method is published in all cases.

     The list is FETCHED from the engine's own published graph, never restated
     here. Both surfaces are served from ventusltd.github.io, so this is a
     same-origin request. If it fails -- offline, or the engine moved -- no
     group is added and the menu is exactly what it was; a File panel that
     silently lacks one group is a far better failure than a menu bar that
     throws during install. */
  var ENGINE_GRAPH_URL =
    'https://ventusltd.github.io/ventus-grid-engine/genome/engine-graph.json';
  var ENGINE_VIEW_URL =
    'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph&focus=';

  /* Set SYNCHRONOUSLY, before the fetch is issued. The DOM marker below cannot
     do this job on its own: adoptLate runs from a MutationObserver, so between
     the request going out and the rows arriving there are hundreds of further
     calls, and a guard that only checks the DOM starts a request on every one
     of them. */
  var engineFetchStarted = false;

  function appendEngineModules(panel) {
    if (!panel || !window.fetch || engineFetchStarted) return;
    if (panel.querySelector('[data-gm-engine]')) return;
    engineFetchStarted = true;
    fetch(ENGINE_GRAPH_URL, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (graph) {
      var nodes = (graph && graph.nodes) || [];
      if (!nodes.length || panel.querySelector('[data-gm-engine]')) return;

      /* EVERY node, not only the canonical eleven.
         ------------------------------------------------------------------
         The first version of this listed `type === 'canonical'` and the
         architect caught it in one line: "Why are the mjs files not there?"
         The graph publishes 44 nodes -- 11 canonical, 1 extract, 1 reference
         and 31 fragments -- and every .mjs in the estate is in the three
         groups the filter had thrown away: sizing-arithmetic.mjs is an
         extract, grid-distance-maths/src/geodesy.mjs a reference,
         atlas-pointer-deep-link.mjs and wider-fleet.mjs are fragments.

         The fragments are the most useful rows here, not the least: they are
         where a calculation has been copied and left to drift, which is the
         defect class this estate keeps paying for. A File menu that hides
         them shows the tidy half of the truth. Groups are ordered canonical
         first, then the rest, and the graph's own kind_labels are used for
         the headings where it publishes them, so this menu does not invent a
         vocabulary the graph does not use. */
      var ORDER = ['canonical', 'extract', 'reference', 'fragment'];
      var FALLBACK_LABEL = {
        canonical: 'Engine · the maths this runs on',
        extract: 'Extracts',
        reference: 'References',
        fragment: 'Copies elsewhere in the estate'
      };
      var kindLabels = (graph && graph.kind_labels) || {};
      var byKind = {};
      nodes.forEach(function (node) {
        if (!node || !node.label) return;
        var kind = node.type || 'other';
        if (!byKind[kind]) byKind[kind] = [];
        byKind[kind].push(node);
      });
      var kinds = ORDER.filter(function (k) { return byKind[k]; })
        .concat(Object.keys(byKind).filter(function (k) { return ORDER.indexOf(k) < 0; }).sort());

      /* Hand over something that RUNS, not only something that reads.
         ------------------------------------------------------------------
         "The MJS apps that AI and humans can deploy as an IDE via menu ...
         or text they could execute with AI in approved terminals or
         powershells or IDE lets hand power to the people" -- the architect,
         2026-09-05.

         This is one command, and it is one that actually works today: it
         clones the engine, installs it and runs its own fail-closed gate,
         which currently reports 8 proofs and 133 checks. It is copied to the
         clipboard rather than executed -- nothing here runs anything on
         anyone's machine, and the person or agent that pastes it into a
         terminal is the one who decides to. That is the whole of the
         approval step, and it belongs to them. */
      /* No `npm install`. Measured 202609050250: the engine declares no
         dependencies and no proof in it opens a socket, so `node verify.mjs`
         runs its whole fail-closed gate -- 8 proofs, 133 checks -- from a
         clone, offline, on any machine with node. The earlier version of this
         command included an install step, which implied a network dependency
         that does not exist and would have made the offline claim false. */
      var RUN_COMMAND =
        'git clone https://github.com/Ventusltd/ventus-grid-engine'
        + ' && cd ventus-grid-engine && node verify.mjs';

      appendGroup(panel, 'Run the engine yourself · offline, no dependencies');
      var run = document.createElement('button');
      run.setAttribute('data-gm-engine', '1');
      run.setAttribute('type', 'button');
      run.title = RUN_COMMAND;
      run.textContent = '⧉ Copy: clone the engine and run its 133 checks';
      run.addEventListener('click', function () {
        var done = function (ok) {
          run.textContent = ok
            ? '✓ Copied — paste it into a terminal'
            : '⧉ ' + RUN_COMMAND;
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(RUN_COMMAND).then(function () { done(true); },
              function () { done(false); });
          } else {
            /* No clipboard permission: show the command in full so it can
               still be selected by hand. A control that silently does
               nothing is worse than one that shows its own payload. */
            done(false);
          }
        } catch (_) { done(false); }
      });
      panel.appendChild(run);

      var total = 0;
      kinds.forEach(function (kind) {
        var group = byKind[kind];
        /* Alphabetical, as every non-version group in this estate is. */
        group.sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'en-GB'); });
        appendGroup(panel, (FALLBACK_LABEL[kind] || kindLabels[kind] || kind) + ' · ' + group.length);
        group.forEach(function (node) {
          var a = document.createElement('a');
          a.setAttribute('data-gm-engine', '1');
          a.setAttribute('role', 'button');
          a.href = ENGINE_VIEW_URL + encodeURIComponent(node.label);
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = node.label;
          /* The node's own one-line reason, as the graph publishes it. */
          if (node.reason) a.title = node.reason;
          panel.appendChild(a);
          total += 1;
        });
      });
      state.engine_modules = total;
    }).catch(function () {
      /* Deliberately silent. See the note above: the menu must survive the
         engine being unreachable, and a reader who cannot reach it is not
         helped by an error row in a File menu. */
      state.engine_modules = 0;
    });
  }

  /* Published studies, in View, beside the price control the reader is already
     using. A study is a reading of the network over time, and View is where
     this application keeps readings -- GB prices · historic is already there.
     Putting it in About would file it as provenance, which it is not: it is
     something to look at. */
  var STUDY_LINKS = [
    { href: 'https://globalgrid2050.com/data/grid_studies_public/'
        + 'great_britain_electricity_price_grid_constraint_trends_2016_2026.html',
      text: 'GB electricity price & grid constraint trends · 2016–2026' }
  ];

  function appendStudies(panel) {
    if (!panel || panel.querySelector('[data-gm-study]')) return 0;
    appendGroup(panel, 'Studies');
    var added = 0;
    STUDY_LINKS.forEach(function (item) {
      var a = document.createElement('a');
      a.setAttribute('data-gm-study', '1');
      a.setAttribute('role', 'button');
      a.href = item.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = item.text;
      panel.appendChild(a);
      added += 1;
    });
    return added;
  }

  /* Export: print a slide, or save an image of exactly what is on screen.
     ------------------------------------------------------------------------
     "allow the user to export screenshot prints via file save or file print
     and they should produce beautiful slides of what's on display be it mobile
     or desktop" -- the architect, 2026-09-05.

     Two things this must get right, and both are failure modes this estate has
     already paid for:

     1. THE IMAGE MUST NOT BE BLANK. The map is a WebGL canvas created without
        preserveDrawingBuffer, so reading it after the frame is composited
        returns an empty image. The capture therefore happens INSIDE a render
        frame, and the result is then CHECKED -- decoded and sampled for
        non-transparent pixels -- before it is offered. If it comes back blank
        the reader is told and sent to print instead. Handing someone an empty
        PNG that looks like a successful save is worse than refusing.

     2. THE CREDIT MUST TRAVEL WITH THE ARTEFACT. This generation moved the
        attribution into About, which is right for the screen and wrong for an
        export: OpenStreetMap, CARTO and Open Charge Map require attribution on
        the thing that leaves the building. Both paths re-place it, visibly, on
        the exported artefact. */
  function exportStamp() {
    var now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function attributionText(doc) {
    var node = doc.querySelector('.custom-map-attrib');
    return cleanText(node && node.textContent)
      || 'Data © OpenStreetMap contributors | © CARTO | EV data © Open Charge Map';
  }

  /* THE GENERATION IS READ FROM WHAT THE COMPOSER ACTUALLY PUBLISHES.
     v9.121 read `window.__GRIDATLAS_CURRENT__`, which exists nowhere in this
     estate: the loader in atlas/index.html writes
     `window.__GRIDATLAS_ATLAS__` and stamps
     `document.documentElement.dataset.gridatlasGeneration`. So the stamp on
     every printed sheet silently lost the build it came from -- measured at
     202609050354, the furniture read "2026-09-05 10:35 UTC" and nothing else.
     A slide that cannot be traced back to a composition is not evidence.
     Both published sources are read, because the dataset attribute survives a
     later document.write while a global would not. */
  function generationText() {
    var atlas = window.__GRIDATLAS_ATLAS__;
    var generation = (atlas && atlas.generation)
      || (document.documentElement && document.documentElement.dataset
        && document.documentElement.dataset.gridatlasGeneration);
    return generation ? 'generation ' + generation : '';
  }

  /* The slide furniture: a title, the identity of whatever is on screen, the
     credit, and the stamp. Created only while printing and removed after, so
     nothing about the live page changes. */
  function buildPrintFurniture(doc) {
    var box = doc.createElement('div');
    box.id = 'gridatlas-print-furniture';
    var selected = doc.querySelector('.project-popup .name, .gm-panel .project-name');
    var title = cleanText(selected && selected.textContent) || 'GlobalGrid2050 · Grid Atlas';
    box.innerHTML =
      '<div class="gpf-head"><span class="gpf-brand">VENTUS</span>'
      + '<span class="gpf-sub">GLOBAL GRID 2050 · GRID ATLAS</span></div>'
      + '<div class="gpf-title"></div>'
      + '<div class="gpf-foot"><span class="gpf-attrib"></span>'
      + '<span class="gpf-stamp"></span></div>';
    box.querySelector('.gpf-title').textContent = title;
    box.querySelector('.gpf-attrib').textContent = attributionText(doc);
    box.querySelector('.gpf-stamp').textContent =
      [generationText(), exportStamp()].filter(Boolean).join(' · ');
    doc.body.appendChild(box);
    return box;
  }

  function installPrintStyle(doc) {
    if (doc.getElementById('gridatlas-print-css')) return;
    var style = doc.createElement('style');
    style.id = 'gridatlas-print-css';
    style.textContent = [
      '#gridatlas-print-furniture{display:none}',
      '@media print{',
      /* The bar and every open panel are interface, not content. The map and
         the furniture are the slide. */
      '  #' + BAR_ID + '{display:none!important}',
      '  #gridatlas-print-furniture{display:block;position:fixed;inset:0;',
      '    padding:8mm;box-sizing:border-box;pointer-events:none;z-index:9;',
      '    font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0b1416}',
      '  #gridatlas-print-furniture .gpf-head{letter-spacing:.28em;font-size:13px}',
      '  #gridatlas-print-furniture .gpf-brand{font-weight:700;margin-right:10px}',
      '  #gridatlas-print-furniture .gpf-sub{opacity:.65;letter-spacing:.16em}',
      '  #gridatlas-print-furniture .gpf-title{margin-top:4mm;font-size:20px;',
      '    letter-spacing:.02em;max-width:70%}',
      '  #gridatlas-print-furniture .gpf-foot{position:absolute;left:10mm;right:10mm;',
      '    bottom:8mm;display:flex;justify-content:space-between;gap:8mm;',
      '    font-size:9px;opacity:.75}',
      /* FIT THE PAGE, whatever the page is.
         "make sure print always fits to page in landscape or portrait on
         mobile, or desktop and sizes to fit the page" -- the architect.

         The first version of this forced A4 landscape, which is the opposite
         of fitting: it overrides the reader's own paper and orientation, and
         on a phone printing to A5 or Letter it clips. `size:auto` accepts
         whatever the reader chose, and the layout then fills that page rather
         than assuming its shape.

         WHICH BOX FLEXES, AND WHICH BOX MUST NOT.
         v9.121 put `flex:1 1 auto;min-height:0;height:auto` on
         `.map-container, .maplibregl-map, .maplibregl-canvas-container`
         together, reasoning that body becomes a flex column so the map takes
         the remaining height. THAT PREMISE WAS FALSE FOR THIS DOM. The shell
         is `body > .dashboard > .map-container > #map`, and `.dashboard` is
         already the flex column (`display:flex;flex-direction:column;
         height:100dvh` in ventusv8.css). Making body a flex column therefore
         reaches `.dashboard`, never the map. `.map-container` is
         `position:relative;display:block`, so `flex:1 1 auto` on `#map` is
         inert -- and `height:auto!important` overrode `#map{height:100%}` and
         collapsed it, because its only child is `position:absolute` and
         contributes no height.

         Measured at 202609050354 under print emulation: `.maplibregl-canvas`
         was 385x0 on a 393x852 phone and 1392x0 on a 1400x900 desktop, and
         `Page.printToPDF` produced ZERO image XObjects on both. A sheet with
         no map on it.

         So `.map-container` keeps the flex line -- that part is correct and
         is what makes the sheet fit the paper, since it IS a flex child of
         `.dashboard` -- while the map chain is given an EXPLICIT print height
         instead of `auto`. Same measurement after: 385x838 and 1392x518, two
         full-resolution image XObjects, one page, both viewports. */
      '  @page{size:auto;margin:8mm}',
      '  html,body{background:#fff!important;height:100%!important;',
      '    margin:0!important;padding:0!important;overflow:hidden!important}',
      '  body{display:flex!important;flex-direction:column!important}',
      '  .map-container{',
      '    flex:1 1 auto!important;min-height:0!important;width:100%!important;',
      '    max-height:100%!important}',
      '  #map,.maplibregl-map,.maplibregl-canvas-container{',
      '    height:100%!important;width:100%!important;max-height:100%!important}',
      '  .maplibregl-canvas{width:100%!important;height:100%!important;',
      '    object-fit:contain}',
      /* Nothing may spill onto a second sheet: a slide is one page. */
      '  body>*{break-inside:avoid;page-break-inside:avoid}',
      '  body{page-break-after:avoid}',
      '}'
    ].join('');
    doc.head.appendChild(style);
  }

  function printView(doc) {
    var map = window.__GRIDATLAS_V9_MAP__;
    var canvas = map && map.getCanvas && map.getCanvas();
    if (!canvas) return;
    var capture = function () {
      var url;
      try { url = canvas.toDataURL('image/png'); } catch (_) { return; }
      if (looksBlank(canvas)) return;
      var old = doc.getElementById('gridatlas-print-furniture');
      if (old) old.remove();
      var furniture = buildPrintFurniture(doc);
      var image = doc.createElement('img');
      image.className = 'gpf-map'; image.alt = 'Current Grid Atlas map'; image.src = url;
      furniture.appendChild(image);
      var style = doc.getElementById('gridatlas-print-css');
      if (!style) { style = doc.createElement('style'); style.id = 'gridatlas-print-css'; doc.head.appendChild(style); }
      style.textContent = '#gridatlas-print-furniture{display:none}' +
        '@media print{@page{size:auto;margin:8mm}html,body{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important;background:white!important}' +
        'body>*:not(#gridatlas-print-furniture){display:none!important}' +
        '#gridatlas-print-furniture{display:block!important;position:fixed;inset:0;box-sizing:border-box;padding:4mm;background:white;color:#101c22;font:11px/1.4 system-ui}' +
        '.gpf-head{font-size:12px;letter-spacing:2px}.gpf-brand{font-weight:bold;margin-right:10px}.gpf-title{font-size:18px;margin-top:3mm}' +
        '.gpf-map{position:absolute;left:4mm;top:22mm;width:calc(100% - 8mm);height:calc(100% - 42mm);object-fit:contain}' +
        '.gpf-foot{position:absolute;left:4mm;right:4mm;bottom:3mm;display:flex;gap:12px;justify-content:space-between;font-size:9px}.gpf-stamp{white-space:nowrap}}';
      var clean = function () { furniture.remove(); window.removeEventListener('afterprint', clean); };
      window.addEventListener('afterprint', clean);
      image.decode().then(function () { window.print(); }).catch(clean);
      // Keep the snapshot while a mobile print/share dialog is open.
      window.setTimeout(clean, 300000);
    };
    map.once('render', capture); map.triggerRepaint();
  }


  /* Was anything actually drawn? A canvas read outside a render frame returns
     a fully transparent image, which encodes to a small PNG and downloads
     perfectly happily. Sample it rather than trust it. */
  function looksBlank(canvas) {
    try {
      var probe = document.createElement('canvas');
      probe.width = 40; probe.height = 40;
      var context = probe.getContext('2d');
      context.drawImage(canvas, 0, 0, 40, 40);
      var data = context.getImageData(0, 0, 40, 40).data;
      for (var i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
      return true;
    } catch (_) {
      /* A tainted canvas throws here. That is not blank, and treating it as
         blank would send the reader to print for no reason. */
      return false;
    }
  }

  function saveImage(doc, button) {
    /* THE MAP HANDLE IS THE ONE THE ESTATE ACTUALLY PUBLISHES.
       v9.121 read `window.__GRIDATLAS_MAP__ || (window.map && ...)`. Neither
       resolves: `__GRIDATLAS_MAP__` is assigned nowhere in this estate, and
       `window.map` is the DIV `<div id="map">` by named-element reflection,
       whose `.getCanvas` is undefined. `map` was therefore null on every
       attempt, the render-frame guard below was skipped, and the canvas was
       read OUTSIDE a frame -- the exact failure the guard exists to prevent.
       Every save on both viewports refused with "the map could not be
       captured". The search cartridge publishes
       `window.__GRIDATLAS_V9_MAP__`, and that is the handle. With it, inside
       `map.once('render')`, looksBlank() is false and toDataURL returns a
       real image. The guard was sound; only the lookup was wrong. */
    var map = window.__GRIDATLAS_V9_MAP__;
    if (!map || !map.getCanvas) {
      map = (window.map && window.map.getCanvas) ? window.map : null;
    }
    var canvas = doc.querySelector('.maplibregl-canvas')
      || (map && map.getCanvas ? map.getCanvas() : null);
    var say = function (text) { button.textContent = text; };

    if (!canvas) { say('⊘ No map canvas to save — use Print'); return; }

    var grab = function () {
      var url;
      try { url = canvas.toDataURL('image/png'); } catch (_) { url = null; }
      if (!url || looksBlank(canvas)) {
        /* Refused, and the reason is said out loud. The alternative is a file
           that opens as an empty rectangle an hour later, in front of someone
           else. */
        say('⊘ The map could not be captured — use Print instead');
        return;
      }
      var link = doc.createElement('a');
      link.href = url;
      link.download = 'gridatlas-' + exportStamp().replace(/[^0-9]/g, '').slice(0, 12) + '.png';
      doc.body.appendChild(link);
      link.click();
      doc.body.removeChild(link);
      say('✓ Image saved');
      window.setTimeout(function () { say('⤓ Save an image of this view'); }, 4000);
    };

    /* Inside a render frame, which is what makes the read non-blank on a
       canvas created without preserveDrawingBuffer. */
    if (map && map.once && map.triggerRepaint) {
      map.once('render', grab);
      map.triggerRepaint();
    } else {
      grab();
    }
  }

  function appendExport(panel, doc) {
    if (!panel || panel.querySelector('[data-gm-export]')) return 0;
    appendGroup(panel, 'Export this view');

    var print = doc.createElement('button');
    print.setAttribute('data-gm-export', '1');
    print.setAttribute('type', 'button');
    print.textContent = '⎙ Print · or save as PDF';
    print.addEventListener('click', function () { printView(doc); });
    panel.appendChild(print);

    var image = doc.createElement('button');
    image.setAttribute('data-gm-export', '1');
    image.setAttribute('type', 'button');
    image.textContent = '⤓ Save an image of this view';
    image.addEventListener('click', function () { saveImage(doc, image); });
    panel.appendChild(image);

    return 2;
  }

  function appendEstateLinks(panel) {
    if (!panel || panel.querySelector('[data-gm-estate]')) return 0;
    appendGroup(panel, 'Estate');
    var added = 0;
    ESTATE_LINKS.forEach(function (item) {
      var a = document.createElement('a');
      a.setAttribute('data-gm-estate', '1');
      a.setAttribute('role', 'button');
      a.href = item.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = item.text;
      panel.appendChild(a);
      added += 1;
    });
    return added;
  }

  /* A measured audit found the v8 panel's own checkboxes at 17x17 px --
     the input element itself, not just its label. A label with a tall
     min-height passes a hit-test at its centre but still measures 17x17
     if something re-measures the <input> node's own rect, the way the
     live audit did. So the proxy <input> here is stretched, invisible,
     over the FULL label (position:absolute;inset:0) -- its own
     getBoundingClientRect() is therefore the whole >=44px control, under
     any measurement method -- and a separate, normally-sized box (built
     from CSS alone, no image) carries the visible tick. */
  function layerCheckbox(kind) {
    var proxy = document.createElement('input');
    proxy.type = kind;
    var box = document.createElement('span');
    box.className = 'gm-layer-box';
    box.setAttribute('aria-hidden', 'true');
    return { proxy: proxy, box: box };
  }

  function buildLayerControls(found) {
    var lastGroup = '';
    found.controls.forEach(function (original) {
      var key = layerKey(original);
      var group = layerGroup(original);
      if (group !== lastGroup) {
        appendGroup(gridBody, group);
        lastGroup = group;
      }
      var label = document.createElement('label');
      label.className = 'gm-layer';
      label.setAttribute('data-gridatlas-layer-key', key);
      var built = layerCheckbox('checkbox');
      var proxy = built.proxy;
      proxy.setAttribute('data-gridatlas-layer-proxy', key);
      var name = document.createElement('span');
      name.className = 'gm-layer-name';
      label.appendChild(proxy);
      label.appendChild(built.box);
      label.appendChild(name);
      gridBody.appendChild(label);
      layerTargets[key] = original;
      layerProxies[key] = proxy;
      proxy.addEventListener('change', function () {
        if (!!original.checked !== !!proxy.checked && typeof original.click === 'function') {
          /* original.click() must remain the implementation: its delegated
             engine listener owns hydration.  Suppress only the document-level
             outside-click closer while that synchronous forwarding runs, so
             the reader can see the tick and its live load state. */
          forwardingLayerChoice = true;
          try { original.click(); }
          finally { forwardingLayerChoice = false; }
        }
        syncLayer(key);
      });
      syncLayer(key);
    });

    var basemaps = array(found.host.querySelectorAll('input[type="radio"][name="bm"]'));
    if (basemaps.length) appendGroup(gridBody, 'Basemap');
    basemaps.forEach(function (original) {
      var label = document.createElement('label');
      label.className = 'gm-layer';
      var built = layerCheckbox('radio');
      var proxy = built.proxy;
      proxy.name = 'gridatlas-menu-basemap';
      proxy.value = original.value;
      proxy.checked = !!original.checked;
      var name = document.createElement('span');
      name.className = 'gm-layer-name';
      name.textContent = cleanText(original.closest('label').textContent) || original.value;
      proxy.addEventListener('change', function () {
        if (proxy.checked && !original.checked && typeof original.click === 'function') original.click();
        closeAll();
      });
      label.appendChild(proxy);
      label.appendChild(built.box);
      label.appendChild(name);
      gridBody.appendChild(label);
    });
  }

  function move(panel, node, label) {
    if (!node || !panel || (bar && bar.contains(node))) return false;
    if (label && node.setAttribute) node.setAttribute('aria-label', label);
    panel.appendChild(node);             // same node: its original listener survives
    if (node.removeAttribute) node.removeAttribute('hidden');
    state.controls_moved += 1;
    return true;
  }

  function trayRoute(node) {
    var text = cleanText(node && node.textContent).toLowerCase();
    if (/\bclear\b|\bscope\b/.test(text)) return 'Scope';
    if (/\bgrid\b|\bsubs\b/.test(text)) return 'Grid';
    return '';
  }

  /* The two chips that must NOT be swallowed by a menu on a phone.
     ------------------------------------------------------------------------
     GRID and SUBS were put on the map deliberately, and the reason is on the
     record: the grid-line and substation switches live in the SCADA panel
     below the map, "which a phone never scrolls to; activation looked
     broken" (composition manifest, mobile_tray, from phone acceptance on
     2026-09-01). Moving every tray button into a dropdown re-created a milder
     form of exactly that fault - measured at an iPhone 13 viewport on
     202609041330, zero layer controls were reachable without first opening a
     menu.

     So on a touch screen or a narrow window these two stay where they were
     designed to be. Everything else still routes into the menus, and desktop
     is unchanged: there the chips are redundant with a menu that is already
     one click away and always visible. */
  function chipStaysOnMap(node) {
    var text = cleanText(node && node.textContent).toLowerCase();
    if (!/\bgrid\b|\bsubs\b/.test(text)) return false;
    /* An UNKNOWN width is not a phone. Reading `(window.innerWidth || 0) <= 700`
       makes a missing or zero width report narrow, which is the wrong way for
       a default to fail: it would strand these chips on the map in any host
       that does not publish a width, including a headless proof fixture. The
       width has to be a real positive number before it argues for a phone. */
    var coarse = false;
    try {
      coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (error) {
      coarse = false;
    }
    var width = Number(window.innerWidth);
    var narrow = isFinite(width) && width > 0 && width <= 700;
    return coarse || narrow;
  }

  function adoptLate(doc) {
    if (!bar) return;
    move(panels.View, doc.getElementById('gridatlas-gb-conditions'));
    move(panels.About, doc.getElementById('gridatlas-version-ledger'));
    move(panels.View, doc.getElementById('btn-fullscreen-exit'), 'Exit full screen');

    var curtain = doc.getElementById('fs-curtain-tab');
    if (curtain && !bar.contains(curtain)) {
      curtain.setAttribute('role', 'button');
      curtain.setAttribute('tabindex', '0');
      curtain.setAttribute('aria-label', 'Open the fullscreen layer curtain');
      move(panels.Grid, curtain);
    }

    var tray = doc.getElementById('gridatlas-mobile-tray');
    if (tray) {
      array(tray.querySelectorAll('button')).forEach(function (button) {
        if (chipStaysOnMap(button)) return;   // one tap on a phone, not two
        var route = trayRoute(button);
        if (route) move(panels[route], button);
        else button.hidden = true;       // Tools only revealed the controls now in menus
      });
    }

    move(panels.Scope, doc.getElementById('btn-gridpoint'));

    var disclaimer = doc.querySelector('.disclaimer-box');
    var shoutout = doc.querySelector('.podcast-shoutout');
    move(panels.About, disclaimer);
    move(panels.About, shoutout);

    state.estate_links = appendEstateLinks(panels.About);
    appendEngineModules(panels.File);
    state.export_controls = appendExport(panels.File, doc);
    state.studies = appendStudies(panels.View);

    /* The map attribution moves off the map and into About, LAST, in small
       print.
       ----------------------------------------------------------------------
       Measured live at generation 202609042123, 2026-09-05: .custom-map-attrib
       rendered at x=15 y=47, 401x24 px -- a boxed band immediately under the
       menu bar, over the top-left of the map, which is where a reader arriving
       on a deep link looks first. On a 393x852 phone it wrapped to two lines
       and the architect photographed the consequence: opening EDIT drew
       "Status Colours" UNDERNEATH the attribution box, the two overlapping in
       the same space. His instruction, verbatim: "Attribution bar clashes move
       that to about and in small print at the bottom".

       The credit is owed and is not dropped: it is the same node, moved once,
       text intact, so OpenStreetMap, CARTO and Open Charge Map are still named
       on the page and one tap away. It is appended AFTER the estate links, and
       re-appended on every later adoption pass, so a late DOM rebuild cannot
       leave it above the controls again. appendChild on a node already in the
       panel moves it to the end rather than duplicating it. */
    var attrib = doc.querySelector('.custom-map-attrib');
    if (attrib) {
      if (!bar || !bar.contains(attrib)) move(panels.About, attrib);
      else if (panels.About.lastElementChild !== attrib) panels.About.appendChild(attrib);
      /* The `lastElementChild` test is not tidiness, it is the difference
         between this working and crashing the tab. adoptLate runs from a
         MutationObserver, so an unconditional appendChild here IS a mutation,
         which re-enters adoptLate, which appends again: a feedback loop that
         crashed the renderer outright under the 393x852 arrival gate, while
         the previous generation passed the same gate in the same harness.
         Once the node is already last, this is a no-op and the loop closes. */
    }

    /* The real .scada-brand (VENTUS, again) and .status-legend move once,
       into the restored SCADA panel's head, during install() below -- not
       hidden as a "duplicate" and not here, so a late DOM rebuild cannot
       repeatedly fight over one node's location. */

    /* The panel's own show/hide control stays REACHABLE. It was hidden here as
       "superseded; measured inert", and it is neither: the stylesheet rule
       above was hiding the panel it moved, so its effect could not be seen.
       With the panel restored this is the only control that opens and closes
       it, and hiding it would leave a phone with a collapsed panel and nothing
       to open it with -- which is the fault this generation exists to end. */
    var dashToggle = doc.getElementById('gridatlas-dash-toggle');
    if (dashToggle) dashToggle.hidden = false;

    var stack = doc.querySelector('.map-controls');
    if (stack) {
      var leftovers = array(stack.querySelectorAll('button,input,select,textarea,a'))
        .filter(function (node) { return !node.hidden; });
      if (leftovers.length === 0) stack.setAttribute('data-gridatlas-menu-emptied', '1');
    }

    MENUS.forEach(function (name) {
      state.panel_counts[name] = panels[name] ? panels[name].children.length : 0;
    });
  }

  function install(doc) {
    if (state.installed || doc.getElementById(BAR_ID)) return true;
    var ready = required(doc);
    state.engine_layer_controls = ready.found.engine.length;
    state.pipeline_layer_controls = ready.found.pipeline.length;
    state.layer_controls = ready.found.controls.length;
    if (ready.missing.length) {
      state.waiting_for = ready.missing.slice();
      return false;
    }

    installStyle(doc);
    bar = buildBar(doc);
    buildLayerControls(ready.found);

    // Search stays on the map throughout initialization.
    if (ready.nodes.search) ready.nodes.search.setAttribute("data-testcode-search", "persistent");
    move(panels.File, ready.nodes.exportButton);
    move(panels.Edit, ready.nodes.statusButton);
    move(panels.View, ready.nodes.fullscreenButton);
    move(panels.Scope, ready.nodes.radiusButton);
    move(panels.Scope, ready.nodes.radiusAreaButton);
    move(panels.Scope, ready.nodes.zoneButton);
    move(panels.Scope, ready.nodes.measureButton);

    /* The VENTUS masthead: fused into the bar's own centre (see buildBar),
       never a closed panel -- the architect's "VENTUS branding has been
       lost" was this node being moved into a collapsed About panel, and
       the measured "flash then vanish" (present for ~1.5s, then torn out)
       was that same move happening after the raw v8 page had already
       painted it once. Moving it here, into brandSlot, keeps it visible
       through the whole transition: raw markup, then fused into the bar,
       never hidden in between. */
    move(brandSlot, ready.nodes.header);

    /* The restored SCADA panel's head: the real .scada-brand (VENTUS,
       again, exactly as v8 rendered it) and .status-legend, moved once --
       not cloned, not hidden as a duplicate. gridHead sits above gridBody
       (built by buildLayerControls) and never enters its column flow. */
    move(gridHead, doc.querySelector('.scada-brand'));
    move(gridHead, doc.querySelector('.status-legend'));

    ready.nodes.host.insertBefore(bar, ready.nodes.host.firstChild);
    doc.documentElement.classList.add('gridatlas-menu-hosted');
    syncAttribClearance(doc);
    if (typeof ResizeObserver === 'function') {
      var barResize = new ResizeObserver(function () {
        syncAttribClearance(doc);
        if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
      });
      barResize.observe(bar);
      state.attrib_clearance_source = 'ResizeObserver';
    } else if (doc.defaultView && typeof doc.defaultView.addEventListener === 'function') {
      /* No ResizeObserver: a viewport resize is the only other way the
         bar's own height changes (the @media breakpoint), so fall back to
         watching that. */
      doc.defaultView.addEventListener('resize', function () {
        syncAttribClearance(doc);
        if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
      });
      state.attrib_clearance_source = 'resize-listener';
    }

    /* One document click listener and one change listener, installed once.
       The retry path cannot multiply effects. */
    doc.addEventListener('click', function (event) {
      if (!bar.contains(event.target)) {
        if (!forwardingLayerChoice) closeAll();
      }
      else if (event.target && /^(BUTTON|INPUT)$/.test(event.target.tagName || '')) {
        if (event.target.type !== 'text'
          && !event.target.classList.contains('gm-title')
          && !event.target.hasAttribute('data-gridatlas-layer-proxy')) {
          window.setTimeout ? window.setTimeout(closeAll, 0) : closeAll();
        }
      }
    });
    doc.addEventListener('change', function (event) {
      var key = layerKey(event.target);
      if (key && layerProxies[key]) syncLayer(key);
    });
    state.listeners = 2;

    adoptLate(doc);
    closeAll();
    state.installed = true;
    state.waiting_for = [];
    state.failure = null;
    state.one_identity_surface = true;
    state.mobile_sheet_hit_target_guard = true;
    state.layer_status_mirrored = true;
    state.layer_menu_stays_open = true;

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(function () {
        adoptLate(doc);
        syncAll();
      });
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    }
    return true;
  }

  state.install = function () { return install(document); };
  state.closeAll = closeAll;

  function loudFailure(doc) {
    if (state.installed || doc.getElementById(FAILURE_ID)) return;
    var found = inventory(doc);
    state.failure = 'menu not installed: expected 60 engine + 3 Pipeline News layer controls; found '
      + found.engine.length + ' + ' + found.pipeline.length;
    if (window.console && typeof window.console.error === 'function') {
      window.console.error('[GRIDATLAS MENU] ' + state.failure);
    }
    var alert = doc.createElement('div');
    alert.id = FAILURE_ID;
    alert.setAttribute('role', 'alert');
    alert.textContent = state.failure + '. Original controls remain available.';
    alert.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:10030;'
      + 'padding:8px;background:#280b0b;color:#ffd0d0;border:1px solid #b44;'
      + 'font:11px/1.4 monospace';
    (doc.body || doc.documentElement).appendChild(alert);
  }

  function start() {
    /* Cartridge proofs and prerenderers can provide a deliberately partial
       document. Treat that exactly like any other missing dependency: publish
       the refusal and leave the owner's interface untouched. In particular,
       do not start the 40-second browser retry loop against a non-DOM stub. */
    if (!document.documentElement || typeof document.createElement !== 'function') {
      state.failure = 'menu not installed: full document unavailable';
      return;
    }
    var probe = document.createElement('div');
    if (!probe || typeof probe.setAttribute !== 'function' || !probe.classList) {
      state.failure = 'menu not installed: full DOM element API unavailable';
      return;
    }
    if (install(document)) return;
    if (typeof window.setInterval !== 'function'
      || typeof window.clearInterval !== 'function') return;
    timer = window.setInterval(function () {
      state.tries += 1;
      if (install(document)) {
        window.clearInterval(timer);
        timer = null;
      } else if (state.tries >= MAX_TRIES) {
        window.clearInterval(timer);
        timer = null;
        loudFailure(document);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());

;(() => {
 const style=document.createElement('style');style.textContent=`
 .search-bar-wrapper{display:flex!important;position:absolute!important;top:64px!important;left:12px!important;right:12px!important;width:auto!important;max-width:520px!important;z-index:1100!important;margin:0!important;transform:none!important}
 .search-bar-wrapper input{min-height:48px!important;font-size:16px!important;width:100%!important;box-sizing:border-box}
 .testcode-identity{position:fixed;right:12px;bottom:64px;z-index:2000;background:#08161fee;color:#aaf6ff;padding:8px;border:1px solid #36616a;font:12px monospace;text-decoration:none}
 @media print{.testcode-identity,.search-bar-wrapper{display:none!important}}
 `;document.head.append(style);
 const link=document.createElement('a');link.className='testcode-identity';link.href='/testcode/202609051214/';link.textContent='Test Code · 202609051214';document.body.append(link);
})();
