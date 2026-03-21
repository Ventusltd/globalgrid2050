# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

---

## Market Inputs

<div style="background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    
    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Copper (USD per Tonne)</label>
    <input id="cu" type="number" value="12850" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700;">

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Aluminium (USD per Tonne)</label>
    <input id="al" type="number" value="3520" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700;">

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; pointer-events: none;">
        <div style="text-align:center; border-bottom: 1px solid #edf2f7; padding-bottom: 10px;">
            <div style="font-size:0.75em; color:#64748b; font-weight:700;">COPPER (GBP per Tonne)</div>
            <div id="cu_gbp_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">£0</div>
        </div>
        <div style="text-align:center; border-bottom: 1px solid #edf2f7; padding-bottom: 10px;">
            <div style="font-size:0.75em; color:#64748b; font-weight:700;">ALUMINIUM (GBP per Tonne)</div>
            <div id="al_gbp_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">£0</div>
        </div>
        <div style="text-align:center; padding-top: 10px;">
            <div style="font-size:0.75em; color:#64748b; font-weight:700;">COPPER (EUR per Tonne)</div>
            <div id="cu_eur_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">€0</div>
        </div>
        <div style="text-align:center; padding-top: 10px;">
            <div style="font-size:0.75em; color:#64748b; font-weight:700;">ALUMINIUM (EUR per Tonne)</div>
            <div id="al_eur_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">€0</div>
        </div>
    </div>

    <div style="background:#fff5f5; border:2px solid #feb2b2; padding:20px; border-radius:10px; margin-bottom:25px;">
        <label style="display:block; font-weight:800; color:#9b2c2c; margin-bottom:8px; text-transform:uppercase; font-size:0.85em;">Non-Metal Costs Estimate (%)</label>
        <input id="non_metal_input" type="number" value="70" oninput="calc()" style="width:100%; padding:12px; border:1px solid #fc8181; border-radius:6px; font-weight:700; color:#c53030; background:#fff;">
        <div style="font-size:0.8em; color:#e53e3e; margin-top:10px; font-weight:600; line-height:1.4;">
            Rule: 70% non-metal costs results in Metal being 30% of Total Price.<br>
            (Total Metal Value is divided by 0.30 to reach Net Price)
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom:18px;">
        <div>
            <label style="font-size:0.8em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">GBP/USD</label>
            <input id="fx_gbp" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
        </div>
        <div>
            <label style="font-size:0.8em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">EUR/USD</label>
            <input id="fx_eur" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
        </div>
        <div style="background:#fffaf0; border:1px solid #feebc8; border-radius:6px; padding:5px; text-align:center;">
            <label style="font-size:0.75em; font-weight:700; color:#c05621; display:block; margin-bottom:2px;">GBP to EUR</label>
            <div id="fx_cross" style="font-weight:700; color:#744210; font-size:1.1em;">
