function renderStatus(review) {
        const box = byId("status_box");
        box.className = `status-box ${review.worstSeverity}`;
        box.textContent = review.summary;
    }

    function renderIssues(review) {
        const conflictBox  = byId("conflict_box");
        const reviewBox    = byId("review_box");
        const conflictList = byId("conflict_list");
        const reviewList   = byId("review_list");
        conflictList.innerHTML = "";
        reviewList.innerHTML   = "";
        if (review.inputConflicts.length) {
            conflictBox.hidden = false;
            review.inputConflicts.forEach(msg => { const li = document.createElement("li"); li.textContent = msg; conflictList.appendChild(li); });
        } else { conflictBox.hidden = true; }
        if (review.reviewPoints.length) {
            reviewBox.hidden = false;
            review.reviewPoints.forEach(msg => { const li = document.createElement("li"); li.textContent = msg; reviewList.appendChild(li); });
        } else { reviewBox.hidden = true; }
    }

    function renderStats(layout, review, inputs) {
        byId("out_width").textContent        = formatMm(layout.formationWidth);
        byId("out_depth").textContent        = formatMm(layout.formationDepth);
        byId("out_burial").textContent       = formatMm(inputs.burial_depth_mm);
        byId("out_trench_width").textContent = formatMm(layout.indicativeTrenchWidth);
        byId("out_trench_depth").textContent = formatMm(layout.indicativeTrenchDepth);
        byId("out_mbr").textContent          = formatMm(layout.appliedBendRadius);
        byId("out_rows").textContent         = `${layout.rows} row${layout.rows === 1 ? "" : "s"}`;
        byId("out_gap_h").textContent        = formatMm(layout.gapH);
        byId("out_gap_v").textContent        = formatMm(layout.gapV);
        byId("out_ctc_h").textContent        = formatMm(layout.approxGroupCtcH);
        byId("out_ctc_v").textContent        = formatMm(layout.approxGroupCtcV);
        byId("out_note").textContent         = review.worstSeverity.toUpperCase();
        byId("out_note").style.color         = review.worstSeverity === "error" ? "#ff6666"
                                             : review.worstSeverity === "warn"  ? "#ffcc66" : "#00ff88";
    }

    function getServiceColours(serviceType) {
        if (serviceType === "mv")  return { fill: "#b87333", stroke: "#ff5555" };
        if (serviceType === "ehv") return { fill: "#ffd700", stroke: "#ff8800" };
        if (serviceType === "lv")  return { fill: "#666",    stroke: "#00ffff" };
        return { fill: "#777", stroke: "#ff00ff" };
    }

    function drawGroup(ctx, x, y, d, drawType, serviceType, scale) {
        const r = d / 2;
        const col = getServiceColours(serviceType);
        function circle(cx, cy, fill, stroke) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle   = fill;
            ctx.fill();
            ctx.strokeStyle = stroke;
            ctx.lineWidth   = 2 / scale;
            ctx.stroke();
        }
        if (drawType === "trefoil") {
            const h = d * (1 + Math.sqrt(3) / 2);
            circle(x+r,       y+h-r,     col.fill, col.stroke);
            circle(x+d+r,     y+h-r,     col.fill, col.stroke);
            circle(x+d,       y+r,       col.fill, col.stroke);
            return;
        }
        if (drawType === "flat_3") {
            circle(x+r,       y+r, col.fill, col.stroke);
            circle(x+d+r,     y+r, col.fill, col.stroke);
            circle(x+(2*d)+r, y+r, col.fill, col.stroke);
            return;
        }
        if (drawType === "stacked_2x3") {
            circle(x+r,       y+r,     col.fill, col.stroke);
            circle(x+d+r,     y+r,     col.fill, col.stroke);
            circle(x+(2*d)+r, y+r,     col.fill, col.stroke);
            circle(x+r,       y+d+r,   col.fill, col.stroke);
            circle(x+d+r,     y+d+r,   col.fill, col.stroke);
            circle(x+(2*d)+r, y+d+r,   col.fill, col.stroke);
            return;
        }
        if (drawType === "dc_pair_h") {
            circle(x+r,   y+r, "#555", "#ff00ff");
            circle(x+d+r, y+r, "#777", "#ff00ff");
            return;
        }
        if (drawType === "dc_pair_v") {
            circle(x+r, y+r,   "#555", "#ff00ff");
            circle(x+r, y+d+r, "#777", "#ff00ff");
            return;
        }
        if (drawType === "multicore_3c" || drawType === "multicore_4c" || drawType === "multicore_5c") {
            const coreCount = drawType === "multicore_3c" ? 3 : drawType === "multicore_4c" ? 4 : 5;
            ctx.beginPath();
            ctx.arc(x+r, y+r, r, 0, Math.PI*2);
            ctx.fillStyle   = col.fill;
            ctx.fill();
            ctx.strokeStyle = col.stroke;
            ctx.lineWidth   = 2/scale;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x+r, y+r, r*0.62, 0, Math.PI*2);
            ctx.strokeStyle = col.stroke;
            ctx.lineWidth   = 1.2/scale;
            ctx.setLineDash([3/scale, 3/scale]);
            ctx.stroke();
            ctx.setLineDash([]);
            const dotR  = r * 0.13;
            const ringR = r * 0.38;
            for (let k = 0; k < coreCount; k++) {
                const ang  = (2 * Math.PI * k / coreCount) - Math.PI / 2;
                const cx2  = x + r + ringR * Math.cos(ang);
                const cy2  = y + r + ringR * Math.sin(ang);
                ctx.beginPath();
                ctx.arc(cx2, cy2, dotR, 0, Math.PI*2);
                ctx.fillStyle = col.stroke;
                ctx.fill();
            }
            return;
        }
    }

    function drawFormation(inputs, layout, review) {
        const canvas = byId("formation_canvas");
        const W = canvas.width;
        const H = canvas.height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, W, H);

        const topInfo    = 50;
        const botInfo    = 26;
        const pad        = 34;
        const usableW    = W - pad * 2;
        const usableH    = H - pad * 2 - topInfo - botInfo;
        const scaleX     = usableW / Math.max(layout.formationWidth, 1);
        const scaleY     = usableH / Math.max(layout.formationDepth, 1);
        const scale      = Math.min(scaleX, scaleY);
        const dW         = layout.formationWidth  * scale;
        const dH         = layout.formationDepth * scale;
        const offX       = Math.max(pad, (W - dW) / 2);
        const offY       = Math.max(topInfo + 6, topInfo + ((usableH - dH) / 2) + 12);

        ctx.save();
        ctx.translate(offX, offY);
        ctx.scale(scale, scale);

        ctx.fillStyle   = "#11161f";
        ctx.fillRect(0, 0, layout.formationWidth, layout.formationDepth);
        ctx.strokeStyle = review.worstSeverity === "error" ? "#ff6666" : "#444";
        ctx.lineWidth   = 3 / scale;
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
        ctx.font      = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`Worst-case envelope width = ${Math.round(layout.formationWidth)} mm  |  envelope depth = ${Math.round(layout.formationDepth)} mm`, 14, 20);
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
    }

    function drawTrench(inputs, layout) {
        const canvas = byId("trench_canvas");
        const W = canvas.width;
        const H = canvas.height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, W, H);

        const applicable = ["buried_duct","direct_buried","open_trough"].includes(inputs.installation_condition);
        if (!applicable) {
            ctx.fillStyle = "#9fa8b7";
            ctx.font      = "16px monospace";
            ctx.textAlign = "center";
            ctx.fillText("Trench cross section not applicable to selected installation condition.", W / 2, H / 2);
            return;
        }

        const pad    = 40;
        const topPad = 60;
        const botPad = 90;
        const usableW = W - pad * 2;
        const usableH = H - topPad - botPad;

        const bd = inputs.burial_depth_mm;
        const td = layout.indicativeTrenchDepth;
        const tw = layout.indicativeTrenchWidth;

        if (!Number.isFinite(bd) || !Number.isFinite(td) || !Number.isFinite(tw) || tw <= 0 || td <= 0) {
            ctx.fillStyle = "#9fa8b7";
            ctx.font      = "14px monospace";
            ctx.textAlign = "center";
            ctx.fillText("Waiting for valid burial depth input.", W / 2, H / 2);
            return;
        }

        const scaleX  = usableW / tw;
        const scaleY  = usableH / td;
        const scale   = Math.min(scaleX, scaleY);

        const trenchW    = tw * scale;
        const trenchD    = td * scale;
        const trenchX    = (W - trenchW) / 2;
        const trenchY    = topPad;
        const burialY    = trenchY + (bd * scale);
        const formationW = layout.formationWidth * scale;
        const formationD = layout.formationDepth * scale;
        const formationX = trenchX + (trenchW - formationW) / 2;

        ctx.strokeStyle = "#8fd3ff";
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(pad / 2, trenchY);
        ctx.lineTo(W - pad / 2, trenchY);
        ctx.stroke();

        ctx.fillStyle   = "#11161f";
        ctx.fillRect(trenchX, trenchY, trenchW, trenchD);
        ctx.strokeStyle = "#444";
        ctx.lineWidth   = 1;
        ctx.strokeRect(trenchX, trenchY, trenchW, trenchD);

        ctx.strokeStyle = "#8fd3ff";
        ctx.lineWidth   = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(trenchX, burialY);
        ctx.lineTo(trenchX + trenchW, burialY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle   = "rgba(0,255,255,0.08)";
        ctx.fillRect(formationX, burialY, formationW, formationD);
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(formationX, burialY, formationW, formationD);

        ctx.fillStyle = "#8fd3ff";
        ctx.font      = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText("Ground line", pad, trenchY - 10);
        ctx.fillText(`Burial depth input to top of cable box = ${Math.round(bd)} mm`, pad, burialY - 8);
        ctx.fillText(`Indicative trench width = ${Math.round(tw)} mm`,  pad, H - 58);
        ctx.fillText(`Indicative trench depth = ${Math.round(td)} mm`,  pad, H - 38);
        ctx.fillText("Civil design still to add bedding, side clearance, duct OD and build-up", pad, H - 18);

        canvas.setAttribute("aria-label",
            `Indicative trench cross section. Width ${Math.round(tw)} mm. Depth ${Math.round(td)} mm. Burial depth ${Math.round(bd)} mm.`);
    }

    function drawBend(inputs, layout) {
        const canvas = byId("bend_canvas");
        const W = canvas.width;
        const H = canvas.height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, W, H);

        const pad         = 40;
        const radius      = layout.appliedBendRadius;
        const outerRadius = layout.singleCableOuterSweepRadius;
        const usableW     = W - pad * 2;
        const usableH     = H - pad * 2;
        const scaleX      = usableW / Math.max(outerRadius * 2.4, 1);
        const scaleY      = usableH / Math.max(outerRadius * 1.9, 1);
        const scale       = Math.min(scaleX, scaleY);
        const ct          = Math.max(inputs.cable_od_mm * scale, 2);
        const xOrigin     = Math.max(radius * scale * 0.95, W * 0.28);
        const straightL   = Math.max(radius * scale * 0.8,  W * 0.24);
        const topL        = Math.max(radius * scale * 0.45, 90);

        ctx.save();
        ctx.translate(xOrigin, H - pad);

        ctx.fillStyle = "#111";
        ctx.fillRect(-straightL, -ct/2, straightL, ct);

        ctx.beginPath();
        ctx.arc(0, -radius*scale, radius*scale, Math.PI/2, 0, true);
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth   = ct;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(radius*scale, -radius*scale);
        ctx.lineTo(radius*scale, -radius*scale - topL);
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth   = ct;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -radius*scale, radius*scale, 0, Math.PI/2, false);
        ctx.strokeStyle = "#ff00ff";
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -radius*scale, outerRadius*scale, Math.PI/2, 0, true);
        ctx.strokeStyle = "#666";
        ctx.lineWidth   = 1;
        ctx.setLineDash([7, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#ff00ff";
        ctx.textAlign = "left";
        ctx.font      = "12px monospace";
        ctx.fillText(`Applied bend radius = ${Math.round(radius)} mm`,           radius*scale*0.2, -radius*scale*0.52);
        ctx.fillStyle = "#9fa8b7";
        ctx.fillText(`Single cable outer sweep = ${Math.round(outerRadius)} mm`, radius*scale*0.2, -radius*scale*0.38);
        ctx.restore();

        ctx.fillStyle = "#00ffff";
        ctx.font      = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`Cable OD: ${Math.round(inputs.cable_od_mm)} mm`,       14, 18);
        ctx.fillText(`Bend factor: ${Math.round(inputs.bend_factor)} x OD`,  14, 34);
        ctx.fillText(`Burial depth input: ${Math.round(inputs.burial_depth_mm)} mm`, 14, 50);

        canvas.setAttribute("aria-label",
            `Single cable bend sweep. Applied bend radius ${Math.round(radius)} mm. Outer sweep ${Math.round(outerRadius)} mm.`);
    }

    function buildSnapshot(inputs, layout, review) {
        const snap = {
            captured_at:    new Date().toISOString(),
            schema_version: "v5-geometry-migration-1",
            tool_scope:     "Worst case cable formation, indicative burial depth and single cable bend geometry capture only",
            assumptions: {
                within_group_cable_spacing:  "touching",
                bend_model_basis:            "single_cable_body_sweep_only",
                burial_depth_basis:          "user_input_guidance_only_not_design_advice",
                mixed_service_visual_basis:  "single_worst_case_od_for_all_services",
                multicore_4c_5c_basis:       "single_od_envelope_only_internal_core_arrangement_not_modelled"
            },
            calculations_performed: false,
            not_for_construction:   true,
            route_id: inputs.route_name,
            cable_od_source: byId("od_source_note") ? byId("od_source_note").textContent : "manual",
            inputs: {
                worst_case_section_length_m:             inputs.section_length_m,
                installation_condition:                  inputs.installation_condition,
                service_type:                            inputs.service_type,
                grouping_basis:                          inputs.grouping_basis,
                burial_depth_mm:                         inputs.burial_depth_mm,
                formation_type:                          inputs.formation_type,
                indicative_trench_cross_section_enabled: ["buried_duct","direct_buried","open_trough"].includes(inputs.installation_condition),
                number_of_circuit_groups:                inputs.circuit_qty,
                max_groups_per_row:                      inputs.max_per_row,
                cable_outer_diameter_mm:                 inputs.cable_od_mm,
                spacing_basis:                           inputs.spacing_basis,
                horizontal_spacing_input_mm:             inputs.spacing_h_mm,
                vertical_spacing_input_mm:               inputs.spacing_v_mm,
                bend_factor_x_od:                        inputs.bend_factor
            },
            derived_geometry: {
                effective_horizontal_clear_gap_mm:   layout.gapH,
                effective_vertical_clear_gap_mm:     layout.gapV,
                approx_horizontal_group_ctc_mm:      layout.approxGroupCtcH,
                approx_vertical_group_ctc_mm:        layout.approxGroupCtcV,
                group_count_rows:                    layout.rows,
                row_group_counts:                    layout.rowCounts,
                group_geometry_note:                 layout.groupNote,
                worst_case_formation_width_mm:       layout.formationWidth,
                worst_case_formation_depth_mm:       layout.formationDepth,
                applied_bend_radius_mm:              layout.appliedBendRadius,
                single_cable_outer_sweep_radius_mm:  layout.singleCableOuterSweepRadius
            },
            outside_scope: [
                "thermal rating and derating","ambient and soil correction factors",
                "pulling tension and installation forces","duct entry and trench profile design",
                "utility compliance check","highway loading and civil protection design",
                "joint bay and termination geometry","full multi cable bend sweep",
                "internal core arrangement within multicore cables"
            ],
            reliance_statement: "Indicative geometry only. Must be independently verified by a competent engineer before use in any design, specification or construction document.",
            disclaimer: {
                design_advice: false, safety_verification_required: true,
                verification_route: "competent_person_plus_local_regulation_plus_power_utility_requirement"
            },
            review: {
                status: review.worstSeverity,
                input_conflicts: review.inputConflicts,
                review_points: review.reviewPoints,
                standing_assumptions: review.standingAssumptions
            }
        };
        appState.snapshotText = JSON.stringify(snap, null, 4);
        byId("snapshot_box").textContent = appState.snapshotText;
    }

    