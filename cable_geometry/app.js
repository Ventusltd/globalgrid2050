// ===============================
// Cable Geometry Visualiser Engine
// ===============================

const OD_CONFIRMED = { ...OD_LV, ...OD_MV_HV, ...OD_SOLAR };

function byId(id) { return document.getElementById(id); }

// ===============================
// VOLTAGE DROPDOWN
// ===============================
function populateVoltageOptions() {
    const serviceType = byId("service_type").value;
    const sel = byId("lookup_voltage");
    sel.innerHTML = '<option value="">— manual OD entry —</option>';

    const groups = VOLTAGE_DROPDOWN_GROUPS[serviceType] || [];

    groups.forEach(group => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = group.label;

        group.options.forEach(optData => {
            const opt = document.createElement("option");
            opt.value = optData.value;
            opt.textContent = optData.text;
            optgroup.appendChild(opt);
        });

        sel.appendChild(optgroup);
    });

    populateLookupCSA();
}

// ===============================
// 🔧 FIXED OD LOOKUP (FULL CORE SUPPORT)
// ===============================
function lookupOD(voltageKey, csaMm2, selectedCore) {

    if (!voltageKey || !csaMm2) return null;

    const vc = VOLTAGE_CLASSES[voltageKey];
    if (!vc) return null;

    const corePrefixMap = {
        single: "sc",
        two: "2c",
        three: "3c",
        four: "4c",
        five: "5c"
    };

    const prefix = corePrefixMap[selectedCore] || "sc";

    const isLV = voltageKey.startsWith("lv");

    const isLVpwr = [
        "lv_cu_sc","lv_al_sc","lv_cu_2c","lv_cu_3c","lv_cu_4c","lv_cu_5c",
        "lv_al_3c","lv_al_4c","lv_al_5c"
    ].includes(voltageKey);

    const isSolar = [
        "pv_string","flex_hv_ac","flex_hv_dc","al_ata_ac","al_ata_dc"
    ].includes(voltageKey);

    const isMV_HV = !isLV && !isSolar;

    let key;

    // LV power mapping
    if (isLVpwr) {

        const coreMap = {
            "lv_cu_sc":"sc_cu_lv",
            "lv_al_sc":"sc_al_lv",
            "lv_cu_2c":"2c_cu_lv",
            "lv_cu_3c":"3c_cu_lv",
            "lv_cu_4c":"4c_cu_lv",
            "lv_cu_5c":"5c_cu_lv",
            "lv_al_3c":"3c_al_lv",
            "lv_al_4c":"4c_al_lv",
            "lv_al_5c":"5c_al_lv"
        };

        key = `${coreMap[voltageKey]}_${csaMm2}`;
    }

    // Generic LV
    else if (isLV) {
        key = `${prefix}_${voltageKey}_${csaMm2}`;
    }

    // Solar (always single-core)
    else if (isSolar) {
        key = `sc_${voltageKey}_${csaMm2}`;
    }

    // MV / HV
    else {
        key = `${prefix}_${vc.Uo}_${csaMm2}`;
    }

    if (OD_CONFIRMED[key]) {
        const isEstimated =
            key.includes("_cu_lv_") ||
            key.includes("_al_lv_");

        return {
            ...OD_CONFIRMED[key],
            estimated: isEstimated
        };
    }

    // Fallback model
    if (selectedCore === "single" && isMV_HV) {
        const od = OD_A + OD_B * Math.sqrt(csaMm2) + OD_C * vc.Uo;
        const od_r = Math.round(od / 2.5) * 2.5;
        const mbr = vc.mbr_factor * od_r;

        return {
            od: od_r,
            mbr: mbr,
            src: "catalogue model ±3mm",
            estimated: true
        };
    }

    return null;
}

// ===============================
// CSA POPULATION
// ===============================
function populateLookupCSA() {

    const vk = byId("lookup_voltage").value;
    const selectedCore = byId("lookup_cores").value;

    const sel = byId("lookup_csa");
    sel.innerHTML = "";

    if (!vk) {
        sel.innerHTML = '<option value="">— select voltage first —</option>';
        return;
    }

    const vc = VOLTAGE_CLASSES[vk];
    if (!vc) return;

    // Filter by core compatibility
    if (selectedCore !== "any" && !vc.cores.includes(selectedCore)) {
        sel.innerHTML = '<option value="">Not available for this core type</option>';
        return;
    }

    let csas;

    if (vk.startsWith("lv")) {
        csas = SC_CSAS_LV_CU_PWR;
    } else if (vk === "pv_string") {
        csas = SC_CSAS_STR;
    } else {
        csas = SC_CSAS_MV;
    }

    csas.forEach(csa => {

        const res = lookupOD(vk, csa, selectedCore);

        const opt = document.createElement("option");
        opt.value = csa;

        opt.textContent = res
            ? `${csa} mm² — OD ${res.od} mm | MBR ${res.mbr} mm${res.estimated ? " (est.)" : ""}`
            : `${csa} mm² — no data`;

        sel.appendChild(opt);
    });
}

// ===============================
// APPLY LOOKUP
// ===============================
function applyLookup() {

    const vk = byId("lookup_voltage").value;
    const csa = byId("lookup_csa").value;
    const selectedCore = byId("lookup_cores").value;

    if (!vk || !csa) return;

    const result = lookupOD(vk, parseFloat(csa), selectedCore);

    if (!result) return;

    byId("cable_od").value = result.od;
}

// ===============================
// EVENTS
// ===============================
function bindEvents() {

    byId("service_type").addEventListener("change", () => {
        populateVoltageOptions();
    });

    byId("lookup_voltage").addEventListener("change", () => {
        populateLookupCSA();
    });

    byId("lookup_cores").addEventListener("change", () => {
        populateLookupCSA();
    });

    byId("lookup_csa").addEventListener("change", applyLookup);
}

// ===============================
// INIT
// ===============================
function init() {
    populateVoltageOptions();
    bindEvents();
}

init();
