# 03 BESS Grid Resilience

## Purpose

V6 should learn from large grid scale storage systems without copying site specific detail.

The main lesson is that BESS is not only energy capacity. It is grid response, control architecture, redundancy, transformer dependency, fire safety, protection and commissioning risk.

## Relevant V6 apps

```text
solar-bess-topology-v6/gis-sld-financial-sandbox/
solar-bess-topology-v6/dc-ac-lv-topology-review/
```

## Governing visibility rule

Treat voltage margin, insulation basis, protection zones, surge protection, transformer dependency, grid service availability, BESS fire access and commissioning status as visibility layers before topology, capacity or financial outputs are treated as reliable.

## BESS is a grid service object

Future V6 should distinguish:

```text
energy_storage_capacity_mwh
power_capacity_mw
duration_hours
grid_support_role
market_role
fast_response_role
black_start_or_support_role
constraint_management_role
```

## Redundancy must be calculated

Redundancy claims must be calculated, not merely stated.

Future fields:

```text
n_minus_1_requirement
minimum_guaranteed_power_mw
minimum_guaranteed_energy_mwh
redundancy_margin_mw
redundancy_margin_mwh
single_failure_tolerated
multiple_failure_status
remaining_power_after_outage_mw
remaining_energy_after_outage_mwh
```

## Transformer dependency

Large BESS systems can be constrained by HV and MV transformer availability.

Future V6 should track:

```text
hv_transformer_count
hv_transformer_rating_mva
mv_transformer_count
mv_transformer_rating_mva
transformer_outage_case
remaining_export_capacity
transformer_failure_mode_review
commissioning_hold_point_status
```

## PCS and controller integration

BESS behaviour depends on PCS, EMS, PPC and grid operator signals.

PCS and PPC integration status must be visible before grid service capability is treated as reliable.

Future fields:

```text
pcs_count
pcs_rating_mw
pcs_mode
grid_forming_capable
grid_following_capable
ems_present
ppc_present
response_time_requirement
control_signal_source
integration_test_status
compliance_test_status
```

## Fire and access layer

BESS layout should carry safety and access assumptions.

Fire access and emergency response belong in the system model.

Future fields:

```text
enclosure_type
fire_access_route_present
separation_distance_basis
fire_water_or_suppression_basis
thermal_runaway_containment_status
detection_status
emergency_response_status
```

## Cable and busbar implication

Large BESS blocks involve high current DC and AC interfaces.

Future V6 should make visible:

```text
dc_bus_current
ac_bus_current
mv_collection_current
cable_thermal_status
busbar_rating_status
fault_current_status
surge_protection_status
earthing_status
```

## Grid connection implication

A BESS grid connection is not only a capacity number.

Future V6 should include:

```text
grid_voltage_level
connection_transformer_rating
export_limit
import_limit
grid_support_obligation
compliance_test_status
commissioning_hold_point_status
```

## Commercial risk link

Grid service obligations must link to technical availability.

Future V6 financial logic should eventually connect:

```text
available_power
available_energy
equipment_outage
contracted_service_obligation
revenue_at_risk
liquidated_damage_or_penalty_flag
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
outage case required
```

Avoid unsupported conclusions:

```text
The transformer failure was caused by a specific event.
The cables are definitely undersized.
The protection grading is definitely wrong.
The fire strategy is inadequate.
```

## Avoid

```text
Do not model BESS as only MW and MWh.
Do not hide transformer dependency.
Do not hide PCS and control dependency.
Do not ignore fire access and emergency planning.
Do not treat redundancy claims as valid unless the remaining capacity is calculated.
Do not turn evidence gaps into final engineering conclusions.
```
