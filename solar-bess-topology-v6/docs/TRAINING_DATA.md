# V6 Training Data Note

This document records training logic for the GlobalGrid2050 V6 workspace.

It intentionally avoids naming live or historical projects, clients, sites or commercially sensitive references. It converts the attached technical evidence into general architectural lessons for V6.

This file is not a design report. It is not a calculation certificate. It is not an engineering approval. It is a reasoning note for how V6 should absorb real project behaviour without pretending to replace competent engineering review.

## 1. Why this training data matters

The attached evidence shows the difference between a visual engineering tool and a true infrastructure reasoning system.

V6 already contains useful layers: a GIS SLD financial sandbox, a module layout app, a DC AC LV topology review app and a modular cable geometry visualiser. These tools are now separated into a cleaner workspace and the cable geometry visualiser has been split into CSS, data, calculation, rendering, export and UI modules.

That is good architecture, but the attached evidence shows what the next level must become.

Real infrastructure design does not fail because people cannot draw a cable or enter a cable size. It fails because assumptions are scattered between physical layouts, thermal models, current ratings, protective device settings, installation conditions, transformer blocks, switchgear interfaces, manufacturer limitations, trench spacing, soil conditions, voltage drop limits, short circuit withstand and commercial pressure.

The practical lesson is simple:

V6 must not become a drawing tool.

V6 must become a structured reasoning environment where geometry is only the first layer of evidence.

The cable geometry visualiser currently captures route identity, service type, installation basis, burial depth, cable outside diameter, grouping basis, spacing, formation, indicative trench envelope and bend radius. That is a strong start because it forces the user to look at physical geometry before pretending a cable is electrically valid.

However, the uploaded material shows that geometry is not enough. Cable suitability depends on at least 5 interacting dimensions:

```text
physical arrangement
thermal environment
electrical loading
fault withstand
protection and isolation
```

The V6 doctrine should therefore treat every cable route as a physical object, an electrical conductor, a thermal body, a protection zone and a commercial risk item at the same time.

## 2. Real cable studies are assumption led

The cable reports show that real calculations are driven by declared assumptions. They record installation method, number of circuits, grouping, ambient or ground temperature, soil thermal resistivity, depth, protective device assumptions, voltage drop limits and fault levels.

This is the key training point:

```text
A cable result is only as strong as the assumptions attached to it.
```

V6 should not merely show an output such as trench width or cable spacing. It should increasingly show the assumption chain behind the output.

The current cable geometry visualiser already includes warnings that the tool is geometry only and does not perform electrical rating, thermal rating, cable sizing, protection grading or construction design. That warning is correct and should remain. The next step is not to remove the warning. The next step is to create structured placeholders for the assumptions that a formal calculation would need.

Useful future fields could include:

```text
load current
load profile
maximum conductor temperature
ambient air temperature
ground temperature
soil thermal resistivity
backfill thermal resistivity
installation method
duct material
duct internal diameter
duct outside diameter
number of parallel groups
edge to edge spacing
centre to centre spacing
bonding method
protective device type
protective device setting
fault duration
permitted voltage drop
```

V6 does not need to calculate everything immediately. But it should teach the user that these assumptions exist and must be gathered before a cable can be treated as technically bankable.

That is the difference between a drawing app and an infrastructure reasoning app.

## 3. Soil thermal resistivity is not a minor field

The attached current rating material and cable studies repeatedly show soil thermal resistivity as a controlling assumption.

This is important because early stage solar, BESS and EV infrastructure discussions often talk about cable sizes and lengths without asking whether the ground can dissipate heat. A cable in a spreadsheet is abstract. A cable in soil is a thermal system.

V6 should treat soil and backfill as first class engineering variables.

The cable geometry visualiser currently allows the user to define geometry and spacing. The future thermal layer should not simply ask for a cable size. It should ask:

```text
Is this in air, duct, direct buried, trough or enclosure?
What is the assumed soil thermal resistivity?
Is the backfill controlled or natural?
Is the cable group thermally independent from adjacent groups?
Does the arrangement assume a reference condition or a site verified condition?
What happens if actual soil is worse than assumed?
```

This matters commercially as much as technically. A route that looks cheap can become expensive if spacing, depth, backfill, ducts or parallel runs must change to preserve rating. A shallow early assumption can become a late stage civil redesign.

V6 should make this visible.

## 4. Grouping is where simple tools become dangerous

The uploaded cable studies show multiple runs, parallel groups, duct groups, open trough assumptions, direct buried assumptions and grouped circuit derating. They show that cable rating is not only about one cable. It is about the thermal and electromagnetic behaviour of many cables installed together.

The present V6 geometry visualiser can draw group arrangements and give indicative spacing. That is valuable, but the next lesson is that grouping must eventually be connected to rating logic.

For example, V6 should distinguish between:

```text
single circuit
parallel conductors in one circuit
multiple circuits in one trench
separate trenches that are thermally independent
mixed services in one corridor
single core AC arrangements
multi core AC arrangements
DC positive and negative pairs
```

The tool should also preserve the difference between:

```text
touching spacing
edge to edge spacing
centre to centre spacing
vertical separation
horizontal separation
formation envelope
civil trench width
thermal model width
```

These are not the same thing. A user may say “300 mm spacing” but unless the basis is defined, the statement is ambiguous. V6 should force that ambiguity to become explicit.

## 5. Cable geometry must stay linked to protection

The cable studies show current capacity, voltage drop, impedance, fault rating, earth fault loop and protective device details sitting together in the same reasoning chain.

That is a lesson for V6.

Cable geometry is not just civil coordination. It directly affects impedance, voltage drop, earth fault loop, fault current at source and load ends and short circuit withstand.

Future V6 logic should allow a cable route record to carry the following layers:

```text
route geometry
installation geometry
conductor and cable construction
current capacity assumption
voltage drop calculation basis
fault withstand basis
protective device basis
earthing or armour bonding basis
review status
```

The current V6 cable geometry visualiser should remain geometry only until the next layer is deliberately designed. But the data model should prepare for protection fields later.

The important point is that protection should not be bolted on after the geometry. It should be a future layer of the same route object.

## 6. Standards are not decorations

The uploaded standards material shows why V6 must avoid fake certainty.

Electrical standards do not merely provide labels. They define scope, protection, selection and erection rules, wiring system requirements, inspection and verification expectations, current carrying capacity guidance, voltage drop logic, PV specific requirements, isolation and switching principles and safety assumptions.

For PV systems, the standard material reinforces several principles that should shape V6:

```text
PV DC equipment can remain energised even when disconnected from the AC side.
PV DC wiring must be selected and erected to reduce earth fault and short circuit risk.
DC equipment must be suitable for direct voltage and direct current.
String and array cable protection depends on current carrying capacity relative to PV short circuit current.
Isolation and switching must be treated seriously on both DC and AC interfaces.
Warning labels and maintenance access are part of the system, not afterthoughts.
Loop areas should be minimised to reduce induced voltage risk.
```

V6 should therefore avoid presenting a route, layout or topology as “compliant”.

A better V6 language is:

```text
geometry captured
assumptions visible
review required
standard relevant
competent engineer required
```

That tone protects the tool and improves its engineering value.

## 7. Manufacturer block data teaches topology discipline

The attached manufacturer material for turnkey MV and LV blocks shows that real solar blocks are not just inverter counts. They are packaged systems with transformers, switchgear, low voltage switching, surge protection, isolated rooms, containerised layouts, access constraints and standardised block capacities.

V6 already has string inverter and central inverter assumptions, skid transformer inputs and block logic. The training point is that those inputs should increasingly align with manufacturer block reality.

For example, a user should not only enter “inverter count” and “skid MVA”. V6 should eventually understand that a block may include:

```text
multiple low voltage inverter inputs
main low voltage switching
transformer capacity
medium voltage switchgear
surge protection
access and maintenance clearances
container or skid footprint
transport constraints
replacement strategy
front access or walk in constraints
```

This does not mean V6 should hard code one manufacturer’s product. It means V6 should treat equipment blocks as systems rather than abstract boxes.

The GIS SLD Financial Sandbox should eventually connect manufacturer style block capacity to:

```text
number of blocks
block footprint
LV cable aggregation
transformer rating
MV feeder count
switchgear interface
33 kV collector topology
spares and maintainability
CAPEX logic
```

That is where V6 becomes more than a finance calculator.

## 8. Switchgear teaches interface discipline

The switchgear catalogue material shows that MV interfaces are modular, configurable and protection dependent. A ring main unit or compact switchgear arrangement is not just a symbol. It contains cable switches, fuse switch disconnectors, vacuum circuit breakers, direct cable connection options, metering modules, earthing switches, interlocks, mechanisms, bushings, cable terminations, relays and extension logic.

V6 should therefore treat the MV interface as a system boundary.

The present GIS SLD sandbox draws 33 kV radial logic and points of connection. That is valuable for early screening. But future V6 layers should separate:

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

This matters because the commercial model may treat a connection as a distance and a cost, while the engineering model sees switching, protection, earthing, access, testing, fault isolation and outage strategy.

V6 should progressively make those boundaries visible without pretending to complete a protection study.

## 9. The inverter manual teaches professional responsibility

The inverter manual material makes clear that installation, operation and maintenance are intended for professional technicians with electrical, mechanical and safety competence. It also shows that manuals are updated, product variants differ and actual purchased equipment governs final design.

This is important for V6.

A public tool must not imply that generic assumptions override product manuals.

V6 should treat manufacturer data as versioned, conditional and subject to confirmation. Where V6 uses an inverter rating, voltage, current, MPPT structure, DC input limit or AC output assumption, the tool should eventually allow a source note or manufacturer confirmation flag.

Suggested future fields:

```text
equipment family
equipment version
datasheet date
manual date
rated AC output
maximum DC voltage
MPPT count
string input count
maximum input current
short circuit input current
AC voltage
installation temperature range
clearance requirement
source confidence
```

The tool should teach users that topology is not valid until it is aligned with the actual equipment data.

## 10. V6 should distinguish 3 levels of truth

The attached evidence suggests V6 should classify outputs into 3 levels:

```text
Level 1: visual assumption
Level 2: engineering screening assumption
Level 3: verified design input
```

Level 1 is what the current V6 cable geometry visualiser mostly does. It captures geometry and shows the user what the assumed arrangement looks like.

Level 2 would add structured assumptions such as current, thermal resistivity, installation method, grouping, voltage drop limit and fault duration.

Level 3 would require competent engineering calculation, project specific data, verified manufacturer information, site conditions and formal review.

V6 should not confuse these levels.

A good future UI pattern would be:

```text
Visual assumption captured
Screening data incomplete
Formal design not verified
```

or:

```text
Geometry complete
Thermal inputs missing
Protection inputs missing
Manufacturer confirmation missing
```

This would make V6 stronger because it would expose missing evidence rather than hiding it.

## 11. What the current V6 already does well

The current V6 structure is strong in several ways.

First, the apps are separated. That prevents one tool from contaminating another.

Second, V5 is protected. This is essential because the working baseline must remain available.

Third, the cable geometry visualiser has been modularised without changing behaviour. That proves the workflow can improve structure while preserving runtime truth.

Fourth, the cable visualiser already speaks the right language: geometry only, no electrical rating, no thermal rating, no compliance verdict and competent review required.

Fifth, the existence of `data.js`, `calculations.js`, `rendering.js`, `export.js` and `ui.js` creates the correct architecture for future layering.

The next stage should not be random feature addition. The next stage should be disciplined data model expansion.

## 12. What V6 should learn next

The training data points to the following priorities.

### 12.1 Add assumption capture before calculation

Before V6 tries to perform rating calculations, it should capture the data required for rating calculations.

This is safer and more useful than pretending to calculate too early.

### 12.2 Add route object structure

A cable route should become an object with geometry, electrical, thermal, protection and evidence fields.

Example future structure:

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
voltage_drop_limit_percent
fault_duration_s
protective_device_type
source_status
review_status
```

### 12.3 Keep standards as references, not automatic approvals

The tool can say which standard topic is relevant. It should not declare compliance unless a verified calculation and review workflow exists.

### 12.4 Connect cable geometry to commercial risk

Every increase in spacing, trench width, duct count, cable size, conductor material or parallel run changes cost. V6 should eventually show that early technical assumptions affect CAPEX and project viability.

### 12.5 Preserve manufacturer version awareness

Equipment data changes. V6 should not treat a product family as timeless. The data source, version and confidence level should be visible.

## 13. Specific V6 architecture implication

The current modular cable geometry files should not be collapsed back into one file.

The modular split should be used as the foundation for future disciplined growth:

```text
data.js
```

Should hold constants, cable tables, standards labels, source confidence fields and equipment metadata.

```text
calculations.js
```

Should continue to hold deterministic calculations and normalisation logic. Future screening calculations should go here only after the input model is stable.

```text
rendering.js
```

Should remain responsible for visual output, warnings, status and canvas drawings.

```text
export.js
```

Should become more important. Exported JSON should preserve assumptions, missing data flags and review status, not only visible geometry.

```text
ui.js
```

Should orchestrate input capture, event binding and workflow. It should not become a dumping ground for technical calculation logic.

## 14. Recommended next feature after validation

The best next feature is not thermal calculation.

The best next feature is:

```text
V6 cable route assumption schema phase 1
```

Purpose:

Add structured fields and export keys for thermal and protection assumptions without claiming to rate the cable.

Suggested output:

```text
thermal_assumptions_complete: true or false
protection_assumptions_complete: true or false
manufacturer_data_confirmed: true or false
formal_design_required: true
```

That would align the tool with the uploaded evidence and keep it honest.

## 15. Final training conclusion

The attached evidence confirms the central GlobalGrid2050 philosophy.

Software is not the hard part. The hard part is knowing what must be made visible.

Real infrastructure engineering is a chain of assumptions. If those assumptions are hidden, the output becomes false confidence. If those assumptions are visible, the user can see where judgement, data and formal calculation are still required.

V6 is now ready to become the workshop for that discipline.

The next mission is not to make the tool look more impressive. The next mission is to make it more truthful.

The rule is:

```text
Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.
```

That is how V6 should absorb the confidential training data without leaking project names, copying proprietary reports or pretending that a browser tool replaces engineering responsibility.
