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

## DC string risk

Future V6 should check or record:

```text
modules_per_string
module_voc
minimum_temperature_basis
maximum_string_voltage
maximum_system_voltage
string_current
short_circuit_current
string_fuse_or_no_fuse_basis
mppt_pairing_basis
connector_rating_status
dc_arc_detection_status
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

## Avoid

```text
Do not draw protection without protection data.
Do not assume unity power factor unless explicitly stated.
Do not assume cable voltage rating is valid without earthing basis.
Do not assume surge protection exists because equipment has an AC SPD.
Do not treat long MV feeders as low risk lines.
```
