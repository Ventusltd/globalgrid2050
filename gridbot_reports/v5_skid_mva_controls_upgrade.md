# V5 Skid MVA Controls Upgrade Report

UTC created: 2026-05-17T17:40:55.569698+00:00

Scope: V5 only. V4 remains untouched.

Purpose:
Replace production substation wording with skid based terminology, add editable skid MVA ratings, remove the central inverter dropdown, and allow users to specify central inverter DC input and AC output ratings.

Installed features:

- String skid transformer rating MVA input.
- Central inverter DC input rating MWdc input.
- Central inverter AC output rating MWac input.
- Central skid transformer rating MVA input.
- Skid based user language for finance and non technical users.
- Inverter ACmax per skid output.
- Skid transformer rating output.
- Central DC and AC rating outputs.
- Warnings when inverter ACmax exceeds skid transformer rating.

Actions:

- OK: replace String Inverters per Production Substation with String Inverters per Skid
- OK: replace Production Substations per 33 kV Ring Main with Skids per 33 kV Ring Main
- OK: replace Production Substation AC Rating with Skid AC Rating
- OK: replace production substation with skid
- OK: replace Central Inverters per MV Station with Central Inverter Units per Skid
- OK: replace MV Stations per 33 kV Ring Main with Central Skids per 33 kV Ring Main
- OK: add string skid MVA input
- OK: replace central dropdown with DC AC MVA inputs
- OK: add inverter ACmax summary row
- OK: add central DC output summary row
- OK: replace buildStats with skid fields
- OK: add central DC and skid MVA helpers
- OK: replace computeStringStats with skid MVA logic
- OK: replace computeCentralStats with DC input and skid MVA logic
- OK: replace renderTechSummary with skid fields
