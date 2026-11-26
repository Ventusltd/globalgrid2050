# REPD intelligence reporting core (isolated candidate)

Owner request: https://github.com/Ventusltd/neural-link-between-agents/issues/83

This is a **read-only, additive candidate**. It is not mounted into PipelineNews, has not passed public browser checks, and makes no homepage or immutable-release changes.

## Existing canonical fields

Operates on the unchanged PipelineNews project list (October 2026 Q3): `repd_ref`, `capacity_mw`, `capacity_unit`, `status`, `operational`, `repd_technology`, `operator`, `region`. Never invents absent dates, operators, statuses, capacity, energy, meters, commissioning or connections.

- `snapshotReport(projects,{dimension,filters})`: group all statuses by operator/status/region/technology; count each source record, preserve separate MW and MWp sums, show missing values explicitly.
- `operationalReport(projects,{period,dimension,filters,asOf})`: month/quarter/year **REPD-reported Operational** cohorts; non-operational projects are excluded even with a populated Operational date; undated and contradictory future dates get separate buckets.
- `estimatedGeneration(projects,{year,period,factors,seasonality,filters,asOf})`: optional explicit **scenario**, never metered data; `factors` are **user-supplied** 0–1 capacity factors keyed by official REPD technology and `seasonality` optional twelve-value multipliers. No assumptions = null/not available where operational non-storage projects have no factor. BESS/storage excluded. Per-month active hours reflect the recorded operational date and the `asOf` cutoff; future months are null. No default capacity factors, no automatic BESS MWh conversion.

Source `capacity_unit` differences must remain visible. A power sum is not energy. The scenario energy calculation with MWp uses capacity factor defined against the reported MWp basis, so scenario assumptions must be displayed to the user.

## Remaining integration work

1. **Additive UI scaffold now present**: `panel.mjs` exports `mountRepdReports(host, projects, { asOf, sourceLabel, onSelectProjects })` and `panel.css` reuses the established PipelineNews `:root` colour variables (`--bg`, `--panel`, `--accent`, `--ok`, etc), without overriding any existing UI. It has report buttons [Operator MW, Status MW, Region MW, Operational by Year, Energy Scenario], period buttons [Month, Quarter, Year], optional operational trend, technology/status/region/operator filter dropdowns, table, bar chart, CSV and explicit user-entered scenario capacity factors. **It is NOT mounted into any dated PipelineNews release**.
2. Integrate this scaffold into a **new immutable PipelineNews successor** after current live version and other agent ownership are verified. Wire the click callback to the original REPD table and MAP/A4 actions. The chart is simple and deliberately not a replacement for the existing three speedometer gauges.
2. For actual monthly/quarterly **metered** energy, integrate a licensed meter/source dataset with precise dates and provenance. Until then label scenario as estimated or display unavailable.
3. Add full browser tests (Chromium/WebKit iPhone-like portrait, landscape and desktop), canonical 7,775 rows count/sum identity, exact downstream MAP/A4/PDF/engine regression, unchanged Solar-1000 and previous edition checks, independent served-byte publication proof. Physical handset acceptance is separate.

Do not merge as a live interface or publish without release-owner validation and actual CI evidence.