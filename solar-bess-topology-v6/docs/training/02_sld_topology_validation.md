# 02 SLD Topology Validation

## Purpose

V6 must learn that an SLD is not complete because it is drawn.

It is complete only when every symbol, cable, feeder, transformer, inverter, string count and total reconciles through the hierarchy.

## Relevant V6 apps

```text
solar-bess-topology-v6/gis-sld-financial-sandbox/
solar-bess-topology-v6/dc-ac-lv-topology-review/
solar-bess-topology-v6/cable-geometry-visualiser/
```

## Future hierarchy

V6 should eventually model:

```text
plant
zone
MV main
production substation
transformer
LV bus
inverter group
string group
cable section
protection device
metering point
```

## Reconciliation rule

```text
Every total must be calculated from child objects, not manually typed.
```

## Totals to check

```text
total_dc_capacity
registered_export_capacity
ac_capacity
dc_ac_ratio
module_count
string_count
inverter_count
transformer_rating
zone_totals
plant_totals
```

## Feeder loading rule

A feeder cable size must be checked against cumulative downstream load.

Future feeder record:

```text
from_node
to_node
length_m
cable_size
conductor_material
downstream_blocks
downstream_ac_capacity
downstream_dc_capacity
current_load
voltage_drop_status
thermal_status
fault_withstand_status
installation_status
```

## Transformer and inverter cross checks

V6 should check:

```text
number_of_inverters
inverter_ac_rating
transformer_rating
transformer_temperature_basis
LV_switchgear_rating
MV_feeder_rating
dc_ac_ratio
```

## Template rule

```text
Template drawings are allowed. Template assumptions are not.
```

Each block instance must carry its own data.

## Module rating visibility

Mixed module ratings may be valid, but they must be explicit.

Future fields:

```text
module_rating_wp
module_type
module_rating_source
mixed_module_rating_flag
module_rating_contribution
```

## MV joints

MV joints are risk objects.

Future fields:

```text
joint_count
joint_location
joint_type
joint_test_required
joint_risk_flag
```

## Protection zones

SLD topology should connect to protection zones.

Future fields:

```text
relay_function
CT_ratio
protection_zone
trip_target
upstream_device
downstream_device
grading_status
```

## Temperature rating basis

Equipment capacity can change with temperature.

Future fields:

```text
rated_capacity_at_reference_temperature
rated_capacity_at_high_temperature
ambient_basis
temperature_derating_flag
```

## Drawing status

Electrical assumptions should carry drawing maturity.

Future values:

```text
preliminary
IFR
IFC
as_built
superseded
```

## Avoid

```text
Do not treat SLD symbols as proof of electrical validity.
Do not allow manual totals to override calculated hierarchy.
Do not hide mixed module ratings.
Do not hide temperature rating basis.
Do not hide feeder load assumptions.
```
