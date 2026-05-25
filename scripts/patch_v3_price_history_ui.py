from pathlib import Path

PAGE = Path("uk_energy_tracking_v3/index.md")
CSS = Path("uk_energy_tracking_v3/price-history-ui.css")
DIARY = Path("uk_energy_tracking_v3/WORK_DIARY.md")

CSS_LINK = '<link rel="stylesheet" href="/uk_energy_tracking_v3/price-history-ui.css">'
IMPORT_LINE = "@import url('/uk_energy_tracking_v3/price-history-ui.css');"

PANEL_START = '  <section id="electricity-price-history-panel">'
PANEL_END = "\n  </section>"

CSS_TEXT = r'''
#electricity-price-history-panel,
#electricity-price-history-panel * {
  box-sizing: border-box;
}

#electricity-price-history-panel {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

#electricity-price-history-panel .trend-panel {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background: #070a10 !important;
  border: 1px solid #252b36 !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 22px rgba(0,255,255,.05);
}

#electricity-price-history-panel .price-history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

#electricity-price-history-panel .price-history-actions strong {
  color: #00ffff !important;
  letter-spacing: .12em;
  text-transform: uppercase;
}

#electricity-price-history-panel .price-history-actions select {
  background: #050505 !important;
  color: #00ffff !important;
  border: 1px solid #252b36 !important;
  border-radius: 4px;
  padding: 7px 9px;
  font-family: "Courier New", monospace;
}

#electricity-price-history-panel .price-history-actions a {
  border: 1px solid #252b36 !important;
  border-radius: 4px;
  padding: 7px 9px;
  color: #7fdfff !important;
  text-decoration: none !important;
  background: rgba(255,255,255,.03) !important;
}

#electricity-price-history-panel #price-history-canvas {
  width: 100% !important;
  max-width: 100% !important;
  height: clamp(190px, 32vw, 300px) !important;
  display: block;
  border: 1px solid #252b36 !important;
  background: #05070c !important;
  border-radius: 6px;
  touch-action: none;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

#electricity-price-history-panel .price-history-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 10px;
  margin-top: 12px;
}

#electricity-price-history-panel .price-history-card {
  border: 1px solid #252b36 !important;
  background: #0b0f17 !important;
  border-radius: 6px;
  padding: 12px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

#electricity-price-history-panel .price-history-label {
  color: #9aa3b6 !important;
  text-transform: uppercase;
  letter-spacing: .12em;
  font-size: 10px;
}

#electricity-price-history-panel .price-history-value {
  color: #00ffff !important;
  font-size: 18px;
  font-weight: 800;
  margin-top: 5px;
}

#electricity-price-history-panel .price-history-table-toggle {
  margin-top: 12px;
  border: 1px solid #252b36 !important;
  border-radius: 6px;
  background: #0b0f17 !important;
  overflow: hidden;
}

#electricity-price-history-panel .price-history-table-toggle summary {
  cursor: pointer;
  list-style: none;
  padding: 10px 12px;
  color: #00ffff !important;
  background: #05070c !important;
  text-transform: uppercase;
  letter-spacing: .1em;
  font-size: 11px;
  border-bottom: 1px solid #252b36 !important;
}

#electricity-price-history-panel .price-history-table-toggle summary::-webkit-details-marker {
  display: none;
}

#electricity-price-history-panel .price-history-table-toggle summary::after {
  content: "Open";
  float: right;
  color: #9aa3b6;
  letter-spacing: .08em;
}

#electricity-price-history-panel .price-history-table-toggle[open] summary::after {
  content: "Close";
}

#electricity-price-history-panel .price-history-table-wrap {
  overflow-x: auto;
  overflow-y: auto;
  border: 0 !important;
  border-radius: 0;
  margin-top: 0;
  max-height: 260px;
  background: #070a10 !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

#electricity-price-history-panel table.price-history-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 12px;
  color: #f5f7fb !important;
  background: #070a10 !important;
  font-family: "Courier New", monospace;
}

#electricity-price-history-panel table.price-history-table thead,
#electricity-price-history-panel table.price-history-table tbody,
#electricity-price-history-panel table.price-history-table tr {
  background: transparent !important;
}

#electricity-price-history-panel table.price-history-table th,
#electricity-price-history-panel table.price-history-table td {
  border: 0 !important;
  border-bottom: 1px solid #252b36 !important;
  border-right: 1px solid rgba(255,255,255,.045) !important;
  padding: 9px 10px;
  text-align: left;
  white-space: nowrap;
  background: #0b0f17 !important;
  color: #f5f7fb !important;
}

#electricity-price-history-panel table.price-history-table tbody tr:nth-child(even) td {
  background: #0f1520 !important;
}

#electricity-price-history-panel table.price-history-table tbody tr:hover td {
  background: #111b29 !important;
}

#electricity-price-history-panel table.price-history-table th {
  color: #00ffff !important;
  text-transform: uppercase;
  letter-spacing: .08em;
  background: #05070c !important;
  position: sticky;
  top: 0;
  z-index: 2;
}

#electricity-price-history-panel table.price-history-table td:nth-child(2) {
  color: #00ffff !important;
  font-weight: 800;
}

#electricity-price-history-panel table.price-history-table td:nth-child(4) {
  color: #9aa3b6 !important;
}

@media (max-width: 850px) {
  #electricity-price-history-panel .price-history-grid { grid-template-columns: 1fr 1fr; }
  #electricity-price-history-panel #price-history-canvas { height: 220px !important; }
  #electricity-price-history-panel table.price-history-table { font-size: 11px; min-width: 620px; }
}

@media (max-width: 560px) {
  #electricity-price-history-panel .price-history-grid { grid-template-columns: 1fr; }
  #electricity-price-history-panel .price-history-value { font-size: 22px; }
  #electricity-price-history-panel #price-history-canvas { height: 210px !important; }
}
'''.strip() + "\n"

DIARY_MARKER = "## Diary entry: 2026-05-25 V3 price history table dark UI patch"
DIARY_ENTRY = f'''

{DIARY_MARKER}

Purpose:

```text
repair the electricity price history table UI on mobile and desktop
keep the V3 development tracker isolated
avoid touching the stable tracker
```

Issue observed:

```text
The V3 price history table rendered with a white table background while the rest of the SCADA page remained dark.
The graph also risked overflowing on mobile if the external stylesheet was not loaded properly.
The table made the page visually heavy because it exposed raw records directly under the graph.
```

Patch method:

```text
remove the late CSS import from the inline style block
insert a normal stylesheet link for /uk_energy_tracking_v3/price-history-ui.css
rewrite the price history CSS with scoped high specificity rules under #electricity-price-history-panel
force dark table background, dark rows, cyan headings and readable body text
make the chart width responsive so it fits inside the page container
move the raw records table inside a closed details dropdown by default
retain CSV download for full data review
```

Files intentionally changed by GridBot workflow:

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/price-history-ui.css
uk_energy_tracking_v3/WORK_DIARY.md
```

Stable tracker rule:

```text
No changes to uk_energy_tracking/.
```
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_if_changed(path: Path, text: str) -> bool:
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if old == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def extract_panel(text: str) -> tuple[str, str]:
    start = text.find(PANEL_START)
    if start == -1:
        return text, ""
    end = text.find(PANEL_END, start)
    if end == -1:
        raise RuntimeError("Could not locate end of electricity price history panel")
    end += len(PANEL_END)
    return text[:start] + text[end:], text[start:end]


def ensure_linked_css(text: str) -> str:
    text = text.replace(IMPORT_LINE + "\n", "")
    text = text.replace(IMPORT_LINE, "")
    if CSS_LINK in text:
        return text
    style_pos = text.find("<style>")
    if style_pos == -1:
        raise RuntimeError("Could not locate opening style block")
    return text[:style_pos] + CSS_LINK + "\n" + text[style_pos:]


def ensure_panel_after_generation_mix(text: str) -> str:
    text, panel = extract_panel(text)
    if not panel:
        return text
    generation_mix = '  <section>\n    <h2 class="section-title">Generation Mix</h2>\n    <div id="scada-mix" class="scada-mix-grid"></div>\n  </section>'
    if generation_mix not in text:
        raise RuntimeError("Generation Mix block not found. V3 structure has changed.")
    return text.replace(generation_mix, generation_mix + panel, 1)


def collapse_price_table(text: str) -> str:
    if 'class="price-history-table-toggle"' in text:
        return text
    old = '''      <div class="price-history-table-wrap">
        <table class="price-history-table">
          <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Captured UTC</th><th>Carbon g/kWh</th></tr></thead>
          <tbody id="price-history-table-body"><tr><td colspan="4">Awaiting captured price history.</td></tr></tbody>
        </table>
      </div>'''
    new = '''      <details class="price-history-table-toggle">
        <summary>Captured records table</summary>
        <div class="price-history-table-wrap">
          <table class="price-history-table">
            <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Captured UTC</th><th>Carbon g/kWh</th></tr></thead>
            <tbody id="price-history-table-body"><tr><td colspan="4">Awaiting captured price history.</td></tr></tbody>
          </table>
        </div>
      </details>'''
    if old not in text:
        raise RuntimeError("Price history table block not found. V3 structure has changed.")
    return text.replace(old, new, 1)


def patch_page() -> bool:
    text = read(PAGE)
    text = text.replace("UK LIVE GRID TRACKER V2", "UK LIVE GRID TRACKER V3")
    text = text.replace("This page uses isolated V2 feeds", "This page uses isolated V3 feeds")
    text = ensure_linked_css(text)
    text = ensure_panel_after_generation_mix(text)
    text = collapse_price_table(text)
    if "price-history-ui.js" not in text:
        text = text.replace(
            "</div>\n\n<script>",
            "</div>\n<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>\n\n<script>",
        )
    if IMPORT_LINE in text:
        raise RuntimeError("Late CSS import still present")
    if CSS_LINK not in text:
        raise RuntimeError("Price history stylesheet link was not inserted")
    if 'class="price-history-table-toggle"' not in text:
        raise RuntimeError("Price history table was not collapsed")
    return write_if_changed(PAGE, text)


def patch_css() -> bool:
    return write_if_changed(CSS, CSS_TEXT)


def patch_diary() -> bool:
    text = read(DIARY)
    if DIARY_MARKER in text:
        return False
    return write_if_changed(DIARY, text.rstrip() + DIARY_ENTRY + "\n")


def main() -> None:
    changed = []
    if patch_page():
        changed.append(str(PAGE))
    if patch_css():
        changed.append(str(CSS))
    if patch_diary():
        changed.append(str(DIARY))
    if changed:
        print("Patched V3 price history UI:")
        for path in changed:
            print(f"  {path}")
    else:
        print("V3 price history UI already patched")


if __name__ == "__main__":
    main()
