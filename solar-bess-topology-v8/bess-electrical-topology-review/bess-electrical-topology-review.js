function num(id, fallback = 0) {
  const value = parseFloat(document.getElementById(id)?.value || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function val(id) {
  return document.getElementById(id)?.value || 'unknown';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function updateBessTopology() {
  const bessMw = num('bess_power_mw');
  const bessMwh = num('bess_energy_mwh');
  const dcV = num('dc_voltage', 1500);
  const sets = Math.max(1, num('parallel_sets', 1));
  const routeM = num('dc_route_m');
  const rKm = num('r_ohm_km');
  const xKm = num('x_ohm_km');
  const pcsQty = Math.max(1, num('pcs_qty', 1));
  const pcsMw = num('pcs_total_mw');

  const totalCurrent = dcV > 0 ? (bessMw * 1000000) / dcV : 0;
  const currentPerSet = totalCurrent / sets;
  const duration = bessMw > 0 ? bessMwh / bessMw : 0;
  const mwPerPcs = pcsMw / pcsQty;

  const km = routeM / 1000;
  const rPath = sets > 0 ? (2 * rKm * km) / sets : 0;
  const xPath = sets > 0 ? (2 * xKm * km) / sets : 0;
  const zPath = Math.sqrt((rPath * rPath) + (xPath * xPath));
  const vdrop = dcV > 0 ? ((totalCurrent * rPath) / dcV) * 100 : 0;

  setText('out_total_dc_current', fmt(totalCurrent, 0) + ' A');
  setText('out_current_per_set', fmt(currentPerSet, 0) + ' A');
  setText('out_duration', fmt(duration, 2) + ' h');
  setText('out_mw_per_pcs', fmt(mwPerPcs, 2) + ' MW');
  setText('out_r_path', fmt(rPath, 5) + ' ohm');
  setText('out_x_path', fmt(xPath, 5) + ' ohm');
  setText('out_z_path', fmt(zPath, 5) + ' ohm');
  setText('out_vdrop', fmt(vdrop, 3) + ' %');

  const pcsMismatch = Math.abs(pcsMw - bessMw) > Math.max(1, bessMw * 0.05);
  setText('out_pcs_match', pcsMismatch ? 'PCS and BESS MW mismatch' : 'PCS rating aligned');

  const required = [];
  const warnings = [];
  const critical = [];

  if (currentPerSet > 300) warnings.push('High current per DC cable set');
  if (routeM > 100) warnings.push('Long DC route, voltage drop and thermal review required');
  if (val('installation_basis') === 'unknown') critical.push('Installation basis unknown');
  if (val('pcs_tx_arrangement') === 'separated') warnings.push('Separated PCS and transformer station needs AC cable and protection interface review');
  if (val('pcs_tx_arrangement') === 'unknown') critical.push('PCS to transformer arrangement unknown');
  if (val('dc_imd') !== 'yes') critical.push('DC insulation monitoring not confirmed');
  if (val('dc_leakage') !== 'yes') critical.push('DC leakage protection not confirmed');
  if (val('reverse_current') !== 'yes') critical.push('Reverse current protection not confirmed');
  if (val('dc_disconnector') !== 'yes') warnings.push('DC disconnector rating not confirmed');
  if (val('dc_fault_withstand') !== 'yes') critical.push('DC short circuit withstand not confirmed');
  if (val('rx_confirmed') !== 'yes') warnings.push('Cable R and X not confirmed from datasheet');
  if (val('tx_impedance_confirmed') !== 'yes') warnings.push('Transformer impedance not confirmed');
  if (val('protection_status') !== 'validated') critical.push('Protection coordination not validated');
  if (pcsMismatch) warnings.push('PCS total MW does not align with BESS MW');

  required.push('BESS to PCS DC cable thermal calculation');
  required.push('DC insulation monitoring and leakage protection review');
  required.push('Reverse current protection and battery source contribution review');
  required.push('Cable R, X, Z confirmation from manufacturer datasheet');
  required.push('PCS to transformer AC interface review');
  required.push('Short circuit and protection coordination study');

  const status = document.getElementById('status_box');
  if (status) {
    status.className = 'status-box';
    if (critical.length) {
      status.classList.add('bad');
      status.textContent = 'RED: formal BESS electrical protection and cable study required. ' + critical.join('; ') + '.';
      setText('out_validation_status', 'Red, formal study required');
    } else if (warnings.length) {
      status.textContent = 'AMBER: assumptions incomplete. ' + warnings.join('; ') + '.';
      setText('out_validation_status', 'Amber, assumptions incomplete');
    } else {
      status.classList.add('good');
      status.textContent = 'GREEN: key screening flags confirmed. Formal engineering approval is still required.';
      setText('out_validation_status', 'Green, screening flags confirmed');
    }
  }

  const list = document.getElementById('required_studies');
  if (list) list.innerHTML = required.map(item => '<li>' + item + '</li>').join('');

  drawScada({ bessMw, bessMwh, dcV, totalCurrent, currentPerSet, pcsQty, pcsMw, routeM, warnings, critical });
}

function drawScada(data) {
  const svg = document.getElementById('bess_scada');
  if (!svg) return;
  const riskClass = data.critical.length ? 'scada-bad' : (data.warnings.length ? 'scada-warn' : 'scada-box');
  svg.innerHTML = `
    <rect x="50" y="90" width="220" height="120" rx="14" class="${riskClass}" />
    <text x="160" y="135" text-anchor="middle" class="scada-text">BESS</text>
    <text x="160" y="165" text-anchor="middle" class="scada-small">${fmt(data.bessMw,1)} MW / ${fmt(data.bessMwh,1)} MWh</text>

    <path d="M270 150 L470 150" class="scada-dc" />
    <text x="370" y="120" text-anchor="middle" class="scada-small">DC cable sets</text>
    <text x="370" y="185" text-anchor="middle" class="scada-small">${fmt(data.currentPerSet,0)} A per set</text>

    <rect x="470" y="90" width="220" height="120" rx="14" class="scada-box" />
    <text x="580" y="135" text-anchor="middle" class="scada-text">PCS</text>
    <text x="580" y="165" text-anchor="middle" class="scada-small">${data.pcsQty} units / ${fmt(data.pcsMw,1)} MW</text>

    <path d="M690 150 L850 150" class="scada-line" />
    <rect x="850" y="90" width="220" height="120" rx="14" class="scada-box" />
    <text x="960" y="135" text-anchor="middle" class="scada-text">Transformer</text>
    <text x="960" y="165" text-anchor="middle" class="scada-small">LV AC to MV</text>

    <path d="M960 210 L960 330" class="scada-line" />
    <rect x="760" y="330" width="400" height="120" rx="14" class="scada-box" />
    <text x="960" y="375" text-anchor="middle" class="scada-text">MV switchgear / grid interface</text>
    <text x="960" y="405" text-anchor="middle" class="scada-small">Protection, fault level and compliance boundary</text>

    <rect x="80" y="330" width="500" height="210" rx="14" class="${riskClass}" />
    <text x="330" y="375" text-anchor="middle" class="scada-text">Validation Gate</text>
    <text x="330" y="410" text-anchor="middle" class="scada-small">Insulation monitoring</text>
    <text x="330" y="440" text-anchor="middle" class="scada-small">Leakage and reverse current protection</text>
    <text x="330" y="470" text-anchor="middle" class="scada-small">Cable R, X, Z and thermal study</text>
    <text x="330" y="500" text-anchor="middle" class="scada-small">Protection coordination</text>

    <text x="600" y="630" text-anchor="middle" class="scada-small">BESS design is not just MW and MWh. The critical boundary is DC current, cable geometry, leakage, reverse current and protection coordination.</text>
  `;
}

document.addEventListener('input', updateBessTopology);
document.addEventListener('change', updateBessTopology);
document.addEventListener('DOMContentLoaded', updateBessTopology);
