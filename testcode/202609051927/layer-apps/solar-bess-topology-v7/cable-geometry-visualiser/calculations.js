function byId(id) { return document.getElementById(id); }

    function clampInteger(value, fallback, minValue) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.max(Math.round(num), minValue);
    }

    function formatMm(v) { return `${Math.round(v)} mm`; }

    function effectiveGap(basis, spacing, od) {
        if (basis === "touching")         return 0;
        if (basis === "centre_to_centre") return Math.max(spacing - od, 0);
        return spacing;
    }

    function getBurialDepthForComputation() {
        const raw = Number(byId("burial_depth").value);
        if (!Number.isFinite(raw) || raw <= 0) {
            return DEFAULT_BURIAL_DEPTHS[byId("service_type").value] || 900;
        }
        return Math.max(Math.round(raw), 0);
    }

    function normaliseBurialDepthFieldOnBlur() {
        const burial      = byId("burial_depth");
        const serviceType = byId("service_type").value;
        const minDepth    = MIN_BURIAL_DEPTHS[serviceType]     || 0;
        const fallback    = DEFAULT_BURIAL_DEPTHS[serviceType] || minDepth;
        const normalised  = clampInteger(burial.value, fallback, minDepth);
        burial.value = String(normalised);
        return normalised;
    }

    function normaliseIntegerFields() {
        [
            { id: "circuit_qty",    fallback: 1,  min: 1 },
            { id: "max_per_row",    fallback: 1,  min: 1 },
            { id: "section_length", fallback: 0,  min: 0 },
            { id: "cable_od",       fallback: 45, min: 1 },
            { id: "spacing_h",      fallback: appState.previousSpacing.h || 0, min: 0 },
            { id: "spacing_v",      fallback: appState.previousSpacing.v || 0, min: 0 },
            { id: "bend_factor",    fallback: 15, min: 1 }
        ].forEach(item => {
            const el = byId(item.id);
            el.value = String(clampInteger(el.value, item.fallback, item.min));
        });
    }

    function getInputs() {
        return {
            route_name:             byId("route_name").value.trim() || "Unnamed_Route",
            section_length_m:       clampInteger(byId("section_length").value, 0, 0),
            installation_condition: byId("installation_condition").value,
            service_type:           byId("service_type").value,
            grouping_basis:         byId("grouping_basis").value,
            burial_depth_mm:        getBurialDepthForComputation(),
            formation_type:         byId("formation_type").value,
            circuit_qty:            clampInteger(byId("circuit_qty").value, 1, 1),
            max_per_row:            clampInteger(byId("max_per_row").value, 1, 1),
            cable_od_mm:            clampInteger(byId("cable_od").value, 45, 1),
            spacing_basis:          byId("spacing_basis").value,
            spacing_h_mm:           clampInteger(byId("spacing_h").value, appState.previousSpacing.h || 0, 0),
            spacing_v_mm:           clampInteger(byId("spacing_v").value, appState.previousSpacing.v || 0, 0),
            bend_factor:            clampInteger(byId("bend_factor").value, 15, 1)
        };
    }

    function getGroupGeometry(inputs) {
        const d = inputs.cable_od_mm;
        const sqrt3 = Math.sqrt(3);
        switch (inputs.formation_type) {
            case "trefoil_single_row": return { width: d*2, depth: d*(1+sqrt3/2), drawType: "trefoil",     note: "Trefoil 1c groups" };
            case "flat_single_row":    return { width: d*3, depth: d,             drawType: "flat_3",      note: "Flat 1c groups" };
            case "stacked_two_high":   return { width: d*3, depth: d*2,           drawType: "stacked_2x3", note: "Stacked 2 high 1c groups" };
            case "multicore_3c":       return { width: d,   depth: d,             drawType: "multicore_3c",note: "Three core cable groups" };
            case "multicore_4c":       return { width: d,   depth: d,             drawType: "multicore_4c",note: "Four core cable groups" };
            case "multicore_5c":       return { width: d,   depth: d,             drawType: "multicore_5c",note: "Five core cable groups" };
            case "dc_pair_horizontal": return { width: d*2, depth: d,             drawType: "dc_pair_h",   note: "DC horizontal pair" };
            case "dc_pair_vertical":   return { width: d,   depth: d*2,           drawType: "dc_pair_v",   note: "DC vertical pair" };
            default:                   return { width: d*2, depth: d*(1+sqrt3/2), drawType: "trefoil",     note: "Trefoil 1c groups" };
        }
    }

    function computeLayout(inputs) {
        const gapH = effectiveGap(inputs.spacing_basis, inputs.spacing_h_mm, inputs.cable_od_mm);
        const gapV = effectiveGap(inputs.spacing_basis, inputs.spacing_v_mm, inputs.cable_od_mm);
        const geom      = getGroupGeometry(inputs);
        const perRow    = Math.max(1, inputs.max_per_row);
        const groupCount = Math.max(1, inputs.circuit_qty);
        const rows      = Math.ceil(groupCount / perRow);
        const rowCounts = [];
        let remaining   = groupCount;
        for (let i = 0; i < rows; i++) {
            const c = Math.min(perRow, remaining);
            rowCounts.push(c);
            remaining -= c;
        }
        const maxRowCount    = Math.max(...rowCounts);
        const formationWidth = (maxRowCount * geom.width) + (Math.max(maxRowCount-1,0) * gapH);
        const formationDepth = (rows * geom.depth)        + (Math.max(rows-1,0)        * gapV);
        const appliedBendRadius          = inputs.cable_od_mm * inputs.bend_factor;
        const singleCableOuterSweepRadius = appliedBendRadius + inputs.cable_od_mm / 2;
        const approxGroupCtcH = inputs.spacing_basis === "centre_to_centre" ? inputs.spacing_h_mm : geom.width + gapH;
        const approxGroupCtcV = inputs.spacing_basis === "centre_to_centre" ? inputs.spacing_v_mm : geom.depth + gapV;
        return {
            rows, rowCounts,
            groupWidth: geom.width, groupDepth: geom.depth,
            drawType: geom.drawType, groupNote: geom.note,
            gapH, gapV,
            formationWidth, formationDepth,
            appliedBendRadius, singleCableOuterSweepRadius,
            approxGroupCtcH, approxGroupCtcV,
            indicativeTrenchWidth: formationWidth,
            indicativeTrenchDepth: inputs.burial_depth_mm + formationDepth,
            hasUnevenLastRow: rowCounts.length > 1 && rowCounts[rowCounts.length-1] !== maxRowCount
        };
    }

    function buildReview(inputs, layout) {
        const inputConflicts = [];
        const reviewPoints   = [];
        const standingAssumptions = [
            "Within group cable spacing is assumed touching unless separately modelled.",
            "Mixed service visual uses one worst case OD for all shown services and is schematic only.",
            "Bend model is a single cable body sweep only.",
            "Burial depth is recorded as an indicative input only.",
            "4-core and 5-core multicore formations are drawn as a single cable OD."
        ];

        if (inputs.grouping_basis === "mixed_service")
            reviewPoints.push("Mixed service grouping selected. Visual remains schematic and uses one worst case OD for all shown services.");

        if (inputs.spacing_basis === "centre_to_centre") {
            if (inputs.spacing_h_mm <= inputs.cable_od_mm)
                inputConflicts.push("Horizontal centre to centre spacing is less than or equal to cable outer diameter. This collapses to touching or overlap risk.");
            if (inputs.spacing_v_mm <= inputs.cable_od_mm)
                inputConflicts.push("Vertical centre to centre spacing is less than or equal to cable outer diameter. This collapses to touching or overlap risk.");
        }

        if (inputs.spacing_basis === "touching" && inputs.grouping_basis !== "same_circuit")
            reviewPoints.push("Touching groups outside a single circuit basis should be reviewed.");
        if (layout.formationWidth >= 3000)
            reviewPoints.push("Formation width is at or above 3000 mm and may need corridor review.");
        if (layout.formationDepth > 2000)
            reviewPoints.push("Formation depth is above 2000 mm and may need trench or enclosure review.");
        if (inputs.burial_depth_mm > 3000)
            reviewPoints.push("Burial depth input is unusually deep. Confirm civil, thermal and utility basis.");
        if (inputs.bend_factor < 12)
            reviewPoints.push("Low bend factor entered. Confirm against manufacturer installation data. This is not a generic limit.");
        if (inputs.service_type === "mv" && inputs.formation_type === "trefoil_single_row" && layout.approxGroupCtcH < (inputs.cable_od_mm * 3))
            reviewPoints.push("33kV trefoil group spacing is tight. Check separation against the relevant rating and installation standard before use.");
        if (layout.hasUnevenLastRow)
            reviewPoints.push("Worst case envelope is based on the fullest row. The final row is shallower or narrower than the plotted maximum envelope.");

        const worstSeverity = inputConflicts.length ? "error" : reviewPoints.length ? "warn" : "ok";
        const summary = worstSeverity === "ok"
            ? "Geometry capture complete. No active conflicts or review points detected."
            : worstSeverity === "warn"
                ? "Geometry capture complete with review points."
                : "Input conflict detected. Review before using output.";

        return { inputConflicts, reviewPoints, standingAssumptions, worstSeverity, summary };
    }

    