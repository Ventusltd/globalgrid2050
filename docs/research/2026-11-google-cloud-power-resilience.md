# When line-side voltage is not usable power: the 2026 Google Cloud London outage

**Research record:** GG2050-PS-2026-11-07-01  
**Prepared:** 7 November 2026 (Europe/London)  
**Publisher:** GlobalGrid2050 / VENTUS Ltd — independent, AI-assisted technical desk study  
**Status:** public research draft; not peer-reviewed, commissioned, site-verified or approved for design use  
**Primary source:** [Google Cloud service-health incident report, europe-west2, 20 October 2026](https://status.cloud.google.com/incidents/Xs2XTHzAVC9YnafnPyzj) (incident report displayed under 27 October 2026)

> **Scope boundary.** VENTUS did not investigate Google's facility, inspect its PLC source code, design its power system, or perform this incident's forensic engineering. Google is the source of the incident facts below; the logical counterexample and proposed verification questions are independent analytical contributions. This record cannot establish fault ownership or any UK utility's involvement.

## The falsifiable point

**Voltage upstream of an open breaker is not proof that electrical power is available to the load downstream.** That is a statement about connectivity and observability, not merely a preference for more sensors. A redundant controller using an identical false inference can remain wrong twice.

The [Google incident report](https://status.cloud.google.com/incidents/Xs2XTHzAVC9YnafnPyzj) describes a UK facility serving `europe-west2-b` normally built around 2N utility paths, a central HV generator bank commanded through dual redundant PLCs, and static UPS batteries specified for **five minutes of autonomous runtime**. In a temporary maintenance configuration, feeder B was physically open and key-interlocked/locked out; feed A carried the critical load. An external underground utility cable fault removed feed A.

Google reports that the PLC sensing inputs on B were on the **line side** of its open breaker. Both PLCs interpreted the still-energised upstream B feeder as an available utility supply. Generator automatic-start commands were not issued; onsite attempts at remote transfer were inhibited. UPS reserves were exhausted and equipment in `europe-west2-b` lost power. The report records the initial electrical event at **06:53 BST, 20 October**, customer impact from approximately **07:00 BST**, and an overall service disruption of **6 hours 8 minutes**. The elapsed seven minutes between reported event and impact should **not** be described as measured seven-minute UPS autonomy: the facility specification says five minutes, and those timestamps bracket a larger sequence.

## Evidence register

| Claim | Evidence class | Basis |
|---|---|---|
| An external underground cable fault interrupted utility feeder A | Google-confirmed | Incident report, Root Cause |
| Feeder B was open, key-interlocked and in locked-out maintenance state | Google-confirmed | Incident report, facility background |
| Line-side B voltage remained present despite disconnected load path | Google-confirmed | Incident report, PLC investigation |
| Both PLCs inferred that utility power was available and did not issue a generator-start command | Google-confirmed | Incident report, Root Cause |
| UPS batteries were specified for five-minute autonomy and later exhausted | Google-confirmed | Incident report, facility background and timeline |
| A line-side measurement alone is insufficient to prove a usable load supply | Independent electrical inference | Connectivity counterexample below |
| Common software/measurement assumptions can defeat redundant controllers | Independent systems inference | Same erroneous state interpretation in both controllers; not proof of every shared failure mode |
| A different PLC design would necessarily have prevented the outage | **Not established** | No authorised logic, detailed SLD, setpoints, operating procedures or safety assessment available |

## The counterexample — not a reconstruction of proprietary PLC code

Consider the following **conceptual** state at the instant utility A fails. It is intended to illustrate the false premise; it is **not** Google's exact PLC programme or a proposed generator controller.

| Observation | Feeder A | Feeder B |
|---|---|---|
| Voltage on the line side of the intake breaker | Absent after external fault | Present |
| Intake breaker connects feeder to the load path | Not the source of healthy load supply | No: breaker open/key-interlocked |
| Usable utility power demonstrated at the critical load bus | No | No |

The predicate `upstream_A_voltage OR upstream_B_voltage` evaluates **true**, while the proposition `at least one utility source is physically available to supply the critical load` is **false**. This single counterexample invalidates treating upstream voltage as sufficient evidence of an available load supply.

This does **not** imply a safe replacement algorithm of `upstream voltage AND breaker closed`: switchgear position, downstream metering, control supply, protective interlocks, generator readiness, reverse-feed possibility, equipment failure and maintenance conditions all need engineered validation. Voltage, position and current readings must be interpreted in a documented topology and operating state. No Boolean example here is suitable for controlling a real plant.

**Failure chain (Google-confirmed):** maintenance reduced utility configuration to a single active feed → an external cable fault removed that feed → redundant controllers accepted a non-delivering upstream voltage as healthy → the generator plant received no automatic-start command → UPS reserves depleted → local cloud equipment lost power → adjacent zones and regional services experienced failover pressure and control-plane dependencies.

## Test questions for a competent independent reviewer

The incident illustrates why a **normal 2N test is not a maintenance-state test**. A suitable site-specific design review, led and approved by qualified controls/protection engineers with the facility operator, would ask:

1. Where are voltage transformers and sensing points relative to every breaker, interlock and load bus? Can an isolated feeder look healthy?
2. Does the PLC receive trustworthy **physical breaker position** and independently verified downstream bus conditions, and how are disagreements treated?
3. Is generator-start eligibility independent of the single erroneous assumption shared by both controllers? Are hardware and software common-mode failures tested?
4. Does the test matrix include **B key-interlocked open + simultaneous loss of A**, not only A/B normal, and is the live system tested under a formally approved procedure?
5. Are generator command issuance, generator acceptance, transfer permissions/inhibits, utility-state changes, UPS runtime and operator alarms captured by synchronised, independently reviewable logs?
6. What human actions are realistically possible during the verified **UPS autonomy window**, including inhibited remote transfers and safe manual operating procedures?
7. Are IT failover capacity and cross-zone control-plane dependencies tested against physical loss of an entire availability zone, not only routine application failures?

**Audit outputs to request:** as-operated single-line diagram; switchgear/breaker status history; PLC input-point mapping and revision-controlled logic; approved method of procedure for the temporary 1N configuration; primary and secondary controller event logs; generator start-command records; UPS battery telemetry and alarm chronology; remedial change/test records. None are public evidence in this study.

## What Google says it is doing

Google's report documents PLC reconfiguration and validation on 20 and 26 October, full generator transfer testing, updated emergency operating procedures, enhanced change management and planned broader PLC configuration checks across similar sites. Planned dates in that report are **plans at publication**, not independent proof of later completion. See the live [incident record](https://status.cloud.google.com/incidents/Xs2XTHzAVC9YnafnPyzj) for status updates.

## Relevance and limits of the VENTUS research estate

- [Data Centres GB](https://github.com/Ventusltd/data-centres-gb) is an open, provenance-led **data-centre facility and electricity-infrastructure dataset**. It does **not** identify the facility hosting `europe-west2-b`, prove its ownership, or model PLC/generator states.
- [GridAtlas](https://github.com/Ventusltd/gridatlas) and [VENTUS Grid Engine](https://github.com/Ventusltd/ventus-grid-engine) support publicly sourced grid mapping, distances and reproducible data engineering. Proximity does not establish electrical connectivity, capacity, responsibility or source availability.
- [Testcode](https://github.com/Ventusltd/testcode) develops an evidence-gated test philosophy: an apparently valid result can conceal non-functional behaviour. A separate, non-operational feeder-state counterexample accompanies this study for reproducibility.
- [VENTUS Ltd](https://www.ventusltd.com/) is the commercial organisation supporting the GlobalGrid2050 research programme. This case study does not assert certification, appointment by Google or ability to remedy a specific facility without competent site engineers.

**Related official research (context, not incident evidence):** [UK Power Networks' Data Centre Demand Profiles](https://ukpowernetworks.opendatasoft.com/explore/assets/ukpn-data-centre-demand-profiles/) and [HSE guidance on control systems](https://www.hse.gov.uk/comah/sragtech/techmeascontsyst.htm). The cited UKPN dataset neither identifies nor attributes the Google facility.

## Independence and revision discipline

This is **post-incident commentary written on 7 November 2026**, not pre-incident prediction. All claims about the October event trace to Google's report; hypotheses and suggested audit checks are labelled as independent analysis. The GitHub pull request and commit history form the contemporary paper trail. Corrections should be additive, with dated reasons, rather than silently rewriting the discovery record.

**One-line finding:** electrical redundancy is not independent resilience if both channels rely on a shared, unverified inference that upstream voltage means power can reach the load.
