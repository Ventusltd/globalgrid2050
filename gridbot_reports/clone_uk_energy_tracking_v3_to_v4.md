# Clone UK Energy Tracking V3 to V4

Created V4 from the preserved V3 benchmark.

New app:

```text
uk_energy_tracking_v4/
https://globalgrid2050.com/uk_energy_tracking_v4/
```

Benchmark preserved:

```text
uk_energy_tracking_v3/
```

Copied scripts:

```text
scripts/update_uk_energy_v4.py
scripts/update_uk_price_v4.py
scripts/update_oil_prices_v4.py
scripts/update_uk_fuel_prices_v4.py
```

Workflow files are not created by this clone workflow because GitHub Actions cannot create or update workflow files unless the token has workflow permission. Create V4 workflows separately.

Rule: patch V4 only. Leave V3 as benchmark.
