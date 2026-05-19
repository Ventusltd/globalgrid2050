# 01 Cable Route Assumptions

## Purpose

V7 cable geometry must become assumption aware before it becomes calculation heavy.

The current cable geometry visualiser captures physical layout. Future work should add structured assumptions without claiming formal cable rating.

## Core lesson

```text
A cable output is only as strong as the assumptions attached to it.
```

## Relevant V7 app

```text
solar-bess-topology-v7/cable-geometry-visualiser/
```

## Route object fields to add later

```text
route_id
service_type
voltage_class
source_equipment
destination_equipment
length_m
installation_condition
formation_type
cable_od_mm
conductor_material
conductor_size_mm2
parallel_groups
spacing_basis
spacing_h_mm
spacing_v_mm
burial_depth_mm
soil_thermal_resistivity
backfill_thermal_resistivity
design_current_a
load_profile
ambient_temperature
ground_temperature
voltage_drop_limit_percent
fault_duration_s
protective_device_type
protective_device_setting
manufacturer_data_source
review_status
```

## Thermal assumptions

V7 should show whether these assumptions exist:

```text
installation method
soil condition
backfill condition
ambient temperature
ground temperature
grouping basis
spacing basis
parallel circuit count
continuous load basis
```

## Grouping assumptions

V7 should distinguish:

```text
single circuit
parallel conductors
multiple circuits in one trench
thermally independent trenches
mixed services in one corridor
single core AC
multi core AC
DC positive and negative pairs
```

## Spacing basis

Spacing must not be ambiguous.

V7 should keep these separate:

```text
touching
edge to edge
centre to centre
horizontal spacing
vertical spacing
formation envelope
civil trench width
thermal model width
```

## Protection placeholders

Do not calculate protection yet.

First capture whether protection data exists:

```text
protective_device_type
protective_device_setting
fault_duration_s
fault_withstand_status
voltage_drop_status
earthing_or_bonding_basis
formal_design_required
```

## Export requirements

Future exported JSON should preserve:

```text
visible_geometry
thermal_assumptions
protection_assumptions
manufacturer_data_status
missing_data_flags
review_status
formal_design_required
```

## Avoid

```text
Do not claim compliance.
Do not claim cable rating.
Do not hide missing assumptions.
Do not add IEC style calculation before the data model is stable.
```
