export const GB_ELECTRICITY_CONTEXT_CONTRACT = Object.freeze({
  schema: "pipelinenews.gb-electricity-context-cartridge.v1",
  generation: "202608312339",
  additive_only: true,
  mutates_existing_dom: false,
  project_bindings: 0,
  eligible_for_news_signal: false,
  source_repository: "Ventusltd/data-gb-electricity",
  source_schema: "data-gb-electricity.price-decade-rollup.v1",
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function digestHex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function loadAttestedProduct(asset) {
  invariant(asset && typeof asset.url === "string", "GB price payload URL missing");
  invariant(Number.isInteger(asset.bytes) && asset.bytes > 0, "GB price payload byte pin missing");
  invariant(/^[a-f0-9]{64}$/u.test(asset.sha256), "GB price payload digest pin missing");
  const target = new URL(asset.url, location.href);
  invariant(target.origin === location.origin, "cross-origin GB price payload rejected");
  const response = await fetch(target.href, { cache: "no-store" });
  invariant(response.ok, `GB price payload returned HTTP ${response.status}`);
  const raw = await response.arrayBuffer();
  invariant(raw.byteLength === asset.bytes, "GB price payload byte drift");
  invariant(await digestHex(raw) === asset.sha256, "GB price payload digest drift");
  return JSON.parse(new TextDecoder().decode(raw));
}

function validateProduct(product) {
  invariant(product?.schema === GB_ELECTRICITY_CONTEXT_CONTRACT.source_schema,
    "GB price product schema changed");
  invariant(typeof product.not_a_forecast === "string" && product.not_a_forecast.length > 30,
    "GB price product lost its no-forecast boundary");
  invariant(product.solar?.present === false, "GB price product unexpectedly claims solar data");
  invariant(product.price?.unit === "GBP per MWh", "GB price unit changed");
  invariant(Array.isArray(product.price.span) && product.price.span.length === 2,
    "GB price span missing");
  invariant(Array.isArray(product.price.by_year) && product.price.by_year.length >= 10,
    "GB yearly rollup is not a decade");
  const completeDays = product.price.by_year.reduce((sum, row) => sum + Number(row.days), 0);
  const negativeDays = product.price.by_year.reduce((sum, row) =>
    sum + Number(row.days_with_a_negative_settlement_period), 0);
  invariant(completeDays === product.derived_from.complete_days,
    "GB complete-day provenance disagrees with yearly rows");
  invariant(negativeDays === product.price.days_with_a_negative_settlement_period,
    "GB negative-settlement-day headline disagrees with yearly rows");
  invariant(product.price.by_year.every((row, index, rows) => index === 0
    || Number(rows[index - 1].year) < Number(row.year)), "GB years are not strictly increasing");
}

function number(value, digits = 0) {
  return Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(value) {
  const numeric = Number(value);
  return `${numeric < 0 ? "-" : ""}£${number(Math.abs(numeric), 2)}`;
}

function render(host, product) {
  const price = product.price;
  const low = price.lowest_settlement_period;
  const high = price.highest_settlement_period;
  const yearRows = price.by_year.map(row => `
    <tr>
      <th scope="row">${escapeHtml(row.year)}</th>
      <td>${number(row.days)}</td>
      <td>${number(row.mean_gbp_per_mwh, 2)}</td>
      <td>${number(row.min_daily_mean, 2)}</td>
      <td>${number(row.max_daily_mean, 2)}</td>
      <td>${number(row.days_with_a_negative_settlement_period)}</td>
    </tr>`).join("");

  const style = document.createElement("style");
  style.textContent = `
    #gbElectricityHost .gbe-wrap{border:1px solid #21454b;background:#061215;padding:12px;color:#c8dadd}
    #gbElectricityHost .gbe-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline}
    #gbElectricityHost .gbe-head h3{margin:0;color:#70d2db;font:700 13px ui-monospace,monospace;letter-spacing:.08em}
    #gbElectricityHost .gbe-head span{color:#779096;font:10px ui-monospace,monospace}
    #gbElectricityHost .gbe-cards{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:7px;margin:10px 0}
    #gbElectricityHost .gbe-card{border:1px solid #1a353b;background:#030a0d;padding:8px}
    #gbElectricityHost .gbe-card b{display:block;color:#e4f4f5;font:700 18px ui-monospace,monospace}
    #gbElectricityHost .gbe-card span{color:#82989d;font:9px/1.4 ui-monospace,monospace;text-transform:uppercase}
    #gbElectricityHost .gbe-table{overflow-x:auto;overscroll-behavior-x:contain}
    #gbElectricityHost table{width:100%;min-width:650px;border-collapse:collapse;font:10px/1.4 ui-monospace,monospace}
    #gbElectricityHost th,#gbElectricityHost td{padding:5px 7px;border-bottom:1px solid #14282d;text-align:right;white-space:nowrap}
    #gbElectricityHost th:first-child,#gbElectricityHost td:first-child{text-align:left}
    #gbElectricityHost thead th{color:#70d2db;font-size:9px;vertical-align:bottom}
    #gbElectricityHost .gbe-note{margin:9px 0 0;color:#8ca1a6;font:10px/1.55 ui-monospace,monospace}
    #gbElectricityHost .gbe-note strong{color:#d7a95e}
    #gbElectricityHost .gbe-source{color:#70d2db}
    @media(max-width:720px){#gbElectricityHost .gbe-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:420px){#gbElectricityHost .gbe-wrap{padding:9px}#gbElectricityHost .gbe-card b{font-size:15px}}
  `;
  host.replaceChildren(style);
  const panel = document.createElement("div");
  panel.className = "gbe-wrap";
  panel.innerHTML = `
    <div class="gbe-head"><h3>HISTORIC GB SYSTEM PRICE</h3>
      <span>${escapeHtml(price.span.join("-"))} · ${number(product.derived_from.settlement_periods)} settlement periods</span></div>
    <div class="gbe-cards">
      <div class="gbe-card"><b>${money(price.decade_mean)}</b><span>mean of complete daily means · £/MWh</span></div>
      <div class="gbe-card"><b>${number(price.days_with_a_negative_settlement_period)}</b><span>complete days containing at least one negative settlement period</span></div>
      <div class="gbe-card"><b>${money(low.value)}</b><span>lowest settlement period · ${escapeHtml(low.date)}</span></div>
      <div class="gbe-card"><b>${money(high.value)}</b><span>highest settlement period · ${escapeHtml(high.date)}</span></div>
    </div>
    <div class="gbe-table"><table>
      <thead><tr><th>YEAR</th><th>COMPLETE DAYS</th><th>MEAN £/MWh</th><th>LOW DAILY MEAN</th><th>HIGH DAILY MEAN</th><th>DAYS WITH A NEGATIVE PERIOD</th></tr></thead>
      <tbody>${yearRows}</tbody>
    </table></div>
    <p class="gbe-note"><strong>Historic context only. Not a forecast.</strong> ${escapeHtml(product.not_a_forecast)}
      This panel is not joined to a project and cannot create or alter a REPD news signal.</p>
    <p class="gbe-note"><strong>Solar is not in this product.</strong> ${escapeHtml(product.solar.why)}</p>
    <p class="gbe-note">Source: Elexon system sell price via the attested
      <a class="gbe-source" href="https://github.com/Ventusltd/data-gb-electricity" target="_blank" rel="noopener">Ventusltd/data-gb-electricity rollup</a>.
      Product grain is calendar year over complete daily means; days with fewer than
      ${number(product.grain.minimum_periods_per_day)} settlement periods are excluded.</p>`;
  host.appendChild(panel);
}

export async function mountGbElectricityContext({ host, payloadAsset }) {
  invariant(host && typeof host.replaceChildren === "function", "GB electricity host missing");
  const product = await loadAttestedProduct(payloadAsset);
  validateProduct(product);
  render(host, product);
  host.dataset.gbElectricityState = "ready";
  return Object.freeze({ payloadRequests: 1, projectBindings: 0,
    years: product.price.by_year.length, completeDays: product.derived_from.complete_days });
}
