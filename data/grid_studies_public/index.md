<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Public Grid Events Studies | GlobalGrid2050</title>
    <style>
        :root { --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; --danger:#ff3333; }
        * { box-sizing:border-box; }
        body { margin:0; padding:28px; background:var(--bg); color:var(--text); font-family:"Courier New", monospace; }
        header { max-width:1180px; margin:0 auto 24px auto; border:1px solid var(--line); background:rgba(10,10,10,.96); padding:22px; border-radius:14px; }
        .kicker { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; }
        h1 { margin:8px 0 10px 0; font-size:28px; }
        h2 { margin:0 0 10px 0; }
        h3 { margin:0 0 8px 0; color:var(--accent); font-size:17px; }
        p { color:var(--muted); line-height:1.55; }
        .status { margin:14px 0 0 0; padding:14px; border:1px solid var(--accent); border-radius:10px; color:var(--text); line-height:1.55; background:rgba(0,255,255,.06); }
        main { max-width:1180px; margin:0 auto; }
        .dashboard-section { margin:0 auto 22px auto; }
        .section-title { color:var(--accent); font-size:22px; margin:0 0 14px 0; border-bottom:1px solid var(--line); padding-bottom:8px; }
        .section-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:18px; }
        .card { display:block; min-height:210px; border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:20px; text-decoration:none; color:var(--text); }
        .card:hover { border-color:var(--accent); }
        .card h2 { margin:0 0 10px 0; color:var(--accent); font-size:18px; }
        .card span { color:var(--ok); font-weight:bold; }
        .engineering-functions { max-width:1180px; margin:22px auto 0 auto; border:1px solid var(--line); background:rgba(10,10,10,.96); padding:22px; border-radius:14px; }
        .engineering-functions h2 { color:var(--accent); font-size:22px; }
        .function-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-top:16px; }
        .function-item { border:1px solid var(--line); background:var(--panel); border-radius:12px; padding:16px; }
        .function-item p { margin:0; }
        footer { max-width:1180px; margin:22px auto 0 auto; color:var(--muted); font-size:12px; }
        a { color:inherit; }
    </style>
</head>
<body>
    <header>
        <div class="kicker">GlobalGrid2050 Public Evidence Library</div>
        <h1>Public Grid Events Studies</h1>
        <p>A dashboard navigator for public domain grid failure, resilience, market design, infrastructure fire, BESS transformer, critical asset and blackout studies.</p>
        <div class="status">STATUS: PUBLIC STUDY INDEX. Use these pages for research, screening and mission review only. Verify every source before engineering, commercial, regulatory or investment reliance.</div>
    </header>

    <main>
        <section class="dashboard-section">
            <h2 class="section-title">Core Grid Event Case Studies</h2>
            <div class="section-grid">
                <a class="card" href="./iberian_blackout_2025.md">
                    <h2>Iberian Blackout 2025</h2>
                    <p>Voltage control, reactive power, inverter behaviour, oscillatory stability and European system restoration study.</p>
                    <span>Open study</span>
                </a>
                <a class="card" href="./texas_ercot_winter_failures.md">
                    <h2>ERCOT Texas Winter Failures</h2>
                    <p>Cold weather resilience, fuel security, weatherisation, reserve adequacy, isolation and repeated warning event study.</p>
                    <span>Open study</span>
                </a>
                <a class="card" href="./california_wildfire_grid_risk.md">
                    <h2>California Wildfire Grid Risk</h2>
                    <p>Transmission asset condition, wildfire ignition risk, vegetation, drought, high wind and Public Safety Power Shutoff study.</p>
                    <span>Open study</span>
                </a>
                <a class="card" href="./new_york_northeast_cascading_failures.md">
                    <h2>New York and Northeast Cascading Failures</h2>
                    <p>Interconnected system fragility, relay behaviour, vegetation, operator visibility, reactive power and cascading blackout study.</p>
                    <span>Open study</span>
                </a>
            </div>
        </section>

        <section class="dashboard-section">
            <h2 class="section-title">Market, Critical Infrastructure and BESS Studies</h2>
            <div class="section-grid">
                <a class="card" href="./california_market_design_operational_reliability.md">
                    <h2>California Market Design Reliability</h2>
                    <p>Market design, dispatch incentives, transmission congestion, price signals and physical power delivery study.</p>
                    <span>Open study</span>
                </a>
                <a class="card" href="./heathrow_north_hyde_substation_fire.md">
                    <h2>Heathrow North Hyde Substation Fire</h2>
                    <p>Transformer bushings, oil sampling, fire suppression, airport distribution, network reconfiguration and critical infrastructure resilience.</p>
                    <span>Open study</span>
                </a>
                <a class="card" href="./bess_transformer_procurement_insurance_exposure.md">
                    <h2>BESS Transformer and Insurance Exposure</h2>
                    <p>Waratah, high voltage transformer availability, commissioning delay, OEM exposure, insurance market stress and grid support availability.</p>
                    <span>Open study</span>
                </a>
                <a class="card" href="./heathrow_regulator_and_airport_commentary.md">
                    <h2>Heathrow Regulator and Airport Commentary</h2>
                    <p>AI generated mission review commentary on the latest public regulator, National Grid and Heathrow resilience position.</p>
                    <span>Open note</span>
                </a>
            </div>
        </section>
    </main>

    <section class="engineering-functions">
        <h2>Failure Modes Covered By This Library</h2>
        <p>This index is designed so each case can be studied deeply while the folder index brings the evidence back to a dashboard navigator.</p>
        <div class="function-grid">
            <div class="function-item"><h3>1. Voltage and reactive power</h3><p>European system stability, inverter behaviour, grid support and restoration studies.</p></div>
            <div class="function-item"><h3>2. Weather and fuel resilience</h3><p>Cold weather, gas supply, generation availability and reserve adequacy studies.</p></div>
            <div class="function-item"><h3>3. Asset condition and fire</h3><p>Transmission equipment, bushings, wildfire ignition, fire suppression and maintenance follow through.</p></div>
            <div class="function-item"><h3>4. Cascading interconnection risk</h3><p>Protection behaviour, overloaded corridors, operator visibility and regional failure propagation.</p></div>
            <div class="function-item"><h3>5. Market design and dispatch</h3><p>Commercial rules, scarcity signals, congestion management and operational reliability.</p></div>
            <div class="function-item"><h3>6. Critical infrastructure dependency</h3><p>Airport, transport, customer private networks and cross sector resilience.</p></div>
            <div class="function-item"><h3>7. BESS and transformer exposure</h3><p>High voltage transformer failure, commissioning hold points, procurement exposure and insurance stress.</p></div>
            <div class="function-item"><h3>8. Public source discipline</h3><p>All pages should remain neutral, public safe and linked back to confirmed source material.</p></div>
        </div>
    </section>

    <footer>GlobalGrid2050 public grid events studies. Content for technical documentation, research and mission review only.</footer>
</body>
</html>
