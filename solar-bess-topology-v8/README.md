# GlobalGrid2050 V8

V8 is the standalone BESS study workspace.

V7 remains stable. V8 is where standalone BESS logic is developed before any future V9 merge back into a unified Solar plus BESS UI.

## Current apps

```text
solar-bess-topology-v8/bess-gis-sld-financial-sandbox/
solar-bess-topology-v8/bess-electrical-topology-review/
```

## Main app boundary

The BESS GIS SLD Financial Sandbox handles:

- BESS containers.
- PCS blocks.
- Integrated PCS transformer layout.
- Separate PCS plus external transformer layout.
- Distributed PCS islands.
- PCS corridor layout.
- Central PCS block.
- Transmission scale HV compound placeholder.
- Access roads.
- Fire or acoustic barriers.
- Basic MW, MWh, CAPEX and revenue screening.

It does not handle cable sizing or protection validation.

## Advanced review boundary

The BESS Electrical Topology Review handles cable, impedance, leakage, reverse current, transformer impedance, fault level and formal study flags.
