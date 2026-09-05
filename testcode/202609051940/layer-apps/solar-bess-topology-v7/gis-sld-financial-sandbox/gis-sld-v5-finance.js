"use strict";

// FINANCIALS
// ============================================================
function setFinanceLabel(inputId, labelText) {
    const input = $(inputId);
    if (!input) return;
    const group = input.closest(".input-group");
    const label = group ? group.querySelector("label") : null;
    if (label) label.textContent = labelText;
}

function convertLargeDefaultToWp(inputId) {
    const input = $(inputId);
    if (!input) return;
    const value = parseFloat(input.value);
    if (!Number.isFinite(value)) return;
    if (value > 10) {
        input.value = (value / 1_000_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    }
}

function setFinanceInputDefaultsForWp(prefix) {
    const stage = $(prefix + "_dev_stage");
    if (stage) {
        const stageValues = ["0.003", "0.015", "0.035", "0.055", "0.070", "0.080", "0.100"];
        Array.from(stage.options).forEach((option, idx) => {
            if (stageValues[idx]) option.value = stageValues[idx];
        });
        if (parseFloat(stage.value) > 10) stage.value = "0.100";
    }

    setFinanceLabel(prefix + "_dev_cost_mw", "Development Cost £/Wp");
    setFinanceLabel(prefix + "_dev_module_mwp", "Module Supply Cost £/Wp");
    setFinanceLabel(prefix + "_dev_epc_mw", "EPC Cost £/Wp");
    setFinanceLabel(prefix + "_dev_owner_mw", "Other Owner Costs £/Wp");
    setFinanceLabel(prefix + "_dev_grid_mw", "Grid Connection Cost £/Wp");
    setFinanceLabel(prefix + "_dev_exit_mwp", "Target Exit Value £/Wp");
    setFinanceLabel(prefix + "_dev_npv_mwp", "Operating Asset Net Present Value (NPV) £/Wp");
    setFinanceLabel(prefix + "_bess_spread", "BESS Revenue per MWh £/MWh");

    convertLargeDefaultToWp(prefix + "_dev_cost_mw");
    convertLargeDefaultToWp(prefix + "_dev_module_mwp");
    convertLargeDefaultToWp(prefix + "_dev_epc_mw");
    convertLargeDefaultToWp(prefix + "_dev_owner_mw");
    convertLargeDefaultToWp(prefix + "_dev_grid_mw");
    convertLargeDefaultToWp(prefix + "_dev_exit_mwp");
    convertLargeDefaultToWp(prefix + "_dev_npv_mwp");

    const stepMap = {
        _dev_cost_mw: "0.005",
        _dev_module_mwp: "0.01",
        _dev_epc_mw: "0.025",
        _dev_owner_mw: "0.025",
        _dev_grid_mw: "0.025",
        _dev_exit_mwp: "0.05",
        _dev_npv_mwp: "0.05"
    };
    Object.entries(stepMap).forEach(([suffix, step]) => {
        const el = $(prefix + suffix);
        if (el) el.step = step;
    });
}

function migrateFinanceUnitsToWp() {
    setFinanceInputDefaultsForWp("fin_string");
    setFinanceInputDefaultsForWp("fin_central");
}

function applyDevelopmentStageDefaults(prefix) {
    const stage = $(prefix + "_dev_stage");
    const cost = $(prefix + "_dev_cost_mw");
    if (!stage || !cost) return;
    cost.value = stage.value;

    const success = $(prefix + "_dev_success");
    const successByStage = {
        "0.003": 10,
        "0.015": 15,
        "0.035": 30,
        "0.055": 55,
        "0.070": 70,
        "0.080": 80,
        "0.100": 95
    };
    if (success && successByStage[stage.value] !== undefined) {
        success.value = successByStage[stage.value];
    }
}

function computeFinance(prefix, stats) {
    const dc_mwp = stats.dc_mwp, ac_mw = stats.ac_mw;

    const price = num(prefix + "_price");
    const other = num(prefix + "_other");
    const yieldVal = num(prefix + "_yield");
    const bifacial = num(prefix + "_bifacial");
    const baseLoss = num(prefix + "_losses");
    const deg = num(prefix + "_deg");
    const opexRate = num(prefix + "_opex");

    const epcEx = num(prefix + "_epc_ex");
    const floodAdder = checked(prefix + "_flood") ? num(prefix + "_flood_rate") : 0;
    const modules = num(prefix + "_modules");
    const otherCapex = num(prefix + "_other_capex");
    const fixedCapex = num(prefix + "_fixed_capex");
    const cont = num(prefix + "_cont");

    const lossExtras = num(prefix + "_loss_dc_string") + num(prefix + "_loss_lv_dc") +
                       num(prefix + "_loss_lv_ac") + num(prefix + "_loss_tx") + num(prefix + "_loss_other");
    const totalLoss = baseLoss + lossExtras;

    const bessMw = num(prefix + "_bess_mw");
    const bessMwh = num(prefix + "_bess_mwh");
    const bessCapexRate = num(prefix + "_bess_capex");
    const bessCycles = num(prefix + "_bess_cycles");
    const bessRevenuePerMwh = num(prefix + "_bess_spread");
    const bessEff = num(prefix + "_bess_eff") / 100;

    const safeLoss = Math.min(Math.max(totalLoss, 0), 100);
    const safeBessEff = Math.min(Math.max(bessEff, 0), 1);
    const effectiveYield = yieldVal * (1 + bifacial / 100);

    const year1Gen = dc_mwp * effectiveYield * (1 - safeLoss / 100);

    let gen25 = 0, gen35 = 0;
    for (let y = 1; y <= 35; y++) {
        const yr = year1Gen * Math.pow(1 - deg / 100, y - 1);
        if (y <= 25) gen25 += yr;
        gen35 += yr;
    }

    const annualSolarRevenue = year1Gen * (price + other);
    const bessAnnualValue = bessMwh * bessCycles * bessRevenuePerMwh * safeBessEff;
    const annualRevenue = annualSolarRevenue + bessAnnualValue;
    const revenue25 = gen25 * (price + other) + bessAnnualValue * 25;
    const revenue35 = gen35 * (price + other) + bessAnnualValue * 35;

    const annualOpex = ac_mw * opexRate;

    const baseCapexWp = epcEx + modules + otherCapex + floodAdder;
    const baseCapex = dc_mwp * 1_000_000 * baseCapexWp;
    const contingency = baseCapex * (cont / 100);
    const bessCapex = bessMwh * bessCapexRate;
    const totalCapex = baseCapex + contingency + fixedCapex + bessCapex;
    const capexPerWp = dc_mwp > 0 ? totalCapex / (dc_mwp * 1_000_000) : 0;

    const surplus25 = revenue25 - annualOpex * 25 - totalCapex;
    const surplus35 = revenue35 - annualOpex * 35 - totalCapex;

    const devCostPerMw = num(prefix + "_dev_cost_mw");
    const devModulePerMwp = num(prefix + "_dev_module_mwp");
    const devEpcPerMw = num(prefix + "_dev_epc_mw");
    const devOwnerPerMw = num(prefix + "_dev_owner_mw");
    const devGridPerMw = num(prefix + "_dev_grid_mw");
    const devExitPerMwp = num(prefix + "_dev_exit_mwp");
    const devNpvPerMwp = num(prefix + "_dev_npv_mwp");
    const devSuccessPct = num(prefix + "_dev_success");
    const devYears = num(prefix + "_dev_years");
    const devStageEl = $(prefix + "_dev_stage");
    const devStage = devStageEl ? devStageEl.options[devStageEl.selectedIndex]?.text || "Manual" : "Manual";

    const wpCapacity = dc_mwp * 1_000_000;
    const devCapitalAtRisk = wpCapacity * devCostPerMw;
    const devModuleCost = wpCapacity * devModulePerMwp;
    const devEpcCost = wpCapacity * devEpcPerMw;
    const devOwnerCost = wpCapacity * devOwnerPerMw;
    const devGridCost = wpCapacity * devGridPerMw;
    const devTotalBuildCost = devCapitalAtRisk + devModuleCost + devEpcCost + devOwnerCost + devGridCost;
    const devExitValue = wpCapacity * devExitPerMwp;
    const devOperatingNpv = wpCapacity * devNpvPerMwp;
    const devGrossMargin = devExitValue - devTotalBuildCost;
    const devRiskAdjustedValue = devGrossMargin * (devSuccessPct / 100);
    const devReturnMultiple = devCapitalAtRisk > 0 ? devGrossMargin / devCapitalAtRisk : 0;

    return {
        annualRevenue, revenue25, revenue35, totalCapex, capexPerWp, surplus25, surplus35,
        devStage, devCostPerMw, devModulePerMwp, devEpcPerMw, devOwnerPerMw, devGridPerMw, devExitPerMwp, devNpvPerMwp, devSuccessPct, devYears,
        devCapitalAtRisk, devModuleCost, devEpcCost, devOwnerCost, devGridCost, devTotalBuildCost, devExitValue, devOperatingNpv,
        devGrossMargin, devRiskAdjustedValue, devReturnMultiple,
        price, other, yieldVal, bifacial, baseLoss, deg, opexRate,
        epcEx, floodActive: checked(prefix + "_flood"), floodRate: num(prefix + "_flood_rate"),
        modules, otherCapex, fixedCapex, cont, totalLoss,
        bessMw, bessMwh, bessCapexRate, bessCycles, bessSpread: bessRevenuePerMwh, bessEff: num(prefix + "_bess_eff"),
        epcIncModules: epcEx + modules
    };
}

function renderFinance(prefix, fin) {
    setText(prefix + "_annual_rev", money(fin.annualRevenue));
    setText(prefix + "_25_rev", money(fin.revenue25));
    setText(prefix + "_35_rev", money(fin.revenue35));
    setText(prefix + "_capex", money(fin.totalCapex));
    setText(prefix + "_capex_wp", "£" + fin.capexPerWp.toFixed(2) + "/Wp");
    setText(prefix + "_surplus_25", money(fin.surplus25));
    setText(prefix + "_surplus_35", money(fin.surplus35));
    setText(prefix + "_dev_capital", money(fin.devCapitalAtRisk));
    setText(prefix + "_dev_module_cost", money(fin.devModuleCost));
    setText(prefix + "_dev_epc_cost", money(fin.devEpcCost));
    setText(prefix + "_dev_owner_cost", money(fin.devOwnerCost));
    setText(prefix + "_dev_grid_cost", money(fin.devGridCost));
    setText(prefix + "_dev_total_cost", money(fin.devTotalBuildCost));
    setText(prefix + "_dev_exit_value", money(fin.devExitValue));
    setText(prefix + "_dev_operating_npv", money(fin.devOperatingNpv));
    setText(prefix + "_dev_margin", money(fin.devGrossMargin));
    setText(prefix + "_dev_risk_value", money(fin.devRiskAdjustedValue));
    setText(prefix + "_dev_multiple", fin.devReturnMultiple.toFixed(2) + "x");
}

function renderFinanceWarnings(prefix, fin, stats) {
    const w = [];
    if (fin.price < 0) w.push("Energy price cannot be negative.");
    if (fin.opexRate < 0) w.push("OPEX cannot be negative.");
    if (fin.totalLoss < 0) w.push("Losses cannot be negative.");
    if (fin.epcIncModules < 0) w.push("EPC cannot be negative.");
    if (fin.capexPerWp < 0) w.push("CAPEX cannot be negative.");
    if (fin.bessMwh < 0 || fin.bessMw < 0) w.push("BESS size cannot be negative.");
    if (fin.bessMwh > 0 && fin.bessEff / 100 <= 0) w.push("BESS efficiency missing.");
    if (fin.bessEff / 100 > 1) w.push("BESS efficiency above 100 percent.");

    if (fin.price < 50) w.push("Low energy price case.");
    if (fin.price > 85) w.push("High energy price case.");
    if (fin.epcIncModules < 0.42) w.push("Aggressive EPC pricing.");
    if (fin.capexPerWp > 1.00) w.push("Full project cost territory.");
    if (fin.capexPerWp > 1.25) w.push("Complex project or asset value territory.");
    if (fin.devCostPerMw > 0.10) w.push("Development cost is above typical EPC signature range.");
    if (fin.devModulePerMwp < 0.10 && fin.devModulePerMwp > 0) w.push("Module supply cost may be aggressive.");
    if (fin.devEpcPerMw < 0.55 && fin.devEpcPerMw > 0) w.push("EPC cost may be aggressive against UK benchmark range.");
    if (fin.devEpcPerMw > 0.85) w.push("EPC cost is above typical non BESS UK benchmark range.");
    if (fin.devNpvPerMwp < 0.90 && fin.devNpvPerMwp > 0) w.push("Operating asset Net Present Value (NPV) assumption is below current screening range.");
    if (fin.devNpvPerMwp > 1.40) w.push("Operating asset Net Present Value (NPV) assumption is above current screening range and may require strong evidence.");
    if (stats.dc_mwp > 100) w.push("Project capacity is above 100 megawatts peak. Nationally Significant Infrastructure Project (NSIP) and Development Consent Order (DCO) planning assumptions may apply and development cost, timescale and owner cost defaults may be too low.");
    if (fin.devGridPerMw > 1.00) w.push("Grid connection cost assumption is very high and may indicate major reinforcement, transmission interface or abnormal connection risk.");
    if (fin.devGridPerMw < 0.10 && fin.devGridPerMw > 0) w.push("Grid connection cost assumption is low and should be checked against the project specific connection scope.");
    if (fin.devSuccessPct < 8) w.push("Development success probability is below typical greenfield to EPC outcome range.");
    if (fin.devSuccessPct > 25) w.push("Development success probability may be optimistic unless project is already materially de risked.");
    if (fin.opexRate < 10000 && fin.opexRate >= 0) w.push("OPEX may be unrealistically low.");
    if (fin.totalLoss > 6) w.push("High loss assumption.");
    if (fin.bifacial > 12) w.push("Aggressive bifacial gain assumption.");
    if (fin.bessMwh > 0 && fin.bessMw <= 0) w.push("BESS MW missing.");
    if (fin.bessMw > 0 && fin.bessMwh / fin.bessMw > 8) w.push("Unusually long BESS duration.");
    if (fin.bessCycles > 365) w.push("Aggressive storage cycling assumption.");

    const elecZero = num(prefix + "_loss_dc_string") + num(prefix + "_loss_lv_dc") +
                     num(prefix + "_loss_lv_ac") + num(prefix + "_loss_tx") + num(prefix + "_loss_other");
    if (elecZero === 0) w.push("Specialist electrical loss fields are blank or zero. Revenue may be overstated until verified.");

    const gf = state.activeTab === "string" ? num("gross_factor") : num("gross_factor_c");
    if (gf < 1.15) w.push("Gross site factor may be too low for roads, buffers, substations, drainage and ecology.");
    if (stats.mods_pallet <= 0 || stats.mods_container <= 0) w.push("Module logistics assumptions are missing.");

    const el = $(prefix + "_warnings");
    if (el) el.innerHTML = w.join("<br>");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", migrateFinanceUnitsToWp);
} else {
    migrateFinanceUnitsToWp();
}

// ============================================================