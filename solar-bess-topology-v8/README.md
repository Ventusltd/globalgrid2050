# GlobalGrid2050 V8

V8 is the standalone BESS to PCS study workspace.

V7 is to remain stable for the combined solar and BESS GIS SLD release. V8 is where standalone BESS logic can be tested safely before any future V9 merge back into a unified Solar plus BESS UI.

## Current app

```text
solar-bess-topology-v8/bess-pcs-standalone/
```

## Doctrine

Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.

## Scope

V8 starts with the BESS to PCS DC link only:

```text
BESS DC terminals -> parallel DC cable sets -> PCS DC input
```

The first screening logic converts BESS MW and DC voltage into total DC current, then divides that current by the number of parallel DC cable sets.

Formal IEC 60287 or equivalent thermal study remains required for real projects.

## V9 intention

V9 may merge solar and BESS into one UI after the standalone BESS logic is stable.
