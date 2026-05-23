# Create V8 BESS PCS Standalone

Created a standalone V8 BESS to PCS study workspace.

## Source

Copied from:

```text
solar-bess-topology-v7/gis-sld-financial-sandbox/
```

## Destination

```text
solar-bess-topology-v8/bess-pcs-standalone/
```

## Purpose

Leave V7 stable and create a separate V8 app for BESS to PCS logic.

## First logic added

```text
BESS power MW / DC voltage = total DC current
Total DC current / parallel cable sets = current per cable set
```

## Next safe step

Test V8 standalone in the browser before removing any inherited solar UI sections.
