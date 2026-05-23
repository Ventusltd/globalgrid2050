# BESS GIS SLD Financial Sandbox V8

This is the main BESS only V8 app.

It keeps the GIS, SLD and financial sandbox concept but removes PV specific logic.

## Included

- CARTO dark map base.
- Satellite base toggle.
- BESS energy and power inputs.
- 20 ft and 40 ft container assumptions.
- Energy per container.
- PCS rating.
- Containers per PCS.
- BESS layout modes.
- Integrated PCS transformer option.
- Separate PCS plus external transformer option.
- Distributed PCS islands.
- PCS corridor layout.
- Central PCS block.
- Transmission scale HV compound placeholder.
- Compound boundary.
- Access road and maintenance corridor.
- Fire or acoustic barrier placeholder.
- Indicative BESS CAPEX and revenue screening.
- SVG layout and SLD preview.

## Excluded from this app

- Cable sizing.
- Cable ampacity.
- Cable R, X and Z calculation.
- Thermal derating.
- Fault withstand.
- Protection coordination.
- Reverse current calculation.
- Earth fault calculation.
- Insulation monitoring validation.

Those items belong in:

```text
solar-bess-topology-v8/bess-electrical-topology-review/
```

## Future notes

Future advanced versions should allow a client substation footprint, customer switchroom, MV compound or HV interface area to be drawn and sized as a separate grid connection zone. This is intentionally excluded from the first BESS layout version to keep the app focused on BESS containers, PCS blocks, transformer arrangement, access and commercial screening.
