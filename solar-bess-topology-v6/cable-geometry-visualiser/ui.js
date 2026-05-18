function populateFormationOptions(serviceType, preferredValue) {
        const sel  = byId("formation_type");
        const opts = FORMATION_LIBRARY[serviceType] || FORMATION_LIBRARY.lv;
        sel.innerHTML = "";
        opts.forEach(o => {
            const node = document.createElement("option");
            node.value = o.value;
            node.textContent = o.label;
            sel.appendChild(node);
        });
        sel.value = opts.some(o => o.value === preferredValue) ? preferredValue : opts[0].value;
    }

    function syncSpacingInputs() {
        const basis    = byId("spacing_basis").value;
        const touching = basis === "touching";
        const h = byId("spacing_h");
        const v = byId("spacing_v");
        const note = byId("spacing_note");
        const qty  = clampInteger(byId("circuit_qty").value, 1, 1);

        if (qty <= 1) {
            h.disabled = true;
            v.disabled = true;
            note.textContent = "Spacing not applicable for a single circuit group — no adjacent group to space from.";
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
    }

    function syncBurialDepthNote(force = false) {
        const serviceType  = byId("service_type").value;
        const burial       = byId("burial_depth");
        const note         = byId("burial_note");
        const defaultDepth = DEFAULT_BURIAL_DEPTHS[serviceType] || 900;
        const minDepth     = MIN_BURIAL_DEPTHS[serviceType]     || 0;

        if (force || !Number.isFinite(Number(burial.value)) || burial.value.trim() === "") {
            burial.value = String(defaultDepth);
        }

        const labels = { lv: "LV AC", mv: "33kV AC", ehv: "132kV AC", dc: "DC" };
        const src    = serviceType === "dc"
            ? "Project assumption only — no normative source in this release."
            : "Utility footway/private. Verify locally.";
        note.textContent = `Default = ${defaultDepth} mm. Guidance min for ${labels[serviceType] || serviceType} = ${minDepth} mm. ${src}`;
    }

    function populateLookupCSA() {
        const vk = byId("lookup_voltage").value;
        const isThree = byId("lookup_cores").value === "three";
        const sel = byId("lookup_csa");
        const noteEl = byId("lookup_note");
        sel.innerHTML = "";

        if (!vk) {
            sel.innerHTML = '<option value="">— select voltage first —</option>';
            noteEl.innerHTML = "Select voltage class and CSA to auto-populate OD and bend radius. " +
                "All values are for <strong>fixed installation</strong> only. " +
                "Flexible applications, very tight bend radii, cleats and terminations " +
                "must be verified with the cable manufacturer. " +
                "★ = confirmed datasheets. Others = catalogue model estimate.";
            return;
        }

        const vc = VOLTAGE_CLASSES[vk];
        if (!vc) return;

        const isSolar  = ["pv_string","flex_hv_ac","flex_hv_dc","al_ata_ac","al_ata_dc"].includes(vk);
        const isLVpwr  = ["lv_cu_sc","lv_al_sc","lv_cu_2c","lv_cu_3c","lv_cu_4c","lv_cu_5c",
                          "lv_al_3c","lv_al_4c","lv_al_5c"].includes(vk);

        if (isLVpwr) {
            const coreLabel = { "lv_cu_sc":"single core", "lv_al_sc":"single core",
                                "lv_cu_2c":"2-core", "lv_cu_3c":"3-core",
                                "lv_cu_4c":"4-core", "lv_cu_5c":"5-core",
                                "lv_al_3c":"3-core", "lv_al_4c":"4-core", "lv_al_5c":"5-core" }[vk];
            const condLabel = vk.includes("_cu_") ? "copper" : "aluminium";
            const armour    = vk.endsWith("_sc") ? "AWA (Al wire armour — non-magnetic, suitable for single-core AC)" : "SWA";
            noteEl.innerHTML = `<strong>0.6/1kV ${condLabel} XLPE ${coreLabel} — ${armour}.</strong> ` +
                `Fixed installation. BS EN 60502-1 / BS 5467. ` +
                `<strong>All ODs are catalogue model estimates (±1–2 mm) — verify against manufacturer controlled datasheet before use in design.</strong> ` +
                (vk === "lv_cu_sc" || vk === "lv_al_sc"
                    ? " Single-core AC circuits: use AWA (aluminium wire armour). SWA (steel wire armour) must NOT be used on single-core AC cables due to eddy current losses."
                    : "");
        }

        if (isThree && !vc.cores.includes("three")) {
            sel.innerHTML = '<option value="">Single core only for this category</option>';
            if (isSolar) {
                noteEl.textContent = "All solar PV categories in this tool are single-core only.";
            } else if (["66","110","132"].includes(vk)) {
                noteEl.innerHTML = "<strong>Three-core cables are not used at 66 kV and above.</strong> " +
                    "At these voltages each phase is a separate single-core cable. " +
                    "The standard installation arrangement is <strong>trefoil</strong> (or flat with transposition). " +
                    "Select <em>Single Core</em> in the Cores dropdown, then choose " +
                    "<em>Trefoil Single Row (1c&times;3ph)</em> or <em>Flat Single Row (1c&times;3ph)</em> " +
                    "in the Formation Type selector to correctly model your three-phase group.";
            } else {
                noteEl.textContent = "Three-core OD data is only available up to 33 kV. Use single core for HV.";
            }
            return;
        }

        if (vk === "33cu" && !isThree) {
            sel.innerHTML = '<option value="">Three core only for this category</option>';
            noteEl.innerHTML = "<strong>33 kV Cu 3-core:</strong> This entry is for three-core copper conductor cables only. " +
                "For single-core 33 kV entries use the <em>33 kV (19/33 kV) — Al</em> category (which also uses the model for single-core). " +
                "ODs from generic power cable catalogue, IEC 60502-2 / VDE 0276-620.";
            return;
        }

        if (vk === "pv_string") {
            noteEl.innerHTML = "<strong>PV DC string cable — 1500V DC only.</strong> " +
                "Flexible tinned Cu, XLPE Class II, UV/ozone resistant (BS EN 50618 H1Z2Z2-K type). " +
                "MBR = 4× OD (fixed installation). " +
                "This cable is rated for DC use only — do not use on AC circuits. " +
                "Confirm OD and MBR with your cable manufacturer.";
        } else if (vk === "flex_hv_ac") {
            noteEl.innerHTML = "<strong>Flexible screened — 1000/1000V AC (Uo=1000V).</strong> " +
                "Fine wire Cu, tinned Cu braid screen. Rated 1000/1000V AC. " +
                "MBR: fixed = 3× OD | occasionally moved = 5× OD (both shown after CSA selection). " +
                "<strong>Uo=1000V — correct for inverter IT systems up to 1000V AC</strong> (e.g. 800V inverters). " +
                "Contrast: standard 0.6/1kV cable (Uo=600V) is non-compliant on an 800V IT system. " +
                "Confirm MBR and ratings with your cable manufacturer.";
        } else if (vk === "flex_hv_dc") {
            noteEl.innerHTML = "<strong>Flexible screened — 1500V DC.</strong> " +
                "Same construction as the 1000/1000V AC version — fine wire Cu, tinned Cu braid screen. Rated 1500V DC. " +
                "MBR: fixed = 3× OD | occasionally moved = 5× OD. " +
                "Confirm MBR and ratings with your cable manufacturer.";
        } else if (vk === "al_ata_ac") {
            noteEl.innerHTML = "<strong>Rigid Al solar — 1000/1000V AC, aluminium tube armour.</strong> " +
                "Compacted Al class 2, XLPE, halogen-free. " +
                "<strong>Aluminium tube armour is non-magnetic</strong> — safe for single-core AC use. " +
                "Steel wire armour must NEVER be used on single-core AC cables (eddy current losses). " +
                "MBR = 12× OD — rigid, fixed installation only. Direct burial capable. " +
                "Uo=1000V — correct for 800V IT inverter systems. " +
                "Confirm with manufacturer.";
        } else if (vk === "al_ata_dc") {
            noteEl.innerHTML = "<strong>Rigid Al solar — 1500/1500V DC (Um=1800V), aluminium tube armour.</strong> " +
                "Same cable as the 1000/1000V AC version — compacted Al class 2, XLPE, halogen-free. " +
                "Aluminium tube armour, non-magnetic. MBR = 12× OD — rigid, fixed installation only. " +
                "Direct burial capable. Confirm with manufacturer.";
        } else if (vk === "33cu") {
            noteEl.innerHTML = "<strong>33 kV Cu 3-core unarmoured.</strong> " +
                "Stranded Cu conductor, XLPE insulation, copper screen, PVC outer jacket. " +
                "ODs from generic power cable catalogue, IEC 60502-2 / VDE 0276-620. " +
                "MBR = 15× OD. Fixed installation. Confirm with cable manufacturer.";
        }

        let csas;
        if      (vk === "lv_cu_sc")            csas = SC_CSAS_LV_CU_PWR;
        else if (vk === "lv_al_sc")            csas = SC_CSAS_LV_AL_PWR;
        else if (vk === "lv_cu_2c")            csas = MC2_CSAS_CU_LV;
        else if (vk === "lv_cu_3c")            csas = MC_CSAS_CU_LV;
        else if (vk === "lv_cu_4c")            csas = MC_CSAS_CU_LV;
        else if (vk === "lv_cu_5c")            csas = MC5_CSAS_CU_LV;
        else if (vk === "lv_al_3c")            csas = MC_CSAS_AL_LV;
        else if (vk === "lv_al_4c")            csas = MC_CSAS_AL_LV;
        else if (vk === "lv_al_5c")            csas = MC5_CSAS_AL_LV;
        else if (vk.startsWith("lv"))          csas = isThree ? TC_CSAS_LV : SC_CSAS_LV;
        else if (vk === "pv_string")           csas = SC_CSAS_STR;
        else if (vk === "flex_hv_ac" || vk === "flex_hv_dc") csas = SC_CSAS_FLX;
        else if (vk === "al_ata_ac"  || vk === "al_ata_dc")  csas = SC_CSAS_ATA;
        else if (["66","110","132"].includes(vk)) csas = SC_CSAS_HV;
        else if (vk === "33cu")                csas = TC_CSAS_MV;
        else    csas = isThree ? TC_CSAS_MV : SC_CSAS_MV;

        csas.forEach(csa => {
            const res = lookupOD(vk, csa, isThree);
            const opt = document.createElement("option");
            opt.value = csa;
            opt.textContent = res
                ? `${csa} mm²  —  OD ${res.od} mm  |  MBR ${res.mbr} mm${res.estimated ? " (est.)" : " ✓"}`
                : `${csa} mm²  —  no data`;
            sel.appendChild(opt);
        });
    }

    function applyLookup() {
        const vk  = byId("lookup_voltage").value;
        const csa = byId("lookup_csa").value;
        if (!vk || !csa) return;
        const isThree = byId("lookup_cores").value === "three";
        const result  = lookupOD(vk, parseFloat(csa), isThree);
        if (!result) return;

        const vc = VOLTAGE_CLASSES[vk];
        const mbr_factor = vc.mbr_factor;
        byId("cable_od").value  = result.od;
        byId("bend_factor").value = mbr_factor;

        const noteEl = byId("lookup_note");
        const srcTag = result.estimated
            ? " (catalogue model ±3mm — verify with manufacturer)"
            : ` (${result.src})`;

        if (vk === "pv_string") {
            noteEl.innerHTML = `<strong>PV DC string — ${csa}mm²:</strong> OD = ${result.od}mm. ` +
                `Fixed installation MBR = ${result.mbr}mm (4× OD)${srcTag}. ` +
                `<strong>1500V DC only</strong> — not for AC use. Flexible tinned Cu, Class II.`;
        } else if (vk === "flex_hv_ac" || vk === "flex_hv_dc") {
            const mbr_occ = Math.round(5 * result.od);
            const vLabel  = vk === "flex_hv_ac" ? "1000/1000V AC (Uo=1000V)" : "1500V DC";
            noteEl.innerHTML = `<strong>Flexible screened ${vLabel} — ${csa}mm²:</strong> OD = ${result.od}mm. ` +
                `MBR <strong>fixed = ${result.mbr}mm (3× OD)</strong> | ` +
                `occasionally moved = ${mbr_occ}mm (5× OD)${srcTag}. ` +
                (vk === "flex_hv_ac"
                    ? `Uo=1000V — correct for 800V IT systems. Same cable serves AC and DC.`
                    : `Same cable construction also rated 1000/1000V AC.`) +
                ` Confirm with cable manufacturer.`;
            byId("bend_factor").value = 3;
        } else if (vk === "al_ata_ac" || vk === "al_ata_dc") {
            const vLabel = vk === "al_ata_ac" ? "1000/1000V AC (Uo=1000V)" : "1500/1500V DC (Um=1800V)";
            noteEl.innerHTML = `<strong>Rigid Al solar ${vLabel} — ${csa}mm²:</strong> OD = ${result.od}mm. ` +
                `Fixed installation MBR = ${result.mbr}mm (12× OD)${srcTag}. ` +
                `<strong>Aluminium tube armour — non-magnetic, safe for single-core AC.</strong> ` +
                `Steel wire armour must never be used on single-core AC cables. ` +
                `Rigid fixed installation only — no occasional-move rating. Confirm with manufacturer.`;
        } else if (vk === "33cu") {
            noteEl.innerHTML = `<strong>33 kV Cu 3-core unarmoured — ${csa}mm²:</strong> OD = ${result.od}mm. ` +
                `Fixed installation MBR = ${result.mbr}mm (15× OD)${srcTag}. ` +
                `IEC 60502-2 / VDE 0276-620. Fixed installation only. Confirm with manufacturer.`;
        } else if (["lv_cu_sc","lv_al_sc","lv_cu_2c","lv_cu_3c","lv_cu_4c","lv_cu_5c",
                    "lv_al_3c","lv_al_4c","lv_al_5c"].includes(vk)) {
            const condLabel = vk.includes("_cu_") ? "Cu" : "Al";
            const coreLabel = {"lv_cu_sc":"1c","lv_al_sc":"1c","lv_cu_2c":"2c","lv_cu_3c":"3c",
                               "lv_cu_4c":"4c","lv_cu_5c":"5c","lv_al_3c":"3c",
                               "lv_al_4c":"4c","lv_al_5c":"5c"}[vk];
            const armour = (vk === "lv_cu_sc" || vk === "lv_al_sc") ? "AWA" : "SWA";
            noteEl.innerHTML = `<strong>0.6/1kV ${condLabel} XLPE ${coreLabel} ${armour} — ${csa}mm²:</strong> OD = ${result.od}mm. ` +
                `Fixed installation MBR = ${result.mbr}mm (${mbr_factor}× OD). ` +
                `<strong>⚠ Catalogue model estimate ±1–2mm — verify against manufacturer controlled datasheet before use in design.</strong> ` +
                `BS EN 60502-1 / BS 5467.` +
                ((vk === "lv_cu_sc" || vk === "lv_al_sc")
                    ? ` Single-core AC: AWA only — SWA must not be used on single-core AC cables (eddy current losses).` : ``);
        } else {
            const srcTag2 = result.estimated ? " (model estimate ±3mm)" : ` (${result.src})`;
            noteEl.innerHTML = `<strong>${vc.label} — ${csa}mm²:</strong> OD = ${result.od}mm. ` +
                `Fixed installation MBR = ${result.mbr}mm (${mbr_factor}× OD)${srcTag2}. ` +
                `Fixed installation only. Verify with cable manufacturer.`;
        }

        updateFromLookup();
    }

    function updateFromLookup() {
        const odEl   = byId("cable_od");
        const srcEl  = byId("od_source_note");
        const vk     = byId("lookup_voltage").value;
        const csa    = byId("lookup_csa").value;
        const isThree = byId("lookup_cores").value === "three";
        if (vk && csa) {
            const res = lookupOD(vk, parseFloat(csa), isThree);
            if (res) {
                srcEl.textContent = res.estimated
                    ? `OD from catalogue model ±3mm — ${res.src}. Verify with manufacturer.`
                    : `OD confirmed — ${res.src}.`;
                srcEl.style.color = res.estimated ? "var(--warn)" : "var(--ok)";
            }
        }
        renderAll();
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
        return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); };
    }
    const debouncedRenderAll = debounce(renderAll, 80);

    function handleInput(event) {
        const id = event.target.id;
        if (id === "service_type") {
            populateFormationOptions(byId("service_type").value, byId("formation_type").value);
            syncBurialDepthNote(true);
        }
        if (id === "spacing_basis" || id === "circuit_qty") syncSpacingInputs();
        debouncedRenderAll();
    }

    function handleChange(event) {
        const id = event.target.id;
        if (id === "service_type") {
            populateFormationOptions(byId("service_type").value, byId("formation_type").value);
            syncBurialDepthNote(true);
        }
        if (id === "spacing_basis" || id === "circuit_qty") syncSpacingInputs();
        renderAll();
    }

    function handleBlur(event) {
        const id = event.target.id;
        const otherNumerics = ["section_length","circuit_qty","max_per_row","cable_od","spacing_h","spacing_v","bend_factor"];
        if (otherNumerics.includes(id)) {
            normaliseIntegerFields();
            if (id === "circuit_qty") syncSpacingInputs();
            renderAll();
        } else if (id === "burial_depth") {
            normaliseBurialDepthFieldOnBlur();
            renderAll();
        }
    }

    function updateViewportMode() {
        const isLM = window.matchMedia("(orientation: landscape) and (max-width: 1200px)").matches;
        document.body.classList.toggle("landscape-mobile", isLM);
    }

    function toggleDrawingView() {
        const isOn = document.body.classList.toggle("drawing-view");
        byId("drawing_view_btn").textContent = isOn ? "Exit Drawing View" : "Drawing View";
        updateViewportMode();
        renderAll();
    }

    function bindNumericFieldUX() {
        document.querySelectorAll('input[data-numeric="true"]').forEach(el => {
            const sel = () => { window.setTimeout(() => { try { el.select(); el.setSelectionRange && el.setSelectionRange(0, el.value.length); } catch(_) {} }, 0); };
            el.addEventListener("focus",    sel);
            el.addEventListener("click",    sel);
            el.addEventListener("touchend", sel);
        });
    }

    function bindEvents() {
        ["installation_condition","service_type","grouping_basis","formation_type","spacing_basis"]
            .forEach(id => byId(id).addEventListener("change", handleChange));

        byId("lookup_cores").addEventListener("change", () => { populateLookupCSA(); applyLookup(); });
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

        ["route_name","section_length","burial_depth","circuit_qty","max_per_row","cable_od","spacing_h","spacing_v","bend_factor"]
            .forEach(id => {
                byId(id).addEventListener("input", handleInput);
                byId(id).addEventListener("blur",  handleBlur);
            });

        byId("export_btn").addEventListener("click", exportJson);
        byId("copy_btn").addEventListener("click",   copySnapshot);
        byId("drawing_view_btn").addEventListener("click", toggleDrawingView);
        window.addEventListener("resize", debounce(() => { updateViewportMode(); renderAll(); }, 80));
    }

    function init() {
        populateFormationOptions(byId("service_type").value, "trefoil_single_row");
        syncSpacingInputs();
        syncBurialDepthNote(true);
        normaliseIntegerFields();
        bindNumericFieldUX();
        populateLookupCSA();
        bindEvents();
        updateViewportMode();
        renderAll();
    }

    init();