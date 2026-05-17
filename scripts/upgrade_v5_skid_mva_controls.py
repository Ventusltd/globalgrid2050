from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "solar-bess-topology-v5"
HTML = V5 / "indexforgis-sld-v5.html"
CALC = V5 / "gis-sld-v5-calculations.js"
UI_CORE = V5 / "gis-sld-v5-ui-core.js"
REPORT = ROOT / "gridbot_reports" / "v5_skid_mva_controls_upgrade.md"


def replace_once(text, old, new, label, actions):
    if old not in text:
        actions.append(f"SKIP: {label}")
        return text
    actions.append(f"OK: {label}")
    return text.replace(old, new, 1)


def replace_js_function(text, fn_name, replacement, label, actions):
    marker = f"function {fn_name}"
    start = text.find(marker)
    if start < 0:
        actions.append(f"SKIP: {label} function not found")
        return text
    brace_start = text.find("{", start)
    if brace_start < 0:
        actions.append(f"SKIP: {label} opening brace not found")
        return text
    depth = 0
    in_single = False
    in_double = False
    in_backtick = False
    escape = False
    for i in range(brace_start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == "'" and not in_double and not in_backtick:
            in_single = not in_single
        elif ch == '"' and not in_single and not in_backtick:
            in_double = not in_double
        elif ch == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
        elif not in_single and not in_double and not in_backtick:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    actions.append(f"OK: {label}")
                    return text[:start] + replacement + text[i + 1:]
    actions.append(f"SKIP: {label} closing brace not found")
    return text


def patch_html(actions):
    html = HTML.read_text(encoding="utf-8")

    replacements = {
        "String Inverters per Production Substation": "String Inverters per Skid",
        "Production Substations per 33 kV Ring Main": "Skids per 33 kV Ring Main",
        "Production Substation AC Rating": "Skid AC Rating",
        "production substation": "skid",
        "Production substation": "Skid",
        "Production Substation": "Skid",
        "Central Inverters per MV Station": "Central Inverter Units per Skid",
        "MV Stations per 33 kV Ring Main": "Central Skids per 33 kV Ring Main"
    }
    for old, new in replacements.items():
        if old in html:
            html = html.replace(old, new)
            actions.append(f"OK: replace {old} with {new}")

    string_anchor = '<div class="input-group"><label>String Inverter Rating kVA</label><input type="number" id="string_inv_kva" value="352" step="1" min="1" /></div>'
    string_add = string_anchor + '\n        <div class="input-group"><label>String Skid Transformer Rating MVA</label><input type="number" id="string_skid_mva" value="8.96" step="0.01" min="0.1" /></div>'
    if 'id="string_skid_mva"' not in html:
        html = replace_once(html, string_anchor, string_add, "add string skid MVA input", actions)

    central_old = '''<div class="input-group">
            <label>Central Inverter Rating Mode</label>
            <select id="central_rating_mode">
                <option value="preset" selected>Preset</option>
                <option value="custom">Custom</option>
            </select>
        </div>
        <div class="input-group">
            <label>Preset Central Inverter Rating MWac</label>
            <select id="inv_ac_mw_c">
                <option value="3.15">3.15 MWac</option>
                <option value="4.4" selected>4.40 MWac</option>
                <option value="4.6">4.60 MWac</option>
                <option value="5.0">5.00 MWac</option>
                <option value="6.25">6.25 MWac</option>
                <option value="6.8">6.80 MWac</option>
                <option value="8.8">8.80 MWac</option>
                <option value="10.0">10.00 MWac</option>
            </select>
        </div>
        <div class="input-group"><label>Custom Central Inverter Rating MWac</label><input type="number" id="inv_ac_mw_custom_c" value="4.40" step="0.1" min="0.1" max="20" /></div>
        <div class="ux-note">Use custom values only for known inverter, MV station or power block assumptions. Values above 10 MW require transformer, MV switchgear, harmonic, thermal, protection and grid code verification.</div>
        <div class="input-group"><label>DC/AC Ratio</label><input type="number" id="dc_ac_ratio_c" value="1.20" step="0.05" min="0.01" /></div>'''
    central_new = '''<div class="input-group"><label>Central Inverter DC Input Rating MWdc</label><input type="number" id="inv_dc_mw_c" value="5.28" step="0.01" min="0.1" max="30" /></div>
        <div class="input-group"><label>Central Inverter AC Output Rating MWac</label><input type="number" id="inv_ac_mw_c" value="4.40" step="0.01" min="0.1" max="20" /></div>
        <div class="input-group"><label>Central Skid Transformer Rating MVA</label><input type="number" id="central_skid_mva_c" value="4.40" step="0.01" min="0.1" max="25" /></div>
        <div class="ux-note">A skid is a factory assembled power package. It usually combines inverter equipment, transformer, switchgear, protection and auxiliary systems on a transportable base or frame. Finance and non technical teams can treat each skid as one repeatable cost and power block. Values above 10 MWac should be treated as large power block assumptions and require transformer, MV switchgear, harmonic, thermal, protection and grid code verification.</div>
        <div class="input-group"><label>Calculated DC/AC Ratio</label><input type="number" id="dc_ac_ratio_c" value="1.20" step="0.05" min="0.01" /></div>'''
    if 'id="inv_dc_mw_c"' not in html:
        html = replace_once(html, central_old, central_new, "replace central dropdown with DC AC MVA inputs", actions)

    summary_old = '<div class="stat-row"><span>Skid AC Rating:</span><span class="stat-val" id="out_sub_ac_rating">0.00 MVA</span></div>'
    summary_new = '''<div class="stat-row"><span>Inverter ACmax per Skid:</span><span class="stat-val" id="out_inverter_acmax_mva">0.00 MVA</span></div>
        <div class="stat-row"><span>Skid Transformer Rating:</span><span class="stat-val" id="out_sub_ac_rating">0.00 MVA</span></div>'''
    if 'id="out_inverter_acmax_mva"' not in html:
        html = replace_once(html, summary_old, summary_new, "add inverter ACmax summary row", actions)

    central_summary_anchor = '<div class="stat-row central-only" style="display: none;"><span>Central Inverter Rating:</span><span class="stat-val" id="out_central_inv_rating">0.00 MWac</span></div>'
    central_summary_new = '''<div class="stat-row central-only" style="display: none;"><span>Central Inverter DC Input:</span><span class="stat-val" id="out_central_inv_dc_rating">0.00 MWdc</span></div>
        <div class="stat-row central-only" style="display: none;"><span>Central Inverter AC Output:</span><span class="stat-val" id="out_central_inv_rating">0.00 MWac</span></div>'''
    if 'id="out_central_inv_dc_rating"' not in html:
        html = replace_once(html, central_summary_anchor, central_summary_new, "add central DC output summary row", actions)

    old_para = 'A skid is a medium voltage switchgear used to connect skids into a 33 kV network.'
    if old_para in html:
        html = html.replace(old_para, 'A Ring Main Unit, or RMU, is medium voltage switchgear used to connect skids into a 33 kV network.')
        actions.append("OK: repair RMU explainer wording")

    if 'A skid is a factory assembled power package' not in html:
        html = html.replace('<h3>Electrical Topology Explanation</h3>', '<h3>Electrical Topology Explanation</h3>\n        <p>A skid is a factory assembled power package. In solar design it normally means a repeatable block containing inverter equipment, a transformer, switchgear, protection and auxiliary systems. For finance and non technical teams, a skid is useful because it turns complex electrical equipment into one repeatable power block with a rating, cost, logistics requirement and interface risk.</p>', 1)
        actions.append("OK: add skid explanation paragraph")

    HTML.write_text(html, encoding="utf-8")


def patch_calculations(actions):
    calc = CALC.read_text(encoding="utf-8")

    build_stats = '''function buildStats(opts) {
    const {
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        combiner_boxes_per_inverter, total_combiner_boxes,
        string_inverter_kva, inverter_acmax_mva, production_substation_ac_mva, ring_main_ac_mva,
        central_inverter_mwac, central_inverter_mwdc, combiner_box_dc_kw, combiner_design_limit_kwdc,
        engineering_warning
    } = opts;
    const { mod_wp, mod_l, mod_w, gcr, gross_factor, mods_pallet, mods_container, spare_pct } = physical;

    const dc_mwp = (module_count * mod_wp) / 1_000_000;
    const ac_mw = ac_mw_direct != null ? ac_mw_direct : (dc_ac_ratio > 0 ? dc_mwp / dc_ac_ratio : 0);
    const actual_dc_ac = ac_mw > 0 ? dc_mwp / ac_mw : dc_ac_ratio;

    const net_mod_area_m2 = module_count * mod_l * mod_w;
    const net_array_area_m2 = gcr > 0 ? net_mod_area_m2 / gcr : 0;
    const gross_site_area_m2 = net_array_area_m2 * gross_factor;
    const block_ground_area_m2 = total_blocks > 0 ? net_array_area_m2 / total_blocks : 0;

    const pallets = Math.ceil(module_count / mods_pallet);
    const containers = Math.ceil(module_count / mods_container);
    const modules_inc_spares = Math.ceil(module_count * (1 + spare_pct / 100));
    const pallets_inc_spares = Math.ceil(modules_inc_spares / mods_pallet);
    const containers_inc_spares = Math.ceil(modules_inc_spares / mods_container);

    return {
        total_blocks, block_ground_area_m2, dc_mwp, ac_mw, module_count,
        net_mod_area_m2, net_array_area_m2, gross_site_area_m2, dc_ac_ratio: actual_dc_ac,
        pallets, containers, spares_pct: spare_pct,
        modules_inc_spares, pallets_inc_spares, containers_inc_spares,
        mods_pallet, mods_container,
        combiner_boxes_per_inverter: combiner_boxes_per_inverter || 0,
        total_combiner_boxes: total_combiner_boxes || 0,
        string_inverter_kva: string_inverter_kva || 0,
        inverter_acmax_mva: inverter_acmax_mva || 0,
        production_substation_ac_mva: production_substation_ac_mva || 0,
        ring_main_ac_mva: ring_main_ac_mva || 0,
        central_inverter_mwac: central_inverter_mwac || 0,
        central_inverter_mwdc: central_inverter_mwdc || 0,
        combiner_box_dc_kw: combiner_box_dc_kw || 0,
        combiner_design_limit_kwdc: combiner_design_limit_kwdc || 0,
        engineering_warning: engineering_warning || "Check assumptions"
    };
}'''
    calc = replace_js_function(calc, "buildStats", build_stats, "replace buildStats with skid fields", actions)

    if 'function getCentralInverterDcMwdc()' not in calc:
        helper = '''function getCentralInverterDcMwdc() {
    const dc = num("inv_dc_mw_c") || ((num("inv_ac_mw_c") || 4.4) * 1.2);
    return Math.min(Math.max(dc, 0.1), 30);
}

function getCentralSkidMva() {
    const mva = num("central_skid_mva_c") || (num("inv_ac_mw_c") || 4.4);
    return Math.min(Math.max(mva, 0.1), 25);
}

'''
        calc = calc.replace('function computeStringStats() {', helper + 'function computeStringStats() {')
        actions.append("OK: add central DC and skid MVA helpers")

    string_stats = '''function computeStringStats() {
    const physical = readPhysicalInputs("");
    const x = intVal("x_mods"), z = intVal("z_strings"), y = intVal("y_invs"), s = intVal("s_subs"), rings = intVal("b_cols");
    const dc_ac_ratio = num("dc_ac_ratio") || 1.2;
    const string_inverter_kva = num("string_inv_kva") || 352;
    const string_skid_mva = num("string_skid_mva") || 8.96;

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const total_blocks = rings * s;
    const module_count = total_blocks * y * z * x;
    const inverter_acmax_mva = (y * string_inverter_kva) / 1000;
    const production_substation_ac_mva = string_skid_mva;
    const ring_main_ac_mva = production_substation_ac_mva * s;
    const ac_mw_direct = total_blocks * production_substation_ac_mva;
    let engineering_warning = "Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.";
    if (inverter_acmax_mva > production_substation_ac_mva) engineering_warning = "Inverter ACmax exceeds skid transformer rating. Verify temperature rating, overload strategy and clipping assumptions.";
    if (string_inverter_kva > 500) engineering_warning = "Large string inverter rating selected. Verify LV switchgear, transformer, cable loading and protection.";

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        string_inverter_kva, inverter_acmax_mva, production_substation_ac_mva, ring_main_ac_mva,
        engineering_warning
    });
}'''
    calc = replace_js_function(calc, "computeStringStats", string_stats, "replace computeStringStats with skid MVA logic", actions)

    central_stats = '''function computeCentralStats() {
    const physical = readPhysicalInputs("_c");
    const x_mods = intVal("x_mods_c");
    const inv_ac_mw = getCentralInverterMwac();
    const inv_dc_mw = getCentralInverterDcMwdc();
    const central_skid_mva = getCentralSkidMva();
    const dc_ac_ratio = inv_ac_mw > 0 ? inv_dc_mw / inv_ac_mw : 1.2;
    const str_per_cb = intVal("str_per_cb_c", 1);
    const inv_per_mv = intVal("inv_per_mv_c");
    const mv_per_ring = intVal("mv_per_ring_c");
    const rings = intVal("rings_c");
    const combiner_design_limit_kwdc = num("combiner_limit_kwdc_c") || 500;

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x_mods <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const str_dc_kwp = (x_mods * physical.mod_wp) / 1000;
    const combiner_box_dc_kw = str_per_cb * str_dc_kwp;
    const req_strings = str_dc_kwp > 0 ? Math.ceil((inv_dc_mw * 1000) / str_dc_kwp) : 0;
    const combiner_boxes_per_inverter = Math.ceil(req_strings / str_per_cb);
    const total_blocks = inv_per_mv * mv_per_ring * rings;
    const total_combiner_boxes = combiner_boxes_per_inverter * total_blocks;
    const module_count = req_strings * x_mods * total_blocks;
    const ac_mw_direct = total_blocks * central_skid_mva * inv_per_mv;
    const production_substation_ac_mva = central_skid_mva * inv_per_mv;
    const ring_main_ac_mva = production_substation_ac_mva * mv_per_ring;

    let engineering_warning = "Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.";
    if (combiner_box_dc_kw > combiner_design_limit_kwdc) engineering_warning = "Combiner box DC capacity exceeds the selected design limit.";
    if (inv_ac_mw > central_skid_mva) engineering_warning = "Central inverter AC output exceeds skid transformer rating. Verify thermal rating and export limitation.";
    if (inv_ac_mw > 10) engineering_warning = "Large central inverter or power block selected. Verify transformer, MV switchgear, harmonics, thermal loading, protection and grid code compliance.";

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        combiner_boxes_per_inverter, total_combiner_boxes,
        production_substation_ac_mva, ring_main_ac_mva,
        central_inverter_mwac: inv_ac_mw, central_inverter_mwdc: inv_dc_mw,
        combiner_box_dc_kw, combiner_design_limit_kwdc,
        engineering_warning
    });
}'''
    calc = replace_js_function(calc, "computeCentralStats", central_stats, "replace computeCentralStats with DC input and skid MVA logic", actions)

    CALC.write_text(calc, encoding="utf-8")


def patch_ui_core(actions):
    ui = UI_CORE.read_text(encoding="utf-8")
    render = '''function renderTechSummary(stats) {
    setText("out_module_count", stats.module_count.toLocaleString());
    setText("out_dc_capacity", stats.dc_mwp.toFixed(2) + " MWp");
    setText("out_ac_capacity", stats.ac_mw.toFixed(2) + " MWac");
    setText("out_actual_dcac", stats.dc_ac_ratio.toFixed(2));
    setText("out_cb_per_inv", stats.combiner_boxes_per_inverter.toLocaleString());
    setText("out_total_cb", stats.total_combiner_boxes.toLocaleString());
    setText("out_string_inv_rating", stats.string_inverter_kva ? stats.string_inverter_kva.toFixed(0) + " kVA" : "n/a");
    setText("out_inverter_acmax_mva", stats.inverter_acmax_mva ? stats.inverter_acmax_mva.toFixed(2) + " MVA" : "n/a");
    setText("out_sub_ac_rating", stats.production_substation_ac_mva.toFixed(2) + " MVA");
    setText("out_ring_ac_rating", stats.ring_main_ac_mva.toFixed(2) + " MVA");
    setText("out_central_inv_dc_rating", stats.central_inverter_mwdc.toFixed(2) + " MWdc");
    setText("out_central_inv_rating", stats.central_inverter_mwac.toFixed(2) + " MWac");
    setText("out_cb_dc_kw", stats.combiner_box_dc_kw.toFixed(2) + " kWdc");
    setText("out_engineering_warning", stats.engineering_warning || "Check assumptions");
    setText("out_net_mod_area", (stats.net_mod_area_m2 / CONSTANTS.M2_PER_ACRE).toFixed(0) + " Acres");
    setText("out_net_array_area", (stats.net_array_area_m2 / CONSTANTS.M2_PER_ACRE).toFixed(0) + " Acres");
    setText("out_gross_area", (stats.gross_site_area_m2 / CONSTANTS.M2_PER_ACRE).toFixed(0) + " Acres");
    setText("out_mod_per_pallet", stats.mods_pallet);
    setText("out_pallets", stats.pallets.toLocaleString());
    setText("out_mod_per_cont", stats.mods_container);
    setText("out_containers", stats.containers.toLocaleString());
    setText("out_spare_pct", stats.spares_pct.toFixed(1) + "%");
    setText("out_containers_spares", stats.containers_inc_spares.toLocaleString());

    const tabClass = state.activeTab === "central" ? "stat-val orange" : "stat-val cyan";
    setClass("out_dc_capacity", tabClass);
    setClass("out_containers_spares", tabClass);

    const cpm = stats.dc_mwp > 0 ? stats.containers_inc_spares / stats.dc_mwp : 0;
    setText("out_cont_per_mwp", cpm.toFixed(2));
    setClass("out_cont_per_mwp", tabClass);
}'''
    ui = replace_js_function(ui, "renderTechSummary", render, "replace renderTechSummary with skid fields", actions)
    UI_CORE.write_text(ui, encoding="utf-8")


def write_report(actions):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 Skid MVA Controls Upgrade Report\n\n"
        f"UTC created: {datetime.now(timezone.utc).isoformat()}\n\n"
        "Scope: V5 only. V4 remains untouched.\n\n"
        "Purpose:\n"
        "Replace production substation wording with skid based terminology, add editable skid MVA ratings, remove the central inverter dropdown, and allow users to specify central inverter DC input and AC output ratings.\n\n"
        "Installed features:\n\n"
        "- String skid transformer rating MVA input.\n"
        "- Central inverter DC input rating MWdc input.\n"
        "- Central inverter AC output rating MWac input.\n"
        "- Central skid transformer rating MVA input.\n"
        "- Skid based user language for finance and non technical users.\n"
        "- Inverter ACmax per skid output.\n"
        "- Skid transformer rating output.\n"
        "- Central DC and AC rating outputs.\n"
        "- Warnings when inverter ACmax exceeds skid transformer rating.\n\n"
        "Actions:\n\n" + "\n".join(f"- {a}" for a in actions) + "\n",
        encoding="utf-8"
    )


def main():
    actions = []
    for path in (HTML, CALC, UI_CORE):
        if not path.exists():
            raise SystemExit(f"Missing required file: {path}")
    patch_html(actions)
    patch_calculations(actions)
    patch_ui_core(actions)
    write_report(actions)


if __name__ == "__main__":
    main()
