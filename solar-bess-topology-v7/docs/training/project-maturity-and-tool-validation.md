# Project Maturity and Tool Validation

## Purpose

This training note explains the gap between perceived project maturity and actual engineering definition. It also explains how real project datasets can be used to stress test the V7 tool assumptions.

This document supports the V7 doctrine:

```text
Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.
```

## Relevant V7 apps

```text
solar-bess-topology-v7/gis-sld-financial-sandbox/
solar-bess-topology-v7/cable-geometry-visualiser/
solar-bess-topology-v7/module-layout/
solar-bess-topology-v7/dc-ac-lv-topology-review/
```

## Assessing engineering maturity

Early stage projects often show signs of maturity that do not equal bankable engineering definition.

Projects may have a consented layout, an environmental assessment and a redacted grid offer. Those items are useful, but they do not automatically prove that the project has a complete engineering basis.

Common missing foundations include:

1. Ground investigation information.
2. Detailed system specifications.
3. Protection philosophy.
4. Cable installation assumptions.
5. Thermal assumptions.
6. Earthing and bonding assumptions.
7. Route definition.
8. Transformer and inverter data.
9. Fault level confirmation.
10. Validated loss assumptions.

An SLD without validated studies can represent concept maturity dressed as a later stage of development.

The purpose of V7 is not to pretend that screening is formal design. The purpose is to expose assumptions early so that teams understand what still needs to be verified.

## Validating V7 sandbox assumptions

Real project datasets provide the best stress test for the V7 tools.

The GIS SLD Financial Sandbox can be tested against real projects by comparing inputs such as:

1. Site location.
2. Export route length.
3. Grid connection point.
4. Solar capacity.
5. BESS power and energy assumptions.
6. Cable route assumptions.
7. CAPEX assumptions.
8. Revenue assumptions.
9. Loss assumptions.
10. Cashflow and profit sensitivity.

The objective is not to replace a formal study. The objective is to test whether the screening outputs remain sensible when measured against realistic project constraints.

## Cable geometry and electrical risk

The cable geometry visualiser should make physical assumptions visible before anyone mistakes a simple route distance for a complete cable design.

Critical tracking parameters include:

1. Installation method.
2. Soil thermal resistivity.
3. Burial depth.
4. Cable grouping.
5. Parallel circuits.
6. Conductor size.
7. Cable outer diameter.
8. Bend radius.
9. Fault withstand.
10. Route congestion.

A cable route is not just a line on a map. It is a physical, thermal, electrical and commercial assumption.

## Commercial engineering interface

Commercial screening must not hide engineering uncertainty.

When V7 shows CAPEX, revenue, cashflow, profit or IRR sensitivity, those outputs must be treated as screening outputs unless the engineering inputs have been verified.

Useful commercial questions include:

1. What happens if export distance increases?
2. What happens if cable losses are higher than assumed?
3. What happens if CAPEX rises because route assumptions were incomplete?
4. What happens if grid connection assumptions change?
5. What happens if BESS duration, power or cycling assumptions change?
6. What happens if project maturity is overstated?

The value of the tool is that it links engineering assumptions to commercial consequences early.

## Validation rule

Do not use V7 outputs as formal design evidence.

Use V7 to identify what needs checking, what assumptions drive value and where technical uncertainty could become financial risk.

The correct sequence is:

```text
Screen.
Expose assumptions.
Validate data.
Run formal studies.
Then decide.
```

## Standing warning

Do not confuse a clean dashboard with a complete project.

The dashboard is a thinking surface. The engineering truth still depends on verified inputs, formal studies and competent review.
