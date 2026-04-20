# GlobalGrid2050 | Ventus Core V2 Architecture

**Version:** 2.0.0-blueprint  
**Status:** Design Phase  
**Last Updated:** 2025-01-14  
**Approved By:** Pending Senior Review

---

## Directive

**DO NOT IMPLEMENT THIS UNTIL APPROVED.**

This document replaces the v1 monolith architecture (ventus-core.js, 1,170 lines) with a modular, lifecycle-aware, testable foundation.

V2 is not a feature addition. V2 is a **systems engineering correction** to enable safe embedding, plugin architecture, and constraint-first spatial reasoning at scale.

---

## 1. Core Principles

### 1.1 Lifecycle First
Every subsystem must define:
- `init(context)`
- `dispose()`
- Cleanup paths for listeners, timers, requests, observers

No global state without ownership. No network request without cancellation. No DOM mutation without teardown.

### 1.2 State Centralization
All mutable state lives in **one authoritative store**.  
No scattered module-scoped `let` variables.  
Subsystems subscribe to state changes; they do not mutate directly.

### 1.3 Explicit Render Boundaries
State changes trigger **named render functions**, not ad-hoc DOM mutations.  
No imperative jQuery-style updates scattered across event handlers.

### 1.4 Test-Driven Refactor
Critical tests (geometry, state, export) are written **BEFORE** modules are split.  
Integration tests come during refactor.  
E2E tests come after stabilization.

### 1.5 Plugin Architecture
Core provides narrow, capability-based plugin API.  
Plugins register tools, controls, search providers, layer processors.  
Plugins cannot mutate core internals.

---

## 2. Public API Contract

### 2.1 Primary API (ESM/npm)

```javascript
import { VentusMap } from '@ventus/core';

const map = new VentusMap(container, {
  config: layerConfig,      // Array<LayerGroup>
  center: [-3.5, 54.0],     // [lon, lat]
  zoom: 4.2,                // number
  basemap: 'dark',          // 'dark' | 'satellite'
  debug: false,             // enables instrumentation
  plugins: []               // Array<VentusPlugin>
});

// Lifecycle
map.destroy();              // Clean teardown

// Events
map.on('layer:loaded', ({ layerId }) => {});
map.on('tool:activated', ({ toolId }) => {});
map.on('search:result', ({ feature }) => {});

// Controls
map.enableTool('radius');
map.disableTool('radius');
map.exportCSV();
map.toggleLayer('solar', true);

// State access (read-only)
map.getState();
```

### 2.2 Legacy API (HTML Embed)

Thin wrapper for backward compatibility:

```javascript
window.initVentusMap({
  config: ukConfig,
  center: [-3.5, 54.0],
  zoom: 4.2
});
```

Internally creates singleton `VentusMap` instance. No destroy support in legacy mode.

---

## 3. Module Structure

```
ventus-core-v2/
├── src/
│   ├── core/
│   │   ├── VentusMap.js        # Main class, lifecycle owner
│   │   ├── boot.js             # Initialization sequence
│   │   └── context.js          # Shared context object
│   ├── state/
│   │   ├── store.js            # State container
│   │   ├── actions.js          # State mutations
│   │   ├── selectors.js        # Derived data
│   │   └── types.js            # State shape (TypeScript later)
│   ├── map/
│   │   ├── adapter.js          # MapLibre abstraction layer
│   │   ├── sources.js          # Source registration
│   │   └── styles.js           # Layer paint/layout logic
│   ├── layers/
│   │   ├── registry.js         # Layer config management
│   │   ├── hydration.js        # Lazy load coordinator
│   │   └── visibility.js       # Show/hide logic
│   ├── tools/
│   │   ├── ToolBase.js         # Abstract tool interface
│   │   ├── RadiusTool.js       # Radius search
│   │   ├── MeasureTool.js      # Distance/area measurement
│   │   ├── ZoneDrawTool.js     # Polygon zone drawing
│   │   └── registry.js         # Tool lifecycle manager
│   ├── network/
│   │   ├── queue.js            # Fetch queue (4 concurrent)
│   │   ├── cache.js            # URL cache with TTL
│   │   ├── abort.js            # AbortController ownership
│   │   └── geojson.js          # GeoJSON parser
│   ├── geometry/
│   │   ├── haversine.js        # Geodesic distance
│   │   ├── circle.js           # Geodesic circle generation
│   │   ├── area.js             # Polygon area calculation
│   │   └── constants.js        # Earth model (WGS84)
│   ├── ui/
│   │   ├── render.js           # Main render coordinator
│   │   ├── legend.js           # renderLegend(state)
│   │   ├── controls.js         # renderControls(state)
│   │   ├── stats.js            # renderStats(state)
│   │   ├── popup.js            # Popup manager
│   │   └── dom.js              # DOM utilities
│   ├── search/
│   │   ├── index.js            # Search index builder
│   │   ├── query.js            # Fuzzy search logic
│   │   └── results.js          # Results rendering
│   ├── export/
│   │   └── csv.js              # CSV export logic
│   ├── plugins/
│   │   └── api.js              # Plugin registration interface
│   └── utils/
│       ├── format.js           # Number formatting
│       ├── sanitize.js         # HTML escaping
│       └── validators.js       # Input validation
├── dist/
│   ├── ventus-core.esm.js      # ES modules
│   └── ventus-core.umd.js      # UMD for HTML embed
└── test/
    ├── unit/                    # Geometry, state, formatters
    ├── integration/             # Layer loading, tools
    └── e2e/                     # Playwright/Cypress
```

---

## 4. State Management

### 4.1 State Shape

```javascript
{
  // Map state
  map: {
    center: [lon, lat],
    zoom: number,
    basemap: 'dark' | 'satellite'
  },

  // Layer state
  layers: {
    visible: Set<string>,          // Layer IDs currently visible
    loaded: Map<string, boolean>,  // Load status per layer
    stats: Map<string, { count, mw }> // Derived stats
  },

  // Tool state
  tools: {
    active: string | null,         // One active tool at a time
    transient: {                   // Tool-specific state
      radius: { center, km },
      measure: { points, closed },
      zonedraw: { vertices }
    }
  },

  // UI state
  ui: {
    popup: { visible, coords, content },
    search: { query, results, selected },
    fullscreen: boolean,
    curtainOpen: boolean
  },

  // Network state
  network: {
    queue: Array<Request>,
    inFlight: Set<string>,         // URLs being fetched
    abortControllers: Map<string, AbortController>
  }
}
```

### 4.2 State Mutations

All mutations via **actions**:

```javascript
// Bad (v1)
statusMode = !statusMode;

// Good (v2)
dispatch({ type: 'TOOL_TOGGLE', payload: { tool: 'status' } });
```

Subsystems subscribe to relevant state slices:

```javascript
store.subscribe('tools.active', (activeTool) => {
  renderToolOverlay(activeTool);
});
```

---

## 5. Tool Lifecycle Contract

Every tool must implement:

```javascript
class ToolBase {
  constructor(context) {
    this.context = context;  // { map, state, dispatch }
    this.listeners = [];
    this.abortController = null;
  }

  // Lifecycle
  enable() {
    // Disable other tools
    // Set cursor
    // Register map listeners
    // Show UI overlay
  }

  disable() {
    // Remove listeners
    // Clear overlays
    // Reset state
  }

  dispose() {
    // Full cleanup
    // Cancel pending requests
  }

  // Event handlers (optional)
  onMapClick(e) {}
  onMapMove(e) {}
  onKeyDown(e) {}
}
```

### 5.1 Tool Registry

```javascript
class ToolRegistry {
  constructor(context) {
    this.tools = new Map();
    this.active = null;
  }

  register(id, ToolClass) {
    this.tools.set(id, new ToolClass(this.context));
  }

  enable(id) {
    if (this.active) this.active.disable();
    const tool = this.tools.get(id);
    tool.enable();
    this.active = tool;
  }

  dispose() {
    this.tools.forEach(tool => tool.dispose());
  }
}
```

---

## 6. AbortController Strategy

### 6.1 Ownership Rules

**Layer Manager owns layer fetch aborts:**

```javascript
class LayerHydration {
  constructor() {
    this.abortControllers = new Map(); // layerId -> AbortController
  }

  async loadLayer(layerId, url) {
    // Cancel any pending request for this layer
    if (this.abortControllers.has(layerId)) {
      this.abortControllers.get(layerId).abort();
    }

    const controller = new AbortController();
    this.abortControllers.set(layerId, controller);

    try {
      const response = await fetch(url, { 
        signal: controller.signal 
      });
      const data = await response.json();
      this.abortControllers.delete(layerId);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[CANCELLED] ${layerId}`);
      }
      throw err;
    }
  }

  cancelLayer(layerId) {
    const controller = this.abortControllers.get(layerId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(layerId);
    }
  }

  cancelAll() {
    this.abortControllers.forEach(ctrl => ctrl.abort());
    this.abortControllers.clear();
  }
}
```

### 6.2 Abort Trigger Points

| Event | Action |
|-------|--------|
| Layer toggled off | Cancel layer fetch immediately |
| Tool disabled | Cancel tool-initiated requests (e.g., search) |
| Map destroyed | Cancel all pending requests |
| Layer toggled on (while loading) | Cancel old request, start new |

### 6.3 Fetch Queue Integration

```javascript
class FetchQueue {
  async add(url, abortSignal) {
    if (this.active >= this.concurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.active++;
    try {
      const response = await fetch(url, { signal: abortSignal });
      return await response.json();
    } finally {
      this.active--;
      if (this.queue.length > 0) this.queue.shift()();
    }
  }
}
```

---

## 7. Render Model

### 7.1 Named Render Functions

All UI updates go through explicit render functions:

```javascript
// legend.js
export function renderLegend(state) {
  const { layers } = state;
  const container = document.getElementById('scada-ui-container');

  // Build DOM from state
  const fragment = buildLegendDOM(layers);
  container.replaceChildren(fragment);
}

// controls.js
export function renderControls(state) {
  const { tools } = state;
  document.querySelectorAll('.map-ctrl-btn').forEach(btn => {
    const toolId = btn.dataset.tool;
    btn.classList.toggle('active', tools.active === toolId);
    btn.setAttribute('aria-pressed', tools.active === toolId);
  });
}

// stats.js
export function renderStats(state) {
  const { layers } = state;
  layers.stats.forEach((stat, layerId) => {
    const label = document.getElementById(`lbl-${layerId}`);
    if (label) {
      const base = label.dataset.baseLabel;
      const mw = stat.mw >= 1000 
        ? `${(stat.mw / 1000).toFixed(1)}GW` 
        : `${Math.round(stat.mw)}MW`;
      label.innerText = `${base} [${stat.count} | ${mw}]`;

      // Announce to screen readers
      const liveRegion = document.getElementById('aria-live-stats');
      liveRegion.textContent = `${base} loaded: ${stat.count} assets, ${mw}`;
    }
  });
}

// visibility.js
export function renderLayerVisibility(state) {
  const { layers, map } = state;
  layers.visible.forEach(layerId => {
    if (map.getLayer(`l-${layerId}`)) {
      map.setLayoutProperty(`l-${layerId}`, 'visibility', 'visible');
    }
  });
}

// toolOverlay.js
export function renderToolOverlay(state) {
  const { tools } = state;

  // Hide all tool overlays
  document.querySelectorAll('.tool-overlay').forEach(el => {
    el.style.display = 'none';
  });

  // Show active tool overlay
  if (tools.active) {
    const overlay = document.getElementById(`${tools.active}-overlay`);
    if (overlay) overlay.style.display = 'block';
  }
}
```

### 7.2 Render Cycle (Pseudocode)

```javascript
// Main render coordinator
export class Renderer {
  constructor(context) {
    this.context = context;
    this.dirty = new Set();
    this.rafId = null;
  }

  markDirty(subsystem) {
    this.dirty.add(subsystem);
    this.scheduleRender();
  }

  scheduleRender() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.render();
      this.rafId = null;
    });
  }

  render() {
    const state = this.context.state.getState();

    if (this.dirty.has('legend')) {
      renderLegend(state);
    }
    if (this.dirty.has('controls')) {
      renderControls(state);
    }
    if (this.dirty.has('stats')) {
      renderStats(state);
    }
    if (this.dirty.has('visibility')) {
      renderLayerVisibility(state);
    }
    if (this.dirty.has('toolOverlay')) {
      renderToolOverlay(state);
    }

    this.dirty.clear();
  }

  dispose() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
```

### 7.3 State Change Flow

```
User Action
  ↓
Event Handler
  ↓
dispatch({ type, payload })
  ↓
State Mutation
  ↓
Subscribers Notified
  ↓
renderer.markDirty('subsystem')
  ↓
requestAnimationFrame
  ↓
render()
```

**No direct DOM manipulation in event handlers.**

---

## 8. Migration Path (4 Phases)

### Phase 1: Foundation & Cleanup (4 weeks)

**Goals:**
- Define public API
- Centralize state
- Fix memory leaks
- Add core tests

**Deliverables:**
1. **API Contract:** `VentusMap` class signature, events, destroy()
2. **State Store:** Single source of truth with actions/selectors
3. **Memory Leak Fixes (MANDATORY):**
   - **rAF Cleanup Registry:** Track all `requestAnimationFrame` IDs, cancel on destroy
   - **urlCache TTL/Expiry:** Add 5-minute TTL to URL cache entries, auto-evict stale entries
   - **Listener Teardown Audit:** Enumerate all event listeners (map, DOM, window), ensure removal paths exist
   - **8-Hour Dashboard Fix:** Add `visibilitychange` listener to pause updates when tab hidden, preventing Gemini's crash scenario
4. **Tests (BEFORE refactor begins):**
   - Geometry: Haversine, circle generation, area calculation (golden tests)
   - State transitions: Tool enable/disable, layer toggle
   - CSV export: Escaping, filtering, filename generation
5. **Fetch Abort Strategy:** Implement `AbortController` ownership model (layer manager, tool registry)

**Success Criteria:**
- All geometry tests pass
- `VentusMap.destroy()` removes all listeners and cancels all requests
- No console errors after 10 layer toggles + destroy

---

### Phase 2: Modularization & Tool Architecture (6 weeks)

**Goals:**
- Split monolith into modules
- Extract tool system
- Move preprocessing offline

**Deliverables:**
1. **Module Split:** Follow folder structure (Section 3)
2. **Tool Lifecycle:** `ToolBase` class, registry, enable/disable contracts
3. **Preprocessing:** Move line snapping to `scripts/snap_topology.py`
4. **Data Structures:** Replace arrays with `Set`/`Map` for layer visibility
5. **Render Functions:** Implement named render functions (Section 7)
6. **Integration Tests:**
   - Layer loading with abort
   - Tool mode switching
   - Fullscreen state transitions

**Success Criteria:**
- All v1 features work with new architecture
- No runtime line snapping
- Layer toggle < 50ms (profiled)

---

### Phase 3: UI, Accessibility & Instrumentation (4 weeks)

**Goals:**
- Accessibility baseline
- Debug tooling
- UX polish

**Deliverables:**
1. **Accessibility (See Section 11)**
2. **Debug Mode:**
   - Timing logs for fetch/parse
   - Layer load status panel
   - Event trace for tool activation
3. **Adaptive LOD:** Circle vertex count based on screen radius
4. **Search Improvements:**
   - Debounce input (300ms)
   - Accent folding
   - Rank by capacity + text relevance
5. **E2E Tests:**
   - Radius search flow
   - Zone draw + undo
   - Keyboard navigation

**Success Criteria:**
- WCAG 2.1 AA audit passes
- Debug panel shows timing for all fetches
- Mobile keyboard controls work

---

### Phase 4: TypeScript & Advanced Features (4 weeks)

**Goals:**
- Type safety
- Plugin API
- Optional enhancements

**Deliverables:**
1. **TypeScript Migration:** Convert modules incrementally
2. **Plugin API:** Interface definition, registration, sample plugins
3. **CSS Modernization:** Custom properties, container queries
4. **Worker Offload (if profiling justifies):**
   - GeoJSON parsing
   - Search index building
5. **Bundle Output:** Dual package (ESM + UMD)

**Success Criteria:**
- No TypeScript errors
- Sample plugin works (e.g., heatmap overlay)
- npm package published with both ESM and UMD builds

---

## 9. Test Strategy

### 9.1 Test Sequencing

**BEFORE Refactor (Phase 1):**
- ✅ Geometry unit tests (haversine, area, circle)
- ✅ State transition tests (tool switching, layer toggle)
- ✅ CSV export tests (escaping, filtering)

**DURING Refactor (Phase 2):**
- ✅ Integration tests (layer loading, fetch abort, tool lifecycle)
- ✅ Render function tests (DOM output verification)

**AFTER Stabilization (Phase 3):**
- ✅ E2E tests (Playwright: radius search, zone draw, keyboard nav)
- ✅ Accessibility audit (axe-core)
- ✅ Performance regression tests (layer toggle timing)

### 9.2 Test Pyramid

```
       /\
      /E2E\          5 tests  (critical user journeys)
     /──────\
    /  INT   \       20 tests (layer loading, tools, search)
   /──────────\
  /    UNIT    \     50 tests (geometry, state, formatters)
 /──────────────\
```

### 9.3 Mocking Strategy

**MapLibre Adapter Mock:**

```javascript
class MockMapAdapter {
  constructor() {
    this.sources = new Map();
    this.layers = new Map();
    this.listeners = new Map();
  }

  addSource(id, spec) { this.sources.set(id, spec); }
  addLayer(layer) { this.layers.set(layer.id, layer); }
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }
  off(event, handler) { /* remove */ }

  // Simulate events for testing
  triggerClick(lngLat) {
    this.listeners.get('click')?.forEach(h => h({ lngLat }));
  }
}
```

**Unit tests:** Use mock adapter  
**Integration tests:** Use richer mock with feature query simulation  
**E2E tests:** Use real MapLibre in browser (Playwright)

---

## 10. Plugin Architecture

### 10.1 Plugin Interface

```javascript
export class VentusPlugin {
  constructor(id, options) {
    this.id = id;
    this.options = options;
  }

  // Lifecycle
  init(context) {
    // context = { map, state, dispatch, registerTool, registerControl }
  }

  dispose() {
    // Cleanup
  }

  // Optional hooks
  onStateChange(prev, next, context) {}

  // Plugin can provide
  commands = {};
  controls = [];
}
```

### 10.2 Example Plugin

```javascript
class HeatmapPlugin extends VentusPlugin {
  init(context) {
    context.registerTool('heatmap', new HeatmapTool(context));
    context.registerControl({
      id: 'heatmap-toggle',
      label: 'Heatmap',
      onClick: () => context.dispatch({ type: 'TOOL_ENABLE', payload: 'heatmap' })
    });
  }
}

// Usage
const map = new VentusMap(container, {
  plugins: [
    new HeatmapPlugin('heatmap', { radius: 20 })
  ]
});
```

### 10.3 Plugin Constraints

Plugins **cannot**:
- Mutate core state directly
- Access private Map internals
- Register conflicting event handlers

Plugins **can**:
- Register tools and controls
- Subscribe to state changes
- Add custom layers via adapter
- Provide commands

---

## 11. Accessibility (WCAG 2.1 AA Baseline)

### 11.1 Keyboard Operability

**All controls must be keyboard accessible:**

```html
<!-- Tool buttons -->
<button 
  id="btn-radius" 
  class="map-ctrl-btn"
  aria-label="Radius search tool"
  aria-pressed="false"
  tabindex="0">
  ◎ Radius Search
</button>

<!-- Layer checkboxes -->
<label class="key-item">
  <input 
    type="checkbox" 
    data-layer-id="solar"
    aria-label="Toggle solar layer">
  <span>Solar PV</span>
</label>
```

**Keyboard shortcuts:**
- `Tab` / `Shift+Tab`: Navigate controls
- `Enter` / `Space`: Activate buttons/checkboxes
- `Escape`: Close transient panels (popups, search results)
- `Arrow keys`: Navigate search results

### 11.2 Focus Management

**Visible focus states:**

```css
.map-ctrl-btn:focus-visible {
  outline: 2px solid #00ffff;
  outline-offset: 2px;
}

input[type="checkbox"]:focus-visible {
  outline: 2px solid #00ffff;
  outline-offset: 2px;
}
```

**Focus trap in fullscreen mode:**
- When fullscreen curtain opens, focus moves to first control
- `Tab` cycles within curtain
- `Escape` closes curtain and returns focus to fullscreen button

### 11.3 ARIA Attributes

**Tool toggle buttons:**
```html
<button 
  aria-pressed="true"
  aria-label="Radius search tool (active)">
```

**Dynamic stats:**
```html
<div 
  id="aria-live-stats" 
  aria-live="polite" 
  aria-atomic="true"
  class="sr-only">
  Solar PV loaded: 1,234 assets, 15.2GW
</div>
```

**Search results:**
```html
<div 
  role="listbox" 
  aria-label="Project search results">
  <div 
    role="option" 
    aria-selected="false"
    tabindex="0">
    Solar Farm Alpha - 50 MW
  </div>
</div>
```

### 11.4 Color Independence

**Status must not rely on color alone:**

```html
<!-- Bad -->
<span style="color:#00ff88">Operational</span>

<!-- Good -->
<span style="color:#00ff88">
  <span aria-hidden="true">●</span>
  <span>Operational</span>
</span>
```

**Status legend includes both color and text:**
```html
<div class="status-legend">
  <div class="status-dot">
    <span style="background:#00ff88" aria-hidden="true"></span>
    <span>Operational</span>
  </div>
</div>
```

### 11.5 Contrast Requirements

**Minimum contrast ratios (WCAG 2.1 AA):**
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components: 3:1

**Current colors audit:**
- `#00ffff` on `#000`: 13.8:1 ✅
- `#888` on `#000`: 5.3:1 ✅
- `#444` on `#000`: 2.8:1 ❌ (needs fixing)

**Fix:**
```css
/* Old */
.search-input::placeholder { color: #444; }

/* New */
.search-input::placeholder { color: #666; } /* 4.6:1 */
```

### 11.6 Screen Reader Announcements

**Loading states:**
```javascript
function announceLayerLoad(layerId, count, mw) {
  const liveRegion = document.getElementById('aria-live-stats');
  liveRegion.textContent = `${layerId} layer loaded: ${count} assets, ${mw} megawatts`;
}
```

**Tool activation:**
```javascript
function announceTool(toolId, active) {
  const liveRegion = document.getElementById('aria-live-tools');
  liveRegion.textContent = active 
    ? `${toolId} tool activated` 
    : `${toolId} tool deactivated`;
}
```

### 11.7 Logical Tab Order

**Tab sequence:**
1. Search input
2. Search button
3. Map controls (export, radius, measure, etc.)
4. Fullscreen button
5. Layer checkboxes (in SCADA panel)
6. Basemap radio buttons

**Implementation:**
- Use semantic HTML (`<button>`, `<label>`, `<input>`)
- Avoid `tabindex > 0`
- Use `tabindex="-1"` for programmatically focusable elements
- Use `tabindex="0"` for custom interactive elements

### 11.8 Mobile Accessibility

**Touch targets:**
- Minimum 44×44px (iOS HIG, WCAG 2.5.5)
- Controls already meet this (padding ensures target size)

**Zoom:**
- Do not use `maximum-scale=1.0` (prevents pinch-zoom)
- Current viewport meta is correct: `user-scalable=no` should be removed if added

### 11.9 Accessibility Test Checklist

**Before Phase 3 completion:**
- [ ] Run axe-core automated audit (0 violations)
- [ ] Keyboard-only navigation test (no mouse)
- [ ] Screen reader test (NVDA/JAWS/VoiceOver)
- [ ] Color contrast audit (all UI components)
- [ ] Focus indicator visibility test
- [ ] Touch target size verification (mobile)

---

## 12. Bundle Strategy

### 12.1 Dual Package Output

**Commitment:**

V2 will ship **two build outputs**:

1. **ESM (ES Modules)** for modern bundlers (Vite, Webpack 5+, Rollup)
   - `dist/ventus-core.esm.js`
   - Tree-shakeable
   - `"type": "module"` in package.json

2. **UMD (Universal Module Definition)** for HTML embed
   - `dist/ventus-core.umd.js`
   - Self-contained with dependencies bundled
   - Exposes `window.VentusMap` and `window.initVentusMap`

### 12.2 Package.json Configuration

```json
{
  "name": "@ventus/core",
  "version": "2.0.0",
  "type": "module",
  "main": "./dist/ventus-core.umd.js",
  "module": "./dist/ventus-core.esm.js",
  "exports": {
    ".": {
      "import": "./dist/ventus-core.esm.js",
      "require": "./dist/ventus-core.umd.js"
    },
    "./styles": "./dist/ventus.css"
  },
  "files": [
    "dist"
  ]
}
```

### 12.3 Build Tooling

**Rollup configuration:**

```javascript
export default [
  // ESM build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/ventus-core.esm.js',
      format: 'es',
      sourcemap: true
    },
    external: ['maplibre-gl']
  },
  // UMD build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/ventus-core.umd.js',
      format: 'umd',
      name: 'VentusMap',
      sourcemap: true,
      globals: {
        'maplibre-gl': 'maplibregl'
      }
    },
    external: ['maplibre-gl']
  }
];
```

### 12.4 Usage Examples

**ESM (npm/bundler):**
```javascript
import { VentusMap } from '@ventus/core';
import '@ventus/core/styles';

const map = new VentusMap(container, config);
```

**UMD (HTML embed):**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@ventus/core@2/dist/ventus.css">
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3/dist/maplibre-gl.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@ventus/core@2/dist/ventus-core.umd.js"></script>
<script>
  const map = new VentusMap(document.getElementById('map'), config);
  // OR legacy wrapper
  window.initVentusMap(config);
</script>
```

---

## 13. Observability & Debug Mode

### 13.1 Debug Mode Activation

```javascript
const map = new VentusMap(container, {
  debug: true
});
```

### 13.2 Instrumentation

**Timing logs:**
```
[FETCH START] /grid_400kv.geojson
[FETCH END] /grid_400kv.geojson (342ms)
[PARSE START] /grid_400kv.geojson (5,847 features)
[PARSE END] /grid_400kv.geojson (89ms)
[LAYER READY] 400 (total: 431ms)
```

**Event trace:**
```
[TOOL ENABLE] radius
[TOOL DISABLE] measure
[LAYER TOGGLE] solar ON
[LAYER LOAD] solar (1,234 features | 15.2 GW)
[SEARCH QUERY] "solar farm" (12 results, 8ms)
```

### 13.3 Debug Panel (Optional UI)

```html
<div id="debug-panel" style="display:none">
  <h3>Ventus Debug</h3>
  <div>Visible Layers: <span id="debug-visible-count"></span></div>
  <div>Active Tool: <span id="debug-active-tool"></span></div>
  <div>Cache Size: <span id="debug-cache-size"></span></div>
  <div>In-Flight Requests: <span id="debug-requests"></span></div>
</div>
```

---

## 14. Security & Sanitization

### 14.1 HTML Escaping

All user-provided or config-driven text must be escaped:

```javascript
// utils/sanitize.js
export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

**Usage:**
```javascript
popup.setHTML(`
  <b>${escapeHTML(feature.properties.name)}</b>
`);
```

### 14.2 CSP Compatibility

**Avoid inline scripts:**
- No `onclick="..."` in HTML
- Use event delegation via `addEventListener`

**Avoid `eval()` or `new Function()`:**
- No dynamic code execution
- Config must be static JSON

### 14.3 URL Validation

**Config-driven URLs:**
```javascript
function validateURL(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    // Allow same-origin or specific CDN domains
    const allowed = [
      window.location.origin,
      'https://cdn.example.com'
    ];
    if (!allowed.some(domain => parsed.origin === domain)) {
      throw new Error('URL not allowed');
    }
    return parsed.href;
  } catch {
    throw new Error('Invalid URL');
  }
}
```

---

## 15. Open Questions for Review

1. **State persistence:** Should v2 support localStorage/sessionStorage for layer visibility and tool state?
2. **Undo/redo granularity:** Should undo apply to all tools or only zone draw?
3. **Plugin sandboxing:** Should plugins be isolated (iframe/worker) or run in main context?
4. **WebGL2 requirement:** Can we drop MapLibre GL v1 support and require WebGL2?
5. **Offline mode:** Should v2 cache tiles/GeoJSON for offline operation (Service Worker)?

---

## 16. Success Metrics

V2 is successful when:

- ✅ `VentusMap.destroy()` causes zero memory leaks (Chrome DevTools heap snapshot)
- ✅ Layer toggle completes in < 50ms (profiled on Chromebook)
- ✅ All AbortControllers fire when expected (100% cancellation coverage)
- ✅ WCAG 2.1 AA audit passes with 0 critical violations (axe-core)
- ✅ E2E tests run in < 2 minutes (Playwright)
- ✅ First-time contributors can add a plugin in < 1 hour (documented plugin guide)
- ✅ Production deployment runs 8+ hours without console errors (Gemini scenario fixed)

---

**END OF ARCHITECTURE V2**

This document supersedes all prior v1 implementation details.  
Do not implement until approved by senior engineering review.
