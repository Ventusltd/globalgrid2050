# V6 Training Index

Developer and AI reference.

## Governing rule

```text
Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.
```

## Training modules

```text
01_cable_route_assumptions.md
```

Cable geometry, thermal assumptions, grouping, spacing, protection placeholders and review status.

```text
02_sld_topology_validation.md
```

SLD hierarchy, totals reconciliation, feeder loading, transformer checks, inverter counts, module ratings, joints and protection zones.

```text
03_bess_grid_resilience.md
```

Grid scale BESS lessons: redundancy, fast response, transformer dependency, PCS integration, fire safety, grid support and failure mode visibility.

```text
04_electrical_risk_controls.md
```

Electrical risk controls: surge protection, grounding, earthing, insulation coordination, arc energy, DC faults, AC faults and MV feeder protection.

```text
05_v6_module_relevance.yml
```

Machine readable map of which lessons apply to which V6 modules.

## Use by future AI

Before proposing a V6 feature:

1. Read `/PHILOSOPHY.md`.
2. Read `solar-bess-topology-v6/docs/ARCHITECTURE.md`.
3. Read this training index.
4. Identify which V6 app is affected.
5. Keep the feature small.
6. Do not introduce calculation claims before assumptions are visible.

## Development stance

This is not marketing.

This is a working reference layer for building the machine correctly.
