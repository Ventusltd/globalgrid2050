"use strict";

const topoState = { mode: "string" };
const RHO = { cu: 0.01724, al: 0.02826 };

function t(id) { return document.getElementById(id); }
function n(id, fallback = 0) { const el = t(id); if (!el) return fallback; const v = parseFloat(el.value); return Number.isFinite(v) ? v : fallback; }
function i(id, fallback = 0) { return Math.max(0, Math.round(n(id, fallback))); }
function txt(id, value) { const el = t(id); if (el) el.textContent = value; }
function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d) : "0.00"; }

function read(prefix) {
    return {
        modWp: n(prefix + "_mod_wp", 660),
        voc: n(prefix + "_voc", 45.9),
        vmp: n(prefix + "_vmp", 38.1),
        isc: n(prefix + "_isc", 18.45),
        imp: n(prefix + "_imp", 17.35),
        fuseA: n(prefix + "_fuse_a", 35),
        systemV: n(prefix + "_system_v", 1500),
        vocCoeff: n(prefix + "_voc_coeff", -0.25),
        iscCoeff: n(prefix + "_isc_coeff", 0.04),
        minTemp: n(prefix + "_min_temp", -10),
        currentFactor: n(prefix + "_current_factor", 1.25),
        bifacialCurrent: n(prefix + "_bifacial_current", 10),
        modulesPerString: i(prefix + "_modules_per_string", 30),
        dcLengthM: n(prefix + "_dc_length_m", 300),
        dcCsa: n(prefix + "_dc_csa", 6),
        dcMaterial: t(prefix + "_dc_material")?.value || "cu",
        dcVdropLimit: n(prefix + "_dc_vdrop_limit", 1)
    };
}

function baseCalc(v) {
    const stringKwp = v.modulesPerString * v.modWp / 1000;
    const stringVmp = v.modulesPerString * v.vmp;
    const stringVocStc = v.modulesPerString * v.voc;
    const coldFactor = 1 + Math.abs(v.vocCoeff / 100) * (25 - v.minTemp);
    const coldModuleVoc = v.voc * coldFactor;
    const coldStringVoc = v.modulesPerString * coldModuleVoc;
    const maxModules = Math.floor(v.systemV / coldModuleVoc);
    const designCurrent = v.isc * v.currentFactor * (1 + v.bifacialCurrent / 100);
    const rho = RHO[v.dcMaterial] || RHO.cu;
    const loopResistance = 2 * v.dcLengthM * rho / v.dcCsa;
    const cableDropV = designCurrent * loopResistance;
    const cableDropPct = stringVmp > 0 ? cableDropV / stringVmp * 100 : 0;
    const cableLossW = designCurrent * designCurrent * loopResistance;
    return { stringKwp, stringVmp, stringVocStc, coldFactor, coldStringVoc, maxModules, designCurrent, loopResistance, cableDropV, cableDropPct, cableLossW };
}

function calcString() {
    const v = read("s");
    v.stringsPerInverter = i("s_strings_per_inverter", 21);
    v.inverterKva = n("s_inverter_kva", 352);
    v.invertersPerSkid = i("s_inverters_per_skid", 28);
    v.skidMva = n("s_skid_mva", 8.96);
    v.skidsPerRing = i("s_skids_per_ring", 5);
    const b = baseCalc(v);
    const dcPerInvKwp = b.stringKwp * v.stringsPerInverter;
    const invAcMva = v.inverterKva / 1000;
    const dcac = invAcMva > 0 ? dcPerInvKwp / 1000 / invAcMva : 0;
    const skidDcMwp = dcPerInvKwp * v.invertersPerSkid / 1000;
    const skidInvAcMva = invAcMva * v.invertersPerSkid;
    const ringAcMva = v.skidMva * v.skidsPerRing;
    const warnings = [];
    if (b.coldStringVoc > v.systemV) warnings.push("Cold string Voc exceeds system voltage limit");
    if (v.modulesPerString > b.maxModules) warnings.push("Modules per string exceeds calculated cold limit");
    if (b.designCurrent > v.fuseA * 0.8) warnings.push("Design current approaches module fuse rating");
    if (b.cableDropPct > v.dcVdropLimit) warnings.push("DC cable voltage drop exceeds selected limit");
    if (skidInvAcMva > v.skidMva) warnings.push("Inverter ACmax exceeds selected skid transformer rating");
    return { mode: "string", v, b, dcPerInvKwp, invAcMva, dcac, skidDcMwp, skidInvAcMva, ringAcMva, warnings };
}

function calcCentral() {
    const v = read("c");
    v.stringsPerCombiner = i("c_strings_per_combiner", 24);
    v.combinerLimitKw = n("c_combiner_limit_kw", 500);
    v.invDcMw = n("c_inv_dc_mw", 5.28);
    v.invAcMw = n("c_inv_ac_mw", 4.40);
    v.skidMva = n("c_skid_mva", 4.40);
    v.invertersPerSkid = i("c_inverters_per_skid", 1);
    v.skidsPerRing = i("c_skids_per_ring", 5);
    const b = baseCalc(v);
    const combinerKw = b.stringKwp * v.stringsPerCombiner;
    const reqStrings = Math.ceil(v.invDcMw * 1000 / b.stringKwp);
    const combinersPerInv = Math.ceil(reqStrings / v.stringsPerCombiner);
    const dcac = v.invAcMw > 0 ? v.invDcMw / v.invAcMw : 0;
    const skidDcMwp = v.invDcMw * v.invertersPerSkid;
    const skidInvAcMva = v.invAcMw * v.invertersPerSkid;
    const ringAcMva = v.skidMva * v.skidsPerRing;
    const warnings = [];
    if (b.coldStringVoc > v.systemV) warnings.push("Cold string Voc exceeds system voltage limit");
    if (combinerKw > v.combinerLimitKw) warnings.push("Combiner box DC capacity exceeds selected limit");
    if (b.cableDropPct > v.dcVdropLimit) warnings.push("DC cable voltage drop exceeds selected limit");
    if (v.invAcMw > v.skidMva) warnings.push("Central AC output exceeds selected skid transformer rating");
    return { mode: "central", v, b, combinerKw, reqStrings, combinersPerInv, dcPerInvKwp: v.invDcMw * 1000, invAcMva: v.invAcMw, dcac, skidDcMwp, skidInvAcMva, ringAcMva, warnings };
}

function currentCalc() { return topoState.mode === "central" ? calcCentral() : calcString(); }

function renderStats(r) {
    txt("out_string_kwp", fmt(r.b.stringKwp, 2) + " kWp");
    txt("out_string_vmp", fmt(r.b.stringVmp, 1) + " V");
    txt("out_string_voc_stc", fmt(r.b.stringVocStc, 1) + " V");
    txt("out_string_voc_cold", fmt(r.b.coldStringVoc, 1) + " V");
    txt("out_max_modules", String(r.b.maxModules));
    txt("out_design_current", fmt(r.b.designCurrent, 2) + " A");
    txt("out_dc_per_inv", fmt(r.dcPerInvKwp, 1) + " kWp");
    txt("out_dcac", fmt(r.dcac, 3));
    txt("out_skid_block", fmt(r.skidDcMwp, 2) + " MWp / " + fmt(r.skidInvAcMva, 2) + " MVA");
    txt("out_ring_ac", fmt(r.ringAcMva, 2) + " MVA");
    txt("out_dc_loss", fmt(r.b.cableDropPct, 2) + "% / " + fmt(r.b.cableLossW, 0) + " W");
    txt("topo_status", r.warnings.length ? r.warnings.join(" | ") : "No screening warnings from current assumptions.");
}

function svgEl(name, attrs = {}, text = null) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== null) el.textContent = text;
    return el;
}

function box(svg, x, y, w, h, title, lines = [], tone = "") {
    svg.appendChild(svgEl("rect", { x, y, width: w, height: h, class: "scada-box " + tone, rx: 10 }));
    svg.appendChild(svgEl("text", { x: x + 14, y: y + 28, class: "scada-text" }, title));
    lines.forEach((line, idx) => svg.appendChild(svgEl("text", { x: x + 14, y: y + 55 + idx * 20, class: idx === 0 ? "scada-value" : "scada-small" }, line)));
}

function line(svg, x1, y1, x2, y2, tone = "") { svg.appendChild(svgEl("path", { d: `M ${x1} ${y1} L ${x2} ${y2}`, class: "scada-line " + tone })); }

function renderScada(r) {
    const svg = t("topo_scada");
    if (!svg) return;
    svg.innerHTML = "";
    svg.appendChild(svgEl("text", { x: 32, y: 56, class: "scada-text" }, r.mode === "string" ? "STRING INVERTER TOPOLOGY" : "CENTRAL INVERTER TOPOLOGY"));
    const warnTone = r.warnings.length ? "orange" : "green";
    if (r.mode === "string") {
        box(svg, 60, 110, 190, 110, "PV Module", [`${fmt(r.v.modWp,0)} Wp`, `Voc ${fmt(r.v.voc,1)} V`, `Isc ${fmt(r.v.isc,2)} A`], "green");
        box(svg, 310, 110, 210, 110, "String", [`${r.v.modulesPerString} modules`, `${fmt(r.b.stringKwp,2)} kWp`, `Cold Voc ${fmt(r.b.coldStringVoc,1)} V`], warnTone);
        box(svg, 585, 110, 230, 110, "String Inverter", [`${r.v.stringsPerInverter} strings`, `${fmt(r.dcPerInvKwp,1)} kWp DC`, `${fmt(r.invAcMva,3)} MVA AC`]);
        box(svg, 880, 110, 230, 110, "Skid", [`${r.v.invertersPerSkid} inverters`, `${fmt(r.skidDcMwp,2)} MWp`, `${fmt(r.v.skidMva,2)} MVA transformer`], warnTone);
        box(svg, 460, 350, 280, 115, "33 kV Ring", [`${r.v.skidsPerRing} skids`, `${fmt(r.ringAcMva,2)} MVA`, `Screening view only`], "orange");
        line(svg, 250, 165, 310, 165, "green"); line(svg, 520, 165, 585, 165); line(svg, 815, 165, 880, 165); line(svg, 995, 220, 600, 350, "orange");
    } else {
        box(svg, 60, 110, 190, 110, "PV Module", [`${fmt(r.v.modWp,0)} Wp`, `Voc ${fmt(r.v.voc,1)} V`, `Isc ${fmt(r.v.isc,2)} A`], "green");
        box(svg, 290, 110, 190, 110, "String", [`${r.v.modulesPerString} modules`, `${fmt(r.b.stringKwp,2)} kWp`, `I ${fmt(r.b.designCurrent,1)} A`], warnTone);
        box(svg, 530, 110, 220, 110, "Combiner", [`${r.v.stringsPerCombiner} strings`, `${fmt(r.combinerKw,1)} kWdc`, `${r.combinersPerInv} per inverter`], warnTone);
        box(svg, 800, 110, 260, 110, "Central Inverter", [`${fmt(r.v.invDcMw,2)} MWdc input`, `${fmt(r.v.invAcMw,2)} MWac output`, `DC/AC ${fmt(r.dcac,2)}`], "orange");
        box(svg, 460, 350, 280, 115, "Skid and Ring", [`Skid ${fmt(r.v.skidMva,2)} MVA`, `${r.v.skidsPerRing} skids per ring`, `Ring ${fmt(r.ringAcMva,2)} MVA`]);
        line(svg, 250, 165, 290, 165, "green"); line(svg, 480, 165, 530, 165); line(svg, 750, 165, 800, 165, "orange"); line(svg, 930, 220, 600, 350, "orange");
    }
    const y = 560;
    svg.appendChild(svgEl("text", { x: 60, y, class: "scada-warning" }, r.warnings.length ? "WARNINGS" : "STATUS"));
    if (r.warnings.length) r.warnings.slice(0, 5).forEach((w, idx) => svg.appendChild(svgEl("text", { x: 60, y: y + 28 + idx * 22, class: "scada-warning" }, "• " + w)));
    else svg.appendChild(svgEl("text", { x: 60, y: y + 28, class: "scada-value" }, "No screening warnings. Verify with full engineering studies before design use."));
    txt("topo_footer_left", r.mode === "string" ? "String inverter LV and DC chain" : "Central inverter combiner and skid chain");
}

function update() { const r = currentCalc(); renderStats(r); renderScada(r); }
function setMode(mode) { topoState.mode = mode; document.querySelectorAll(".topo-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === mode)); document.querySelectorAll(".topo-mode").forEach(p => p.classList.toggle("active", p.dataset.modePanel === mode)); update(); }
function boot() { document.querySelectorAll("input, select").forEach(el => { el.addEventListener("input", update); el.addEventListener("change", update); }); document.querySelectorAll(".topo-tab").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode))); update(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
