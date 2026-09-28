// mod/menu-style.js - the site world's look for the overlay: black page, dim text, hairline edges, no blue buttons.
// Plain script, no dependencies. Load it FIRST in mod/index.json (menu-bar.js last).
// Tokens are copied from the morning site-world release (solar-design-studio/202609270524-site-world, index.html
// lines 23-33, 59-62, 67, 153-160). The menu geometry (six titles, one panel at a time) follows GridAtlas menu-bar.js.
// It only adds CSS: every element it hides (#bar, #info, #spd, the readouts, the mod boxes) still exists and still
// receives the text the mods write; menu-bar.js moves them into menus and panels.
(function () {
  'use strict';
  if (document.getElementById('menu-style')) return;
  const css = document.createElement('style');
  css.id = 'menu-style';
  css.textContent = `
:root { --bg: #0a0a0a; --line: #9cdbff; --text: #cfe9ff; --dim: #6f8ea6;
        --panel: rgba(10, 10, 10, 0.86); --edge: #1c2c3a; --foot: 20px; --btn: 30px; --warn: #ffb27a; --bad: #ff8a7a; }
html, body, #map { background: var(--bg); color: var(--text); }
body { font: 12px/1.45 system-ui, sans-serif; }

/* Hidden at rest; still written to by the page and the mods. */
#bar, #info, #spd, #pf-readout, #here-readout, #coords-hud, #fg, #design-box { display: none !important; }
#fg input, #design-box input { font: 12px ui-monospace, Consolas, monospace !important; width: 100% !important; min-height: 28px !important;
  padding: 5px 8px !important; border-radius: 4px !important; border: 1px solid var(--edge) !important; background: #050505 !important; color: var(--text) !important; }
.maplibregl-ctrl-top-right { display: none; }
.maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left { display: none; }

/* Every button in the page: the five-dash-button look, never a filled blue block. */
button { font: 12px system-ui, sans-serif; background: var(--panel); color: var(--dim); border: 1px solid var(--edge);
         border-radius: 4px; padding: 5px 9px; min-height: var(--btn); cursor: pointer; }
button:hover { color: var(--text); }
button.on, button[aria-pressed="true"], button[aria-expanded="true"] { color: #fff; border-color: var(--line); background: var(--panel); }
input { font: 12px system-ui, sans-serif; background: #050505; color: var(--text); border: 1px solid var(--edge);
        border-radius: 4px; padding: 5px 8px; min-height: 28px; box-sizing: border-box; }
input:focus { outline: none; border-color: var(--line); }

.panel { position: fixed; background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 10px 12px; overflow: auto; }
h2 { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--dim); text-transform: uppercase; margin: 0 0 6px; }

/* The touch joystick, restyled (site world #pad). Mouse users never see it. */
#joy { left: 24px !important; right: auto !important; bottom: 56px !important; border: 1px solid var(--edge) !important;
       background: rgba(156, 219, 255, 0.04) !important; }
#knob { width: 48px !important; height: 48px !important; left: 36px; top: 36px; border: 1px solid var(--line);
        background: rgba(156, 219, 255, 0.12) !important; }
@media (pointer: fine) { #joy { display: none !important; } }
@media (pointer: coarse) { #joy { bottom: 88px !important; } }   /* clear of the note, #where and the strip */

/* Mod-drawn boxes that stay free-floating (trench panel, walk HUD, farm labels): the same panel tokens. */
#trench-panel { background: var(--panel) !important; border: 1px solid var(--edge) !important; color: var(--text) !important; }
`;
  document.head.appendChild(css);
})();
