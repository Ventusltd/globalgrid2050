# 01 Advanced Electrical Layers Before Upgrade

## Purpose

This file defines the learning objectives that must be completed before advanced SLD, load flow, feeder loading, MCCB, ACB or protection features are added to V6.

The current V6 rule remains:

```text
Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.
```

Advanced electrical features must not be installed until the relevant assumptions are understood well enough to avoid false confidence.

## 1. SLD hierarchy

Learning objective:

Understand how a project SLD is structured from grid point to internal plant blocks.

Topics to understand:

```text
grid point
customer substation
MV switchgear
transformer
LV switchboard
inverter feeder
BESS feeder
string group
metering point
protection boundary
ownership boundary
```

V6 should not simply draw symbols. It should eventually understand parent and child relationships.

## 2. Load flow basics

Learning objective:

Understand what load flow means before adding any load flow feature.

Topics to understand:

```text
active power
reactive power
apparent power
voltage level
current
power factor
losses
voltage drop
export direction
import direction
```

V6 should not claim load flow until inputs and limits are visible.

## 3. Feeder loading

Learning objective:

Understand that feeder current depends on downstream connected load, voltage and power factor.

Topics to understand:

```text
downstream blocks
connected MW
connected MVA
operating voltage
power factor
continuous current
emergency current
thermal rating
voltage drop
fault withstand
```

Future rule:

```text
Feeder size must not be treated as valid unless downstream loading assumptions are visible.
```

## 4. Transformer loading

Learning objective:

Understand how transformer rating constrains inverter, solar and BESS blocks.

Topics to understand:

```text
rated MVA
ambient temperature basis
cooling class
continuous loading
emergency loading
losses
impedance
LV voltage
MV voltage
parallel transformer operation
N minus 1 case
```

Future V6 should distinguish transformer nameplate rating from usable capacity under assumptions.

## 5. MCCB and ACB basics

Learning objective:

Understand what MCCBs and ACBs do before adding them as design logic.

Topics to understand:

```text
MCCB
ACB
rated current
breaking capacity
short time withstand
thermal setting
magnetic setting
electronic trip unit
selectivity
backup protection
coordination
trip curve
```

V6 should not show MCCB or ACB logic as verified protection design unless settings, fault levels and grading status are available.

## 6. Protection zones

Learning objective:

Understand that protection is zoned and coordinated.

Topics to understand:

```text
upstream device
downstream device
relay function
CT ratio
trip target
fault current minimum
fault current maximum
clearing time
selectivity margin
protection grading
```

Future rule:

```text
Protection symbols are not protection proof.
```

## 7. Fault level visibility

Learning objective:

Understand why fault level is required before selecting or validating switchgear and protection.

Topics to understand:

```text
prospective short circuit current
maximum fault current
minimum fault current
making current
breaking current
withstand rating
arc energy
fault duration
source impedance
grid contribution
inverter contribution
```

V6 should first show whether fault level data is present or missing.

## 8. Earthing basis

Learning objective:

Understand that voltage rating, protection behaviour and fault current depend on earthing arrangement.

Topics to understand:

```text
TN system
TT system
IT system
solid earthing
resistance earthing
transformer neutral earthing
line to earth voltage
touch voltage
step voltage
earth fault current
insulation stress
```

Future V6 should not assess cable insulation or protection without earthing basis.

## 9. Harmonics and reactive power

Learning objective:

Understand that inverter plants are not simple unity power sources.

Topics to understand:

```text
power factor
reactive power
voltage support
harmonic current
THD
filter requirement
inverter grid code mode
PPC control mode
```

Future V6 should expose whether these study assumptions exist before showing advanced electrical confidence.

## 10. Study status layer

Learning objective:

Understand that advanced electrical confidence comes from studies, not drawings alone.

Future V6 status fields may include:

```text
load_flow_study_status
short_circuit_study_status
protection_study_status
harmonic_study_status
earthing_study_status
arc_flash_study_status
manufacturer_data_status
formal_review_status
```

## 11. What V6 may show first

Before calculations, V6 may safely show:

```text
assumption missing
study required
review required
source required
not verified
formal design required
```

## 12. What V6 must not claim yet

V6 must not claim:

```text
cable is correctly sized
MCCB is correctly selected
protection grading is correct
load flow is verified
fault level is acceptable
system is compliant
connection headroom is confirmed
```

unless the required studies and competent review exist.

## 13. Learning gate before upgrade

Before any upgrade involving SLD validation, load flow, MCCB, ACB or protection logic is prepared, answer these questions:

```text
What exact engineering concept is being represented?
What assumptions are required?
What input fields are needed?
What output is safe to show?
What output would be misleading?
What study would be required for formal design?
Which V6 module should own the logic?
What should be exported for review?
```

## 14. Next safe upgrade after learning

The safest first future upgrade is not full load flow.

The safer first upgrade is:

```text
Electrical study status placeholders phase 1
```

Purpose:

Add visibility fields showing which studies and assumptions are missing, without claiming to perform those studies.
