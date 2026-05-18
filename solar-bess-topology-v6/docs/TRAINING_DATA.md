# V6 Training Data

This file records the main training points for the GlobalGrid2050 V6 workspace.

It is intentionally short. It does not name projects, clients or sites. It does not repeat source material. It only records the engineering lessons that should guide future V6 work.

## 1. Core rule

```text
Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.
```

## 2. V6 must not become only a drawing tool

The cable geometry visualiser is useful because it shows route identity, service type, formation, spacing, trench envelope, burial depth and bend radius.

That is only the first layer.

A real cable route also depends on current, thermal conditions, voltage drop, fault withstand, protection settings, installation method, equipment limits and verified manufacturer data.

## 3. Assumptions are the real design object

Every cable output must be linked to the assumptions behind it.

Future V6 route records should make these assumptions visible:

```text
load current
load profile
installation method
burial depth
soil thermal resistivity
backfill thermal resistivity
ambient temperature
ground temperature
parallel groups
spacing basis
protective device type
protective device setting
fault duration
voltage drop limit
manufacturer data source
review status
```

## 4. Soil and backfill must be first class inputs

Cable rating changes with soil and backfill conditions.

Future V6 should distinguish:

```text
native soil
controlled backfill
unknown soil
buried duct
direct buried cable
open trough
free air
metallic enclosure
```

The tool should show when thermal assumptions are missing.

## 5. Grouping must be explicit

Cable grouping is one of the main hidden risks.

V6 should distinguish:

```text
single circuit
parallel conductors
multiple circuits in one trench
separate thermally independent trenches
mixed services in one corridor
single core AC
multi core AC
DC positive and negative pairs
```

Spacing must also be explicit:

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

## 6. Geometry must connect to protection later

Cable geometry affects impedance, voltage drop, fault current, earth fault loop, short circuit withstand and protection behaviour.

Future V6 route records should carry:

```text
route geometry
installation geometry
conductor data
current assumption
voltage drop basis
fault withstand basis
protective device basis
earthing or bonding basis
review status
```

Protection must not be bolted on after the geometry. It should become a future layer of the same route object.

## 7. Standards are references, not automatic approvals

V6 must not declare compliance.

Better wording:

```text
geometry captured
assumptions visible
review required
standard relevant
competent engineer required
```

Standards should guide prompts, assumptions and warnings. They should not be used as decorative labels or automatic approvals.

## 8. Equipment blocks must be treated as systems

A solar or storage block is not only an inverter count.

Future V6 should treat equipment blocks as systems containing:

```text
inverter inputs
LV switching
transformer capacity
MV switchgear
surge protection
access clearances
container or skid footprint
transport limits
replacement strategy
maintenance access
```

This should later connect to block count, footprint, LV cable aggregation, transformer rating, MV feeder count, 33 kV topology and CAPEX logic.

## 9. MV switchgear is a boundary, not a symbol

V6 should eventually separate:

```text
public grid point
customer substation
transformer block
MV switchgear function
collector feeder
export feeder
protection boundary
metering boundary
ownership boundary
```

The map and SLD should show that a connection is not only a line and distance. It is also switching, protection, earthing, metering, access and responsibility.

## 10. Manufacturer data must be version aware

Equipment data changes.

Future V6 should record:

```text
equipment family
equipment version
datasheet date
manual date
rated AC output
maximum DC voltage
maximum input current
short circuit input current
MPPT count
string input count
AC voltage
clearance requirement
source confidence
```

Generic assumptions must not override actual manufacturer data.

## 11. V6 should classify truth into 3 levels

```text
Level 1: visual assumption
Level 2: engineering screening assumption
Level 3: verified design input
```

Current cable geometry is mainly Level 1.

The next stage should be Level 2 assumption capture.

Level 3 requires competent engineering calculation, verified project data, manufacturer confirmation and formal review.

## 12. What V6 already does well

```text
Apps are separated.
V5 is protected.
Cable geometry is now modularised.
Runtime behaviour was preserved during modularisation.
Warnings correctly say geometry only.
The file split creates space for future disciplined growth.
```

## 13. What V6 should avoid

```text
Do not claim compliance.
Do not add thermal calculation too early.
Do not hide assumptions.
Do not mix app logic before shared architecture is designed.
Do not rename legacy files only for neatness.
Do not turn ui.js into a dumping ground.
Do not collapse the modular cable geometry files back into one file.
```

## 14. Correct next feature

```text
V6 cable route assumption schema phase 1
```

Purpose:

Add structured fields and export keys for thermal, protection, manufacturer and review assumptions without claiming to rate the cable.

Suggested status fields:

```text
thermal_assumptions_complete
protection_assumptions_complete
manufacturer_data_confirmed
formal_design_required
review_status
```

## 15. File roles for cable geometry

```text
data.js
```

Constants, cable tables, source labels, confidence fields and future equipment metadata.

```text
calculations.js
```

Deterministic calculations, input normalisation, layout logic and future screening logic only after the input model is stable.

```text
rendering.js
```

Status, warnings, canvas drawings, review panels and visual output.

```text
export.js
```

Exported route data, assumptions, missing data flags and review status.

```text
ui.js
```

Input capture, event binding, debounce, orchestration and boot logic.

## 16. Final instruction

Future V6 work should make hidden assumptions visible before adding more calculations.

The purpose is not to make the tool look more impressive.

The purpose is to make the tool more truthful.
