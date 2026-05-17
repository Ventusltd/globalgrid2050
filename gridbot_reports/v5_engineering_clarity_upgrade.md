# V5 Engineering Clarity Upgrade Report

UTC created: 2026-05-17T17:05:51.245567+00:00

Scope: V5 only. V4 remains untouched.

Installed features:

- Clearer string and central topology labels.
- Editable string inverter rating in kVA.
- Preset or custom central inverter rating up to 20 MWac.
- Central combiner box design limit in kWdc.
- Calculated production substation AC rating.
- Calculated 33 kV ring main AC rating.
- Calculated combiner box DC capacity.
- Engineering warning line in the technical summary.
- Electrical topology explainer text covering strings, string inverters, production substations, RMUs and 33 kV ring mains.
- Financial labels changed from indicative surplus to undiscounted cash surplus.
- Development Return Multiple relabelled as Development Equity Money Multiple.

Actions:

- OK: label Mods / String -> Modules per String
- OK: label Strings / Inverter -> Strings per String Inverter
- OK: label Inverters / Sub -> String Inverters per Production Substation
- OK: label Subs / Ring -> Production Substations per 33 kV Ring Main
- OK: label 33kV Rings -> Number of 33 kV Ring Main Circuits
- OK: label Strings / Combiner Box -> Strings per Combiner Box
- OK: label Central Invs / MV Station -> Central Inverters per MV Station
- OK: label MV Stations / 33kV Ring -> MV Stations per 33 kV Ring Main
- OK: label Indicative 25 Year Surplus -> Undiscounted 25 Year Cash Surplus
- OK: label Indicative 35 Year Surplus -> Undiscounted 35 Year Cash Surplus
- OK: label Development Return Multiple -> Development Equity Money Multiple
- OK: add string inverter kVA input
- OK: add central preset/custom rating controls
- OK: add central combiner design limit
- OK: add engineering summary rows
- OK: add topology explainer text
- OK: replace zeroStats
- OK: replace buildStats
- OK: add getCentralInverterMwac
- OK: replace computeStringStats
- OK: replace computeCentralStats
- OK: replace renderTechSummary
