from pathlib import Path

PAGE = Path("uk_energy_tracking_v3/index.md")

PANEL = """

  <section id="electricity-price-history-panel">
    <h2 class="section-title">Electricity Price History</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Captured Market Index Price</strong>
        <select id="price-history-range">
          <option value="24h">24 hours</option>
          <option value="7d" selected>7 days</option>
          <option value="30d">30 days</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="12m">12 months</option>
          <option value="10y">10 years</option>
        </select>
        <a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>
      </div>
      <div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour. Independently captured from Elexon BMRS Market Index values.</div>
      <canvas id="price-history-canvas" width="900" height="300"></canvas>
      <div class="price-history-grid">
        <div class="price-history-card"><div class="price-history-label">Latest price</div><div class="price-history-value" id="ph-latest-price">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Settlement time</div><div class="price-history-value" id="ph-latest-time">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Records retained</div><div class="price-history-value" id="ph-row-count">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Source</div><div class="price-history-value" style="font-size:13px;" id="ph-source">Elexon BMRS</div></div>
      </div>
      <div class="price-history-table-wrap">
        <table class="price-history-table">
          <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Captured UTC</th><th>Carbon g/kWh</th></tr></thead>
          <tbody id="price-history-table-body"><tr><td colspan="4">Awaiting captured price history.</td></tr></tbody>
        </table>
      </div>
    </div>
  </section>
"""


def patch_page() -> None:
    text = PAGE.read_text(encoding="utf-8")

    text = text.replace("UK LIVE GRID TRACKER V2", "UK LIVE GRID TRACKER V3")
    text = text.replace("This page uses isolated V2 feeds", "This page uses isolated V3 feeds")

    if "price-history-ui.css" not in text:
        text = text.replace("</style>", "@import url('/uk_energy_tracking_v3/price-history-ui.css');\n</style>")

    marker = '  <section>\n    <h2 class="section-title">Generation Mix</h2>'
    if "electricity-price-history-panel" not in text:
        if marker not in text:
            raise RuntimeError("Generation Mix marker not found. V3 structure has changed.")
        text = text.replace(marker, PANEL + '\n  <section>\n    <h2 class="section-title">Generation Mix</h2>')

    if "price-history-ui.js" not in text:
        text = text.replace(
            "</div>\n\n<script>",
            "</div>\n<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>\n\n<script>",
        )

    PAGE.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_page()
    print("Patched V3 electricity price history UI")
