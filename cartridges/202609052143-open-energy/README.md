# Original VENTUS open-energy counter cartridge

One feature: illustrate total, renewable and non-renewable world primary energy consumption at the average rate of the EIA's 2024 baseline. This is not current-year telemetry. Original code and layout; no Worldometer code or feed.

The only data file is source.json: small, pinned statistics with source and reuse provenance. EIA's 1 July 2026 FAQ reports consumption of 606.0 quadrillion Btu total and 42.7 renewable. Non-renewable is the difference (563.3), including nuclear, not fossil-only. The same table/definitions are used for both components. Do not substitute electricity-generation shares or blend accounting methods.

Convert International Table Btu to joules at 1055.05585262 J/Btu, divide by 3.6e9 J/MWh, then by 366 days in the 2024 reference year. Multiply daily amount by elapsed fraction of today's UTC day. Bar maximum is the total modelled daily consumption for every row, so components add to total. Whole-MWh animation is illustrative precision, not measurement accuracy. No current-year extrapolation or seasonal variation is claimed. Review deadline is explicit in data and UI.

EIA information reuse is permitted under https://www.eia.gov/about/copyrights_reuse.php with source/date acknowledgment; logos and third-party imagery are excluded. All source links are in the manifest. IEA/UN sources need per-product reuse checks before future additions. Reserves and reserves/production durations remain planned, not implemented; they must never be presented as literal depletion dates.

Run `node --test cartridges/202609052143-open-energy/model.test.mjs`. UI supports pause and reduced motion, stops updates in hidden tabs, loads one small same-origin data file, and does not poll an API. Failures remain local to the cartridge. Chrome reference checks and raw downloaded source evidence remain in the offline-screenshots folder.
