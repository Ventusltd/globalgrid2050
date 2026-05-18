# 04 Electrical Risk Controls

## Purpose

V6 should expose electrical risk controls before it claims electrical design validity.

This training module records generic lessons for DC systems, AC collection, MV collection, surge protection, grounding, insulation coordination, arc energy and protection.

## Relevant V6 apps

```text
solar-bess-topology-v6/dc-ac-lv-topology-review/
solar-bess-topology-v6/gis-sld-financial-sandbox/
solar-bess-topology-v6/cable-geometry-visualiser/
```

## Governing visibility rule

Treat voltage margin, insulation basis, protection zones, surge protection, transformer dependency, grid service availability, BESS fire access and commissioning status as visibility layers before topology, capacity or financial outputs are treated as reliable.

## DC string voltage margin

PV string voltage must be checked against cold weather margin.

Future V6 should check or record:

```text
modules_per_string
module_voc
voc_temperature_coefficient
minimum_temperature_basis
maximum_string_voltage
maximum_system_voltage
inverter_max_dc_voltage
dc_insulation_margin_status
```

## DC thermal and current assumptions

DC to AC oversizing is not automatically unsafe, but it increases the need for visible current and thermal assumptions.

Future V6 should record:

```text
dc_ac_ratio
string_current
short_circuit_current
mppt_current_limit
connector_rating_status
dc_cable_thermal_status
string_monitoring_status
```

## Insulation coordination

Voltage class must match system earthing and fault behaviour.

Future fields:

```text
system_voltage
system_earthing_type
line_to_earth_voltage_normal
line_to_earth_voltage_fault
cable_u0_rating
cable_u_rating
insulation_margin_status
```

## Surge protection

Surge protection must be visible on DC, LV AC, MV and grid interfaces where relevant.

A single SPD symbol at one layer does not prove coordinated surge protection across the system.

Future fields:

```text
dc_spd_present
lv_ac_spd_present
mv_surge_arrester_present
grid_side_surge_arrester_present
spd_type
spd_location
earthing_connection_status
coordination_status
```

## Arc energy

Arc energy must be visible before claiming safe operation.

This does not mean V6 performs a formal arc flash study. It means V6 should show whether the required arc related assumptions and studies exist.

Future V6 should distinguish:

```text
dc_arc_risk
lv_ac_arc_flash_risk
mv_arc_fault_risk
available_fault_current
clearing_time
arc_flash_study_status
arc_detection_status
maintenance_warning_status
```

## MV feeder protection

Long MV feeders need explicit protection logic.

Future fields:

```text
feeder_length_m
feeder_cable_size
feeder_source_breaker
remote_switchgear_present
local_feeder_protection_present
relay_function
fault_current_min
fault_current_max
clearing_time
sectionalising_status
unit_protection_status
```

## Earthing and bonding

Future V6 should expose:

```text
earthing_system_basis
main_earth_grid_status
equipment_bonding_status
cable_armour_bonding_status
transformer_neutral_earthing_status
touch_voltage_review_status
step_voltage_review_status
```

## Harmonics and reactive power

Large inverter collections should not be treated as simple unity power sources.

Future fields:

```text
power_factor_basis
reactive_power_requirement
harmonic_study_status
THD_status
filter_requirement_status
inverter_grid_code_mode
```

## Safe wording

Use risk visibility language:

```text
status unknown
assumption missing
study required
review required
source required
formal design required
```

Avoid unsupported conclusions:

```text
This design is non compliant.
The cables are definitely undersized.
The transformer failure was caused by a specific event.
The protection grading is definitely wrong.
The fire strategy is inadequate.
```

## Avoid

```text
Do not draw protection without protection data.
Do not assume unity power factor unless explicitly stated.
Do not assume cable voltage rating is valid without earthing basis.
Do not assume surge protection exists because equipment has an AC SPD.
Do not treat long MV feeders as low risk lines.
Do not turn evidence gaps into final engineering conclusions.
```
