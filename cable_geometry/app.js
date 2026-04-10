const OD_CONFIRMED = { …OD_LV, …OD_MV_HV, …OD_SOLAR };

const appState = {
inputs: null,
layout: null,
review: null,
snapshotText: “”,
previousSpacing: { h: 150, v: 150 }
};

function byId(id) { return document.getElementById(id); }

function clampInteger(value, fallback, minValue) {
const num = Number(value);
if (!Number.isFinite(num)) return fallback;
return Math.max(Math.round(num), minValue);
}

function formatMm(v) { return `${Math.round(v)} mm`; }

function effectiveGap(basis, spacing, od) {
if (basis === “touching”) return 0;
if (basis === “centre_to_centre”) return Math.max(spacing - od, 0);
return spacing;
}

function getMinBurialDepth(serviceType) {
if (!MIN_BURIAL_DEPTHS || typeof MIN_BURIAL_DEPTHS !== “object”) return 0;
return MIN_BURIAL_DEPTHS[serviceType] || 0;
}

function getVoltageRuntimeMeta(voltageKey) {
const base = VOLTAGE_CLASSES[voltageKey] || {};
const overrides = {
lv_cu_sc:     { Uo: 0,    mbr_factor: 15 },
lv_cu_3c:     { Uo: 0,    mbr_factor: 12 },
uk_11kv_sc:   { Uo: 6.35, mbr_factor: 15 },
uk_11kv_3c:   { Uo: 6.35, mbr_factor: 15 },
uk_33kv_sc:   { Uo: 19,   mbr_factor: 15 },
uk_33kv_3c:   { Uo: 19,   mbr_factor: 15 },
iec_110kv_sc: { Uo: 64,   mbr_factor: 25 },
pv_string:    { Uo: 0,    mbr_factor: 4  },
flex_hv_ac:   { Uo: 0,    mbr_factor: 3  },
flex_hv_dc:   { Uo: 0,    mbr_factor: 3  },
al_ata_ac:    { Uo: 0,    mbr_factor: 12 },
al_ata_dc:    { Uo: 0,    mbr_factor: 12 }
};
return { …base, …(overrides[voltageKey] || {}) };
}

function getSelectedCore() {
return byId(“lookup_cores”).value;
}

function getBurialDepthForComputation() {
const raw = Number(byId(“burial_depth”).value);
if (!Number.isFinite(raw) || raw <= 0) {
return DEFAULT_BURIAL_DEPTHS[byId(“service_type”).value] || 900;
}
return Math.max(Math.round(raw), 0);
}

function normaliseBurialDepthFieldOnBlur() {
const burial = byId(“burial_depth”);
const serviceType = byId(“service_type”).value;
const minDepth = getMinBurialDepth(serviceType);
const fallback = DEFAULT_BURIAL_DEPTHS[serviceType] || 900;
const normalised = clampInteger(burial.value, fallback, minDepth);
burial.value = String(normalised);
return normalised;
}

function normaliseIntegerFields() {
[
{ id: “circuit_qty”,    fallback: 1,  min: 1 },
{ id: “max_per_row”,    fallback: 1,  min: 1 },
{ id: “section_length”, fallback: 0,  min: 0 },
{ id: “cable_od”,       fallback: 45, min: 1 },
{ id: “spacing_h”,      fallback: appState.previousSpacing.h || 0, min: 0 },
{ id: “spacing_v”,      fallback: appState.previousSpacing.v || 0, min: 0 },
{ id: “bend_factor”,    fallback: 15, min: 1 }
].forEach(item => {
const el = byId(item.id);
if (el) el.value = String(clampInteger(el.value, item.fallback, item.min));
});
}

function getInputs() {
return {
route_name:             byId(“route_name”).value.trim() || “Unnamed_Route”,
section_length_m:       clampInteger(byId(“section_length”).value, 0, 0),
installation_condition: byId(“installation_condition”).value,
service_type:           byId(“service_type”).value,
grouping_basis:         byId(“grouping_basis”).value,
burial_depth_mm:        getBurialDepthForComputation(),
formation_type:         byId(“formation_type”).value,
circuit_qty:            clampInteger(byId(“circuit_qty”).value, 1, 1),
max_per_row:            clampInteger(byId(“max_per_row”).value, 1, 1),
cable_od_mm:            clampInteger(byId(“cable_od”).value, 45, 1),
spacing_basis:          byId(“spacing_basis”).value,
spacing_h_mm:           clampInteger(byId(“spacing_h”).value, appState.previousSpacing.h || 0, 0),
spacing_v_mm:           clampInteger(byId(“spacing_v”).value, appState.previousSpacing.v || 0, 0),
bend_factor:            clampInteger(byId(“bend_factor”).value, 15, 1)
};
}

function populateFormationOptions(serviceType, preferredValue) {
const sel = byId(“formation_type”);
const opts = FORMATION_LIBRARY[serviceType] || FORMATION_LIBRARY.lv;
sel.innerHTML = “”;
opts.forEach(o => {
const node = document.createElement(“option”);
node.value = o.value;
node.textContent = o.label;
sel.appendChild(node);
});
sel.value = opts.some(o => o.value === preferredValue) ? preferredValue : opts[0].value;
}

function syncFormationToLookupCore() {
const formation = byId(“formation_type”).value;
const coreSel = byId(“lookup_cores”);
const coreMap = {
multicore_3c: “three”,
multicore_4c: “four”,
multicore_5c: “five”,
trefoil_single_row: “single”,
flat_single_row: “single”,
stacked_two_high: “single”,
dc_pair_horizontal: “single”,
dc_pair_vertical: “single”
};
const wanted = coreMap[formation];
if (!wanted) return;
if ([…coreSel.options].some(o => o.value === wanted)) {
coreSel.value = wanted;
}
}

function populateVoltageOptions() {
const serviceType = byId(“service_type”).value;
const sel = byId(“lookup_voltage”);
const selectedCore = getSelectedCore();
const previousValue = sel.value;

```
sel.innerHTML = '<option value="">— manual OD entry —</option>';

const groups = VOLTAGE_DROPDOWN_GROUPS[serviceType] || [];
let appendedAny = false;

groups.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;

    group.options.forEach(optData => {
        const runtime = getVoltageRuntimeMeta(optData.value);
        const cores = runtime.cores || [];
        if (selectedCore !== "any" && cores.length && !cores.includes(selectedCore)) return;

        const opt = document.createElement("option");
        opt.value = optData.value;
        opt.textContent = optData.text;
        optgroup.appendChild(opt);
        appendedAny = true;
    });

    if (optgroup.children.length) sel.appendChild(optgroup);
});

if (previousValue && [...sel.options].some(o => o.value === previousValue)) {
    sel.value = previousValue;
} else {
    sel.selectedIndex = 0;
}

if (!appendedAny) {
    sel.innerHTML = '<option value="">— no voltage classes for selected core —</option>';
}

populateLookupCSA();
applyLookup();
```

}

// ===============================
// 🔧 KEY FIX — CORRECT LOOKUP MAP
// ===============================
function getLookupKey(voltageKey, csaMm2, selectedCore) {
if (!voltageKey || !csaMm2) return null;

```
const directMap = {
    // LV
    lv_cu_sc:     csa => `sc_cu_lv_${csa}`,
    lv_cu_3c:     csa => `3c_cu_lv_${csa}`,
    // UK MV
    uk_11kv_sc:   csa => `sc_6.35_${csa}`,
    uk_11kv_3c:   csa => `3c_6.35_${csa}`,
    uk_33kv_sc:   csa => `sc_19_${csa}`,
    uk_33kv_3c:   csa => `3c_cu18_${csa}`,
    // HV
    iec_110kv_sc: csa => `sc_64_${csa}`,
    // Solar / DC
    pv_string:    csa => `sc_pv_string_${csa}`,
    flex_hv_ac:   csa => `sc_flex_hv_ac_${csa}`,
    flex_hv_dc:   csa => `sc_flex_hv_dc_${csa}`,
    al_ata_ac:    csa => `sc_al_ata_ac_${csa}`,
    al_ata_dc:    csa => `sc_al_ata_dc_${csa}`
};

if (directMap[voltageKey]) return directMap[voltageKey](csaMm2);

return null;
```

}

// ===============================
// OD LOOKUP — stored data only, no estimation fallback
// ===============================
function lookupOD(voltageKey, csaMm2, selectedCore) {
if (!voltageKey || !csaMm2) return null;

```
const runtime = getVoltageRuntimeMeta(voltageKey);
const key = getLookupKey(voltageKey, csaMm2, selectedCore);

if (key && OD_CONFIRMED[key]) {
    const entry = OD_CONFIRMED[key];
    return {
        ...entry,
        estimated: /Generic|catalogue|model/i.test(entry.src || "")
    };
}

return null;
```

}

function getVoltageDisplayName(voltageKey) {
const runtime = getVoltageRuntimeMeta(voltageKey);
return runtime.display_short || runtime.label || voltageKey;
}

function getConductorShapeText(voltageKey) {
const runtime = getVoltageRuntimeMeta(voltageKey);
return CONDUCTOR_SHAPE_LABELS[runtime.conductor_shape] || “Conductor shape not stated”;
}

function populateLookupCSA() {
const vk = byId(“lookup_voltage”).value;
const selectedCore = getSelectedCore();
const sel = byId(“lookup_csa”);
const noteEl = byId(“lookup_note”);
sel.innerHTML = “”;

```
if (!vk) {
    sel.innerHTML = '<option value="">— select voltage first —</option>';
    noteEl.innerHTML =
        "Select voltage class and CSA to auto populate OD and bend radius. " +
        "All values are for <strong>fixed installation</strong> only. " +
        "Flexible applications, very tight bend radii, cleats and terminations must be verified separately.";
    return;
}

const runtime = getVoltageRuntimeMeta(vk);
const allowedCores = runtime.cores || [];
if (selectedCore !== "any" && allowedCores.length && !allowedCores.includes(selectedCore)) {
    sel.innerHTML = '<option value="">— no CSA for selected core —</option>';
    noteEl.innerHTML =
        `<strong>${getVoltageDisplayName(vk)}</strong><br>` +
        `This voltage class is not available for the selected core arrangement.`;
    return;
}

const csas = CSA_BY_VOLTAGE_KEY[vk] || [];
if (!csas.length) {
    sel.innerHTML = '<option value="">— no CSA data —</option>';
    noteEl.innerHTML =
        `<strong>${getVoltageDisplayName(vk)}</strong><br>` +
        `No CSA range is configured for this entry.`;
    return;
}

csas.forEach(csa => {
    const res = lookupOD(vk, csa, selectedCore);
    const opt = document.createElement("option");
    opt.value = csa;
    opt.textContent = res
        ? `${csa} mm²  —  OD ${res.od} mm  |  MBR ${Math.round(res.mbr)} mm${res.estimated ? " (est.)" : ""}`
        : `${csa} mm²  —  no OD data`;
    sel.appendChild(opt);
});

sel.selectedIndex = 0;
sel.disabled = !!runtime.locked_csa;

const shapeText = getConductorShapeText(vk);
const sectorNote = runtime.sectorial
    ? " Sector conductors are indicated here because they affect OD, termination selection and accessory fit."
    : "";
const systemNote = runtime.standard_basis
    ? ` Standard basis: ${runtime.standard_basis}.`
    : runtime.system_type
        ? ` System basis: ${runtime.system_type}.`
        : "";
const lockedNote = runtime.locked_csa
    ? ` CSA is fixed at ${runtime.locked_csa} mm² for this entry.`
    : "";
const screenNote = runtime.metallic_screen
    ? ` Metallic screen reference: ${runtime.metallic_screen} mm².`
    : "";

noteEl.innerHTML =
    `<strong>${getVoltageDisplayName(vk)}</strong><br>` +
    `${shapeText}.${sectorNote}${systemNote}${lockedNote}${screenNote}`;
```

}

function applyLookup() {
const vk = byId(“lookup_voltage”).value;
const csa = byId(“lookup_csa”).value;
const selectedCore = getSelectedCore();
if (!vk || !csa) return;

```
const result = lookupOD(vk, parseFloat(csa), selectedCore);
if (!result) return;

const runtime = getVoltageRuntimeMeta(vk);

byId("cable_od").value = String(Math.round(result.od * 10) / 10);
byId("bend_factor").value = String(runtime.mbr_factor || Math.max(1, Math.round(result.mbr / result.od)));

const srcEl = byId("od_source_note");
srcEl.textContent = result.estimated
    ? `OD from model or generic schedule. Verify before use.`
    : `OD from stored dataset.`;
srcEl.style.color = result.estimated ? "var(--warn)" : "var(--ok)";

const noteEl = byId("lookup_note");
const shapeText = getConductorShapeText(vk);
const sectorText = runtime.sectorial ? " Sector conductors affect OD and terminations." : "";
const systemText = runtime.system_type
    ? ` ${runtime.system_type}.`
    : runtime.standard_basis
        ? ` ${runtime.standard_basis}.`
        : "";

noteEl.innerHTML =
    `<strong>${getVoltageDisplayName(vk)} — ${csa} mm²</strong><br>` +
    `OD = ${result.od} mm. Fixed installation MBR = ${Math.round(result.mbr)} mm.${systemText} ` +
    `${shapeText}.${sectorText} ` +
    `${result.estimated ? "Estimated value. Verify before design use." : "Stored dataset value."}`;

renderAll();
```

}

function updateFromLookup() {
const vk = byId(“lookup_voltage”).value;
const csa = byId(“lookup_csa”).value;
const selectedCore = getSelectedCore();
const srcEl = byId(“od_source_note”);

```
if (vk && csa) {
    const res = lookupOD(vk, parseFloat(csa), selectedCore);
    if (res) {
        srcEl.textContent = res.estimated
            ? "OD from model or generic schedule. Verify before use."
            : "OD from stored dataset.";
        srcEl.style.color = res.estimated ? "var(--warn)" : "var(--ok)";
    }
}
renderAll();
```

}

function getGroupGeometry(inputs) {
const d = inputs.cable_od_mm;
const sqrt3 = Math.sqrt(3);
switch (inputs.formation_type) {
case “trefoil_single_row”: return { width: d * 2, depth: d * (1 + sqrt3 / 2), drawType: “trefoil”, note: “Trefoil 1c groups” };
case “flat_single_row”:    return { width: d * 3, depth: d, drawType: “flat_3”, note: “Flat 1c groups” };
case “stacked_two_high”:   return { width: d * 3, depth: d * 2, drawType: “stacked_2x3”, note: “Stacked 2 high 1c groups” };
case “multicore_3c”:       return { width: d, depth: d, drawType: “multicore_3c”, note: “Three core cable groups” };
case “multicore_4c”:       return { width: d, depth: d, drawType: “multicore_4c”, note: “Four core cable groups” };
case “multicore_5c”:       return { width: d, depth: d, drawType: “multicore_5c”, note: “Five core cable groups” };
case “dc_pair_horizontal”: return { width: d * 2, depth: d, drawType: “dc_pair_h”, note: “DC horizontal pair” };
case “dc_pair_vertical”:   return { width: d, depth: d * 2, drawType: “dc_pair_v”, note: “DC vertical pair” };
default:                   return { width: d * 2, depth: d * (1 + sqrt3 / 2), drawType: “trefoil”, note: “Trefoil 1c groups” };
}
}

function computeLayout(inputs) {
const gapH = effectiveGap(inputs.spacing_basis, inputs.spacing_h_mm, inputs.cable_od_mm);
const gapV = effectiveGap(inputs.spacing_basis, inputs.spacing_v_mm, inputs.cable_od_mm);
const geom = getGroupGeometry(inputs);
const perRow = Math.max(1, inputs.max_per_row);
const groupCount = Math.max(1, inputs.circuit_qty);
const rows = Math.ceil(groupCount / perRow);
const rowCounts = [];
let remaining = groupCount;

```
for (let i = 0; i < rows; i++) {
    const c = Math.min(perRow, remaining);
    rowCounts.push(c);
    remaining -= c;
}

const maxRowCount = Math.max(...rowCounts);
const formationWidth = (maxRowCount * geom.width) + (Math.max(maxRowCount - 1, 0) * gapH);
const formationDepth = (rows * geom.depth) + (Math.max(rows - 1, 0) * gapV);
const appliedBendRadius = inputs.cable_od_mm * inputs.bend_factor;
const singleCableOuterSweepRadius = appliedBendRadius + inputs.cable_od_mm / 2;
const approxGroupCtcH = inputs.spacing_basis === "centre_to_centre" ? inputs.spacing_h_mm : geom.width + gapH;
const approxGroupCtcV = inputs.spacing_basis === "centre_to_centre" ? inputs.spacing_v_mm : geom.depth + gapV;

return {
    rows,
    rowCounts,
    groupWidth: geom.width,
    groupDepth: geom.depth,
    drawType: geom.drawType,
    groupNote: geom.note,
    gapH,
    gapV,
    formationWidth,
    formationDepth,
    appliedBendRadius,
    singleCableOuterSweepRadius,
    approxGroupCtcH,
    approxGroupCtcV,
    indicativeTrenchWidth: formationWidth,
    indicativeTrenchDepth: inputs.burial_depth_mm + formationDepth,
    hasUnevenLastRow: rowCounts.length > 1 && rowCounts[rowCounts.length - 1] !== maxRowCount
};
```

}

function buildReview(inputs, layout) {
const inputConflicts = [];
const reviewPoints = [];
const standingAssumptions = [
“Within group cable spacing is assumed touching unless separately modelled.”,
“Mixed service visual uses one worst case OD for all shown services and is schematic only.”,
“Bend model is a single cable body sweep only.”,
“Burial depth is recorded as an indicative input only.”,
“4 core and 5 core multicore formations are drawn as a single cable OD.”
];

```
const vk = byId("lookup_voltage").value;
const runtime = getVoltageRuntimeMeta(vk);

if (inputs.grouping_basis === "mixed_service") {
    reviewPoints.push("Mixed service grouping selected. Visual remains schematic and uses one worst case OD for all shown services.");
}

if (inputs.spacing_basis === "centre_to_centre") {
    if (inputs.spacing_h_mm <= inputs.cable_od_mm) {
        inputConflicts.push("Horizontal centre to centre spacing is less than or equal to cable outer diameter.");
    }
    if (inputs.spacing_v_mm <= inputs.cable_od_mm) {
        inputConflicts.push("Vertical centre to centre spacing is less than or equal to cable outer diameter.");
    }
}

if (runtime.sectorial) {
    reviewPoints.push("Sector conductor entry selected. Check termination and accessory compatibility against the intended conductor shape.");
}

if (runtime.system_type) {
    reviewPoints.push(`Transmission entry selected. Check installation basis against the stated system standard before use.`);
}

if (layout.formationWidth >= 3000) reviewPoints.push("Formation width is at or above 3000 mm and may need corridor review.");
if (layout.formationDepth > 2000) reviewPoints.push("Formation depth is above 2000 mm and may need trench or enclosure review.");
if (inputs.bend_factor < 12 && inputs.service_type !== "dc") reviewPoints.push("Low bend factor entered. Confirm against cable data.");
if (layout.hasUnevenLastRow) reviewPoints.push("Worst case envelope is based on the fullest row.");

const worstSeverity = inputConflicts.length ? "error" : reviewPoints.length ? "warn" : "ok";
const summary = worstSeverity === "ok"
    ? "Geometry capture complete. No active conflicts or review points detected."
    : worstSeverity === "warn"
        ? "Geometry capture complete with review points."
        : "Input conflict detected. Review before using output.";

return { inputConflicts, reviewPoints, standingAssumptions, worstSeverity, summary };
```

}

function renderStatus(review) {
const box = byId(“status_box”);
box.className = `status-box ${review.worstSeverity}`;
box.textContent = review.summary;
}

function renderIssues(review) {
const conflictBox = byId(“conflict_box”);
const reviewBox = byId(“review_box”);
const conflictList = byId(“conflict_list”);
const reviewList = byId(“review_list”);

```
conflictList.innerHTML = "";
reviewList.innerHTML = "";

if (review.inputConflicts.length) {
    conflictBox.hidden = false;
    review.inputConflicts.forEach(msg => {
        const li = document.createElement("li");
        li.textContent = msg;
        conflictList.appendChild(li);
    });
} else {
    conflictBox.hidden = true;
}

if (review.reviewPoints.length) {
    reviewBox.hidden = false;
    review.reviewPoints.forEach(msg => {
        const li = document.createElement("li");
        li.textContent = msg;
        reviewList.appendChild(li);
    });
} else {
    reviewBox.hidden = true;
}
```

}

function renderStats(layout, review, inputs) {
byId(“out_width”).textContent = formatMm(layout.formationWidth);
byId(“out_depth”).textContent = formatMm(layout.formationDepth);
byId(“out_burial”).textContent = formatMm(inputs.burial_depth_mm);
byId(“out_trench_width”).textContent = formatMm(layout.indicativeTrenchWidth);
byId(“out_trench_depth”).textContent = formatMm(layout.indicativeTrenchDepth);
byId(“out_mbr”).textContent = formatMm(layout.appliedBendRadius);
byId(“out_rows”).textContent = `${layout.rows} row${layout.rows === 1 ? "" : "s"}`;
byId(“out_gap_h”).textContent = formatMm(layout.gapH);
byId(“out_gap_v”).textContent = formatMm(layout.gapV);
byId(“out_ctc_h”).textContent = formatMm(layout.approxGroupCtcH);
byId(“out_ctc_v”).textContent = formatMm(layout.approxGroupCtcV);
byId(“out_note”).textContent = review.worstSeverity.toUpperCase();
byId(“out_note”).style.color = review.worstSeverity === “error” ? “#ff6666”
: review.worstSeverity === “warn” ? “#ffcc66” : “#00ff88”;
}

function getServiceColours(serviceType) {
if (serviceType === “mv”) return { fill: “#b87333”, stroke: “#ff5555” };
if (serviceType === “ehv”) return { fill: “#ffd700”, stroke: “#ff8800” };
if (serviceType === “lv”) return { fill: “#666”, stroke: “#00ffff” };
return { fill: “#777”, stroke: “#ff00ff” };
}

function drawGroup(ctx, x, y, d, drawType, serviceType, scale) {
const r = d / 2;
const col = getServiceColours(serviceType);

```
function circle(cx, cy, fill, stroke) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
}

if (drawType === "trefoil") {
    const h = d * (1 + Math.sqrt(3) / 2);
    circle(x + r, y + h - r, col.fill, col.stroke);
    circle(x + d + r, y + h - r, col.fill, col.stroke);
    circle(x + d, y + r, col.fill, col.stroke);
    return;
}

if (drawType === "flat_3") {
    circle(x + r, y + r, col.fill, col.stroke);
    circle(x + d + r, y + r, col.fill, col.stroke);
    circle(x + (2 * d) + r, y + r, col.fill, col.stroke);
    return;
}

if (drawType === "stacked_2x3") {
    circle(x + r, y + r, col.fill, col.stroke);
    circle(x + d + r, y + r, col.fill, col.stroke);
    circle(x + (2 * d) + r, y + r, col.fill, col.stroke);
    circle(x + r, y + d + r, col.fill, col.stroke);
    circle(x + d + r, y + d + r, col.fill, col.stroke);
    circle(x + (2 * d) + r, y + d + r, col.fill, col.stroke);
    return;
}

if (drawType === "dc_pair_h") {
    circle(x + r, y + r, "#555", "#ff00ff");
    circle(x + d + r, y + r, "#777", "#ff00ff");
    return;
}

if (drawType === "dc_pair_v") {
    circle(x + r, y + r, "#555", "#ff00ff");
    circle(x + r, y + d + r, "#777", "#ff00ff");
    return;
}

if (drawType === "multicore_3c" || drawType === "multicore_4c" || drawType === "multicore_5c") {
    const coreCount = drawType === "multicore_3c" ? 3 : drawType === "multicore_4c" ? 4 : 5;

    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + r, y + r, r * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 1.2 / scale;
    ctx.setLineDash([3 / scale, 3 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);

    const dotR = r * 0.13;
    const ringR = r * 0.38;
    for (let k = 0; k < coreCount; k++) {
        const ang = (2 * Math.PI * k / coreCount) - Math.PI / 2;
        const cx2 = x + r + ringR * Math.cos(ang);
        const cy2 = y + r + ringR * Math.sin(ang);
        ctx.beginPath();
        ctx.arc(cx2, cy2, dotR, 0, Math.PI * 2);
        ctx.fillStyle = col.stroke;
        ctx.fill();
    }
}
```

}

function drawFormation(inputs, layout, review) {
const canvas = byId(“formation_canvas”);
const W = canvas.width;
const H = canvas.height;
const ctx = canvas.getContext(“2d”);
ctx.clearRect(0, 0, W, H);

```
const topInfo = 50;
const botInfo = 26;
const pad = 34;
const usableW = W - pad * 2;
const usableH = H - pad * 2 - topInfo - botInfo;
const scaleX = usableW / Math.max(layout.formationWidth, 1);
const scaleY = usableH / Math.max(layout.formationDepth, 1);
const scale = Math.min(scaleX, scaleY);
const dW = layout.formationWidth * scale;
const dH = layout.formationDepth * scale;
const offX = Math.max(pad, (W - dW) / 2);
const offY = Math.max(topInfo + 6, topInfo + ((usableH - dH) / 2) + 12);

ctx.save();
ctx.translate(offX, offY);
ctx.scale(scale, scale);

ctx.fillStyle = "#11161f";
ctx.fillRect(0, 0, layout.formationWidth, layout.formationDepth);
ctx.strokeStyle = review.worstSeverity === "error" ? "#ff6666" : "#444";
ctx.lineWidth = 3 / scale;
ctx.strokeRect(0, 0, layout.formationWidth, layout.formationDepth);

let y = 0;
for (let r = 0; r < layout.rowCounts.length; r++) {
    let x = 0;
    for (let i = 0; i < layout.rowCounts[r]; i++) {
        drawGroup(ctx, x, y, inputs.cable_od_mm, layout.drawType, inputs.service_type, scale);
        x += layout.groupWidth + layout.gapH;
    }
    y += layout.groupDepth + layout.gapV;
}
ctx.restore();

ctx.fillStyle = "#00ffff";
ctx.font = "12px monospace";
ctx.textAlign = "left";
ctx.fillText(`Worst case envelope width = ${Math.round(layout.formationWidth)} mm  |  envelope depth = ${Math.round(layout.formationDepth)} mm`, 14, 20);
ctx.fillText(`Indicative trench width = ${Math.round(layout.indicativeTrenchWidth)} mm  |  indicative trench depth = ${Math.round(layout.indicativeTrenchDepth)} mm`, 14, 36);
ctx.fillText(`Formation: ${layout.groupNote}`, 14, H - 10);
ctx.textAlign = "right";
ctx.fillStyle = "#9fa8b7";
ctx.fillText(`Rows: ${layout.rows}  |  Gap Horiz: ${Math.round(layout.gapH)} mm  |  Gap Vert: ${Math.round(layout.gapV)} mm`, W - 14, 20);

ctx.fillStyle = "#8fd3ff";
ctx.textAlign = "center";
ctx.fillText("WIDTH", offX + dW / 2, offY + dH + 18);
ctx.save();
ctx.translate(offX + dW + 18, offY + dH / 2);
ctx.rotate(-Math.PI / 2);
ctx.fillText("DEPTH", 0, 0);
ctx.restore();

canvas.setAttribute("aria-label",
    `Worst case formation envelope showing ${layout.rows} rows. Width ${Math.round(layout.formationWidth)} mm. Depth ${Math.round(layout.formationDepth)} mm.`);
```

}

function drawTrench(inputs, layout) {
const canvas = byId(“trench_canvas”);
const W = canvas.width;
const H = canvas.height;
const ctx = canvas.getContext(“2d”);
ctx.clearRect(0, 0, W, H);

```
const applicable = ["buried_duct", "direct_buried", "open_trough"].includes(inputs.installation_condition);
if (!applicable) {
    ctx.fillStyle = "#9fa8b7";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Trench cross section not applicable to selected installation condition.", W / 2, H / 2);
    return;
}

const pad = 40;
const topPad = 60;
const botPad = 90;
const usableW = W - pad * 2;
const usableH = H - topPad - botPad;

const bd = inputs.burial_depth_mm;
const td = layout.indicativeTrenchDepth;
const tw = layout.indicativeTrenchWidth;

if (!Number.isFinite(bd) || !Number.isFinite(td) || !Number.isFinite(tw) || tw <= 0 || td <= 0) {
    ctx.fillStyle = "#9fa8b7";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for valid burial depth input.", W / 2, H / 2);
    return;
}

const scaleX = usableW / tw;
const scaleY = usableH / td;
const scale = Math.min(scaleX, scaleY);

const trenchW = tw * scale;
const trenchD = td * scale;
const trenchX = (W - trenchW) / 2;
const trenchY = topPad;
const burialY = trenchY + (bd * scale);
const formationW = layout.formationWidth * scale;
const formationD = layout.formationDepth * scale;
const formationX = trenchX + (trenchW - formationW) / 2;

ctx.strokeStyle = "#8fd3ff";
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(pad / 2, trenchY);
ctx.lineTo(W - pad / 2, trenchY);
ctx.stroke();

ctx.fillStyle = "#11161f";
ctx.fillRect(trenchX, trenchY, trenchW, trenchD);
ctx.strokeStyle = "#444";
ctx.lineWidth = 1;
ctx.strokeRect(trenchX, trenchY, trenchW, trenchD);

ctx.strokeStyle = "#8fd3ff";
ctx.lineWidth = 1;
ctx.setLineDash([6, 6]);
ctx.beginPath();
ctx.moveTo(trenchX, burialY);
ctx.lineTo(trenchX + trenchW, burialY);
ctx.stroke();
ctx.setLineDash([]);

ctx.fillStyle = "rgba(0,255,255,0.08)";
ctx.fillRect(formationX, burialY, formationW, formationD);
ctx.strokeStyle = "#00ffff";
ctx.lineWidth = 1.5;
ctx.strokeRect(formationX, burialY, formationW, formationD);

ctx.fillStyle = "#8fd3ff";
ctx.font = "12px monospace";
ctx.textAlign = "left";
ctx.fillText("Ground line", pad, trenchY - 10);
ctx.fillText(`Burial depth input to top of cable box = ${Math.round(bd)} mm`, pad, burialY - 8);
ctx.fillText(`Indicative trench width = ${Math.round(tw)} mm`, pad, H - 58);
ctx.fillText(`Indicative trench depth = ${Math.round(td)} mm`, pad, H - 38);
ctx.fillText("Civil design still to add bedding, side clearance, duct OD and build up", pad, H - 18);

canvas.setAttribute("aria-label",
    `Indicative trench cross section. Width ${Math.round(tw)} mm. Depth ${Math.round(td)} mm. Burial depth ${Math.round(bd)} mm.`);
```

}

function drawBend(inputs, layout) {
const canvas = byId(“bend_canvas”);
const W = canvas.width;
const H = canvas.height;
const ctx = canvas.getContext(“2d”);
ctx.clearRect(0, 0, W, H);

```
const pad = 40;
const radius = layout.appliedBendRadius;
const outerRadius = layout.singleCableOuterSweepRadius;
const usableW = W - pad * 2;
const usableH = H - pad * 2;
const scaleX = usableW / Math.max(outerRadius * 2.4, 1);
const scaleY = usableH / Math.max(outerRadius * 1.9, 1);
const scale = Math.min(scaleX, scaleY);
const ct = Math.max(inputs.cable_od_mm * scale, 2);
const xOrigin = Math.max(radius * scale * 0.95, W * 0.28);
const straightL = Math.max(radius * scale * 0.8, W * 0.24);
const topL = Math.max(radius * scale * 0.45, 90);

ctx.save();
ctx.translate(xOrigin, H - pad);

ctx.fillStyle = "#111";
ctx.fillRect(-straightL, -ct / 2, straightL, ct);

ctx.beginPath();
ctx.arc(0, -radius * scale, radius * scale, Math.PI / 2, 0, true);
ctx.strokeStyle = "#00ffff";
ctx.lineWidth = ct;
ctx.stroke();

ctx.beginPath();
ctx.moveTo(radius * scale, -radius * scale);
ctx.lineTo(radius * scale, -radius * scale - topL);
ctx.strokeStyle = "#00ffff";
ctx.lineWidth = ct;
ctx.stroke();

ctx.beginPath();
ctx.arc(0, -radius * scale, radius * scale, 0, Math.PI / 2, false);
ctx.strokeStyle = "#ff00ff";
ctx.lineWidth = 1.5;
ctx.setLineDash([5, 5]);
ctx.stroke();

ctx.beginPath();
ctx.arc(0, -radius * scale, outerRadius * scale, Math.PI / 2, 0, true);
ctx.strokeStyle = "#666";
ctx.lineWidth = 1;
ctx.setLineDash([7, 4]);
ctx.stroke();
ctx.setLineDash([]);

ctx.fillStyle = "#ff00ff";
ctx.textAlign = "left";
ctx.font = "12px monospace";
ctx.fillText(`Applied bend radius = ${Math.round(radius)} mm`, radius * scale * 0.2, -radius * scale * 0.52);
ctx.fillStyle = "#9fa8b7";
ctx.fillText(`Single cable outer sweep = ${Math.round(outerRadius)} mm`, radius * scale * 0.2, -radius * scale * 0.38);
ctx.restore();

ctx.fillStyle = "#00ffff";
ctx.font = "12px monospace";
ctx.textAlign = "left";
ctx.fillText(`Cable OD: ${Math.round(inputs.cable_od_mm)} mm`, 14, 18);
ctx.fillText(`Bend factor: ${Math.round(inputs.bend_factor)} x OD`, 14, 34);
ctx.fillText(`Burial depth input: ${Math.round(inputs.burial_depth_mm)} mm`, 14, 50);

canvas.setAttribute("aria-label",
    `Single cable bend sweep. Applied bend radius ${Math.round(radius)} mm. Outer sweep ${Math.round(outerRadius)} mm.`);
```

}

function buildSnapshot(inputs, layout, review) {
const vk = byId(“lookup_voltage”).value;
const runtime = getVoltageRuntimeMeta(vk);
const csa = byId(“lookup_csa”).value;

```
const snap = {
    captured_at: new Date().toISOString(),
    schema_version: "1.6.0",
    tool_scope: "Worst case cable formation, indicative burial depth and single cable bend geometry capture only",
    assumptions: {
        within_group_cable_spacing: "touching",
        bend_model_basis: "single_cable_body_sweep_only",
        burial_depth_basis: "user_input_only",
        mixed_service_visual_basis: "single_worst_case_od_for_all_services",
        multicore_4c_5c_basis: "single_od_envelope_only"
    },
    calculations_performed: false,
    not_for_construction: true,
    route_id: inputs.route_name,
    cable_od_source: byId("od_source_note") ? byId("od_source_note").textContent : "manual",
    cable_selection: {
        voltage_key: vk || null,
        voltage_label: vk ? getVoltageDisplayName(vk) : null,
        csa_mm2: csa ? Number(csa) : null,
        conductor_shape: vk ? getConductorShapeText(vk) : null,
        sectorial: !!runtime.sectorial,
        standard_basis: runtime.standard_basis || null,
        system_type: runtime.system_type || null,
        metallic_screen_mm2: runtime.metallic_screen || null
    },
    inputs: {
        worst_case_section_length_m: inputs.section_length_m,
        installation_condition: inputs.installation_condition,
        service_type: inputs.service_type,
        grouping_basis: inputs.grouping_basis,
        burial_depth_mm: inputs.burial_depth_mm,
        formation_type: inputs.formation_type,
        indicative_trench_cross_section_enabled: ["buried_duct", "direct_buried", "open_trough"].includes(inputs.installation_condition),
        number_of_circuit_groups: inputs.circuit_qty,
        max_groups_per_row: inputs.max_per_row,
        cable_outer_diameter_mm: inputs.cable_od_mm,
        spacing_basis: inputs.spacing_basis,
        horizontal_spacing_input_mm: inputs.spacing_h_mm,
        vertical_spacing_input_mm: inputs.spacing_v_mm,
        bend_factor_x_od: inputs.bend_factor
    },
    derived_geometry: {
        effective_horizontal_clear_gap_mm: layout.gapH,
        effective_vertical_clear_gap_mm: layout.gapV,
        approx_horizontal_group_ctc_mm: layout.approxGroupCtcH,
        approx_vertical_group_ctc_mm: layout.approxGroupCtcV,
        group_count_rows: layout.rows,
        row_group_counts: layout.rowCounts,
        group_geometry_note: layout.groupNote,
        worst_case_formation_width_mm: layout.formationWidth,
        worst_case_formation_depth_mm: layout.formationDepth,
        applied_bend_radius_mm: layout.appliedBendRadius,
        single_cable_outer_sweep_radius_mm: layout.singleCableOuterSweepRadius
    },
    outside_scope: [
        "thermal rating and derating",
        "ambient and soil correction factors",
        "pulling tension and installation forces",
        "duct entry and trench profile design",
        "utility compliance check",
        "highway loading and civil protection design",
        "joint bay and termination geometry",
        "full multi cable bend sweep",
        "internal core arrangement within multicore cables"
    ],
    reliance_statement: "Indicative geometry only. Must be independently verified before design use.",
    review: {
        status: review.worstSeverity,
        input_conflicts: review.inputConflicts,
        review_points: review.reviewPoints,
        standing_assumptions: review.standingAssumptions
    }
};

appState.snapshotText = JSON.stringify(snap, null, 4);
byId("snapshot_box").textContent = appState.snapshotText;
```

}

function exportJson() {
if (!appState.snapshotText) return;
const base = (byId(“route_name”).value.trim() || “geometry_capture”).replace(/[^a-z0-9_]/gi, “_”);
const blob = new Blob([appState.snapshotText], { type: “application/json” });
const url = URL.createObjectURL(blob);
const a = document.createElement(“a”);
a.href = url;
a.download = `${base}_geometry_capture_NOT_FOR_CONSTRUCTION.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}

async function copySnapshot() {
const btn = byId(“copy_btn”);
if (!appState.snapshotText) return;
try {
await navigator.clipboard.writeText(appState.snapshotText);
btn.textContent = “Copied”;
setTimeout(() => { btn.textContent = “Copy Snapshot”; }, 1000);
} catch (_) {
btn.textContent = “Copy Failed”;
setTimeout(() => { btn.textContent = “Copy Snapshot”; }, 1200);
}
}

function syncSpacingInputs() {
const basis = byId(“spacing_basis”).value;
const touching = basis === “touching”;
const h = byId(“spacing_h”);
const v = byId(“spacing_v”);
const note = byId(“spacing_note”);
const qty = clampInteger(byId(“circuit_qty”).value, 1, 1);

```
if (qty <= 1) {
    h.disabled = true;
    v.disabled = true;
    note.textContent = "Spacing not applicable for a single circuit group.";
    return;
}

if (!touching) {
    const hv = Number(h.value);
    const vv = Number(v.value);
    if (Number.isFinite(hv) && hv > 0) appState.previousSpacing.h = hv;
    if (Number.isFinite(vv) && vv > 0) appState.previousSpacing.v = vv;
}

h.disabled = touching;
v.disabled = touching;

if (touching) {
    h.value = 0;
    v.value = 0;
    note.textContent = "Touching selected. Spacing inputs are locked to zero clear gap.";
    return;
}

if (Number(h.value) === 0 && appState.previousSpacing.h > 0) h.value = appState.previousSpacing.h;
if (Number(v.value) === 0 && appState.previousSpacing.v > 0) v.value = appState.previousSpacing.v;

note.textContent = basis === "centre_to_centre"
    ? "Centre to centre selected. Clear gap is derived by subtracting cable outer diameter."
    : "Clear gap selected. Enter direct clear spacing between group envelopes.";
```

}

function syncBurialDepthNote(force = false) {
const serviceType = byId(“service_type”).value;
const burial = byId(“burial_depth”);
const note = byId(“burial_note”);
const defaultDepth = DEFAULT_BURIAL_DEPTHS[serviceType] || 900;
const minDepth = getMinBurialDepth(serviceType);

```
if (force || !Number.isFinite(Number(burial.value)) || burial.value.trim() === "") {
    burial.value = String(defaultDepth);
}

const labels = { lv: "LV Power AC", mv: "MV AC", ehv: "HV AC", dc: "DC" };
const minText = minDepth > 0 ? ` Guidance floor used internally = ${minDepth} mm.` : "";
note.textContent = `Default = ${defaultDepth} mm. ${labels[serviceType] || serviceType}.${minText}`;
```

}

// ===============================
// ⚠️ DC WARNING + BLOCK
// ===============================
function enforceDCRules() {
const serviceType = byId(“service_type”).value;
const formation = byId(“formation_type”);

```
if (serviceType === "dc") {
    alert(
        "DC SYSTEM WARNING\n\n" +
        "DC cables behave differently to AC.\n" +
        "Class II insulation and insulation monitoring required.\n\n" +
        "1500V DC cables MUST be single core.\n" +
        "Multicore DC cables are NOT permitted."
    );

    if (formation.value.includes("multicore")) {
        formation.value = "dc_pair_horizontal";
    }
}
```

}

function renderAll() {
const inputs = getInputs();
const layout = computeLayout(inputs);
const review = buildReview(inputs, layout);
appState.inputs = inputs;
appState.layout = layout;
appState.review = review;
renderStatus(review);
renderIssues(review);
renderStats(layout, review, inputs);
drawFormation(inputs, layout, review);
drawTrench(inputs, layout);
drawBend(inputs, layout);
buildSnapshot(inputs, layout, review);
}

function debounce(fn, delay) {
let t = null;
return function (…args) {
clearTimeout(t);
t = setTimeout(() => fn.apply(this, args), delay);
};
}

const debouncedRenderAll = debounce(renderAll, 80);

function handleInput(event) {
const id = event.target.id;

```
if (id === "service_type") {
    populateFormationOptions(byId("service_type").value, byId("formation_type").value);
    populateVoltageOptions();
    syncBurialDepthNote(true);
}

if (id === "formation_type") {
    syncFormationToLookupCore();
    populateVoltageOptions();
}

if (id === "spacing_basis" || id === "circuit_qty") syncSpacingInputs();

debouncedRenderAll();
```

}

function handleChange(event) {
const id = event.target.id;

```
if (id === "service_type") {
    populateFormationOptions(byId("service_type").value, byId("formation_type").value);
    populateVoltageOptions();
    syncBurialDepthNote(true);
    enforceDCRules();
}

if (id === "formation_type") {
    syncFormationToLookupCore();
    populateVoltageOptions();
}

if (id === "spacing_basis" || id === "circuit_qty") syncSpacingInputs();

renderAll();
```

}

function handleBlur(event) {
const id = event.target.id;
const otherNumerics = [“section_length”, “circuit_qty”, “max_per_row”, “cable_od”, “spacing_h”, “spacing_v”, “bend_factor”];

```
if (otherNumerics.includes(id)) {
    normaliseIntegerFields();
    if (id === "circuit_qty") syncSpacingInputs();
    renderAll();
} else if (id === "burial_depth") {
    normaliseBurialDepthFieldOnBlur();
    renderAll();
}
```

}

function updateViewportMode() {
const isLM = window.matchMedia(”(orientation: landscape) and (max-width: 1200px)”).matches;
document.body.classList.toggle(“landscape-mobile”, isLM);
}

function toggleDrawingView() {
const isOn = document.body.classList.toggle(“drawing-view”);
byId(“drawing_view_btn”).textContent = isOn ? “Exit Drawing View” : “Drawing View”;
updateViewportMode();
renderAll();
}

function bindNumericFieldUX() {
document.querySelectorAll(‘input[data-numeric=“true”]’).forEach(el => {
const sel = () => {
window.setTimeout(() => {
try {
el.select();
if (el.setSelectionRange) el.setSelectionRange(0, el.value.length);
} catch (_) {}
}, 0);
};
el.addEventListener(“focus”, sel);
el.addEventListener(“click”, sel);
el.addEventListener(“touchend”, sel);
});
}

function bindEvents() {
[“installation_condition”, “service_type”, “grouping_basis”, “formation_type”, “spacing_basis”]
.forEach(id => byId(id).addEventListener(“change”, handleChange));

```
byId("lookup_cores").addEventListener("change", () => { populateVoltageOptions(); });
byId("lookup_voltage").addEventListener("change", () => { populateLookupCSA(); applyLookup(); });
byId("lookup_csa").addEventListener("change", applyLookup);

byId("cable_od").addEventListener("input", () => {
    const vk = byId("lookup_voltage").value;
    const csa = byId("lookup_csa").value;
    if (!vk || !csa) {
        byId("od_source_note").textContent = "OD entered manually.";
        byId("od_source_note").style.color = "var(--muted-soft)";
    }
});

["route_name", "section_length", "burial_depth", "circuit_qty", "max_per_row", "cable_od", "spacing_h", "spacing_v", "bend_factor", "formation_type"]
    .forEach(id => {
        byId(id).addEventListener("input", handleInput);
        byId(id).addEventListener("blur", handleBlur);
    });

byId("export_btn").addEventListener("click", exportJson);
byId("copy_btn").addEventListener("click", copySnapshot);
byId("drawing_view_btn").addEventListener("click", toggleDrawingView);
window.addEventListener("resize", debounce(() => { updateViewportMode(); renderAll(); }, 80));
```

}

function init() {
populateFormationOptions(byId(“service_type”).value, “trefoil_single_row”);
syncFormationToLookupCore();
populateVoltageOptions();
syncSpacingInputs();
syncBurialDepthNote(true);
normaliseIntegerFields();
bindNumericFieldUX();
bindEvents();
updateViewportMode();
enforceDCRules();
renderAll();
}

init();
