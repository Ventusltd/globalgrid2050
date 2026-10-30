# Earthing, inverter topology and protection in utility-scale solar

**RESEARCH DRAFT — TEXT EXTRACT ONLY, NOT THE ORIGINAL PDF**

Original report date: 21 October 2026. Original PDF: 134 pages. Extracted and preserved on 30 October 2026.

The text below was extracted from the owner-supplied PDF, with page boundaries preserved. Tables and diagrams may have lost formatting. The original PDF binary is not included in this commit; see `README.md` for its SHA-256 and provenance. This is not verified compliance guidance. Recheck sources, manufacturer requirements and applicable licensed standards before engineering reliance or public publication.

---

## PDF page 1 / 134

Earthing, inverter topology and protection in utility-scale solar




Earthing, inverter topology and protection in
utility-scale solar
  ​Oct 21, 2026          · ​@Vikram

Independent research into whether the adoption of transformerless string inverters on
shared, unearthed AC collection networks has introduced electrical protection risks that
are insufficiently understood, documented or addressed. The hypothesis is tested, not
assumed. Findings are classified as confirmed, reasonably inferred, disputed, unverified
or unknown; manufacturer material is distinguished from independent evidence; no
project is named and site material is anonymised. Ten parallel research passes feed the
sections below; the executive summary is written last.



Executive summary
This report is the product of ten parallel research passes run on 21 October 2026 against a
twenty-section commission on earthing arrangements, inverter topologies and electrical
protection in utility-scale solar, with the reference plant anonymised throughout and
every statement carrying one of five evidence classes: confirmed from an opened source,
reasonably inferred, disputed between sources, unverified, or unknown. Five statements
carry the argument.

First, a utility-scale block built on transformerless string inverters is one galvanically
connected unearthed system from the module glass to the low-voltage winding of the
step-up transformer. The DC side cannot be earthed because the bridge would carry grid
current (SMA: "can exceed 1 kA"; Sungrow: "will not operate normally"), and the AC side is
made IT by the makers' instructions, Sungrow prohibiting neutral earthing when anti-PID
is enabled and limiting a winding to 15 inverters, Huawei supporting "the IT earthing
system in PV-only scenarios" with TT and TN "not recommended", GoodWe stating IT
outright. It is a design choice, not a property of the topology: SMA runs the same
transformerless hardware on an earthed star point and forbids IT on two of its ranges, and
Huawei's own 2020 manual accepted an earthed star point before its later editions
withdrew it without a stated reason. Confirmed.

Second, on the first earth fault anywhere in that system the healthy conductors rise from
462 to 800 V to earth and stay there, while the first fault itself carries only capacitive
current: about 1 A with the inverters off, about 4 A with them on and the arrays dry, 75 to
150 A when the arrays are wet, because the displacement reaches the module
capacitance through the bridges. Nothing in the transformer protection, the shared ACB
or the per-feeder overcurrent devices operates; the inverters' residual-current monitors
trip in waves without identifying the fault; and detection depends on an insulation



                                                                                      Page 1 of 134

---

## PDF page 2 / 134

Earthing, inverter topology and protection in utility-scale solar




monitoring device whose duty is in BS 7671 411.6 and nowhere in the PV standards, whose
number per network is one, whose settings are site-specific, and which none of the
commissioning guides, acceptance checklists or procurement documents opened
requires, records or tests. Mechanism confirmed; the gap reasonably inferred from
independent documents that are consistently silent.

Third, with anti-PID enabled the AC conductors also carry a DC offset to earth. Sungrow's
manual puts the common-mode voltage at 906 V and requires the winding, the cables and
the secondary equipment to withstand at least that; this report reconstructs the figure as
√(750² + 508²), a 750 V link offset under a 508 V phase voltage at 880 V line-to-line, with a
peak near 1,470 V, which is also what the Polish edition's 1,500 V to earth is. The
reconstruction is inference, consistent to a volt, and Sungrow has not published a
derivation. One correction to earlier work follows: IEC 60502-1 Table 1 keeps U0 at 0.6 kV
for Category C at Um 1.2 kV, so a 0.6/1 kV cable is within the standard on an 800 V IT
network; the case for 1,000 V-to-earth insulation rests on the standing first-fault voltage
of 800 to 920 V on the healthy conductors, 200 to 320 V above the cable's design voltage
to earth U0 of 600 V, for as long as the fault stands, on the DC offset, and on the 1,500 V
DC requirement, not on the earth-fault category. Confirmed (the requirement and the
correction); inferred (the reconstruction).

Fourth, the second fault is a calculation that must be done per feeder and has not been.
Two independent models of the reference block put a bolted second fault between two
100 to 150 m feeders at 5 to 10 kA depending on protective-conductor size, temperature,
bonding path and source, between 1.3 and 2.6 times the rating of a shared 4,000 A air
circuit-breaker; a few bolted joints in the path bring it to the breaker's rating, where it is
load. The breaker cannot be shown, with normal margins, to satisfy 2 Ia Zs ≤ U within the 5
s of 411.6.4 for the far end of 150 m feeders, nor to clear resistive faults through structure,
nor to protect a 185 mm² protective conductor at a 0.3 s short-time delay; a 16 mm²
bonding jumper in the loop fails in a third of a second at 4 kA. A 315 to 400 A fuse or MCCB
per feeder at the busbar end clears the same faults in under 0.1 s with a two to seven
times margin, which is what the makers' one-device-per-inverter rule amounts to when
the device sits at the right end. A drawing without an MCCB symbol at the inverter is not
by itself a non-compliance; the fault study, the device data at 800 V and the maker's
acceptance decide it. Reasonably inferred from stated assumptions; the block's
transformer and breaker certificates would confirm or soften it.

Fifth, no published investigation, insurer note or dataset attributes a fire, an injury or a
transformer failure on a string-inverter IT network to this mechanism, and none is
structured to detect it: the UK fire dataset is rooftop-dominated, the German one pre-
dates 1,500 V string plants, the leading operational-risk dataset has no earth-fault
category, and solar-farm incidents go unreported because O&M resolves them.
Transformer failures are documented only as a handful of unmeasured cases and must not



                                                                                         Page 2 of 134

---

## PDF page 3 / 134

Earthing, inverter topology and protection in utility-scale solar




be presented as widespread or as caused by IT faults. The blind spot is therefore
confirmed as a gap in standards scope, procurement language, inspection checklists,
training and data taxonomy, with the hazard mechanisms known to the makers and
written into manuals, warranty exclusions and marketing rather than into codes; it is
unproven as a safety outcome, and the evidence that would settle it, an as-built survey of
fifty plants, fleet alarm telemetry split AC and DC, and a ticket category for AC earth
faults, does not yet exist.

What the report delivers against the commission: the history of the architecture and of
the protection functions that were transferred, distributed or dropped (section 2); the
four earthing arrangements in one table (3); the physics of the floating DC side and the
central-inverter grounding options with their blind spots (4); the makers' reasons for IT,
with the 906 V reconstruction (5); the first fault with voltages, currents and equipment
stress (6); insulation monitoring devices and a coverage matrix (7); the second fault with
the regulations, the fault study and the shared-breaker question (8); switches against
breakers and an eight-step checking method (9); DC string protection, isolators,
connectors and a forensic method (10); transformer failures with their population
statistics and protection response (11); eleven string and eight central inverters compared
on earthing, monitoring and protection (12); the standards and legislation matrix against
A4:2026 (13); commissioning practice and what it is silent on (14); the blind-spot
assessment (15); the reproducible fault model (16); three diagrams (17); twenty questions
to ask any designer (18); a commissioning checklist (19); the knowledge-library schema
(20); the open-questions register (21); the roadmap (22); and the source register (23).

Three open questions would change conclusions if they came back the wrong way:
whether the printed A4:2026 carries the IMD duty at 411.6.3.1 or renumbered it, which
decides whether every public statement made so far needs a one-character correction;
whether the reference block's breaker can after all be shown adequate from its
certificates, which would soften section 9 for that block; and whether a survey would
show winding-level IMDs routinely fitted, which would reduce the blind spot to a
paperwork problem. None can be answered from a desk, and the roadmap puts them first.


Historical development of solar inverter architecture
The early central-inverter plant, roughly 2005 to 2015, paralleled strings in external fused
combiner boxes, typically 8 to 24 strings with a fuse each, recombined them through 200
to 400 A fuses into a 250 kW to 1 MW central inverter, and gave each inverter its own LV
winding on the MV transformer, with an LV breaker or disconnect at the inverter output
and an MV switch or breaker with a protection relay. The SMA Sunny Central 400MV to
630MV datasheet of about 2010 shows the arrangement: 1,000 V DC, "no galvanic
isolation" in the inverter, which was supplied with its own MV transformer feeding 20 kV
directly, 8 + 8 DC inputs, ground-fault monitoring as standard, external string-monitoring


                                                                                      Page 3 of 134

---

## PDF page 4 / 134

Earthing, inverter topology and protection in utility-scale solar




combiners, a motorised DC switch-disconnector and an AC load-disconnection switch
(SMA SC-MV datasheet). Sungrow's SG3125HV-MV turnkey station (datasheet v13, 2022)
shows the same protection set surviving into the 1,500 V generation: 0.6 kV LV, Dy11 with
one winding per inverter, 16 to 28 DC inputs each with "load break switch + fuse",
insulation monitoring and ground-fault monitoring both standard, breakers at the inverter
output and the MV output, and the array configurable as "negative grounding or floating"
(Sungrow SG3125HV-MV). Two-inverter stations with two separate LV windings are
background knowledge, not confirmed from an opened SMA document.

DC earthing conventions diverged early. In the United States, NEC 690.5 grounded one
DC pole through a ground-fault detector-interrupter fuse in a transformer-isolated
inverter; in Europe arrays were generally floating with an insulation monitoring device
measuring continuously. NREL's 2015 field guide records the comparison: the blind spot
"results from the way, until recently, most PV systems installed in the U.S. are grounded
for safety", while non-US designs use an isolation monitor that "operates continuously on
the PV array"; UL 1741 set the GFDI fuse at 1 A up to 25 kW, 2 A to 50 kW, 3 A to 100 kW, 4 A
to 250 kW and 5 A above, so an 800 kW system only had to detect ground current above 5
A (NREL 65050). The two blind-spot fires that follow from that design, Bakersfield 2009
and Mount Holly 2011, are set out in section 10; the literature chain, Brooks 2012 for
SolarABCs, Flicker and Johnson 2013 for Sandia, Ball and others 2013, is confirmed from
NREL's references, and NREL's own statement is that "Ground faults and arc faults are
the two most common reasons for fires in photovoltaic (PV) arrays", with post-blind-spot
recommendations to detect 100 mA of residual current and alarm at no more than 300
mA, normal residual current on 800 kW arrays measuring under 30 mA. As of autumn 2015
few certified arc-fault products existed for 800 kW inverters, a 1 A arc being hard to find
in more than 1,000 A of DC. The older architecture, in other words, was not inherently
safer: the grounded-array central design carried a structural detection gap and large
central DC systems lacked arc detection for years. The first widely used transformerless
central inverter in the US, requiring an ungrounded array under NEC 690.35, and the
integrated LV isolation transformers of the earliest central units are background
knowledge not verified here.

Voltage progression. On the DC side the US stayed at 600 V through about 2012 for NEC
and listing reasons while Europe used 1,000 V from the mid-2000s (background); NEC
2014 690.7(A)(3) allowed engineering-supervised voltage calculation for systems of 100
kW and more; 1,500 V arrived in central inverters first, with Sungrow showing a 1,500 V
containerised central station and the SG125HV string inverter at SPI in September 2016,
GE, Schneider, Ingeteam and SMA following in 2016 to 2018, IHS Markit reporting in 2020
that the utility-scale standard had "rapidly become 1500 V" with 3 to 4 MW central units
at 15.5 GW in 2019, and NREL switching its utility-scale reference design from 1,000 to
1,500 V in 2018. Sungrow's SG80HV (September 2016) is reported by PV Tech as the
"world's first 1500V string inverter", a company claim; its SG125HV (125 kW, 68 kg, early


                                                                                         Page 4 of 134

---

## PDF page 5 / 134

Earthing, inverter topology and protection in utility-scale solar




2017) was marketed as eliminating AC combiner boxes and as a "Virtual Central Inverter
Concept" in 5 MW blocks (PV Tech 2017). On the AC side the sequence is 400 V in Europe
and 480 V in the US for the 20 to 60 kW three-phase units first used in large plants
(background), 600 V for the SG125HV and SMA's PEAK3 150 (background), no utility-scale
690 V string product verified, then 800 V. The earliest 800 V utility string inverter
documented is ABB's PVS-175-TL, 185 kVA at 800 V, 1,500 V DC, 12 MPPT, up to 24 strings
direct "with no separate DC combiner box needed", recognised at Intersolar Munich 2018
and shipping to the US from May 2019 (Solar Power World 2019); Sungrow's SG250HX, 250
kVA, 800 V, 12 MPPT, two strings per MPPT at 26 A, with anti-PID, string-current and
ground-fault monitoring and leakage-current protection, was unveiled at Intersolar
Europe in May 2019 (EE Power 2019); Huawei's SUN2000-330KTL-H1 followed at 330 kVA,
800 V "3W+PE", six MPPT at 65 A with four to five strings each, "Smart String-level
Disconnection", DC insulation-resistance detection and a residual-current detection unit
(Huawei datasheet). Dates for the other 800 V entrants (Huawei 185KTL-H1, GoodWe HT,
Chint/CPS, Solis, Sineng, Ingeteam 3Play, Sungrow SG320HX) are background knowledge.
At 1,000 V AC only Huawei's 506 kW unit (2026) is known; no second vendor was verified.
TMEIC and Power Electronics remained central-inverter vendors, the latter holding the
largest US share in 2021 and co-leading the US with Sungrow in 2023.

Why developers and EPCs moved. NREL's 2018 O&M best-practice guide gives the
operating case: a central inverter is a "single point of failure"; string units are replaced
whole, quickly, by an electrician at US labour of $70 an hour against $128 for DC-qualified
central-inverter technicians, and spares can be stocked and rotated; the same source
gives the counter-case, a "whack-a-mole" pattern of units always down, warranty
replacements taking about a month, a 20-year replacement cost of $0.25/W for string
against $0.14/W for central, central being easier to monitor and to add grid features to, and
central needing more DC wiring repair and arc-flash hardware (NREL 73822). No
independent capex-per-watt comparison was found, NREL's benchmarks never having
modelled a utility-scale string case, although the 1,500 V move itself cut trenching, cable
and combiner cost. The yield, terrain and tracker arguments are vendor and analyst
assertions, not measured. The market series, each with its own denominator:


   Year                   Figure                                    Source

   2015                   Central inverters 57 % of global          GTM 2016; IHS 2015
                          shipments; three-phase string about a
                          third of revenue

   2016                   Three-phase string 26 % of shipments      IHS Markit, pv magazine 2017
                          to utility-scale projects




                                                                                                   Page 5 of 134

---

## PDF page 6 / 134

Earthing, inverter topology and protection in utility-scale solar




   Year                   Figure                                    Source

   2017                   Three-phase string shipments              GTM Research and Wood Mackenzie
                          exceeded central globally for the first   2018 (pv magazine 2018)
                          time; about 94 to 98 GWac shipped

   2019                   String penetration "steadily              IHS Markit, pv magazine 2020
                          increased"; 3 to 4 MW central units
                          15.5 GW

   2021                   225 GWac; Huawei about 23 %,              Wood Mackenzie
                          Sungrow about 21 %

   2022                   330 GWac; Huawei 29 %, Sungrow 23         Wood Mackenzie
                          %; top five 71 %

   2023                   536 GWac (+56 %); Huawei and              Wood Mackenzie 2024
                          Sungrow over 50 % combined; the US
                          led by central vendors (Sungrow,
                          Power Electronics), Europe by string
                          (Huawei, Sungrow, SMA)

   2021 to                String about 60 % rising to over 70 %     PV Tech Research, September 2026
   2024                   of global manufacturing capacity          (capacity, not utility shipments)


No source gives a year-by-year string-against-central split of utility-scale shipments after
2016; the statement that string inverters dominate utility scale is region- and metric-
dependent, and the US utility market was still led by central vendors in 2023.

What happened to the central station's protection functions:




                                                                                                   Page 6 of 134

---

## PDF page 7 / 134

Earthing, inverter topology and protection in utility-scale solar




   Function                             Central era                 String era                 Classification

   String fusing                        Fused combiners             Moved inside the           Transferred, then
                                        and fused inverter          inverter, then designed    partly dropped;
                                        inputs (Sungrow             out by limiting strings    compliance now
                                        SG3125 "load break          per MPPT to two so         rests on inverter
                                        switch + fuse" on 16        reverse current stays      design rules rather
                                        to 28 inputs; SMA           below the module's         than visible fuses
                                        string-monitor              series-fuse rating
                                        combiners)                  (SG250HX, SG350HX);
                                                                    Huawei's 330KTL-H1
                                                                    takes four to five
                                                                    strings per MPPT with
                                                                    electronic "SSLD" and
                                                                    no visible fuse, and
                                                                    whether SSLD is
                                                                    certified as string
                                                                    overcurrent protection
                                                                    is unknown

   Combiner-level                       Fused switch-               The combiner               Distributed, with
   isolation                            disconnectors in            disappears ("no            fewer isolation
                                        every combiner and          separate DC combiner       points per string
                                        a motorised DC              box needed", ABB 2019);    group
                                        switch at the               isolation is one DC
                                        inverter                    switch per 24 strings

   Continuous array                     Plant-grade IMD or          Each inverter checks       Distributed per
   insulation                           GFDI per inverter           insulation resistance      inverter; a DC fault
   monitoring                           covering one array          before connection and      on one array is
                                                                    monitors residual          electrically visible
                                                                    current in operation; no   to the whole IT
                                                                    plant-level IMD covers     network while each
                                                                    the galvanically           RCMU sees only its
                                                                    connected 800 V            own residual
                                                                    network unless added       current (inferred)




                                                                                                                Page 7 of 134

---

## PDF page 8 / 134

Earthing, inverter topology and protection in utility-scale solar




   Function                             Central era                 String era                  Classification

   Dedicated LV                         Dy11 single winding         8 to 14 inverters share a   Redesigned;
   winding per                          per inverter; the           winding across              galvanic separation
   inverter                             unearthed LV                hundreds of metres of       between arrays
                                        segment is metres of        800 V cable and AC          dropped
                                        busbar in one               combiners; the segment
                                        enclosure                   is IT (or TN for SMA
                                                                    PEAK3) by
                                                                    manufacturer
                                                                    instruction

   LV switchgear                        Inverter-output             MCCBs in AC                 Partly dropped: no
   with protective                      breaker plus MV             combiners give              earth-fault relaying
   relays                               breaker and relay           overcurrent protection      at LV unless
                                                                    only; AC earth-fault        specified
                                                                    protection depends on
                                                                    an IMD; 800 V exceeds
                                                                    the 690 V class of most
                                                                    LV switchgear
                                                                    (background)

   GFDI or IMD                          One device per array        One function per            Distributed and
   covering the                                                     inverter; anti-PID shifts   functionally
   whole DC                                                         each array's reference      changed; no
   network                                                          to earth by the inverter    product standard
                                                                    itself                      found that tests
                                                                                                RCMU or Riso
                                                                                                performance when
                                                                                                the AC side is IT
                                                                                                with large network
                                                                                                capacitance

   Arc-fault                            Few certified               1,500 V string inverters    Improved
   detection                            products for 800 kW         for the US carry AFCI to
                                        central DC systems          UL 1699B; IEC 63027
                                        in 2015                     (2023) covers series
                                                                    arcs to 1,500 V DC

   Earthing of the                      Negative grounding          Floating only               Changed
   DC array                             or floating,                (transformerless),
                                        selectable                  consistent with NEC
                                                                    2017 "functionally
                                                                    grounded"




                                                                                                                 Page 8 of 134

---

## PDF page 9 / 134

Earthing, inverter topology and protection in utility-scale solar




The balance: the older architecture had its own documented failures, the blind-spot fires
and EPRI's 2010 finding that inverter failure was among the most frequent causes of
performance loss, with more DC wiring and arc exposure; the string architecture removed
many DC fault locations, combiners, recombiners and GFDI fuses, but moved the galvanic
coupling of arrays from the DC side to a shared unearthed AC side where the PV-specific
standards are silent.

The standards timeline shows that silence. IEC 62109-2 (June 2011, stability date 2026)
sets inverter safety; IEC 62548:2016 (withdrawn December 2023) became IEC 62548-
1:2023 with a revised Clause 6 on array insulation monitoring and earth-fault detection,
new Annex F on anti-PID equipment and arc flash, a scope covering "DC array wiring,
electrical protection devices, switching, and earthing" up to the power conversion
equipment and excluding "the AC or DC distribution network", amended in December
2025 (IEC 62548-1); IEC TS 62738:2018 covers ground-mounted plants with nothing on AC
collection earthing visible in its abstract; IEC 63112:2021 on PV earth-fault protection
equipment is the only PV standard found that acknowledges an unearthed AC side, its
clause 4.1 stating the AC grid "may or may not be an earthed system", with an annex on
AC-side residual-current monitoring for non-separated systems and a heading on blind
spots, but it is an equipment standard, not an installation rule (IEC 63112); IEC 63027:2023
covers DC arc detection to 1,500 V; UL 1699B went from outline (2011) to first edition
(2018); the NEC added DC arc-fault detection in 2011, rapid shutdown and listed GFDI in
2014, "functionally grounded" and 690.41(B) in 2017, and UL 3741 hazard-control systems
and connector intermatability in 2020, with only 25 states enforcing NEC 2020 by
December 2022 (pv magazine USA 2023); BS 7671 introduced Section 712 in the 17th
Edition (2008, background) and has carried it through 2018, A1:2020, A2:2022, A3:2024
and A4:2026 without addressing the inverter output network, the IT-system IMD duty
sitting in 411.6, not in 712. None of the PV-specific standards specifies or tests the
earthing arrangement of an 800 V LV collection network shared by transformerless string
inverters; the choice is left to general LV rules plus manufacturer instructions that
contradict each other between vendors (sections 5 and 12). Section 15 notes that IEC
60364-7-712 Edition 3 (October 2025) claims to add requirements for PV generation
plants; its content was not opened.

Contradictions recorded: IEC 62548 edition numbering (the 2013 document was a
technical specification, so 2016 was the first international standard and 2023 the second);
"string overtook central" (all-segment shipments in 2017 against 26 % of utility-scale in
2016 against manufacturing capacity, different denominators); O&M economics (PV Tech
Research 2026 lower lifetime cost against NREL 2018 higher replacement cost, different
components and dates); the "first 1,500 V string inverter" claim, unverified; GFDI
thresholds ("several amps" against the 1 to 5 A ladder); and a vendor guide stating that
transformerless inverters need one DC pole earthed, which contradicts the standards
and every manual opened and was discarded. Unverified: the SolarABCs blind-spot report


                                                                                         Page 9 of 134

---

## PDF page 10 / 134

Earthing, inverter topology and protection in utility-scale solar




and Mount Holly details; the German PV fire study of 2015 (project domain since
repurposed); SMA two-winding station documents; the first 1,500 V plants and central
inverters of 2012 to 2016; the AC voltages of the SG125HV and the 690 V step; utility-scale
shipment shares after 2016; IEC 62109-2 clause text; IEC TS 62738 body; NEC 2023
changes; whether Huawei's SSLD is accepted as string overcurrent protection.


Earthing arrangements: the fundamentals
Every earthing arrangement answers one question: when a live conductor touches
metalwork, what path does the current take back to the winding it came from? The
answer decides whether a device trips, how high the metalwork rises, and what happens
to the other conductors. BS 7671 calls the subject the type of system earthing (regulation
312.2) and classifies it with two letters, a first for the source and a second for the exposed
metalwork of the installation.

Four concepts that are routinely confused need separating first. System earthing is the
deliberate connection, or non-connection, of a live point of the source (usually the star
point) to earth; it is what the letters describe. Protective earthing is the connection of
exposed-conductive-parts, enclosures, frames, trays and tanks, to the earthing terminal
so that a fault to them has a defined path and they cannot stay at a dangerous potential;
every arrangement in the table, IT included, has it. Functional earthing is a connection to
earth made for the equipment to work rather than for safety, such as the earthed pole of a
negative-grounded PV array or the offset applied by an anti-PID unit; it may share the
earth electrode but it serves a different purpose and needs its own protection.
Equipotential bonding joins conductive parts together so that no dangerous voltage can
appear between them during a fault; it does not by itself provide a return path to the
source. An IT system is therefore not an unearthed system: its source is unearthed while
its metalwork is extensively earthed and bonded, and the two facts together are what
give it its behaviour.


  Arrangement               Source                       Metalwork        First fault, line   What acts          UK status
                            connection                   connection       to frame

  TN-S                      Star point                   Separate         Solid short         Fuse or breaker    Older DNO
                            earthed at the               protective       circuit through     in a fraction of   supplies with
                            transformer                  conductor back   copper,             a second           cable-sheath
                                                         to that point    hundreds to                            earth; the natural
                                                                          thousands of                           choice behind a
                                                                          amps                                   private
                                                                                                                 transformer with
                                                                                                                 an earthed star
                                                                                                                 point




                                                                                                                          Page 10 of 134

---

## PDF page 11 / 134

Earthing, inverter topology and protection in utility-scale solar




  Arrangement               Source                       Metalwork            First fault, line   What acts         UK status
                            connection                   connection           to frame

  TN-C                      Star point                   One combined         Short circuit       Fuse or breaker   Prohibited in
                            earthed                      neutral and          through the                           consumer
                                                         protective           PEN; a broken                         installations by
                                                         conductor            PEN puts line                         ESQCR
                                                         (PEN)                voltage on all                        regulation 8(4)
                                                         throughout           metalwork                             and BS 7671
                                                                                                                    543.4, except
                                                                                                                    behind a
                                                                                                                    privately owned
                                                                                                                    transformer

  TN-C-S (PME)              Star point                   PEN in the           Short circuit       Fuse or breaker   The ordinary UK
                            earthed                      supply, split into   through the                           public supply;
                                                         N and PE at the      PEN; open-PEN                         restricted for
                                                         intake               risk as TN-C                          caravans, EV
                                                                                                                    charging, petrol
                                                                                                                    forecourts and
                                                                                                                    similar

  TT                        Star point                   Installation's       Current returns     RCD (BS 7671      Used where PME
                            earthed at the               own earth            through the soil;   411.5)            is unavailable or
                            transformer                  electrode            too small for a                       unsuitable
                                                                              fuse, large
                                                                              enough to kill

  IT                        Star point                   Local earth          No metallic         Insulation        Not available
                            unearthed, or                electrode and        return; only the    monitoring        from the public
                            earthed                      bonding              network's           device alarms     supply (ESQCR
                            through a high                                    capacitive          (411.6.3.1); a    requires it to be
                            impedance                                         charging            second fault on   earthed); used
                                                                              current, a          another line is   behind private or
                                                                              fraction of an      cleared as a      isolating
                                                                              amp to a few        line-to-line      transformers:
                                                                              amps; the           short by          hospitals
                                                                              faulted line sits   overcurrent       (Section 710),
                                                                              at earth            devices           ships, mines,
                                                                              potential and       (411.6.4)         some process
                                                                              the healthy lines                     plant, and PV
                                                                              rise to line-to-                      collection
                                                                              line voltage                          networks where
                                                                              against earth;                        the inverter
                                                                              nothing trips                         maker requires it




                                                                                                                             Page 11 of 134

---

## PDF page 12 / 134

Earthing, inverter topology and protection in utility-scale solar




  Arrangement               Source                       Metalwork        First fault, line   What acts          UK status
                            connection                   connection       to frame

  High-                     Star point                   Protective       A few amps          59G or resistor-   Industrial
  resistance                earthed                      conductor back   through the         current relay      practice in North
  earthed                   through a                    to the source    resistor,           alarms; pulsing    America (NEC
                            resistor sized                                detected and        locates the        250.36) and
                            above the                                     alarmed, no trip;   fault              elsewhere; the
                            charging                                      restrike                               usual
                            current,                                      overvoltages                           replacement for
                            typically                                     suppressed                             pure IT since the
                            limiting the                                                                         1980s;
                            fault to 1 to 10 A                                                                   incompatible
                                                                                                                 with daytime
                                                                                                                 anti-PID offsets


The windings decide what can be earthed. A three-phase winding is three coils. In star,
one end of each coil is joined at a common point, the star point, whose connection to earth
is the whole of the TN-versus-IT choice; the line-to-star-point voltage is the coil voltage
(462 V on an 800 V system) and the line-to-line voltage is that multiplied by the square
root of three. In delta, the coils are joined end to end and there is no common point, so a
delta winding is unearthed by construction unless one corner is earthed or an artificial
neutral is created; a delta cannot supply line-to-neutral loads. A zig-zag winding is a star
built from half-coils on different limbs; it is used to create an artificial neutral on a delta or
floating system, to give an earthing point for a resistor, or to block zero-sequence current.
Vector groups such as Dy11y11 describe the HV and LV connections and their phase shift:
here delta on the 33 kV side, which circulates triplen harmonics and blocks zero-
sequence current from passing between networks, and two star windings at 800 V whose
star points may be earthed or left floating.

Two cautions follow. The absence of a neutral terminal on an inverter does not prove that
its AC supply is IT: three-wire inverters are connected to earthed-star networks every
day, and the earthing arrangement is a property of the transformer winding and the
installation, not of the inverter's terminal count. And zero-sequence fault current, the
component that flows out through a fault and back through earth, has a path only where
the winding provides one; on a floating star or a delta it has none, which is why the first
fault on an IT network is limited to the charging current of the system's capacitance and
why that capacitance, from cables, inverter filters and, through transformerless inverters,
the modules themselves, sets the first-fault current.

The quantities that follow from each arrangement are set out in the worked models later
in this report: first-fault current paths and magnitudes, prospective fault levels for the
second fault, touch voltages against the 50 V limit of 411.6.2, residual currents seen by
inverter monitors, and the disconnection conditions of 411.6.4. The diagrams section
draws the connections and current-return paths for the TN-S and IT cases.



                                                                                                                         Page 12 of 134

---

## PDF page 13 / 134

Earthing, inverter topology and protection in utility-scale solar




Why transformerless inverters use floating DC systems
The physical fact comes from the makers themselves. SMA's technical information on
leakage current states that in a transformerless inverter part of the AC voltage reaches
the array, so "the complete PV array oscillates with an alternating voltage in relation to its
environment"; the oscillation charges and discharges the array's parasitic capacitance to
earth and drives a displacement current. For single-phase bridges about half the grid
amplitude appears on the array; for three-phase units the low-frequency swing is "largely
suppressed" but not zero. The array capacitance SMA gives is 60 to 110 nF/kW for
crystalline modules and 100 to 160 nF/kW for CdTe, dominated by the water film on the
glass when wet (SMA, Leakage Current); an independent 2024 paper gives the same 50 to
150 nF/kW and works a 577 mA leakage for an 8 µF array on a single-phase 230 V reference
(Despotović and Vuković 2024), and a peer-reviewed 2019 paper describes the same loop
as "common-mode leakage current circulating between PV array and grid" (Bellinaso et al.
2019). The mechanism, reasonably inferred from these and from the common-mode-
voltage literature whose existence was confirmed by metadata only: the bridge connects
each AC terminal alternately to DC+ and DC− or the DC midpoint; averaged over a
switching period the DC-link midpoint sits at minus the common-mode voltage relative to
the AC neutral; in a non-isolated boost stage the array negative is the DC-bus negative, so
the whole array sits near −Vdc/2 plus the common-mode ripple relative to the AC neutral;
the EMC filters' Y-capacitors, line-to-PE on the AC side and DC-to-PE on the DC side, give
the high-frequency return path and, with the array's own capacitance and leakage
resistance, decide where the floating DC side settles relative to earth. SMA's MV Power
Station manual says the same for central inverters: "the inverters are discharged to
ground. As a result, leakage currents to ground occur which must be taken into account
when planning the system" (SMA MVPS manual 2025). The numerical consequence is
confirmed by SMA's central-inverter manuals: with the AC side ungrounded, "during
inverter operation there are nominal voltages of up to 1000 V between the external
conductor and ground", and for the CP-JP generation "The MV transformer must be
designed for voltages that arise during pulsed mode of the inverter", with maximum AC
voltages to ground of ±800 V (500 kW), ±1,450 V (630 and 800 kW) and ±1,600 V (1 MW)
(SMA SC-HE installation guide, SMA CP-JP manual). That is the direct evidence that,
without an earth on the AC side, the LV conductors carry the DC potential plus switching
components to earth, which is the physics behind the 906 V figure of section 6.

Why a DC pole cannot be earthed. SMA's technical information on insulation errors sets
out the consequence for its own products: transformerless inverters "lack galvanic
isolation between the installation's DC circuit" and the grid; if a ground fault occurs during
feed-in "the current driven from the AC grid side through the inverter's grid bridge can far
exceed the permitted current limits", "particularly damaging the power modules (IGBTs)
or the grid disconnection point (relay)"; "the current flowing through the connected




                                                                                      Page 13 of 134

---

## PDF page 14 / 134

Earthing, inverter topology and protection in utility-scale solar




utility grid can exceed 1 kA"; the inverter "can detect a ground fault during operation via
its integrated residual current monitoring system" but "the grid disconnection cannot
occur quickly enough to prevent damage to the inverter components"; and under event
3501, "Inverters without a transformer can be destroyed by an ground fault during
operation" [sic], such damage being treated as externally caused and outside warranty
(SMA, Insulation Error). The loop, reasonably inferred: with the LV star point earthed,
which SMA requires for its Sunny Highpower and Tripower string inverters ("Sunny
Highpower inverters require connection to a grounded Wye transformer winding"; "The
neutral point must be grounded so that the grounding of the inverter is ensured", SMA
SHP MV transformer requirements, SMA STP requirements), an earth on DC− closes
transformer neutral, earth, DC−, the lower free-wheeling diode or conducting IGBT of
each phase leg, the phase conductor, the winding and back to the neutral. The diodes
conduct whenever a phase voltage is below the DC− potential, so this is a line-to-earth
short circuit through the bridge limited only by the transformer and grid impedance and
the semiconductors, hence "over 1 kA"; an earth on DC+ gives the mirror loop through the
upper devices; the DC-link capacitors do not block it because the loop passes through the
diodes, not the capacitors. For an inverter that requires an earthed star point the
prohibition is therefore absolute. With an IT winding the loop has no earthed return, so a
single DC earth, deliberate or accidental, produces only capacitive and monitoring
currents and converts the floating system into a referenced one, a first fault in IT terms;
that is exactly the arrangement used for functionally grounded central inverters below.
Why Sungrow and Huawei still forbid earthing a pole on their IT networks is not stated in
any document opened in this pass (the Sungrow manual's wording is in section 5); the
reasons, inferred, are that their insulation-before-connection and RCMU logic assumes a
floating array (SMA's SHP requires Riso above 33 or 50 kΩ before connection and
"redundantly disconnects the product from the utility grid if residual current jumps of >
30 mA occur"), that a second earth fault anywhere on the shared network, another
inverter's DC side or any AC conductor, closes a loop through two bridges with no device
rated to clear it, and that a plant-level IMD is defeated once any point is earthed.

How a DC earth fault propagates toward the AC system, and what limits it. On a TN AC
side the grid is the source, the bridge diodes are the path, the limit is the source
impedance and the diode surge rating; the RCMU detects a 30 mA step (IEC 62109-2 as
cited by SMA: disconnect "at the latest when a residual current jump of 30 mA occurs")
but the AC relay cannot open before the first current peak, so clearing falls to the
inverter's AC fuses or breaker and the upstream device. On an IT AC side the source is the
array itself plus stored energy and the loop closes only through earth capacitances or a
second fault. Sandia's 2016 ground-fault report, independent, states that "grounded
arrays provide significantly more fault current than ungrounded arrays", that ungrounded
arrays limit fault current through a clamping effect, and that "in ungrounded, non-isolated,
and hybrid systems, the ground fault blind spot does not exist"; it also records that



                                                                                       Page 14 of 134

---

## PDF page 15 / 134

Earthing, inverter topology and protection in utility-scale solar




insulation-resistance measurement "is very slow detection method due to array
capacitance" and that at night array-internal faults can go undetected because bypass
diodes block one polarity of the test pulse and "could subsist indefinitely in the array"
(Sandia SAND2016-0145R). Semiconductor failure modes add a path no manual describes:
IGBT modules and diodes predominantly fail short (background); a shorted upper device
ties DC+ and the array positive permanently to one phase, so the array swings with the
full phase voltage instead of the suppressed common-mode voltage, multiplying
capacitive leakage and, on a TN system, placing the full phase-to-earth voltage across any
DC insulation weakness; a shorted device in one leg plus normal switching of another is a
DC-bus short cleared by the AC fuses and the DC-link energy; on an IT system none of
these creates an earth loop by themselves, only with a coincident earth fault anywhere on
the coupled network. Whether protective shutdown is fast enough for an internal arc is
unknown: SMA says disconnection by the RCMU route "cannot occur quickly enough to
prevent damage", Sandia used 70 W of fault power as its criterion for setting insulation
thresholds (4.9 kΩ minimum, 28.4 kΩ default for a 1,500 V system of 500 kW and above),
and no source gives arc-energy figures for an internal fault in a transformerless string
inverter; the DC short-circuit capability of utility arrays bounds the energy available to a
DC-side arc in either architecture, central datasheets accepting 8 to 16 kA of array short-
circuit current.

IT against TN, in one paragraph. With an earthed star point any single DC-to-earth fault is
a grid-fed short through the bridge; detection by RCMU is fast in principle, clearing is not,
and every DC earth fault is at least detectable as residual current; SMA's string-inverter
transformer documents require this configuration and state that an electrostatic shield
winding is not necessary. With a floating LV winding a single DC earth fault is not a short
circuit; it is detectable only by an IMD, or by a GFDI if the array is functionally grounded,
and the whole galvanically coupled network, every array behind every transformerless
inverter on that winding plus the LV conductors, becomes one IT system whose insulation
resistance and capacitance add in parallel; SMA's central manuals say so ("the grid
between the inverters and the medium-voltage transformer is not grounded") and
FIMER's PVS980 datasheet carries "Distribution network type: TN and IT" with the
footnote "Inverter side must be IT type" (FIMER PVS980-58). The LV conductors then
carry DC-referenced voltages to earth and the transformer must be designed for them.

What a galvanically isolated central inverter permits, and what it does not. Isolation lets
the DC earth reference be chosen independently of the MV grid earthing: functional
negative or positive grounding through a GFDI, resistive soft grounding, or a floating array
with an IMD (SMA HE manual 3.8.2 to 3.8.5; FIMER "negative grounding" standard with
"Floating DC" optional; Sungrow "Negative grounding or floating"); it bounds DC earth-
fault current by the array rather than the grid; and it gives one continuous plant-level view
of the DC insulation at the inverter. SMA's SC-MV datasheet is explicit that "HE" means
"without galvanic isolation for connection to a medium-voltage transformer (taking into


                                                                                       Page 15 of 134

---

## PDF page 16 / 134

Earthing, inverter topology and protection in utility-scale solar




account the SMA specification for the transformer)": the isolation is the MV transformer,
not the inverter, a trap for anyone comparing "transformerless" central inverters with
transformerless string inverters on shared networks. What it does not protect against:
faults on the functionally earthed conductor (the blind spot below); faults below the GFDI
threshold ("The fuse does not trip ... the leakage can persist for an extended period", SMA
SC-HEM); the array's own fault current; shock ("Ground-fault monitoring does not provide
protection from personal injury", SMA CP-JP 2.2); DC-referenced pulsed voltages on the
LV winding; and AC-side earth faults on the IT LV network, which need their own IMD or
are seen only through the coupled system. SMA warns that entering a functionally
grounded field requires first switching "to insulated operation" and that the field "is not
grounded when the inverter is disconnected or during the measurement of the insulation
resistance", with a minimum insulation of 14 kΩ for the UP generation and 1 kΩ for the CP-
JP before entry.

The DC grounding options on central plants and their devices:




                                                                                   Page 16 of 134

---

## PDF page 17 / 134

Earthing, inverter topology and protection in utility-scale solar




   Option                                   What it is                 Documented limits      Source

   Negative or                              "A high-performance        "The GFDI is           SMA SC-HEM;
   positive functional                      miniature circuit-         bypassed when a        SMA HE manual
   grounding through                        breaker with               ground fault occurs    3.8.2 to 3.8.3 (HE
   a GFDI                                   adjustable trip current    in the grounded pole   manual)
                                            with K characteristics"    of the PV array ...
                                            between an input           cannot be reliably
                                            busbar and the             detected"; "If a
                                            protective-conductor       second fault then
                                            bar; "Some module          occurs on the
                                            manufacturers              ungrounded pole,
                                            recommend or require       the GFDI cannot
                                            positive or negative       interrupt that
                                            grounding" for thin-       leakage"; below-
                                            film and back-contact      threshold faults
                                            modules; UL 1741           persist; in team
                                            leakage limits 4 A for     operation "the
                                            100 to 250 kW and 5 A      leakage current will
                                            above; the earthed         in the most
                                            pole is unfused            unfavorable case
                                            ("ensure that the          divide over both
                                            grounded DC cables         GFDIs"; "If the DC
                                            are connected to the       main switch is
                                            busbar"; FIMER "fuses      switched off, the PV
                                            on positive pole only");   generator becomes
                                            the UP generation uses     an IT network" and
                                            a "Remote GFDI fuse"       faults are not
                                            with a motorised           signalled until
                                            disconnect                 restart

   Remote GFDI                              Same function,             As above               SMA HE 3.8.3
                                            remotely tripped and
                                            reclosed by motor, "up
                                            to 3 attempts per day",
                                            then treated as
                                            permanent




                                                                                                           Page 17 of 134

---

## PDF page 18 / 134

Earthing, inverter topology and protection in utility-scale solar




   Option                                   What it is                 Documented limits      Source

   Soft grounding                           "grounds one PV pole       Resistor value not     SMA HE 3.8.4
   (high-resistance)                        through a resistor";       published
                                            software measures the
                                            earthed pole-to-PE
                                            voltage and above a
                                            threshold "the
                                            grounding is
                                            disconnected and the
                                            residual current is
                                            interrupted"; reset
                                            after repair

   Floating array with                      Bender A-ISOMETER          Slow against array     SMA HE 3.8.1 and
   IMD                                      iso-PV "connected          capacitance            3.8.5; FIMER
                                            between the PV             (Sandia); night-time   operation manual;
                                            voltage and PE", active    blindness inside the   datasheets
                                            measurement, warning       array; defeated once
                                            and switch-off alarms,     any point is earthed
                                            profiles for crystalline
                                            and thin film; FIMER
                                            "MIRU" insulation
                                            measurement and
                                            "MGND" functional
                                            grounding units with a
                                            "Grounding
                                            supervision"
                                            parameter group;
                                            Sungrow and Power
                                            Electronics "Insulation
                                            monitoring: Yes"




                                                                                                          Page 18 of 134

---

## PDF page 19 / 134

Earthing, inverter topology and protection in utility-scale solar




   Option                                   What it is                Documented limits         Source

   Residual-current or                      Evaluated by Sandia as    An EPC's                  Sandia 2016
   current-sense                            the effective retrofit:   programme
   monitoring on the                        field data from 340       reported by Sandia,
   grounding                                inverters supported       not a controlled trial;
   conductor                                lowering the RCD trip     "simply replacing
                                            from 5 to 2.5 A; an       one fuse with a
                                            EPC's current-sense       lower rated one may
                                            relay at 100 mA with      actually increase the
                                            healthy readings of 5     detection blind
                                            to 50 mA, delay raised    spot" and may void
                                            from 1 to 3 s against     the listing
                                            lightning; "nine fires
                                            under fuse-based
                                            GFDI over six years,
                                            and zero fires after
                                            CSM retrofits over
                                            three years"


The NEC moved with these findings: through the 2014 edition 690.41 required one
conductor of a two-wire array above 50 V to be grounded, or 690.35 ungrounded with
listed inverters and both poles fused, and 690.5 required ground-fault detection,
interruption and indication; the 2017 edition deleted 690.5, defined "functional grounded"
systems in 690.2, listed the permitted array configurations in 690.41(A) and placed the
ground-fault requirement in 690.41(B) (background, not verified against the code text);
Sandia records that its findings "were used by UL to justify lower trip limits, which are
expected in UL 62109-2". Every option interacts with the LV winding: functional grounding
through a GFDI or resistor requires a floating LV winding (SMA "IT grid"; FIMER "Inverter
side must be IT type"; Sungrow Dy11, Dy11y11 or Dy1 with the star point not brought out;
SMA UP stations with "YNd11 or YNy0", the earthable neutral being on the MV side), since
an earthed LV star point with a GFDI-earthed pole would be the loop through the bridge
described above; a floating array with an IMD likewise requires an IT winding or the AC
earth would reference the DC side through the bridge and the IMD would read a fault.
That is the inverse of SMA's string-inverter rule, earthed star point, insulation checked
only before connection, RCMU in operation, which is the architectural fork this report is
about.

Reading a drawing. A GFDI fuse or MCB creates a low-impedance earth reference so that
a fault on the other pole drives array current through the device and trips it ("leakage
current flows through the GFDI back to the grounded pole, which triggers the GFDI"); it
does not detect faults on the earthed pole or below threshold and does not protect
persons. A resistor limits the first-fault current to V/R, keeps the reference and relies on a



                                                                                                              Page 19 of 134

---

## PDF page 20 / 134

Earthing, inverter topology and protection in utility-scale solar




voltage measurement of the earthed pole. An IMD earths nothing in the functional sense;
it superimposes a measuring signal through a high internal impedance, "the measuring
circuit closes when an insulation error occurs", and it sees both poles and the whole
coupled network, slowly and only while the network floats. A surge arrester's PE
connection is not a grounding of the pole: SPDs are varistor or spark-gap devices between
DC+, DC− and PE, non-conducting at system voltage, with a fused or thermally
disconnected branch and a remote contact, drawn as an arrester symbol with
disconnector and alarm contact from both poles to PE. A GFDI is a fuse or MCB symbol
directly from the DC− (or DC+) busbar to the PE bar, rated 1 to 5 A, labelled GFDI, GFP or
"grounding fuse", usually with an auxiliary contact; soft grounding is a resistor to PE with a
voltmeter tap; an IMD is a box marked ISO, IMD or A-ISOMETER connected to L+, L− and
PE with no fault-current rating. A further tell: single-pole DC fusing, fuses on one polarity
only, indicates functional grounding of the other pole (FIMER; SMA one-pole fused array),
while fusing on both poles (Gamesa "fuse +/- monitored"; Sungrow "24 inputs floating")
indicates a floating array.

Contradictions recorded: SMA's UP datasheet lists insulation monitoring as standard for
IEC markets and optional for the US with GFDI optional, regional practice rather than
disagreement; SMA's SHP transformer document requires a "grounded Wye" while its
vector-group table reads YNd, a garbled table against unambiguous prose; the HE
manual's K-characteristic MCB against the UP's "Remote GFDI fuse", a generational
change; the older HE text's "no longer equipped with insulation monitoring" when a GFDI
is fitted against the later combined device, exclusivity per operating state rather than per
product; Sandia's "the ground fault blind spot does not exist" on ungrounded systems
against SMA's "can be destroyed by an ground fault during operation", detection coverage
against fault energy, both true at once; Sandia's "very slow" against SMA's "continuously
measures", continuous polling with a long time constant; and Gamesa's IEC station
"Dy11y11" against its "UL version: Padmounted Dyn" with the neutral brought out, whose
earthing and reconciliation with DC insulation detection the datasheet does not state.
Unverified: the body of the SMA UP manual's grounding chapter; FIMER's parameter
group 210 contents; the NEC 690.41 and 690.5 text and the UL 1741 GFDI ladder; the
common-mode-voltage papers (Kerekes 2009, Gubía 2007) beyond metadata; and any
quantitative data on internal arc energy or clearing time for a grid-fed DC earth fault in a
transformerless string inverter.


Why some manufacturers require AC IT systems
The short answer is that IT operation is a system-design choice, not a necessity of the
transformerless topology, and the choice is driven by anti-PID and by leakage
management when many inverters share one winding. The long answer starts with what




                                                                                      Page 20 of 134

---

## PDF page 21 / 134

Earthing, inverter topology and protection in utility-scale solar




Sungrow actually says, because its manual is the only one that puts a number on the
consequence.

What Sungrow says. The SG285/320/333/350HX manual, Ver24 (September 2025) and the
current online Ver28 (September 2026), is identical on every point below (Sungrow HX
manual, Ver28). The product description says anti-PID "works when the inverter is in grid-
connected operation status during the day or the reactive power generation at night is
enabled", PID recovery "only works when the DC side of the inverter is voltage-free"; for
P-type modules anti-PID "rises the potential of the negative pole of PV array ... to close to
the ground potential through PID module" and recovery "rises the potential between the
negative pole ... and the ground to 500Vdc"; "Make sure the inverter is applied to an IT
system before enabling the anti-PID function"; the N-type case is left to the module
maker. Section 5.6.1 has two separate bullets: "When the transformer is connected to the
IT grid, to-ground withstanding voltage of the LV winding ..., the LV side AC cables, and the
LV side secondary equipment (including the relay protection device, detection &
measuring device, and other related auxiliary devices) should not be lower than 906 V";
and "When Anti-PID is enabled, the AC output common mode voltage of the inverter is
906V ... must withstand the voltage to ground of at least 906 V. If the LV side winding is in
Y shape, neutral point grounding is prohibited. Surge protective devices (SPD) ... are
recommended to be connected in the '3+1' manner ... The Min. continuous operating
voltages of M1 - M4 are 680 Vac." The manual nowhere defines common-mode voltage,
gives no waveform, derivation or test level, never says r.m.s. or peak, contains no TN or TT
statement at all and no N terminal ("Nominal AC voltage 3 / PE, 800 V", range 640 to 920
V). Section 5.5: "Since the inverter is not equipped with a transformer, neither the
negative electrode nor the positive electrode of the PV string can be grounded.
Otherwise, the inverter will not operate normally", with the hedge that other schemes
meeting local standards "may also be adopted. However, SUNGROW shall not be held
liable for any consequence caused thereby."

What 906 V most plausibly is. The derivation is this report's, not Sungrow's. Anti-PID holds
PV-negative near earth while the inverter switches; in a non-isolated boost and three-
phase bridge the DC-link negative is the PV negative, and the average potential of each
AC phase conductor, the common-mode or virtual star-point potential, sits at half the link
voltage above it, up to +750 V DC above earth for a 1,500 V link. Each AC conductor to
earth is then a 50 Hz sinusoid riding on that offset, with r.m.s. √(750² + V_LN²): 881 V at
800 V line-to-line, 906 V at 880 V (800 V plus 10 %, V_LN = 508 V), 919 V at the 920 V top
of the stated range; the peak is 750 + V_LN√2, 1,468 V at 880 V and 1,501 V at 920 V. So 906
V is best read as the combined DC-plus-AC r.m.s. phase-to-earth voltage, an insulation
design figure for the LV side, not a DC dielectric stress and not a defined test level; the
Polish edition's 1,500 V to earth, reported by the earlier pass and not seen by this one, is
numerically the peak of the same waveform at the top of the AC range. Both figures fit
one physical picture and neither edition explains itself. The arithmetic is consistent to


                                                                                       Page 21 of 134

---

## PDF page 22 / 134

Earthing, inverter topology and protection in utility-scale solar




within a volt; the design case Sungrow used is unknown. What Sungrow does state follows
from it: a solidly earthed star point would clamp the offset to zero and the PID source
would drive DC current into the neutral, hence "neutral point grounding is prohibited"
whenever anti-PID is enabled, hence the IT requirement; and the 3+1 SPD arrangement
with 680 V a.c. MCOV varistors fits phase-to-floating-point varistors seeing only V_LN
while a single spark gap to PE carries the DC offset and the IT first-fault voltage.

Each maker's PID scheme and its earthing precondition:


   Maker                          PID scheme                        Earthing precondition      Class

   Sungrow HX                     Daytime anti-PID offset           IT required; LV winding,   Confirmed
                                  while generating (and at          cables and secondary
                                  night with Q-at-night),           equipment to withstand
                                  optional; separate night          at least 906 V to earth
                                  recovery at 500 V DC
                                  with the DC side
                                  voltage-free; an "AC PID"
                                  option via the EMU200A
                                  communication box
                                  whose mechanism was
                                  not readable




                                                                                                           Page 22 of 134

---

## PDF page 23 / 134

Earthing, inverter topology and protection in utility-scale solar




   Maker                          PID scheme                        Earthing precondition       Class

   Huawei                         No PID function in the            IT by the datasheet         Confirmed facts;
                                  196 to 330 kW or 460 to           condition; the 2024 to      day/night inferred
                                  506 kW inverters; done            2026 manuals say the
                                  by the SmartPID2000               inverters support "the IT
                                  module in the array               earthing system in PV-
                                  controller: input "380 V ~        only scenarios" and that
                                  800 V; 3Ph+FE", output            TT, TN-C and TN-C-S are
                                  DC to ground "50 Vdc –            "not recommended"
                                  800 Vdc" at up to 0.5 A,
                                  "one unit supports a 5
                                  MW DC sub-array",
                                  deployable "ONLY ... in
                                  utility installations"
                                  connected to the MV
                                  grid "without neutral
                                  line" (SmartPID2000 EU
                                  datasheet, CN
                                  datasheet); an AC-
                                  busbar injection that lifts
                                  the whole LV network
                                  and, through the bridges,
                                  the arrays; day or night
                                  operation not stated in
                                  any datasheet opened,
                                  the 2020 inverter
                                  manual's "PID protection
                                  at night" implying it is
                                  active at least during Q-
                                  at-night; no LV withstand
                                  figure published, the
                                  same arithmetic giving
                                  about 948 V r.m.s. and
                                  1,520 V peak for an 800 V
                                  lift




                                                                                                            Page 23 of 134

---

## PDF page 24 / 134

Earthing, inverter topology and protection in utility-scale solar




   Maker                          PID scheme                        Earthing precondition     Class

   Solis 215 to                   Built-in night-only anti-         None stated; with the     Confirmed; third-
   255K-EHV-5G                    PID: starts "when the DC          AC relay open at night    party-hosted
                                  bus voltage is below 260          none is needed
                                  Vdc", "is always ON when
                                  AC is applied", "creates
                                  650 Vdc between PV-
                                  and ground", automatic,
                                  open the AC switch
                                  before night
                                  maintenance (Solis
                                  manual Ver 1.2)

   SMA                            No daytime offset in any          None for PID; the         Confirmed
                                  SMA inverter; the PV              inverters themselves
                                  Offset Box raises the             require an earthed star
                                  array "to a high positive         point (below)
                                  potential (between +400
                                  V and +1,000 V to earth)"
                                  at night, under 3 W, "In
                                  principle ... can be
                                  combined with any
                                  inverter" subject to
                                  module and inverter
                                  maker approval (SMA PV
                                  Offset Box TI); SMA's PID
                                  note says "Grounding
                                  the negative pole of the
                                  PV array resolves this
                                  problem" for isolated
                                  inverters and "A PV
                                  Offset Box can be used
                                  for transformerless
                                  inverters that cannot be
                                  grounded" (SMA PID TI)

   Growatt MAX                    "Anti-PID function:               Mechanism, voltage and    Confirmed listing;
   HV, GoodWe                     Optional" (Growatt, with          day/night not described   mechanism
   HT                             warning 219 "PID                                            unknown
                                  function abnormal");
                                  "Anti-PID: Optional" and
                                  a "PID Recovery" row
                                  (GoodWe)




                                                                                                          Page 24 of 134

---

## PDF page 25 / 134

Earthing, inverter topology and protection in utility-scale solar




   Maker                          PID scheme                        Earthing precondition   Class

   Chint CPS,                     "Built-in anti-PID and PID        Unknown                 Unverified;
   Sineng                         recovery" per a                                           absence
                                  distributor page only;                                    confirmed
                                  Sineng lists none


Is IT essential to the topology? No. SMA's Sunny Highpower PEAK3 is "a transformerless
PV inverter", "not equipped with an integrated transformer and therefore has no galvanic
isolation", 1,500 V DC, and yet "The low-voltage side must be configured in a star
formation and the neutral point must be grounded" (SMA SHP manual); Sunny Tripower X
and CORE2 go further, approved for "TN-C, TN-S, TN-C-S, and TT" with "Operation of the
inverter in IT or Delta IT grids is not permitted" (SMA STP X, SMA CORE2). SMA's TT
footnote gives its reasoning: local earthing must have a low-impedance connection to the
transformer earthing, "Otherwise, operational leakage currents can cause potential
differences", "the ground potential at the neutral point of the transformer must be the
same" as at the inverter's PE, and low-impedance neutral earthing done wrongly "can
cause a device defect" outside warranty. Huawei's own history shows the IT preference is
a choice: its 2020 manual for the 90 to 105 kW units says "The SUN2000 supports the IT
power grid", "The SUN2000 can also apply to the AC power system with the neutral point
grounding of the step-up transformer" and "The SUN2000 itself does not connect to any
neutral wire" (Huawei 2020 manual); the 2022 draft for the 330 kW unit says only
"supports IT power grids"; the 2024 to 2026 manuals add "in PV-only scenarios" and the TT
and TN "not recommended" sentence with "contact the Company's engineers". The
reason for the change is not stated anywhere opened. Sungrow ties the neutral
prohibition explicitly to anti-PID being enabled and the 906 V requirement to IT
connection; it never says TN is forbidden without anti-PID, and never says it is allowed.

What IT buys the 1,500 V platforms, each a control or system-design reason: a daytime
common-mode DC offset for anti-PID (Sungrow explicit; Huawei through the AC-injected
module "without neutral line"); suppression of zero-sequence and leakage return paths
with many inverters on one winding (Sungrow: up to 15 per LV winding, "If more than 15
inverters ... contact SUNGROW") and large wet-array capacitance, where SMA, which
earths the star point, must instead cap coupling capacitance at 32 µF for the SHP and 6 µF
for the STP X and specify Type B RCDs of 1,000 to 1,500 mA (confirmed facts; the causal
link inferred); and first-fault ride-through, since on an earthed network a DC-side earth
fault drives grid current through the bridge (SMA: "the current flowing through the
connected utility grid can exceed 1 kA", residual-current monitoring too slow to prevent
damage), while on IT the same fault is limited to capacitive and leakage current and the
plant keeps running, which is exactly the protection question this report tests. The
corollary in the manuals: the insulation test is pre-connection only. Sungrow warns that
closing a DC switch while grid-connected "may be damaged due to the lack of insulation


                                                                                                          Page 25 of 134

---

## PDF page 26 / 134

Earthing, inverter topology and protection in utility-scale solar




impedance detection"; Huawei's 196 to 215 kW manual states that insulation resistance is
not detected when the inverter is grid-tied and a DC switch is turned on (Huawei 196 to
215KTL, portal). So in operation the only watch on a DC earth fault is the RCMU, whose
IEC 62109-2 thresholds are easiest to exceed where a metallic return exists, an earthed
network, and hardest on IT (inferred). Sungrow's per-string "PV Grounding Fault" codes
1600 to 1615 and 1632 to 1655, with the rule not to open the DC switch "when the direct
current is greater than 0.5 A", show that DC earth-fault currents well above RCMU levels
are nonetheless expected on these platforms, a second fault or a fault on the pole
opposite to the one the PID module references.

Alternatives and their consequences. An earthed star with night recovery, the SMA
model: a TN-S collection network, conventional breakers, an RCMU per inverter plus an
optional Type B RCD at 1,000 to 1,500 mA, LV insulation at the ordinary 462 V to earth; the
cost is the array-capacitance limits, more measured leakage current, no daytime anti-PID,
and a PV Offset Box per string group for PID at night. A high-resistance earthed star: none
of the manuals mention it; Sungrow's "other grounding schemes ... may also be adopted"
and Huawei's "contact the Company's engineers" are the only openings; HRG limits the
first-fault current to a few amps and gives a neutral current to measure, but is
incompatible with a daytime DC offset unless the resistor is so large that it is effectively
IT with monitoring, since a 750 V offset across tens of ohms would draw amperes
(background). PID-resistant modules remove the only stated reason for Sungrow's IT
precondition, qualification being IEC TS 62804-1 (background). Isolated or centrally
transformed inverters allow negative grounding, the arrangement SMA's PID note says
"resolves this problem", at an efficiency and cost penalty (background).

Contradictions recorded: SMA's earthed star and "IT not permitted" against Sungrow,
Huawei and GoodWe's IT requirement, different system-design choices on the same
topology; Huawei 2020 ("neutral point grounding of the step-up transformer" acceptable)
against Huawei 2024 to 2026 (TT and TN "not recommended"), cause unknown; Sungrow's
906 V against the Polish 1,500 V, r.m.s. against peak of one waveform (inferred); GoodWe's
"grid structures supported ... are IT" against its "three-phase four-wire or three-phase
five-wire" terminals and a Type A external RCD recommended for excess DC leakage,
which Type A devices are not designed for, likely template text from TN products; Solis's
night-only 650 V with no precondition against Sungrow's daytime offset, a different
mechanism not a contradiction; and fixed insulation thresholds (SMA 50, 33 or 100 kΩ)
against user-adjustable ones with no published default (Sungrow, Huawei). Unverified:
Sungrow's own definition of 906 V and the Polish sentence; the EMU200A mechanism; the
SmartPID2000 user manual (day or night behaviour, exact wording, any LV withstand
figure, the 5 MW basis); any PV-pole grounding prohibition in the Huawei 330 and 506 kW
manuals; SMA's transformer-requirements note carrying its reasoning for the earthed star
(file not found); any laboratory or independent test of the 906 V claim, of IT-network
residual-current behaviour or of PID-module fault paths, none found.


                                                                                      Page 26 of 134

---

## PDF page 27 / 134

Earthing, inverter topology and protection in utility-scale solar




First earth fault: sustained insulation stress
A first fault on an 800 V IT network holds the healthy conductors at 800 V to earth for as
long as nobody finds it, and the standards treat that condition in two different ways: IEC
60502-1 says a 0.6/1 kV cable is still the recommended cable for a system that runs with a
permanent earth fault, because its highest system voltage Um of 1.2 kV is not exceeded,
while the DC offset that anti-PID and DC-pole faults add on these plants, about 906 V
r.m.s. and 1,400 to 1,470 V peak to earth, is a condition no LV AC cable standard
contemplates and the makers must be asked about directly. The second finding is the one
that matters; the first corrects an assumption made earlier in this work.

The voltages, by network (arithmetic from U0 = U/√3; the IT first-fault principle is
confirmed, the figures are derived):


   Condition                                                        690 V        800 V        1,000 V

   Healthy, conductor to earth, r.m.s.                              398 V        462 V        577 V

   After a solid first fault, healthy conductors to                 690 V        800 V        1,000 V
   earth

   Same at +10% supply tolerance (the SG350HX                       759 V        880 V        1,100 V
   accepts 640 to 920 V AC)

   IEC 60364-4-44 stress voltage, HV earth fault                    940 V        1,050 V      1,250 V
   longer than 5 s (U + 250 V on IT)

   IEC 60364-4-44 stress voltage, 5 s or less (U +                  1,890 V      2,000 V      2,200 V
   1,200 V on IT)

   Restriking first fault, 6 to 8 times phase voltage               2.4 to 3.2   2.8 to 3.7   3.5 to 4.6
   (IEEE 142/242)                                                   kV           kV           kV

   Daytime anti-PID offset of 750 V DC with the AC                  849 V        881 V        947 V
   superimposed, r.m.s. to earth

   Same, peak to earth                                              1,313 V      1,403 V      1,566 V

   DC pole-to-earth fault on an operating inverter,                 1,313 V      1,403 V      1,566 V
   AC side peak to earth


The IEC 60364-4-44 figures rest on the rule, confirmed in the Italian national text of HD
60364-4-442, that "in IT systems with a first earth fault the phase voltage U0 is replaced
by the line-to-line voltage" (CEI C.1113), which is where DEHN's 2,000 V for 800 V comes
from; the IEC table itself could not be opened. The restrike figures are oscillatory and




                                                                                                   Page 27 of 134

---

## PDF page 28 / 134

Earthing, inverter topology and protection in utility-scale solar




should be compared with power-frequency withstand levels, not impulse ratings; whether
they transfer to a network with inverter filter capacitors and long buried cable is
unknown.

What 906 V most plausibly is. The manual was not located by this pass and the following is
a reconstruction, not a manufacturer statement: 906 V is numerically the r.m.s.
combination of a 750 V DC offset, half of the 1,500 V maximum PV input, with the phase-
to-earth voltage at 110% of 800 V, √(750² + (1.1 × 462)²) = 905.9 V. That is the common-
mode voltage of an inverter holding PV-negative at earth with full DC input and the grid at
its upper tolerance, expressed in the r.m.s. terms used for cable U0 and transformer
applied-voltage levels; its peak is about 1,470 V, which is where DEHN's 1,450 V test peaks
sit. The 1,500 V in the later edition most plausibly moves the requirement to a peak or DC
basis: once one pole or one phase is earthed, the full PV system voltage is the ceiling of
any conductor-to-earth voltage in the combined system, so requiring 1,500 V to earth is
equivalent to requiring DC-side insulation class on the AC side, which 0.6/1 kV cables,
1,000 V assemblies and 1,000 V breakers do not formally provide. Sungrow's night-time
PID recovery, by contrast, runs only between 22:00 and 05:00 when the array is below 150
V, at a default ±500 V, and is compatible with TN, TT and IT (Sungrow CX PID factsheet);
the daytime and night-time functions are different things and the 906 V belongs to the
first.

How long a first fault persists is set by what is watching. IEC 60364-4-41 recommends
elimination "with the shortest practicable delay" and fixes no time. The cable standard
supplies the engineering yardstick: IEC 60502-1 Category B tolerates a fault of up to 8
hours on any occasion and 125 hours in a year; anything longer, or a system "expected to
operate fairly often with a permanent earth fault", is Category C (IEC 60502-1:2021
preview). On a collection network with no IMD, nothing in the protection scheme is
obliged to see a solid AC first fault: the fault current is the capacitive current of cables
and filters, the inverters sense line-to-line voltage, their residual monitors see only
displacement current through their own arrays, and the pre-connection test never
touches the AC cable. Durations of days to months are credible; no field data were found.

Cable insulation, the correction, and the reading that survives it. IEC 60502-1:2021 defines
U0 as "the rated RMS power frequency voltage between conductor and earth or metal
screen for which the cable is designed", U as the rated voltage between conductors, and
Um as "the maximum RMS power frequency voltage between conductors for which the
cable is designed", and designates cables 0.6/1 (1.2) kV and 1.8/3 (3.6) kV (verbatim from
the IEC 60502-1:2021 preview, clause 4.1.1, re-read on 21 October 2026). U0 is therefore
the cable's design voltage to earth, 600 V, and Um is a between-conductor figure: the 20
% between U and Um is the system's allowance, so a healthy conductor on a balanced
earthed system sees at most Um/√3 = 693 V to earth, the 720 V of U0 × 1.2 being the same
allowance written the other way round. On an IT network with a standing first fault the



                                                                                       Page 28 of 134

---

## PDF page 29 / 134

Earthing, inverter topology and protection in utility-scale solar




healthy conductors sit at the between-conductor voltage to earth, 800 V nominal, 880 V
at plus 10 %, 920 V at the top of the inverter's range: 200 to 320 V above U0, 80 to 200 V
above the 20 % allowance. That is the condition the standard's system categories exist
for, and Table 1, re-read today, recommends for Um = 1.2 kV U0 = 0.6 kV in Categories A
and B and U0 = 0.6 kV in Category C as well; the step-up for Category C begins at Um = 3.6
kV, where the table gives 3.6 kV with the footnote "This category is covered by 3,6/6 (7,2)
kV cables in accordance with IEC 60502-2", and continues through the MV table of IEC
60502-2 (from memory, Um 12 kV: 6 kV for A and B, 8.7 kV for C). So at the 1 kV level the
standard recommends the 0.6/1 kV cable for a system that may run indefinitely with one
phase earthed, provided the between-conductor voltage stays within Um, and says in
Note 3 of the same clause that where a fault is not promptly isolated "the extra stresses
on the insulation of cables during the earth fault reduce the life of the cables to a certain
degree". Two things are therefore true at once: the 800 V IT network with a standing first
fault is inside the standard's Category C envelope for 0.6/1 kV cable, and its healthy
conductors are 200 to 320 V above the cable's design voltage to earth for as long as the
fault stands, which the standard tolerates at the cost of life. Earlier in this work the MV
step-up rule was generalised to LV and the cable was described as falling 200 V short by
the standard; measured against U0 the 200 V is exact at nominal voltage, and what the
standard does not do at this level is require the next cable up. Why it can afford that is in
Table 6, also in the preview: XLPE insulation for 0.6/1 kV is 0.7 mm up to 16 mm², 0.9 mm at
25 and 35, 1.0 at 50, 1.1 at 70 and 95, 1.2 at 120, 1.4 at 150, 1.6 at 185, 1.7 at 240, 1.8 at 300, 2.0
at 400, 2.2 at 500, 2.4 at 630, 2.6 at 800 and 2.8 mm at 1,000 mm², while 1.8/3 kV XLPE is 2.0
mm from 10 to 400 mm² and identical to the 1 kV cable from 500 mm² upward. Thickness at
LV is set by mechanical handling, not by dielectric stress: at 920 V the stress is about 1.3
kV/mm in a 0.7 mm wall and 0.46 kV/mm in a 2.0 mm wall, against 2 to 4 kV/mm in MV
insulation (background), and a 400 mm² feeder has the same 2.0 mm wall whether it is
designated 0.6/1 or 1.8/3 kV; what the higher designation buys on a large feeder is the
higher routine and type test voltages and the maker's declaration, not more insulation.
The margin that does not exist on paper is the service life: 25 to 35 years, in ducts that are
often wet, with repeated or standing Category C episodes and, with anti-PID, an offset of
906 V r.m.s. and about 1,470 V peak on top, outside U0, outside the 900 V DC-to-earth
convention of BS 6724 Annex A and inside the Um peak of 1,697 V by only 13 to 17 %. Water
matters more than the arithmetic suggests: PVC and LSZH sheaths are not water barriers,
XLPE takes up moisture slowly, water lowers the insulation resistance that the IMD reads
for the whole network (the 15 MW farm in section 14 showed insulation resistance and
capacitance moving with weather and time of day), and AC stress with water present is
the condition for water treeing in XLPE, slow at LV stresses but acting over decades; a
wet-season insulation baseline for the IMD setting, drained ducts, a polyethylene rather
than PVC sheath and longitudinally water-blocked conductors are the practical answers,
and a standing first fault in a wet duct is the worst combination the network can be left in.




                                                                                                Page 29 of 134

---

## PDF page 30 / 134

Earthing, inverter topology and protection in utility-scale solar




There is no intermediate option between 0.6/1 kV and 1.8/3 kV in the standard; a cable
rated 1,000 V to earth is a manufacturer's specification, not a standard designation, and it
is the specification these three legs support: the standing first-fault voltage 200 to 320 V
above U0, the DC offset, and the 1,500 V DC requirement that exceeds Um. HD 620 leaves
it to each cable's particular specification to state its intended category; whether HD 603
or BS 7889 restrict 0.6/1 kV cables to Categories A and B was not verified.

What the standard does not contemplate is the DC offset. With anti-PID or a DC pole
fault, the AC conductors sit at 881 to 906 V r.m.s. and 1,403 to 1,469 V peak to earth, which
is above U0, above the 900 V DC-to-earth convention that BS 6724 Annex A allows for
600/1000 V cables (Eland), and at 83 to 87% of the Um peak; a 1,500 V requirement
exceeds Um outright; and a thirty-year PV life under repeated Category C episodes is not
a condition the 1 kV cable standard was written for. These are matters for agreement with
the cable maker by default rather than by rule, and that agreement is the justification for a
higher earth rating on these networks, not Category C. On a 1,000 V network, 1,100 V at
+10% is still within Um but leaves no margin for any offset, and a 1.8/3 kV cable is the
natural choice. Prysmian offers a 1.8/3 kV rubber cable "as interconnection between
central inverter and transformer station" with a 6.5 kV test, and lists its 0.6/1 kV aluminium
XLPE collection cables with a 4,000 V test and no IT statement (Prysmian PV catalogue
2024). The DC string cable is the one element rated for the full system voltage to earth,
1.5/1.5 kV DC with 1.8 kV maximum and a 6.5 kV AC and 15 kV DC test, so the 1,400 V peak
an AC first fault imposes on the PV poles is within its rating; the 0.6/1 kV AC cable is the
asymmetric element.

Nominal rating is not breakdown. An intact 0.6/1 kV XLPE cable, factory tested at 3.5 to 4
kV, does not puncture at 800 V, 906 V, 1,470 V peak or the 2,000 V temporary overvoltage;
restrike transients approach the routine test level. The relevant quantity is ageing,
concentrated at terminations, joints, damaged sheaths and wet, unscreened insulation.
The inverse power law gives electrical life as a steep function of stress, with a voltage-
endurance exponent of roughly 9 to 15 for XLPE, so a 1.73-fold stress raises the purely
electrical ageing rate by two to three orders of magnitude for the duration of the fault,
although at LV stresses the absolute rate is low and "electrical stress itself is not the
dominant aging factor under normal operating conditions" (Energies 2022 review). Water
treeing in directly buried, unscreened, non-water-blocked cable is driven by the field at
the insulation surface, which the first fault raises 1.73-fold; electrical treeing under DC
with superimposed ripple forms more readily than under pure DC, the nearest published
analogue to an anti-PID offset, from needle tests at tens of kilovolts (Energies 2019); and
partial discharge in air at terminations, discharge-free at 653 V peak, can begin at 1,131 to
1,469 V peak. No LV-specific study of any of these on collection cables was found.

The other equipment on the winding, each against the sustained and offset conditions:




                                                                                        Page 30 of 134

---

## PDF page 31 / 134

Earthing, inverter topology and protection in utility-scale solar




  Equipment                      Governing level              Sustained 800      906 V r.m.s. with    2,000 V, 5 s   Designer's
                                                              to 920 V to        DC offset, 1,470 V   TOV            check
                                                              earth              peak

  Transformer LV                 Applied-voltage              Within             Within the test,     Within         State the IT
  winding, Um 1.1                test 3 kV, 60 s                                 but continuous                      connection, the
  kV                             (IEC 60076-3 /                                  DC-biased stress                    sustained line-
                                 -11)                                            to earth is an                      to-earth voltage
                                                                                 untested                            and the DC
                                                                                 condition; no DC                    offset in the
                                                                                 withstand test                      enquiry; a Um
                                                                                 exists in the                       3.6 kV winding
                                                                                 standard                            with a 10 kV test
                                                                                                                     is how margin is
                                                                                                                     bought; note the
                                                                                                                     offset is
                                                                                                                     common-mode
                                                                                                                     and drives no
                                                                                                                     DC through the
                                                                                                                     winding, unlike
                                                                                                                     inverter DC
                                                                                                                     injection
                                                                                                                     (datasheets
                                                                                                                     state below
                                                                                                                     0.5% In)

  LV assembly and                Ui 1,000 V,                  Within, if Ui is   Within (creepage     Marginal       Ui at least U,
  busbars (IEC                   power-                       chosen as U        is referred to       against        pollution degree
  61439-1)                       frequency test               not U0; an 800     r.m.s.)              2,200 V        3 creepage at
                                 2,200 V, Uimp 8              V IT network                                           Ui, Uimp from
                                 kV at                        belongs in the                                         the 1,000 V row;
                                 overvoltage                  1,000 V row                                            1,500 V is
                                 category III                 (ABB TAP 11)                                           outside every
                                                                                                                     AC class

  MCCBs and                      1,000 V class;               Within             Within               Within         Annex H
  isolators (IEC                 IEC 60947-2                                                                         marking and the
  60947)                         Annex H single-                                                                     single-pole
                                 pole breaking at                                                                    short-circuit
                                 line voltage for                                                                    rating at 800 V,
                                 IT                                                                                  usually far
                                                                                                                     below the
                                                                                                                     three-pole Icu;
                                                                                                                     690 V-class
                                                                                                                     devices are
                                                                                                                     excluded




                                                                                                                             Page 31 of 134

---

## PDF page 32 / 134

Earthing, inverter topology and protection in utility-scale solar




  Equipment                      Governing level              Sustained 800       906 V r.m.s. with    2,000 V, 5 s   Designer's
                                                              to 920 V to         DC offset, 1,470 V   TOV            check
                                                              earth               peak

  Surge protective               Minimum Uc on                Within for 880      Above 880 V          Standard       Scheme,
  devices (IEC                   IT, line to PE 1.1           V varistors; a      continuously:        SPDs not       varistor Uc
  61643, HD 60364-               U: 880 V at 800              680 V varistor      thermal-runaway      designed for   against phase-
  5-534 Table                    V, 1,100 V at                conducts at         risk                 it (DEHN)      to-star voltage,
  534.2)                         1,000 V                      the first fault                                         the series gap
                                 (Schneider EIG)              unless it is in a                                       against U0 plus
                                                              3+1 scheme                                              the offset, TOV
                                                              referenced to                                           withstand, and
                                                              the star point                                          the maker's
                                                                                                                      written
                                                                                                                      statement for
                                                                                                                      800 V IT with
                                                                                                                      DC offset

  Current                        Um 0.72 kV                   0.72 kV class is    Outside              Outside        Specify 1.2 kV
  transformers                   class withstand              outside at 880                                          class; the
  (IEC 61869-1)                  3 kV; Um 1.2 kV              to 920 V to                                             practical barrier
                                 class 6 kV                   earth                                                   is the cable
                                                                                                                      insulation
                                                                                                                      through the
                                                                                                                      window

  Voltage                        Rated voltage                Needs the 1.9       Outside unless       Outside        Phase-to-phase
  transformers and               factor 1.2                   factor; a fault     rated for the                       connection or
  PE-referenced                  continuous, 1.9              longer than 8 h     offset                              three-wire
  instruments                    for 8 h on                   exceeds it                                              metering; an
                                 isolated-neutral                                                                     open-delta VT
                                 systems                                                                              also gives the
                                                                                                                      cheapest first-
                                                                                                                      fault detector
                                                                                                                      (59N), absent
                                                                                                                      from most
                                                                                                                      string designs

  Inverter filters               Clearance from               Within by           Within for the       Not stated     Ask the maker
  and relays (IEC                the impulse                  design              inverter's own                      for the AC-
  62109-1)                       category,                                        offset by                           terminal-to-
                                 creepage from                                    construction;                       earth working
                                 the working                                      third-party                         voltage
                                 voltage to                                       equipment and Y-                    assumed and
                                 earth, which on                                  capacitors to PE                    the behaviour
                                 three-wire IT is                                 see it                              on an AC first
                                 the line voltage                                 continuously                        fault with anti-
                                                                                                                      PID active


Contradictions recorded by the pass: the generic "Category C needs a higher U0" rule
against IEC 60502-1 Table 1 at Um 1.2 kV (resolved: the step-up begins at Um 3.6 kV);
Sungrow's Uc of 680 V against Table 534.2's 880 V minimum (scheme-dependent and



                                                                                                                              Page 32 of 134

---

## PDF page 33 / 134

Earthing, inverter topology and protection in utility-scale solar




unresolved without the manual text); the "1% DC component" in the manual against
"below 0.5% In" on the datasheets (probably different quantities, a transformer tolerance
and an inverter emission limit); and Prysmian's 4,000 V test for HD 603 cable against IEC
60502-1's 3.5 kV routine test (different standards). Unverified: the Sungrow manual text
itself in this pass, IEC 60364-4-44 Table 44.A1 verbatim, IEC 60502-1 test values, HD 603
and BS 7889 category statements, IEC 60076-3 Table 2 verbatim, inverter behaviour under
an AC first fault with anti-PID active, whether the AC contactor is open during night-time
recovery, and any field evidence of collection-cable failure attributable to persistent first
faults.


Insulation monitoring: devices, coverage and zones
On a transformerless string-inverter plant the only device that watches the AC collection
network, and the only one that watches anything while the plant generates, is an
insulation monitoring device coupled to the LV winding; the inverter's own functions
cover its array before start-up and current through its own terminals during operation,
and the standards community has given the inverter-integrated function a separate name
(PV-IMF, IEC 61557-8 Annex D) precisely because it is not a system monitor. Evidence
classes below are as the research pass recorded them: confirmed means read in a
primary document, inferred means it follows from confirmed facts and circuit reasoning.

The devices and what each can see:


   Device                           Standard                        Principle          Sees             Does not see

   Insulation                       IEC 61557-                      Superimposes a     Any resistive    Where the fault
   monitoring                       8:2014 Ed. 3                    measuring signal   path to earth,   is; fast events
   device (IMD)                     (Annex C PV-                    on the whole       AC or DC side,   (10 s typical at 1
                                    IMD, Annex D                    galvanically       symmetrical or   µF, slower at
                                    inverter PV-                    connected          not, while       hundreds of
                                    IMF); functional                system and         coupled; trend   µF); measuring
                                    safety IEC                      measures the       and pre-         range falls to 50
                                    61557-15                        resistive          warning          kΩ at 2,000 µF
                                                                    response                            (isoPV1685)
                                                                    (Bender)




                                                                                                                  Page 33 of 134

---

## PDF page 34 / 134

Earthing, inverter topology and protection in utility-scale solar




   Device                           Standard                        Principle           Sees                Does not see

   Insulation fault                 IEC 61557-                      After an IMD        Which feeder        Anything the
   location                         9:2023                          alarm, injects a    carries the         IMD has not
   system (IFLS)                                                    locating current    fault, in under 5   already found; a
                                                                    (2 to 50 mA)        s on a 12-          symmetrical
                                                                    sensed by a CT      channel unit        decline spread
                                                                    on each feeder                          over many
                                                                    (Schneider IFL12)                       feeders;
                                                                                                            whether its
                                                                                                            locating current
                                                                                                            survives
                                                                                                            passage
                                                                                                            through an
                                                                                                            operating
                                                                                                            inverter is
                                                                                                            unknown

   Residual                         IEC 62020-                      Vector sum of       Residual            A first fault on
   current                          1:2020, scope                   conductor           current with a      an IT network
   monitor                          up to 440 V and                 currents; signals   return path         except through
   (RCM)                            125 A; industrial               only                                    capacitance;
                                    units outside it                                                        symmetrical
                                                                                                            decline;
                                                                                                            formally out of
                                                                                                            scope at 800 to
                                                                                                            1,000 V

   RCD types A,                     IEC 60755,                      Vector sum; trips   Second-fault        Any first fault
   F, B, B+                         61008/61009,                                        current with a      on IT;
                                    62423; B+ to                                        return path;        symmetrical
                                    DIN VDE 0664-                                       Type B needed       decline; Type A
                                    400                                                 for smooth DC       is blinded by
                                                                                        and up to 1 kHz     more than 6 mA
                                                                                                            smooth DC

   Ground-fault                     UL 1741, NEC                    Fuse or relay in    Fault current       Faults on the
   detector-                        690.41                          the single earth    through the         grounded
   interrupter                                                      bond of a           bond above its      conductor (the
   (GFDI)                                                           grounded array      rating              blind spot that
                                                                                                            preceded the
                                                                                                            2009 and 2011
                                                                                                            fires, Sandia
                                                                                                            2013); anything
                                                                                                            on the AC side




                                                                                                                     Page 34 of 134

---

## PDF page 35 / 134

Earthing, inverter topology and protection in utility-scale solar




   Device                           Standard                        Principle         Sees               Does not see

   Inverter pre-                    IEC 62109-2                     Resistance        The array and      The AC feeder;
   start                            4.8.2 (PV-IMF)                  measurement       DC-side            anything after
   insulation test                                                  with the grid     internals at       the relay closes
                                                                    relay open        that instant

   Inverter                         IEC 62109-2                     Vector sum at     Current from       Faults with no
   residual                         4.8.3; IEC 63112                the inverter's    its own array or   return through
   current                                                          own terminals     circuits that      the inverter; AC
   monitor                                                                            returns            cabling as such
   (RCMU)                                                                             through its AC
                                                                                      terminals

   Overcurrent                      IEC 60947-2                     Current above     A second-fault     Every first fault
   relay                                                            pickup            loop above         on IT
                                                                                      pickup


Coverage in the four operating states, for a transformerless inverter on an IT winding
(inferred from the device principles above and Bender's description that insulation "is
measured briefly within the string inverters, and only then the switch to grid operation is
made", after which the IT system "comprises the solar panels up to the secondary winding
of the transformer" (Bender PV brochure)):


   State                         Inverter                           Inverter RCMU    IMD on the          Covered by
                                 insulation test                                     winding             nothing

   Before start-                 The array and                      Nothing useful   The AC network:     Nothing, if the
   up, relay                     DC internals,                                       winding, cables,    IMD exists; the
   open                          once                                                disconnects,        whole AC
                                                                                     arresters, up to    network if it
                                                                                     every open relay    does not




                                                                                                                   Page 35 of 134

---

## PDF page 36 / 134

Earthing, inverter topology and protection in utility-scale solar




   State                         Inverter                           Inverter RCMU      IMD on the             Covered by
                                 insulation test                                       winding                nothing

   Generating,                   Nothing; it                        Net current        The whole              Location; small
   relay closed                  cannot run                         through its own    galvanically           per-array
                                                                    terminals; a       connected              degradation
                                                                    resistive DC       system as one          masked in the
                                                                    first fault on a   aggregate, every       aggregate
                                                                    floating           array and feeder
                                                                    network returns    in parallel
                                                                    only through
                                                                    capacitance and
                                                                    may stay below
                                                                    300 mA, so the
                                                                    concept written
                                                                    for an earthed
                                                                    grid is degraded

   After a trip,                 Nothing until                      Nothing            The feeder up to       The faulted,
   relay open,                   the next start                                        the open relay;        still-energised
   array lit                     attempt, which                                        the tripped array      array, visible
                                 then refuses                                          has just left the      only in the
                                 connection and                                        system, so the         inverter's own
                                 cycles if the                                         IMD reads              log if SCADA
                                 fault is                                              healthy                surfaces it; de-
                                 intermittent                                                                 energised
                                                                                                              "practically only
                                                                                                              when it is dark"

   AC isolator                   At most the                        Nothing            The feeder from        The stretch
   open                          inverter and                                          the transformer        between
                                 array, if it                                          to the open            isolator and
                                 chooses to test                                       isolator, still live   relay; the array
                                                                                       from the grid          at night


Three consequences follow and are inferred, not measured. An AC-side first fault is not
seen by any inverter as such: it impresses a 50 Hz displacement of about the phase
voltage on every floating array, which drives roughly 0.145 A per microfarad of array
capacitance through each inverter's terminals, 1.4 A at 10 µF and 14 A at 100 µF, so the
likely sequence is that many inverters trip together on residual current, each passes its
own insulation test, reconnects and trips again, none reports an AC fault, and once all are
off the current ceases and the fault is invisible unless a winding IMD exists; location then
needs an IFLS. The transformer keeps the feeder energised after the inverter has opened
its relay, day and night, so the section between the winding and the relay has exactly one



                                                                                                                        Page 36 of 134

---

## PDF page 37 / 134

Earthing, inverter topology and protection in utility-scale solar




possible monitor. And an IMD on a winding that feeds fifteen to twenty-five inverters
sees the parallel combination of everything connected: twenty wet arrays at 50 kΩ each
read as 2.5 kΩ, indistinguishable from one dangerous array at 2 kΩ in a dry network,
against factory defaults of 10 kΩ pre-warning and 1 kΩ alarm, which is the mechanism by
which recurring morning alarms come to be acknowledged without investigation or the
thresholds raised.

The one-monitor rule is a physical constraint, stated by both major makers and not found
in any IEC text opened. Bender's manuals say "Only one ISOMETER may be connected in a
galvanically connected system" and that with more than one "the device does not work
and does not signal insulation faults" (isoPV1685RTU manual); Schneider's IM20 guide
says "there must be no more than one IMD injecting into the system" (Schneider
IM10/IM20). The inverter's pre-connection test happens while its relay is open, so the
natural sequence avoids interference; the risk arises if an inverter re-tests while
connected or if a per-inverter DC-side IMD is fitted beside a central one. The only
coordination mechanism found in any manual is a standby input on the isoPV1685RTU that
"can enable inverters to operate in tandem"; no document describes a handshake with
any inverter make, which signal drives it, or for how long. There is no "inverter" profile on
the PV units; that profile belongs to the iso685 drive family, while the isoPV1685DP offers
PV profiles up to 500 and 4,000 µF. Each galvanically separate LV winding is its own IT
system and needs its own IMD; two windings become one system only if they are ever
paralleled or share a conductive link.

Voltage range is a selection point at 800 and 1,000 V with DC offsets: the isoPV1685 covers
AC 1,000 V and DC 1,500 V natively with a permissible extraneous DC voltage of 1,500 V;
the iso685 needs a coupling device above 690 V AC or 1,000 V DC, and the AGH150W-4
extends it to 1,150 V AC and 1,760 V DC (AGH150 datasheet); a 1,000 V AC network sits at
the isoPV1685's nominal limit.

Settings collide with range. General IT practice sets the alarm at 100 Ω per volt and pre-
warning at 300 (DIN VDE 0100-530) or 100 and 50 Ω per volt (iso685 manual), which on 800
V is 80 kΩ and 240 kΩ or 40 kΩ; the PV units leave the factory at 10 kΩ and 1 kΩ, IEC 62548-1
accepts 1 kΩ above 500 kW, and at 2,000 µF the isoPV1685RTU cannot read above 50 kΩ at
all, so the conventional settings are unmeasurable and PV networks run at thresholds two
orders of magnitude below other IT practice. Bender's brochure states that suitable
thresholds are defined on site after comparison measurements, which is to say there is no
published PV recommendation. Response times are published numerically only at 1 µF (10
s typical on the isoPV1685DP, up to 90 s on the isoPV485, and the Schneider IM20's 160 s
filter is the one "for photovoltaic applications"); at the hundreds of microfarads of a real
block the manuals offer only a diagram whose values could not be read. The




                                                                                       Page 37 of 134

---

## PDF page 38 / 134

Earthing, inverter topology and protection in utility-scale solar




isoPV1685DP's fault memory, which holds the alarm until manual reset, is off by default,
and BS 7671 411.6.3.1's requirement that the signal continue as long as the fault persists is
therefore a commissioning setting rather than a delivered behaviour.

Specified, installed, functional. IEC 62446-1's table of contents has a functional-test
clause (6.6) and an array insulation-resistance test (6.7) but no clause title that mentions
an IMD or residual-current monitoring; BS 7671 Chapter 64 and IEC 60364-6 require
functional testing of monitoring devices without prescribing a method or interval. The
manufacturers do: Bender's commissioning instruction is to "perform a functional test
using an earth fault via a suitable resistor" at about half the main alarm value, to confirm
that the relays, LEDs and bus alarm operate, and to run a self-test monthly; Schneider's
IM20 self-tests every five hours. That resistor test is also the only way to prove the IMD is
coupled to the right winding and that no inverter has been left injecting against it. Medical
IT systems (IEC 60364-7-710) have an annual functional test and an alarm duty written
down; no PV-sector document opened assigns responsibility for responding to a
collection-network IMD alarm, and IEC 63112's scope frames the operator only as the
recipient of a warning. No audit or case study of IMDs specified but not installed, installed
but not commissioned, or commissioned but ignored was retrievable for PV; the indirect
evidence is the vendor notes that tell technicians to lower inverter thresholds, the factory
default of no latching, and the aggregation arithmetic above.

Contradictions the pass recorded: leakage capacitance per kilowatt differs by an order of
magnitude between Bender (100 µF for about 100 kW) and Schneider (a 1 MWp farm with
"only a few points over 110 µF"), which decides whether a 20-inverter winding needs a 500
µF or a 5,000 µF class device; the isoPV1685DP manual gives one alarm range in its
specification and another in its profile tables; the brochure describes central monitoring
"from the panels" while the device manuals say nothing about coordination with inverter
measurements. Unverified: the text of IEC 61557-8 Annexes C and D, the IEC 63112 type
and level definitions, numeric IMD response at 500 to 4,000 µF, any inverter manual
describing coordination with a central IMD, and whether an IFLS locating current can
traverse an operating inverter to attribute a DC-side fault.


Second earth faults and automatic disconnection
On an IT network the first fault is tolerated and signalled (sections 6 and 7); a second fault
on a different live conductor must be cleared by automatic disconnection, and whether it
will be is a calculation nobody can skip. BS 7671 411.6.4 sets the condition in two forms
according to how the exposed-conductive-parts are earthed. Where they are earthed
individually or in groups the TT conditions of 411.5 apply, because the loop runs through
two electrodes and only a residual or earth-fault device can be relied on. Where they are
interconnected by a protective conductor and collectively earthed, the normal case for a
block whose inverters, combiners and structures all return to the transformer earth, the


                                                                                      Page 38 of 134

---

## PDF page 39 / 134

Earthing, inverter topology and protection in utility-scale solar




TN conditions apply with the loop doubled: 2 Ia Zs ≤ U where no neutral is distributed (U
the line-to-line voltage, 800 V here) and 2 Ia Z's ≤ Uo where one is. Zs is the impedance of
one circuit's line conductor and protective conductor back to the source; Ia is the current
that operates the protective device within the time of 411.3.2.2 for final circuits or 411.3.2.3
for distribution circuits. A 254 A inverter feeder is neither a socket-outlet circuit up to 63
A nor a fixed-equipment circuit up to 32 A, so Table 41.1 does not apply to it and the
permitted time is 5 s under 411.3.2.3 (1 s under 411.3.2.4 where the TT form applies).
Schneider's installation guide states the same mapping for IT: final circuits to the TN or TT
limits, "other circuits in the same interconnected group" to 5 s. Evidence: the substance is
confirmed from Bender's and Schneider's statements of the identical IEC 60364-4-41
clauses (Bender: "ZS ≤ U/(2 × Ia)... Ia is the current that trips the protective device within
the time defined in 411.3.2.2 / 411.3.2.3"; Bender, Schneider EIG); the printed BS 7671 text
was not opened in this pass, the standard being licensed, so every regulation number in
this section carries that caveat.

Edition and numbering. BS 7671:2018+A4:2026 was published on 15 April 2026 and the
A2:2022 edition was withdrawn on 15 October 2026, so A4 is now the only current edition
(IET, NICEIC). Three independent change summaries (SELECT, NICEIC, BEAMA/EDA) list
no change to 411.3.2, Table 41.1, 411.6, 434.5 or Chapter 54; the inference that the IT rules
are unchanged rests on their absence from those summaries, not on the A4 text. What A4
did change that bears on this report: a new 530.3.201 on the appropriate use of
unidirectional and bidirectional protective devices; new indents in 551.7.1 requiring "a
suitable protective device where energy flow is bidirectional"; a redrafted 551.7.2.2 with
four rating options for an assembly fed by parallel generation; "disconnector" and "switch-
disconnector" added to Table 537.4 with Part 2 definitions; 434.2.1 now using the term
"inherently short-circuit proof and earth fault proof"; a redrafted 536.4.202 permitting
load curtailment; and a new Chapter 57 on stationary batteries whose 570.6.7.203
requires a Type B RCD unless there is simple separation or the converter maker states
otherwise. Two numbering cautions. BSI's 2018 changes document records that 411.6 was
reorganised in the 18th Edition, 411.6.4 redrafted and a new 411.6.5 inserted, and that
Chapter 53 was "completely revised"; the brief's "531.2.4" for RCDs in IT systems does not
appear in any 2018 or A4 source opened, and the requirement that an RCD's non-
operating residual current be at least the first-fault current now sits in 411.6.5. The same
BSI document says 411.6.3.1 and 411.6.3.2 were "deleted"; the two passes that opened it
read this as a renumbering of the 17th-Edition text rather than removal of the IMD duty,
since IEC 60364-4-41 retains 411.6.3.1 and Bender and Schneider cite it, but the regulation
number this report has used for "an insulation monitoring device shall be provided" should
be checked against the printed A4 text before it is quoted to anyone (disputed on
number, confirmed on substance). Bender's cautions on RCDs in IT systems stand
regardless of number: they work "in some cases", an RCD "behind the fault location gives
false assurance", two faults on different line conductors look like a load and produce no



                                                                                         Page 39 of 134

---

## PDF page 40 / 134

Earthing, inverter topology and protection in utility-scale solar




residual current unless each item has its own RCD, and DIN VDE 0100-410:2018-10 states
that correct RCD operation in IT systems is not guaranteed (Bender RCD article). ADS is
also not the only permitted route: the 2018 edition added regulation group 419 for cases
where ADS cannot be achieved, with the example "electronic equipment with limited
short-circuit current" (BSI 2018 changes); that is the islanded case, when the transformer
is open and only inverters feed a fault.

Conductor withstand. 543.1.3 sizes a protective conductor by S = √(I²t)/k and 434.5.2 the
line conductor by k²S² ≥ I²t (for faults shorter than 0.1 s the device's let-through I²t is
compared directly); 543.1.4 with Table 54.7 gives the simplified rule behind the inverter
manuals' PE ≥ S/2 (Sph up to 16 mm², SPE = Sph; 16 to 35, 16 mm²; above 35, Sph/2, valid for
the same material and otherwise corrected by k1/k2; Huawei's quick guide adds
"equivalent conductance ... per IEC 60364-5-54" for a different material). Schneider's
guide warns that in IT and TN the thermal minimum "may conflict with the need to
minimise earth-fault loop impedance so that instantaneous overcurrent devices operate
reliably" (Schneider EIG, PE sizing): the PE is sized twice, once for heat and once for loop
impedance, and on long IT feeders the second governs. The k values (IEC 60364-5-54
Tables A.54.2 and A.54.3 as reproduced by Schneider; BS 7671 Tables 54.2, 54.3 and 43.1
carry the same figures):


   Conductor                                                        Copper PVC /   Aluminium PVC /   Steel PVC /
                                                                    XLPE           XLPE              XLPE

   Separate PE, insulated or bare in                                143 / 176      95 / 116          52 / 64
   contact with the cable sheath

   PE as a core of the cable or bunched                             115 / 143      76 / 94           —
   with it

   Line conductors (Table 43.1)                                     115 / 143      76 / 94           —


The fault study. The second-fault pass rebuilt the reference block independently of
section 16 and the two sets of figures bracket each other. Assumptions: two 4.95 MVA 800
V windings on one 33 kV transformer, 9.5 % impedance on the winding base (the only
base consistent with a busbar fault near 37 kA; on the full 9.9 MVA it would be about 75
kA), X/R 10, the 33 kV source infinite with a 500 MVA sensitivity; 400 mm² aluminium XLPE
single cores at 0.0778 Ω/km (20 °C) and 0.0998 Ω/km (90 °C) with 0.10 Ω/km reactance;
protective conductor 240 mm² aluminium (S/2 of 400 rounded to a standard size; 185 mm²
as the sensitivity) at 0.125 and 0.160 Ω/km; feeders 100 and 150 m; voltage factor c = 1.0
(IEC 60909 brackets with 1.05 or 1.10 for maximum and 0.95 for minimum currents); IEC
60076-1 allows ±10 % on the declared impedance. One arithmetic check first: 25 to 28
inverters at 254 A is 6.4 to 7.1 kA, above a 4,000 A ACB and above the 3,572 A rating of one




                                                                                                           Page 40 of 134

---

## PDF page 41 / 134

Earthing, inverter topology and protection in utility-scale solar




winding, so the block only makes sense with the inverters split across the two LV
windings, 12 to 14 per ACB, which is how section 16 models it; the conclusions do not
depend on the count.


   Case (c = 1.0)                                                            Current

   Three-phase fault at the busbar                                           37.6 kA (34.1 kA with a 500 MVA 33 kV
                                                                             source; 41.8 kA at −10 % impedance
                                                                             tolerance)

   Line-to-line at the busbar                                                32.6 kA

   Inverter end of a 100 m feeder, grid-fed only:                            19.3 / 16.7 kA
   three-phase / line-to-line or two faults in one
   enclosure

   Inverter end of a 150 m feeder: three-phase /                             15.3 / 13.3 kA at 20 °C; 14.6 / 12.6 kA at 90 °C
   line-to-line

   Second fault between two 100 m feeders                                    10.3 kA at 20 °C; 9.5 kA at 90 °C
   through two 240 mm² PEs

   Second fault between two 150 m feeders                                    7.6 kA at 20 °C; 6.9 kA at 90 °C; 6.3 kA with
                                                                             185 mm² PEs

   Feeder end against the busbar enclosure or                                16.0 kA (100 m); 12.6 kA (150 m)
   transformer LV compartment

   Two 150 m feeders, hot, with added path                                   6.1 / 5.2 / 4.0 / 2.7 / 1.4 / 0.74 kA
   resistance 0.02 / 0.05 / 0.10 / 0.20 / 0.50 / 1.0 Ω


Section 16's model gives 6.6 kA at 100 m and 5.2 kA at 150 m for the same feeders because
it takes a 200 mm² PE at 0.206 Ω/km, 50 mΩ of bonding resistance and a 500 MVA source;
this pass takes a larger PE at two temperatures, no bonding resistance and an infinite
source. The spread, 5 to 10 kA for one feeder length, is itself the finding: the second-fault
current depends on the PE size, its temperature, the bonding path and the source more
than on anything a single-line diagram shows, and both models put it between 1.3 and 2.6
times the rating of a shared 4,000 A ACB. At 0.10 Ω of path resistance, a few bolted
structure joints or one corroded bond, the loop current equals the ACB's rating and is
indistinguishable from load.

Thermal withstand of the conductors in the loop, k²S² and the time to reach it:


  Conductor                                                 k²S²     at 37.6      at 17       at 10   at 7.5     at 4 kA
                                                            (MA²s)   kA           kA          kA      kA

  400 mm² Al line, k 94                                     1,414    1.0 s        4.9 s       14 s    25 s       88 s




                                                                                                                           Page 41 of 134

---

## PDF page 42 / 134

Earthing, inverter topology and protection in utility-scale solar




  Conductor                                                 k²S²         at 37.6   at 17    at 10    at 7.5   at 4 kA
                                                            (MA²s)       kA        kA       kA       kA

  240 mm² Al PE, k 94                                       509          0.36 s    1.8 s    5.1 s    9.0 s    32 s

  240 mm² Al PE, k 76 (PVC)                                 333          0.24 s    1.2 s    3.3 s    5.9 s    21 s

  185 mm² Al PE, k 94, or 120 mm²                           ≈300         0.21 s    1.0 s    3.0 s    5.3 s    19 s
  Cu, k 143

  16 mm² Cu bonding jumper, k 143                           5.2          —         —        —        —        0.33 s (2.7 s at 1.4
                                                                                                              kA)


The bonding conductors, not the PE, are the thermally weakest element of a second-fault
loop that runs through structure: a 16 mm² jumper carrying 4 kA fails in a third of a second,
long before any long-time element notices. At the other end of the scale an ACB with a 0.3
s short-time delay lets through about 424 MA²s at 37.6 kA, above the 302 MA²s of a 185
mm² aluminium or 120 mm² copper PE at the busbar end and 83 % of a 240 mm² PE's
withstand, so the delay must be 0.2 s or less or the busbar-end PEs enlarged.

Inverter contribution. What the makers publish, and the one independent measurement
set:


   Source                                                       Figure                               Class

   SMA Technical Information                                    Surge current ip up to 5 × Imax      Confirmed,
   "Short-Circuit Currents" v2.2                                amplitude from the grid filter, "a   manufacturer test data
   (Iscpv-TI-en-22)                                             current peak with a duration of
                                                                max. 40 μs"; initial symmetrical
                                                                current Ik'' up to 1.4 × Imax
                                                                r.m.s., "will not last longer than
                                                                50 ms"; sustained Ik = 1 × Imax
                                                                "during the entire duration of
                                                                the voltage dip" with full FRT,
                                                                zero with partial FRT; example
                                                                SHP 150-20 (Imax 144.3 A): ip
                                                                318 A, Ik'' 170 A, Ik 151 A;
                                                                "comparable to the
                                                                characteristic values defined in
                                                                DIN EN 60909"

   GoodWe GT 150 kW manual                                      "Max. Output Fault Current           Confirmed
   V1.2, Dec 2025 (manual)                                      (peak and duration): 460 A for 5
                                                                μs", about 2.1 × rated




                                                                                                                         Page 42 of 134

---

## PDF page 43 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                       Figure                               Class

   Sungrow SG350HX                                              "AC short-circuit protection:        Confirmed absent
   datasheets V5 (2023) and V22                                 Yes"; no magnitude or duration
   (2024); Huawei SUN2000-                                      published
   185KTL-H1 datasheet

   NREL/TP-550-46698, Keller                                    Literature: one to two times         Confirmed,
   and Kroposki, 2010 (NREL)                                    full-load current for one cycle      independent, dated
                                                                or less; a 500 kVA unit tested at
                                                                2 to 3 times rated peak for 1.1 to
                                                                4.25 ms; about 1.2 times steady
                                                                state for seven cycles under
                                                                LVRT; inverters "provide
                                                                minimal fault current
                                                                contributions"


For device operation the contribution is at most 1.4 × Imax for 50 ms and then about 1 ×
Imax for the ride-through window, which the grid code sets and which can run to seconds;
the 2 to 5 times sub-cycle peaks matter only for making and peak withstand. Fourteen
inverters give about 3.6 kA sustained and 5.0 kA for 50 ms; section 16's 1.2 × In for a few
cycles sits inside that envelope. The apparent contradiction between "1.1 to 1.5 times" and
"2 to 5 times" is peak against r.m.s., not a disagreement. IEC 62109-2 as a source of any
fault-contribution requirement was not located.

When a conventional device may not clear within 5 s. Six cases, each from the arithmetic
above unless cited:

 1. Long feeders, small or hot PE: the bolted two-feeder loop falls from 10.3 kA (100 m,
      cold) to 6.3 to 6.9 kA (150 m, hot, 185 to 240 mm² PE). A 4,000 A ACB's long-time
      element cannot reach 5 s at 1.6 to 1.7 × In; only a short-time pickup at about 1.5 × Ir,
      roughly 5.4 kA, would see it, and the 0.8 voltage factor of the conventional method (5.5
      kA) leaves no margin.
 2. Resistance in the path: at +0.1 Ω the loop current equals the ACB rating and is load; at
      +0.5 Ω, 1.4 kA, a 260 A MCCB is at 5 × In in its thermal region, tens of seconds; at +1 Ω,
      0.74 kA or 2.8 × In, an MCCB may take over a minute while the path dissipates about
      half a megawatt. HSE's offshore sheet describes exactly this: "A second fault may not
      operate fuse or circuit breaker protection if the fault impedance limits the current
      below the trip level", faults then accumulate, and at switchboard incomers the current
      "may be as high as several thousand amperes" (HSE IS2/2011).
 3. Inverter tripped: only the transformer feeds, and the figures above are the grid-fed
      values; the inverter's exit removes a small contribution and does not reduce the grid-
      fed current.



                                                                                                                    Page 43 of 134

---

## PDF page 44 / 134

Earthing, inverter topology and protection in utility-scale solar




 4. Device location: a device at the inverter end sees the grid-fed current only for faults
      downstream of it, inside the inverter; for a fault on the feeder cable it sees its own
      inverter's 1.4 × In at most and does not trip. The feeder cable is protected only by the
      device at the busbar or combiner end.
 5. Fault upstream of the ACB, at the transformer LV terminals or tails: the ACB and every
      feeder device see only reverse inverter current, at most 1.4 × In each; clearance
      depends on the inverters' undervoltage and anti-islanding protection and on the 33 kV
      protection.
 6. Voltage rating: at 800 V many MCCB, ACB and fuse families are at or beyond their 690
      V class; breaking capacities at 800 V are well below the 415 V catalogue values and
      some frames are not rated at all. The declared Icu at 800 V, not at 415 V, is the figure to
      use (background knowledge; to be verified against the devices).

Whether one 4,000 A ACB can protect the 254 A feeders. Breaking capacity first: an ACB
marked 36 kA is below the 37.6 kA busbar level on the stated impedance (34 kA with a 500
MVA source, 41.8 kA at the tolerance limit), and 434.5.1 requires the breaking capacity to
be at least the prospective current at the point of installation unless backup is declared;
whether the 36 kA is Icu, Ics or Icw, and at what voltage, has to be read off the certificate,
and the transformer's test-certificate impedance and the actual 33 kV fault level decide
which side of the line the block falls. Overload: an ACB at Ir ≈ 3,600 A can never protect
one 400 mm² feeder (Iz of the order of 600 A) against overload, which is acceptable only
because the inverter limits its own output, 433.3.1(ii) "not likely to carry overload current".
Fault protection at the far end: three-phase and phase-to-phase faults at 150 m (12.6 to
15.3 kA, 3.2 to 3.8 × In) are within reach of a short-time or instantaneous setting; the two-
feeder second-fault loop (6.3 to 7.6 kA, 1.6 to 1.9 × In) is not, unless Isd is set at 1.3 to 1.5 × Ir,
which removes all margin for the 0.8 factor, conductor temperature, PE size and any joint
resistance, and sacrifices selectivity so that every feeder fault drops the whole winding.
Faults through structure, at or below 4 kA, are invisible to the ACB. Conclusion: one ACB
cannot be shown, with normal engineering margins, to satisfy 2 Ia Zs ≤ U within 5 s for the
far end of 150 m feeders, nor to clear resistive second faults, nor to protect the PE
thermally with a long short-time delay. A per-feeder device at the busbar or combiner
end, a 315 to 400 A fuse or an MCCB with instantaneous pickup at 2 to 4 kA, gives Ia(5 s)
of 1 to 3 kA against a bolted loop of 6.3 to 10 kA (a margin of two to seven times), detects
structural-path faults down to about 1 kA, clears in under 0.1 s with I²t far below the PE
withstand, confines the outage to the faulted feeder, and leaves the system in a defined
first-fault state for the IMD. Even per-feeder devices do not see faults above about 1 Ω;
that residual band belongs to the IMD and, where fitted, per-feeder residual-current or
earth-fault relays. Selectivity between 315 to 400 A feeder devices and the ACB is
straightforward (ACB Isd at or above about 1.6 times the downstream instantaneous
setting, tsd 0.1 to 0.2 s, confirmed from the maker's tables as 536 requires); backup
protection under 434.5.1 and 536, a lower-rated downstream device behind an upstream


                                                                                              Page 44 of 134

---

## PDF page 45 / 134

Earthing, inverter topology and protection in utility-scale solar




one whose let-through it can withstand, is often the only way to use MCCBs on a 37 kA
busbar at 800 V and must be a manufacturer-declared combination. Direction matters: for
a feeder fault the bus-end device sees the transformer plus the other inverters, the
inverter-end device only reverse-fed inverter current; MCCBs, ACBs and fuses are non-
directional, but A4's 530.3.201 and 551.7.1(c) now require suitability for bidirectional flow,
and some RCDs and MCBs marked line/load are unidirectional.

Correctly cleared against catastrophic. A correctly cleared second fault is bolted or low-
resistance, above the instantaneous pickup of a per-feeder device, gone in under 0.1 s
with I²t well inside k²S² for phase, PE and bonding; one feeder is lost and the system
returns to the first-fault state with the IMD alarm standing until the first fault is repaired
(Schneider notes that a double fault "may trip only one circuit, leaving the system in a
first-fault state"). A catastrophic one is limited by its path to 0.5 to 4 kA, below the ACB's
pickup and in the thermal region of any MCCB, dissipating kilowatts to a megawatt at
joints and in 16 to 25 mm² bonding conductors that melt in under a second at 4 kA, arcing
at the fault, with 800 V standing on the healthy phases to earth throughout. HSE records a
severe injury during fault tracing on an unearthed system and advises identifying "parts
of the IT system where large short-circuit currents could be hazardous".

Contradictions recorded: the brief's "531.2.4" against the 2018 renumbering (content now
411.6.5; any surviving Chapter 53 number unknown); Bender attributing RA × Id ≤ 50 V to
411.6.4 in one place and 411.6.2 in another, and Schneider's UPS page using the pre-2005
numbering 413.1.5 (the condition is 411.6.2); the block arithmetic of 25 to 28 inverters
against one 4,000 A ACB; the 36 kA ACB against a 37.6 kA calculated busbar level (base of
the 9.5 %, source impedance, or a marginal rating; the test certificate decides); and the
two models' second-fault currents (PE size, temperature, bonding and source
assumptions, not method). Unverified: the verbatim A4 text of 411.6.1 to 411.6.5, 411.3.2.3
and .4, 433.3.1, 434.2, 434.3, 434.5, 536.4, 543.1.3 and .4; the current Chapter 53 number for
RCD selection in IT systems; the 36 kA ACB's Icu, Ics and Icw at 800 V and the ratings
actually available at 800 V in MCCB, ACB and fuse ranges; the block's cable reactances,
PE material and size, and bonding resistances; the ride-through duration under the
applicable grid code, which sets how long inverter-fed current persists after the ACB
opens; and IEC 62109-2's provisions, if any, on output fault current. The arithmetic for this
pass is kept in a working file alongside section 16's model.


Load-break switches versus circuit-breakers
The question underneath this section is whether a drawing that shows a switch where a
specification says "MCCB per inverter" is a deviation, a non-compliance or neither, and
the answer depends on what each device can do and on the fault study of section 8, not
on the symbol.




                                                                                       Page 45 of 134

---

## PDF page 46 / 134

Earthing, inverter topology and protection in utility-scale solar




What each device is. The definitions below are Schneider's statements of IEC 60947-3 and
60947-2 (Schneider EIG, switching devices, circuit-breaker characteristics); the formal
IEC 60947-1 wording was not opened.


   Device                                                 What it does                        What it cannot do

   Disconnector (isolator),                               "Connecting and                     Make or break any current
   AC-20                                                  disconnecting under no-load
                                                          conditions"; a "dead system
                                                          switching device to be
                                                          operated with no voltage on
                                                          either side"; must withstand
                                                          short-circuit current, generally
                                                          for 1 s

   Switch (load-break                                     "A non-automatic two-position       "It does not consequently,
   switch), AC-21 / AC-22 /                               device" that closes and opens       provide any protection for
   AC-23                                                  "loaded circuits under normal       the circuit it controls";
                                                          unfaulted circuit conditions";      "Upstream protective
                                                          fault-make rated; AC-21             devices are relied upon to
                                                          resistive loads with moderate       clear the short-circuit
                                                          overloads (1.5 In at cos φ 0.95),   fault"
                                                          AC-22 mixed loads (3 In at
                                                          0.65), AC-23 motor and highly
                                                          inductive loads (make 10 In,
                                                          break 8 In); A for frequent, B
                                                          for infrequent operation

   Switch-disconnector                                    A switch that in the open           Automatic protection
                                                          position satisfies the isolating
                                                          requirements of a
                                                          disconnector; A4:2026 adds
                                                          the term to Table 537.4 with a
                                                          Part 2 definition

   Fuse-switch and switch-                                Switch plus gG fuses (the           Adjustable settings; remote
   fuse                                                   fuse-link forms the moving          or shunt trip unless a
                                                          contact in a fuse-switch); gG       striker-operated release is
                                                          fuses "provide protection           fitted; leaves a single-
                                                          against overloads and short-        phasing risk after one fuse
                                                          circuits", aM against short-        operates
                                                          circuits only; high breaking
                                                          capacity, low I²t; "No short-
                                                          circuit current-making rating is
                                                          assigned to fuses"




                                                                                                                  Page 46 of 134

---

## PDF page 47 / 134

Earthing, inverter topology and protection in utility-scale solar




   Device                                                 What it does                       What it cannot do

   MCCB, category A                                       Makes, carries and breaks          Intentional short-time
                                                          under normal and short-circuit     delay for selectivity
                                                          conditions; Icu "the maximum
                                                          fault-current a circuit-breaker
                                                          can successfully interrupt
                                                          without being damaged" (O–t–
                                                          CO), Ics a percentage of Icu
                                                          after which it is "immediately
                                                          available for reclosure" (O–
                                                          CO–CO), Icm the making
                                                          capacity (2.2 × Icu at cos φ 0.2
                                                          for Icu ≥ 50 kA); "no deliberate
                                                          delay" of the instantaneous
                                                          trip, no Icw

   ACB and heavy MCCBs,                                   As above with Icw, the current     Protect a single 400 mm²
   category B                                             withstood "thermally and           feeder against overload
                                                          electrodynamically, without        when rated for the whole
                                                          sustaining damage" for a           winding
                                                          stated time, enabling a short-
                                                          time delay; preferred durations
                                                          0.05 to 1 s and minimum Icw of
                                                          12 In or 5 kA (30 kA above
                                                          2,500 A), background
                                                          knowledge

   Protective relay, IEC 60255                            Measures and issues a trip         Interrupt anything; it needs
                                                          command                            a breaker or contactor with
                                                                                             a shunt or undervoltage
                                                                                             release, which is what
                                                                                             SMA's planning approach of
                                                                                             external relay plus external
                                                                                             switching device amounts
                                                                                             to

   Inverter grid-monitoring                               Load switching on the              Fault interruption; the
   relay and output contactor                             inverter's own decision            inverter's electronics
                                                                                             cannot interrupt grid-fed
                                                                                             current into an internal
                                                                                             fault




                                                                                                                  Page 47 of 134

---

## PDF page 48 / 134

Earthing, inverter topology and protection in utility-scale solar




   Device                                                 What it does                     What it cannot do

   DC-PV1 / DC-PV2 (EN                                    DC-PV1 "Switching of single PV   These are DC-side
   60947-3)                                               string(s) without reverse and    categories; AC-side
                                                          overcurrents"; DC-PV2            inverter isolation uses the
                                                          "Switching of several PV         AC categories
                                                          strings with reverse and
                                                          overcurrents" (IMO brochure)


In one line: switches, switch-disconnectors, fuse-switches, MCCBs, ACBs and contactors
interrupt load; disconnectors and relays do not; MCCBs, ACBs and fuses protect
automatically; switch-disconnectors, disconnectors, contactors and relays alone do not;
and a switch-disconnector can be relied on for fault clearance only within its conditional
short-circuit current or Icw with the declared upstream device (IEC 60947-
3:2020+A1:2025 now carries "conditional short-circuit ratings for devices protected by
upstream circuit breakers", from a vendor summary).

When an inverter feeder may rely on an upstream device. BS 7671 permits it, under
conditions that are verifiable and must be verified. Overload protection may be omitted
under 433.3.1 where the conductor "is not likely to carry overload current" "because of the
characteristics of the load or the supply" or is "effectively protected against overload by a
protective device installed on the supply side", and under 433.3.3 where "unexpected
disconnection of supply could cause danger or damage" (NICEIC 2024); a current-limited
inverter on a 400 mm² feeder satisfies the first. Fault-current protection may sit upstream
of a reduction in cross-section under 434.2 provided the intervening conductor is
protected by it and the installation conditions are met, and may be omitted under 434.3
for conductors "connecting a generator, transformer, rectifier, battery to its associated
control panel, the protective devices being installed in the panel", subject to minimised
fault risk and no proximity to combustible material (verbatim unverified); A4 renames the
434.2.1 condition "inherently short-circuit proof and earth fault proof". The upstream
device must then meet 434.5.1 (breaking capacity) and 434.5.2 (k²S² ≥ I²t) at every point
of the feeder, satisfy 2 Ia Zs ≤ U within 5 s under 411.6.4 for the worst second-fault loop, be
coordinated under 536 (selectivity "where necessary to prevent danger", backup
"according to the manufacturer's information", and a switching device without integral
overcurrent protection "shall be coordinated with an appropriate overcurrent protective
device"; IET Wiring Matters 2012, 17th Edition numbering), and leave a means of isolating
each inverter on the AC side under 537 and 712.537, so a switch-disconnector per inverter
is required in any case. The manufacturer's instructions are to be taken into account
under 134.1.1 and 510.3, so a departure from a "one device per inverter" instruction needs
the maker's written acceptance and a recorded design departure; and A4's 551.7.1(c)
requires "a suitable protective device where energy flow is bidirectional".




                                                                                                                Page 48 of 134

---

## PDF page 49 / 134

Earthing, inverter topology and protection in utility-scale solar




What the makers actually require. Huawei's quick guide for the 75 to 115 kW SUN2000
units (Huawei quick guide, Issue 02, 2023): "Each inverter must be equipped with an AC
output switch. Multiple inverters cannot connect to the same AC output switch", no
ampere rating, the switch to be selected "in accordance with local industry standards and
regulations", a switch exceeding Huawei's recommendation "may not turn off in time
during an exception", and PE at least S/2 with equivalent conductance for another
material. The word is switch, not breaker. GoodWe's GT manual: "Install one AC output
circuit switch for each inverter. Multiple inverters cannot share one AC circuit switch",
with a circuit breaker or fuse on the AC side rated at least 1.25 times the rated output
current (a reference 315 A breaker for the 150 kW unit), RCD use "decided by local laws
and regulations" with reference ratings of 1,000 to 1,500 mA, and an integrated RCMU;
GoodWe therefore accepts a fuse. SMA's PEAK3 datasheet lists "AC short-circuit current
capability" and an all-pole-sensitive RCMU, gives no breaker rating and no fault-current
figure, and says nothing about neutral earthing; its short-circuit data are in the Technical
Information quoted in section 8 and its external-relay trip path is the earlier finding, not
re-opened here. Sungrow's SG350HX datasheets state "AC short-circuit protection: Yes"
and "AC switch: No" with no breaker rating; the 400 A breaker per inverter and PE = S/2 in
the user manual are the earlier finding, and the manual could not be fetched in this pass.
Solis was not researched. None of the opened documents states that the device must
have overcurrent protection as a condition of warranty, nor why sharing is prohibited; the
evident reasons are isolation of one unit for maintenance, protection of the inverter and
its feeder against grid-fed current into an internal fault, and avoiding a device oversized
for any single unit.

Can "an MCCB per inverter" be met another way. A fuse-switch-disconnector with gG
fuses, AC-22 or AC-23, rated for 800 V, provides isolation, load switching, overload and
short-circuit protection with high breaking capacity and low I²t; it lacks adjustable
settings and remote trip and leaves the single-phasing risk, which the inverter's
unbalance protection normally covers. Functionally it meets or exceeds the protective
purpose of an MCCB; contractually it is a deviation unless the specification says "MCCB
or equivalent"; it satisfies Huawei's and GoodWe's "switch" wording and GoodWe's
"breaker or fuse". A bare switch-disconnector relying on the ACB meets the isolation and
switching requirement but not per-feeder protection; it is acceptable under BS 7671 only if
the fault study shows, for every feeder, that the ACB clears the far-end second-fault loop
within 5 s with margin, protects phase and PE thermally, has adequate breaking capacity
at 800 V, that the switch's conditional short-circuit current with that ACB is declared, and
that the maker's dedicated-device requirement is met or formally waived. For 150 m
feeders at 800 V behind a 4,000 A ACB the first of those cannot be shown with normal
margins (section 8), so a bare load-break switch does not meet an "MCCB per inverter"
specification in substance. The configuration that does everything asked is a switch-
disconnector at the inverter end with a fuse or MCCB per feeder at the combiner or



                                                                                        Page 49 of 134

---

## PDF page 50 / 134

Earthing, inverter topology and protection in utility-scale solar




busbar end: it protects the feeder cable (which only a bus-end device can do), protects
the inverter against backfeed, gives selectivity, provides local isolation, and meets the
makers' wording.

The checking method, per feeder and per block:

 1. Fault levels to IEC 60909, maximum and minimum: three-phase, phase-to-phase and
      the IT second-fault loop at both ends of every feeder and at the busbar, using the
      transformer's test-certificate impedance and its tolerance, the 33 kV fault level,
      conductor temperature, the actual PE size and material and measured bonding
      resistances; add the inverter contributions (ip for peak, Ik'' for 50 ms, Ik for the ride-
      through window) from the maker's short-circuit data.
 2. Device ratings at 800 V: Icu or Ics, or fuse breaking capacity, at least the maximum
      prospective current at the point of installation (434.5.1) or a manufacturer-declared
      backup combination; Icm or peak withstand at least the asymmetric peak including
      inverter ip; for switch-disconnectors, the conditional short-circuit current and Icw with
      the actual upstream device (536).
 3. Thermal: the device's let-through I²t (fuse) or I² × (tsd + opening time) (ACB, MCCB) at
      the maximum fault, against k²S² of the phase conductor (434.5.2, Table 43.1) and of the
      PE and bonding conductors (543.1.3, Tables 54.2 to 54.6).
 4. Sensitivity and time: the minimum second-fault loop current at the far end of the two
    longest feeders, with the 0.8 factor if the conventional method is used, at least Ia(5 s)
      of every device in the loop (411.6.4, 411.3.2.3); the feeder-against-busbar and same-
      enclosure cases as well; and the band of path resistance no overcurrent device covers,
      assigned explicitly to the IMD or RCM.
 5. Time-current coordination: the inverter-end device, any combiner device and the ACB
    plotted together; selectivity limits from the maker's tables; the ACB short-time delay
      checked against item 3.
 6. First fault: RA × Id ≤ 50 V with the actual leakage of the connected inverters and cables
    (411.6.2); one IMD to IEC 61557-8 per galvanically separate system with its alarm acted
      upon; and whether the inverters' internal AC-side "insulation monitoring" is an IMD in
      this sense, which is unknown.
 7. Earthing topology: every exposed-conductive-part (inverters, combiners, structures
    carrying equipment) interconnected by PE to the transformer earth so that the TN
      form of 411.6.4 applies; any group earthed only through its own electrode falls under
      the TT form and needs a residual or earth-fault device sized above the first-fault
      current (411.6.5).
 8. Bidirectionality and isolation: devices suitable for bidirectional current (530.3.201,
    551.7.1(c)); an AC isolation point per inverter (537, 712.537); any RCD used for fault
      protection to be Type B unless the maker declares otherwise (712.411.3.2.1.2).




                                                                                           Page 50 of 134

---

## PDF page 51 / 134

Earthing, inverter topology and protection in utility-scale solar




A drawing without an MCCB symbol at the inverter does not by itself prove non-
compliance: BS 7671 permits omission and relocation of protection under verifiable
conditions, a fuse-switch or a combiner-mounted device may be drawn with a different
symbol or on another sheet, and the makers ask for a dedicated "switch" (Huawei,
GoodWe) or "breaker" (Sungrow). What decides compliance is the fault study, the device
data at 800 V and the maker's acceptance. The converse holds too: an MCCB symbol at
the inverter end does not prove the feeder cable is protected, because that device sees
only inverter current for a cable fault.

Unverified in this pass: the verbatim text of 433.3, 434.2, 434.3, 536.4 and 537 in A4:2026;
the IEC 60947-1 definitions and the Icw preferred durations and minima; the DC-PV0
definition and the 2020 and 2025 changes to IEC 60947-3; the Sungrow SG350HX and
Huawei 330KTL-H1 manual wording; SMA's planning-guideline wording on the external
relay and switching device; Solis's requirements; and which MCCB, ACB and fuse families
are rated at 800 V and at what Icu.


DC string protection and combiner-box failures
The fuse-free two-strings-per-MPPT design is sound only while three conditions hold:
exactly two strings share an input, the module's reverse-current rating stays above 1.25
times one string's short-circuit current, and the inverter input cannot feed the DC-link
current back into a string. Modules at 18 to 23 A with 30 to 35 A fuse ratings have eroded
the second margin to about 1.3 times, and the third is a design feature no manufacturer
document opened in this pass states explicitly. The DC-grounding options and their blind
spots are in the central-inverter section.

When string fuses are required. The NEC rule, as Mersen explains it, is that the maximum
circuit current is 1.25 times module Isc (690.8) and the overcurrent device carries at least
125% of that (690.9), the familiar 1.56; one string needs no fuse if its cable is rated for 1.56
Isc, two strings need none while the available current does not exceed the conductor
ampacity or the module's maximum fuse rating, and with three or more "fusing is
required" (Mersen TT-PVPN5). The IEC rule in Mersen's statement of it is that one or two
parallel strings need no fuse and that the unfused limit is N ≤ 1 + I_RM/I_SC, where I_RM is
the module's maximum reverse current, the series-fuse rating on the datasheet, against
which IEC 61730-2 tests the module at 135% for two hours (Mersen HelioProtection); the
IEC 62548-1 clause numbers were not opened in this pass. Applied to the reference
module, 18.4 A Isc and a 35 A fuse rating: two strings per MPPT put at most about 18 A, 23
A at 1.25 times irradiance, backwards through a faulted string, below 35 A, so neither code
requires a fuse and the SG350HX's 60 A per-MPPT rating exceeds 46 A; three strings
would put 37 to 46 A through one and fuses would be required. Were fuses fitted, 1.56 ×
18.4 gives 28.7 A, a 30 A link, 32 A after a 50 °C derating, still under the 35 A ceiling.




                                                                                             Page 51 of 134

---

## PDF page 52 / 134

Earthing, inverter topology and protection in utility-scale solar




How the makers justify it, and where it stops holding. Huawei's 2016 training deck states
"No DC fuse" because "each MPPT short circuit current is less than 10A when fault
happened in PV" and "the IGBT can withstand the current", while the same deck's tables
give 25 and 32 A maximum short-circuit current per MPPT for those models; its C&I page
repeats "one MPPT for every two PV strings" and argues fuses fail from fatigue and
derating after the fourth year, without data (Huawei 2016 deck). GoodWe's SMT page
offers a "fuse-free design without consumable parts" with a 15 A per-string limit, below
the Isc of current modules (GoodWe SMT). Fronius's Tauro Direct variants take up to eight
strings on one input and are therefore fused, 20 or 30 A per string with per-string limits of
14.5 and 22 A, and offer arc detection only on the 20 A option (Fronius Tauro Direct);
whether Huawei's current utility models with four or five strings per MPPT carry fuses
was not established. Fuses themselves are gPV links to IEC 60269-6 with a low minimum
breaking capacity, a conventional fusing current of 1.35 In for two hours, a voltage rating of
at least 1.2 times string Voc, and holders derated from 0.92 at 50 °C to 0.48 at 90 °C with
the instruction "Do not operate under load"; a correctly sized string fuse sees faults at 1.1
to 1.5 times its rating and opens in hours, not seconds, because its purpose is to interrupt
a persistent reverse overload at full voltage, not to clear a bolted fault. Both the fuse
makers and the fuse-free makers agree that daily thermal cycling in hot enclosures ages
fuse elements and holders; the field failure rate is unknown from independent data.

DC isolators. The usual category is DC-21B, tested at 1.5 times rated current with a 1 ms
time constant; DC has no current zero, so PV switches put poles in series at roughly 500 V
per pole and larger units add arc chambers, and EN 60947-3 now has DC-PV1 and DC-PV2
categories for PV switch-disconnectors, the second covering switching under reverse-
current conditions (ETI, Eaton); the TÜV/Fraunhofer guideline warns that "switchgear
designed for conventional DC sources cannot necessarily shut down a PV generator".
Because an array delivers at most about 1.25 Isc into a bolted fault, the fault-breaking duty
is barely harder than load-breaking; the real differentiators are full-voltage breaking with
poles correctly in series, reverse polarity after a fault, and weather performance. Australia
is the natural experiment: AS/NZS 5033 mandated rooftop DC isolators from 2012, the
Clean Energy Regulator's 2020 inspections found 1.7% of 2018 installations unsafe or
potentially unsafe with "water ingress in DC isolators" the biggest threat, isolators were
blamed for almost half of module fires, and the 2021 edition removed the mandate; state
data for 2022 to 2023 still showed 27 isolator fires in Victoria out of 64 rooftop solar fires,
attributed to a lack of servicing (pv magazine Australia 2021, 2023). BRE's UK finding that
isolators were the largest single item is consistent.

Failure mechanisms, each with its evidence:




                                                                                       Page 52 of 134

---

## PDF page 53 / 134

Earthing, inverter topology and protection in utility-scale solar




   Mechanism                                    What the sources establish            Evidence class

   DC arcing                                    Arcs persist "as long as the          Confirmed
                                                voltage and current suffice";
                                                series arcs are lower in energy
                                                and harder to notice because
                                                "the system seems to continue
                                                running normally"; a parallel arc
                                                needs damage to two conductors
                                                and the Lorentz force moves it
                                                away from the modules; arc
                                                power is roughly constant in the
                                                low-current region and a DC arc
                                                has no zero crossing
                                                (TÜV/Fraunhofer guideline,
                                                Artale 2020); Johnson's ignition
                                                model finds UL 1699B trip times
                                                sufficient for 100 to 1,200 W arcs
                                                (Sandia 2014); the EPRI/National
                                                Grid test model gives incident
                                                energy as 0.0012 × Isc × time at
                                                45.7 cm with a 300 V arc
                                                (EPRI/National Grid)

   Arc detection limits                         UL 1699B (1st edition 2018,           Confirmed scope; inferred
                                                effective 2020) tests series arcs     consequence
                                                and unwanted tripping; IEC
                                                63027:2023 "does not cover the
                                                detection of parallel arcs";
                                                inverter noise can mask arcs or
                                                cause false trips and long cables
                                                act as antennas; a 24-string
                                                inverter must find a 300 to 900 W
                                                arc inside a 350 kW spectrum,
                                                and interruption at the inverter
                                                removes only series-arc current,
                                                a parallel or earth arc fed by the
                                                string continues until it is shaded
                                                or opened (UL 1699B notice, DIN
                                                EN IEC 63027)




                                                                                                             Page 53 of 134

---

## PDF page 54 / 134

Earthing, inverter topology and protection in utility-scale solar




   Mechanism                                    What the sources establish           Evidence class

   Connector cross-                             IEC 62548:2016 7.3.9 and IEC         Rule confirmed; field evidence
   mating                                       60364-7-712 712.526 require          largely manufacturer- and
                                                mated connectors "of the same        insurer-held
                                                type from the same
                                                manufacturer"; UL 6703 devices
                                                are not assessed with other
                                                makers' parts; NEC 690.33(C)
                                                requires listing for
                                                intermateability; the mechanism
                                                is differing thermal expansion of
                                                the contacts leading to corrosion
                                                and rising resistance over years
                                                (Stäubli 2021); independent
                                                evidence is thin, one 2016 case of
                                                serial fires on about 2 MW with
                                                non-genuine connectors and an
                                                insurer's exclusion (pv magazine
                                                USA) and an owner's engineer
                                                reporting mismatch on about a
                                                quarter of projects

   Water ingress and                            Confirmed for isolators (CER         Confirmed for isolators;
   corrosion                                    2020); connector IP ratings apply    inferred for connectors
                                                only when fully mated with the
                                                right cable and gland torque;
                                                unmated connectors and open
                                                caps are the ingress path;
                                                "leaking SPDs are common in
                                                older PV systems" (NREL field
                                                guide)

   Cable abrasion and                           Cables were the culprits at          Confirmed cases; inferred
   chafing                                      Bakersfield and Mount Holly; on      mechanism
                                                trackers the damage points are
                                                the flexing loops at the torque
                                                tube and bundles on tray edges;
                                                the first result is a ground fault
                                                on one conductor, which on an IT
                                                network raises only an alarm until
                                                a second fault or an arc develops




                                                                                                                Page 54 of 134

---

## PDF page 55 / 134

Earthing, inverter topology and protection in utility-scale solar




   Mechanism                                    What the sources establish            Evidence class

   Loose terminations                           Falling contact pressure raises       Confirmed
                                                resistance, then heating, fusion
                                                and an arc (guideline); the
                                                canonical series-arc case

   Fuse holders                                 Spring clips relax under cycling,     Inferred; no independent
                                                the holder not the fuse becomes       statistics
                                                the hot spot, polymer creeps and
                                                the holder melts or arcs when
                                                operated; derating and "do not
                                                operate under load" are the
                                                maker's acknowledgement

   Surge arresters in DC                        IEC 61643-31 tests end-of-life        Standard requirements [K];
   combiners                                    under the array's unfusable           mechanism inferred
                                                short-circuit current and
                                                requires a disconnector; a
                                                degraded MOV runs away
                                                thermally and sustains an
                                                internal arc if the disconnector
                                                cannot clear the PV-limited
                                                current; Mersen's units carry a
                                                "dynamic thermal disconnection
                                                system optimised for DC"

   Switching under load                         Fluke: clamp the circuit before       Confirmed instructions;
                                                opening any non-load-break            inferred reason
                                                device, since a hidden ground
                                                fault can flash over "when a fuse
                                                holder is opened or a conductor
                                                is pulled from a terminal" (Fluke);
                                                Huawei: on a reversed string
                                                "wait for weak light"; Sungrow:
                                                below 0.5 A or wait until night; on
                                                a floating array with a standing
                                                fault the load at a connector
                                                includes an earth-return path a
                                                series clamp cannot measure,
                                                which is why the makers say
                                                shade or wait rather than
                                                measure and pull




                                                                                                                Page 55 of 134

---

## PDF page 56 / 134

Earthing, inverter topology and protection in utility-scale solar




Reading an SPD's earth against intentional grounding. An SPD's PE lead is a surge path
only: its varistors are high impedance at working voltage, so the array stays unearthed. On
a drawing it appears as a varistor block, two or three elements, often marked Y, with DC+,
DC− and PE terminals, a disconnector symbol and a type note (T1 or T2, IEC 61643-31,
Ucpv). Intentional grounding appears as a conductor from one pole to the earth bar
through a fuse or breaker marked GFDI or GFP (1 to 5 A per the NREL table), a resistor for
high-resistance grounding, or a relay inside the inverter boundary marked functional
earthing or PV− grounding; an ISO or IMD symbol marks an IT design. In the field, a pole at
about zero volts to earth in operation means intentional grounding; roughly half of Voc on
each pole means a floating array; a GFDI fuse holder is the signature of the grounded
topology whose blind spot caused the two reference fires.

A forensic method for damaged combiners, inverters and structures, from NFPA 921, the
ATF's arc-mapping bulletin, the TÜV/Fraunhofer guideline and the fire-service literature
(ATF 2017, Firehouse 2016). Make safe without destroying evidence: assume every string
and bus live in daylight, shade or wait for darkness rather than operate switches or pull
connectors, and photograph switch handles, fuse-holder positions, SPD indicators and
connector states before anyone touches them. Preserve inverter and SCADA logs at once;
proprietary event stores can be lost at power-down and usually need the maker's tool,
which is the first documented point of manufacturer involvement. Separate electrical
from thermal damage: an arc bead on a DC conductor proves it was energised at that
time, not that the fire started there, because PV conductors stay energised through a fire
and arc wherever insulation burns away; a hole in steel with a bevelled rim and spatter
indicates a sustained arc root, which a parallel arc can carry metres from the initiating
fault; melted aluminium and connector contacts need only an ordinary fire. Establish
direction and sequence from heat shadowing, oxide colour and char depth, then from the
logs: insulation alarms and their values, which on an IT array usually precede any fire by
days, residual-current and arc events, string-current series (a series arc shows as a drop
or noise with the inverter otherwise normal; a parallel or earth arc as steps or trips),
tracker position, wind and rain. Record protective-device states, including internal
contact positions, an opened GFDI fuse, string fuses opened at the element rather than
melted by fire, and SPD flags, remembering that fuses may have been replaced with
higher ratings. Obtain the commissioning and periodic insulation-resistance records as
the baseline, reading relative changes rather than absolute values. Photograph and
preserve witness marks: tie and tray-edge abrasion, burn-through at structure contacts,
connector halves left mated and bagged as pairs for X-ray before opening, half-insertion,
mixed maker marks, pin pitting, crimp fusing, moisture lines and copper salts, gland
orientation, holder clip tension, lug torque lines. Treat manufacturer failure analysis as
party evidence and hold destructive examination under a joint protocol. The common
misattributions are reading the most damaged component as the origin, reading victim
arcs as cause, equating an opened fuse or a hole in steel with ignition, calling



                                                                                      Page 56 of 134

---

## PDF page 57 / 134

Earthing, inverter topology and protection in utility-scale solar




condensation water ingress, blaming the connector when the chafed cable upstream
initiated, defaulting to lightning, adopting an assessor's attribution without evidence, and,
on IT networks, overlooking the first fault that was logged and tolerated for days before
the second.

The two reference investigations show the method. At Bakersfield in 2009, a 383 kW roof
array ran with a 2.5 A fault on a 12 AWG conductor because the fault was below the GFDI
threshold, which UL 1741 sets at 1 to 5 A by inverter size, and because faults on the
grounded conductor shunt the bond and are invisible to the fuse; when a feeder joint
separated and a 311 A fault followed, the GFDI opened and the array's return current was
left with the 12 AWG conductor as its only path. The mechanism was established by
finding two physically distinct fault sites, the opened GFDI fuse, overcurrent heating
along the small conductor rather than a localised arc, and currents reconstructed from
the array topology, in Brooks's analysis for SolarABCs, whose text could not be opened in
this pass. Mount Holly in 2011 followed the same pattern at headline level, an undetected
fault on the grounded conductor and a second on the ungrounded one, with the primary
report also unreachable, and Sandia's blind-spot simulations were written because
"multiple fires have started when ground faults went undetected" (Sandia 2013). The
GFDI blind spot does not exist on an unearthed array with insulation monitoring, but its
structural lesson does: a first fault the protection tolerates, an insulation alarm below the
threshold, a 0.5 A leakage, a half-mated connector, turns a later ordinary fault into a fire,
and the forensic task is to find the earlier tolerated event in the logs and the hardware.

Contradictions recorded: Huawei's "less than 10 A" against its own 25 to 32 A per-MPPT
ratings (a tolerance statement for an earlier module generation, not a reverse-current
analysis); Mersen's "at least 1.4 × Isc" against the IEC 62548 range of 1.5 to 2.4 and the
NEC 1.56 (different documents; the installation standard governs); GoodWe's 15 A per-
string fuse-free claim against 18 to 23 A modules; the guideline's "much more likely a serial
arc" against Huawei's "more than half of plant fires from ground faults" (different
populations, and a ground fault often ends as an arc). Unverified: the IEC 62548-1 clause
numbers for the string-OCPD rule and fuse range, IEC 61730-2 test parameters, UL 1699B
arc power and trip values, IEC 60947-3 DC-PV category definitions, EN 50618 ampacity
tables, IEC 61643-31/-32 requirements, TÜV Rheinland cross-mating laboratory data, NFPA
921's PV section numbering, and the Bakersfield and Mount Holly primary reports.


Transformer failures and possible fault propagation
The honest headline first. No public failure-rate statistics exist for the transformer class in
question, 33 kV, 5 to 10 MVA, multi-winding inverter step-up units. Both CIGRE reliability
surveys cover 69 or 100 kV and above only, the 2024 survey states that wind and solar
data were "not enough ... to make statistically significant conclusions", insurers publish no
transformer line item for PV, and the operator maintenance datasets report no


                                                                                      Page 57 of 134

---

## PDF page 58 / 134

Earthing, inverter topology and protection in utility-scale solar




transformer figures. The documented PV step-up transformer failures in the public
domain are a handful of case histories, and in none of them is the LV earthing
arrangement described or an IT first or second fault identified as the cause; the
mechanisms offered are harmonics (unmeasured or vendor-measured), switching
transients ("no data to confirm"), overloading and quality control. Transformer explosions
must therefore not be presented as widespread, and IT second faults must not be
presented as a principal cause. The defensible statement is that the mechanism is
plausible, undetected by transformer protection, and unsupported by failure evidence
either way.

What the population data say. CIGRE TB 642 (2015) found 964 major failures over 167,459
transformer-years at 58 utilities in 21 countries, a rate of about 0.53 % a year for
substation units and 0.95 % for generator step-ups, with windings the failure location in
38 to 48 % of cases and dielectric "the most significant failure mode"; its scope is HV
power transformers with no PV, inverter-duty or distribution-class sub-population (CIGRE
TB 642). TB 939 (October 2024) covers more than 425,000 transformer-years at 100 kV
and above, finds "the failure rate has now fallen by more than half", and records that
renewable data were sought and were insufficient (CIGRE Electra 336). IEEE C57.159-
2016, the guide on transformers for distributed PV, is a guide with no failure statistics; its
revision as a standard for distributed PV transformers was approved in February 2024
with no completion date, and its clause content on harmonic spectra, DC offset, daily
cycling and winding connection is background knowledge until checked against the
paywalled text. GCube's five years of claims across more than 100 GW give "electrical
failures (19 % of total claims and 3.5 % of total costs)" with no transformer breakdown (pv
magazine, GCube 2023); HSB's general ten-year study puts line surge first and insulation
deterioration second with failed units averaging 17.8 years, but is not PV-specific; AEGIS's
2025 lessons-learned deck carries two renewable transformer losses, neither PV, both
traced to quality control or commissioning (AEGIS 2025); the NREL/Sandia analysis of
55,000 corrective-maintenance records at 880 sites finds inverters in 33 % of records and
transformers only as topics inside inverter tickets (IEEE Access 2020). A 2023 CIGRE
colloquium paper from India states the gap plainly: "very little information is available on
the Inverter Duty Transformer (IDT) failures at national and international levels."

The case histories, none naming a site and none describing the LV earthing:




                                                                                       Page 58 of 134

---

## PDF page 59 / 134

Earthing, inverter topology and protection in utility-scale solar




   Case                                                   What was reported                What it does and does not
                                                                                           show

   Forensic case study, June                              Three incidents on one           Conclusion offered is
   2026 (Envista)                                         electrical section within a      harmonics as "the most
                                                          year: an abrupt in-service       probable contributing factor"
                                                          failure, a replacement from      with the spectrum "outside
                                                          another maker failing at         the investigation's scope", so
                                                          commissioning with               unmeasured; the neutral-
                                                          insulation and tap-changer       current reference implies an
                                                          damage, a rebuilt unit           earthed point somewhere; LV
                                                          removed within hours for         arrangement not described,
                                                          "arcing-like" sounds;            so uninformative on IT stress.
                                                          teardown found "No               Occurrence confirmed,
                                                          carbonization, tracking,         mechanism unverified
                                                          loose connections, or
                                                          mechanical damage"; oil
                                                          samples from all units,
                                                          including a non-failed one,
                                                          showed gas patterns of
                                                          thermal stress and arcing;
                                                          "no protective devices had
                                                          operated"; earlier
                                                          assessments found
                                                          "grounding irregularities and
                                                          unintended current paths"
                                                          and equipment was added to
                                                          stabilise neutral currents

   CIGRE Sendai 2023, South                               About a dozen plants             Authors suspect switching
   India survey (paper)                                   commissioned 2013 to 2021;       transients but say "no
                                                          roughly three reported step-     investigation or data is
                                                          up failures (the paper's own     available to conclude the
                                                          table is inconsistent); one      same due to the lack of power
                                                          12.5 MVA unit with an inter-     quality monitoring"; they cite
                                                          turn fault; one site with a 28   a 2012 multidisciplinary
                                                          MVA unit, delta on 11 kV and     analysis (not opened) in
                                                          star on 380 V (central           which standard tests "did not
                                                          inverters, inferred), "10 %      reveal any deficiency".
                                                          Overloading ... continuously     Occurrence confirmed,
                                                          for prolonged periods" and       mechanism unverified
                                                          temporary external cooling




                                                                                                                  Page 59 of 134

---

## PDF page 60 / 134

Earthing, inverter topology and protection in utility-scale solar




   Case                                                   What was reported                What it does and does not
                                                                                           show

   Vendor case, PAC World,                                Three 11 kV grid-side            Grid-side units, not inverter
   January 2025                                           transformers at a substation     step-ups; author sells the
                                                          serving three solar farms        measurement hardware;
                                                          failed after further farms       internal inconsistencies; no
                                                          were connected; attributed       raw data. Disputed
                                                          to switching harmonics
                                                          around the 60th to 80th
                                                          order, invisible to 4 kHz
                                                          meters, mitigated by
                                                          synchronising inverter
                                                          switching

   ASTESJ 2021, South Africa                              One 2.5 MVA PV step-up           Not a failure; single unit;
                                                          with severe stray gassing        model-based. Unverified
                                                          after about 4 % of predicted     cause
                                                          life (H2 1,478 ppm);
                                                          attributed to under-design
                                                          for the harmonic hot spot
                                                          plus oil stray gassing

   Victoria, Australia,                                   Transformer fire at a            Type, rating, inverter type and
   February 2025 (pv                                      commercial solar farm, ten       cause not stated; no finding
   magazine Australia)                                    fire units attended, under       located. Occurrence
                                                          Energy Safe Victoria             confirmed, cause unknown
                                                          investigation

   EC&M, March 2023                                       A large solar farm with a zig-   Confirms that earth-fault
   (protection, not a failure)                            zag earthing transformer         settings are omitted from
                                                          suffered nuisance earth-         coordination studies in
                                                          fault trips because grid         practice
                                                          voltage imbalance drove
                                                          neutral current rising with
                                                          daytime output; the
                                                          coordination study "covered
                                                          only phase overcurrent, with
                                                          no proposed ground-fault
                                                          settings"




                                                                                                                    Page 60 of 134

---

## PDF page 61 / 134

Earthing, inverter topology and protection in utility-scale solar




   Case                                                   What was reported             What it does and does not
                                                                                        show

   Wind precedent                                         EnerNex reports VCB           Confirmed for wind, not
                                                          switching transients "have    demonstrated for PV
                                                          caused transformer
                                                          failures"; CIGRE TB 577 and
                                                          IEC 60076-16 followed
                                                          (background)


Mechanisms, each with its signature and whether it is IT-specific:


   Mechanism                                    Signature                  Evidence             IT-specific?

   Internal arcing and                          Acetylene or               Dominant mode in     Generic; the IT
   winding insulation                           hydrogen in DGA,           HV surveys; the      pathway of an
   breakdown                                    Buchholz gas or            Indian inter-turn    undetected first
                                                surge, differential        case; Envista gas    fault to core or tank
                                                or overcurrent trip,       patterns             followed by a second
                                                inter-turn damage                               fault is plausible and
                                                on teardown                                     undocumented

   Mechanical forces                            Leakage-reactance          No PV case found     Partly: on IT the first
   from repeated                                or FRA shift,                                   current-carrying
   through-faults                               loosened windings,                              event is a double
                                                failure some time                               fault whose current
                                                after a fault (IEEE                             is loop-limited,
                                                C57.109,                                        usually below a
                                                background)                                     bolted phase-to-
                                                                                                phase fault; not
                                                                                                inherently worse
                                                                                                than TN




                                                                                                                Page 61 of 134

---

## PDF page 62 / 134

Earthing, inverter topology and protection in utility-scale solar




   Mechanism                                    Signature             Evidence                IT-specific?

   Harmonic heating                             High winding or oil   Envista (opinion),      No; identical on TN
   (IEEE C57.110, K-                            temperature at        PAC World (vendor),
   factor)                                      moderate load,        the single-unit
                                                thermal gases,        gassing study, one
                                                discoloured paper,    FEA design paper;
                                                hot spot under-       string inverters
                                                read by a thermal-    typically run THDi
                                                image WTI             under 3 % with 16 to
                                                                      20 kHz switching
                                                                      behind LCL filters,
                                                                      so the open
                                                                      question is kHz
                                                                      residue, which the
                                                                      h² law overstates

   DC bias and core                             Second harmonic       Limits: IEEE 1547-      Partly: with no LV
   saturation                                   in magnetising        2018 0.5 %, IEC         neutral, zero-
                                                current, hum rising   61727 1 %, VDE-AR-      sequence DC cannot
                                                with output, no-      N 4105 0.5 % or 20      flow, only line-to-line.
                                                load loss, hot        mA, G99 0.25 %          Anti-PID shifts the
                                                clamps and tank       (background); a         system potential to
                                                                      2019 study found        earth, an insulation
                                                                      two of three            stress not a winding
                                                                      inverter types          current, and biases
                                                                      above 20 mA             the core only if an
                                                                      (Danisense 2023); 1     earth path exists, a
                                                                      % of a 4.95 MVA         standing first fault
                                                                      800 V winding is        with an earthed
                                                                      about 36 A per          reference, which is
                                                                      phase, several times    worth flagging and
                                                                      a core's magnetising    undocumented
                                                                      current, so the limit
                                                                      is a ceiling not a
                                                                      benign level; typical
                                                                      injection is tens of
                                                                      milliamps to a few
                                                                      amps of random
                                                                      polarity across 12 to
                                                                      14 units




                                                                                                              Page 62 of 134

---

## PDF page 63 / 134

Earthing, inverter topology and protection in utility-scale solar




   Mechanism                                    Signature              Evidence              IT-specific?

   Ferroresonance                               Primary                Confirmed for         Delta-primary units
                                                overvoltages of 2      distribution; no PV   at no load every night
                                                to 4.7 pu after        case                  are textbook
                                                single-phasing a                             susceptible if single-
                                                lightly loaded,                              phased by a single-
                                                cable-fed, delta-                            pole fuse; three-pole
                                                primary unit (TNB                            striker-tripped
                                                Research)                                    switch-fuses or
                                                                                             VCBs make it
                                                                                             unlikely. On the LV IT
                                                                                             side there is no non-
                                                                                             linear element
                                                                                             between star point
                                                                                             and earth, so classic
                                                                                             neutral instability is
                                                                                             not expected unless
                                                                                             59N detection VTs
                                                                                             are added without a
                                                                                             damping resistor

   Switching transients                         Turn-to-turn failure   Hitachi ("Current     No; MV-side,
   and VCB reignition on                        in the line-end        chopping could        independent of LV
   the MV side                                  discs, failure         cause both multiple   earthing
                                                shortly after          reignitions and
                                                switching, PD at       virtual current
                                                the line end           chopping"),
                                                                       EnerNex, wind case
                                                                       studies; suspected
                                                                       in the Indian paper

   Moisture and                                 Rising water-in-oil,   TB 939 on breathing   No
   contamination from                           low dielectric         systems (HV fleet);
   daily cycling                                strength, leaking      C57.159 on gaskets
                                                gaskets, seasonal      and connections
                                                failures               (background); high
                                                                       contact resistance
                                                                       in the Envista case




                                                                                                            Page 63 of 134

---

## PDF page 64 / 134

Earthing, inverter topology and protection in utility-scale solar




   Mechanism                                    Signature              Evidence           IT-specific?

   Inadequate                                   MV relays and          EC&M case; the     Yes for first-fault
   protection                                   fuses blind to loop-   arithmetic below   invisibility and the
   coordination                                 limited LV faults;                        loop-limited double
                                                earth-fault settings                      fault
                                                omitted; re-
                                                energising into a
                                                standing fault


The three IT questions. First, does a persistent first fault stress the LV winding? In steady
state the healthy phases and the winding rise from 462 to 800 V to earth, 1.73 pu, which
against the Um 1.1 kV class's 3 kV one-minute power-frequency test (about 4.2 kV crest;
no impulse requirement at this class, IEC 60076-3 and -11, background) is about 27 % of
the test value, so steady-state stress alone is not a credible failure driver for oil or cast-
resin main insulation; with the anti-PID offset the 906 V figure remains well under the test
level. Transients are another matter: IEEE 242-2001 8.2.5 warns of "possible severe over-
voltages to ground, which can be as high as six to eight times phase voltage" for
intermittent or restriking faults, others give five to six times or "can exceed 5 per unit ... if
restrikes occur in quick succession" (SEL 2014, Bowen 2011); applied to 462 V that is 2.8 to
3.7 kV r.m.s. or 3.9 to 5.2 kV crest, comparable to or above the routine test, although one
field record on an ungrounded system logged 485 events above 700 V with a 1,050 V peak,
far below the theoretical bound (I-Gard); IEEE 141 7.2.1 states that "the over-voltage
incidents associated with ungrounded operation reduce the useful life of insulation".
Verdict: a sustained restriking first fault is a cumulative stress on the 1.1 kV winding and
on inverter AC stages (reasonably inferred); whether it has ever caused a PV transformer
failure is unknown. One modifier: on a string-inverter network the first fault displaces the
DC side too, the inverters' residual-current monitors are expected to trip them within a
fraction of a second, so the fault is unlikely to be silent in daylight, but it stays invisible to
every transformer protection and persists on the energised winding, with cable
capacitance only, until located. Second, can a second fault's current path through earth
and tank damage tank or bushing? Only if one of the two faults is at the transformer, a
bushing-to-tank flashover or winding-to-core fault; a bolted path through tank steel and
earth conductors carries kiloamperes without damage, while an arcing fault at an 800 V
bushing left in the blind zone for seconds delivers energy of order 0.5 to 1 MW times
seconds, megajoule class, enough to destroy an LV terminal box or bushing and produce
gas surges, generally below the multi-megajoule energies CIGRE TB 537 associates with
tank rupture (background). Galvanically separate LV windings do not form a loop with one
fault on each; a short circuit needs two faults on the same winding; an inter-winding LV1 to




                                                                                                         Page 64 of 134

---

## PDF page 65 / 134

Earthing, inverter topology and protection in utility-scale solar




LV2 insulation failure would merge the two IT systems with no current and no alarm. Third,
is there a credible published link between IT faults and transformer damage? None was
found.

Protection response to each event, for a typical 5 to 10 MVA, 33 kV unit:


   Device                                     LV first fault           Loop-limited double        Notes
                                                                       fault (2 to 8 kA)

   Buchholz                                   Nothing for an           Surge or pressure          Background
   (conservator units)                        external fault; a low-   trip within about 0.1      knowledge
   or DGPT2 and                               energy internal          s if one fault is inside
   sudden-pressure                            winding-to-core arc      the tank, even when
   (hermetic units)                           may give a gas-          overcurrent devices
                                              accumulation alarm       are blind; dry-type
                                              after hours or days      has no equivalent
                                              and acetylene in
                                              DGA, the only
                                              transformer-side
                                              detection with any
                                              sensitivity to a first
                                              fault

   Differential 87T                           Zero differential        Seen if one fault is       Not usual below
                                                                       inside the CT zone         about 10 MVA;
                                                                       and the current            needs CTs on both
                                                                       exceeds pickup (0.2        800 V windings
                                                                       to 0.3 pu; a 2 kA fault
                                                                       on a 3.6 kA winding
                                                                       is 0.55 pu); a
                                                                       through-fault
                                                                       otherwise; cross-
                                                                       winding faults carry
                                                                       no current

   Temperature (OTI,                          Nothing                  Nothing                    Under-reads
   WTI, PT100)                                                                                    harmonic hot spots;
                                                                                                  fibre-optic sensors
                                                                                                  for harmonic-rich
                                                                                                  duty




                                                                                                               Page 65 of 134

---

## PDF page 66 / 134

Earthing, inverter topology and protection in utility-scale solar




   Device                                     LV first fault        Loop-limited double       Notes
                                                                    fault (2 to 8 kA)

   MV fuses and 50/51,                        Invisible             Visible only above        Energising into a
   50N/51N                                                          about 8 kA on the LV      standing first fault
                                                                    side for a relay at 1.3   produces only
                                                                    In: a 2 kA LV double      inrush
                                                                    fault reflects to the
                                                                    delta side as at most
                                                                    about 56 A against
                                                                    175 A rated; MV
                                                                    earth-fault elements
                                                                    see nothing through
                                                                    a delta primary

   LV ACB per winding,                        Nothing               Phase overcurrent         Many string-
   LSI(G)                                                           only when both            inverter designs
                                                                    faults are                omit the winding
                                                                    downstream, tens of       ACB and rely on
                                                                    seconds in the long-      per-inverter
                                                                    time region for 1 to 2    devices, leaving the
                                                                    pu; a G element           winding without LV
                                                                    would see a fault         protection
                                                                    that brackets the
                                                                    ACB if enabled and
                                                                    set, and it is often
                                                                    disabled on IT


Three gaps follow: the first fault, which no transformer protection sees; the loop-limited
double fault between MV pickup and the ACB's long-time setting; and inter-winding
insulation failures, LV1 to LV2 or MV to LV, which carry no current on an IT winding, the
MV-to-LV case raising the whole network toward MV potential (IEC 60364-4-44 442
stress-voltage limits; an earthed electrostatic screen between windings mitigates).
Restricted earth fault on the LV winding is inapplicable without an earthed star point. The
practitioner options from ungrounded industrial and marine practice are an IMD per 800 V
winding to IEC 61557-8 with insulation-fault location to find the feeder in operation
(Bender states that monitoring must be "independently from any insulation measurement
carried out by the inverter prior to connection" and that its PV devices are built for
leakage capacitances below 2,000 µF); neutral-displacement voltage detection, 59N or 64,
from three earthed-primary VTs in broken delta with a loading resistor "to dampen out
transients" or from an artificial neutral, with SEL's caveat that "Voltage-based schemes
can only tell if there is a fault somewhere on the system"; conversion to high-resistance
earthing where the inverter maker permits, which IEEE 141 says "provides the same



                                                                                                            Page 66 of 134

---

## PDF page 67 / 134

Earthing, inverter topology and protection in utility-scale solar




advantages as ungrounded systems" while limiting transients, subject to the anti-PID and
transformerless constraints of sections 4 and 5; Buchholz, DGPT2, sudden-pressure
devices, fibre-optic winding sensors and routine DGA as the only transformer-side
indicators sensitive to low-energy internal faults; verification of the double-fault loop
impedance for every feeder with a G element or dedicated LV relay where the loop
current falls below long-time pickup; and surge arresters at the MV bushings with RC
snubbers or controlled switching for cable-fed units switched daily.

Contradictions recorded: harmonics as cause (Envista "most probable", PAC World
definitive) against the low fundamental-band distortion of string inverters, neither case
having measured the spectrum independently; overvoltage multiples of 5 to 8 against a
field peak of 1,050 V, the multiples being undamped upper bounds with an ambiguous
r.m.s. or crest base; TB 642 against TB 939 failure rates, different populations and periods,
neither applicable here; the brief's "first fault leaves the winding at 800 V to earth
indefinitely" against the expected tripping of the inverters by their residual-current
monitors, which makes the fault conspicuous but not identified; DC injection limits of 0.5
% against 1 %, different standards and a ceiling rather than a typical level; and the Envista
grounding irregularities against its harmonic conclusion. Unverified: any failure rate or
claim frequency for this transformer class; any case attributing PV transformer damage to
IT faults or anti-PID offsets; the clause content of IEEE C57.159-2016 and CIGRE TB 577
and 537; the IEC 60076-3 and -11 insulation levels at Um 1.1 kV, the IEEE 1547, IEC 61727 and
G99 DC limits, IEEE C37.91 and C57.109, all background; the 2012 study cited second-hand
by the Indian paper; the Australian fire's type and cause; and the PAC World claims.


Manufacturer-by-manufacturer technical comparison
Every entry below is from a document opened in this work, with the edition and hosting
stated; "third-party-hosted" means the maker's text read from a distributor or ManualsLib
copy. Where a field says unknown, the document was silent or the page was not captured,
and the matrix records that rather than filling it from memory. The string-inverter table
first.




                                                                                      Page 67 of 134

---

## PDF page 68 / 134

Earthing, inverter topology and protection in utility-scale solar




  Model and document             Ratings                   AC earthing and      DC earthing and     Residual current,    External AC          Evidence
                                                           transformer          insulation          arc fault, PID       protection
                                                                                monitoring

  Sungrow                        1,500 V DC, MPP           No N terminal; "If   "neither the        "Leakage current     Breakers or          Confirmed,
  SG285/320/333/350HX;           500 to 1,500 V, 12        the LV side          negative            protection Yes",     fuses "must be       manufacturer-
  manual Ver24 (Sep              MPPT (optional 16)        winding is in Y      electrode nor the   thresholds not       installed on the     hosted; fault
  2025) and Ver28 (Sep           of 2 strings, 40 A        shape, neutral       positive            published; arc       AC side of the       codes 12, 39,
  2026), identical on every      and 60 A SC per           point grounding      electrode of the    fault not in         inverter and the     106, 1600 to
  point; datasheet               MPPT; AC "3 / PE,         is prohibited"       PV string can be    technical data,      grid side",          1655, 1616, 10,
  SG333HX V6 (2025); EU          800 V", 640 to 920        when anti-PID is     grounded.           code 88 in the       recommended          323 as in section
  edition                        V; 352 kVA at 30          enabled; IT          Otherwise, the      generic fault        800 V, 350 or 400    7
                                 °C, 254 A max;            connection           inverter will not   table, fitment on    A; "Multiple
                                 transformerless           requires at least    operate             HX unknown; anti-    inverters cannot
                                                           906 V to-earth       normally";          PID and PID          share one AC
                                                           withstand for        "Ground fault       recovery optional    circuit breaker";
                                                           winding, cables      monitoring Yes";    (section 5)          no load between
                                                           and secondary        ISO protection                           inverter and
                                                           devices;             value user-                              breaker "except
                                                           maximum 15           adjustable "via                          for the tracking
                                                           inverters per LV     the app or the                           axis"; no RCD
                                                           winding; shield      LCD" to "local                           requirement
                                                           winding "not a       regulations",
                                                           requisite";          default not
                                                           transformer DC       stated; pre-
                                                           withstand 1 % of     connection only
                                                           fundamental
                                                           current; SPD 3+1
                                                           with MCOV at
                                                           least 680 V; TN
                                                           and TT never
                                                           mentioned

  Huawei SUN2000-                1,500 V DC, MPP           "supports the IT     No explicit pole-   "comprehensive       "A three-phase       Confirmed,
  330KTL-H1/H2; manual           500 to 1,500 V, 6         earthing system      earthing            residual current     AC switch            third-party-
  Issue 13 (30 June 2024)        MPPT with 28              in PV-only           prohibition         detection unit ...   should be            hosted (OCR)
  and Draft A (30 Aug            inputs, 65 A and 115      scenarios"; TT,      captured;           immediately          installed", one
  2022); datasheet               A SC per MPPT; AC         TN-C and TN-C-S      commissioning:      disconnects",        per inverter,
                                 800 V "3W + PE";          "not                 insulation at or    threshold not        OCPD "in
                                 300 kW / 330 kVA,         recommended"         above 1 MΩ is       published; arc       compliance with
                                 238.2 A max;              (contact             normal; "DC         fault not listed,    local power
                                 transformerless           engineers);          insulation          alarm 2003 "DC       distribution
                                                           dedicated            resistance          Arc Fault" in the    regulations"; no
                                                           transformer, not     detection: Yes";    draft FAQ; PID       rating, no RCD
                                                           LV overhead          threshold           external             type
                                                           lines; "must not     parameter exists    (SmartPID2000)
                                                           be connected to      on Huawei
                                                           a winding ... that   inverters (2020
                                                           has other models     manual), default
                                                           of inverters         unknown
                                                           connected to it";
                                                           no inverters-per-
                                                           winding or
                                                           withstand figure;
                                                           no N terminal;
                                                           Draft A said only
                                                           "supports IT
                                                           power grids"

  Huawei SUN2000-                1,500 V DC, 9             "supports the IT     "Ensure that the    Integrated RCDU,     "A three-phase       Confirmed,
  196KTL-H0 / 200KTL-H2 /        MPPT, 18 inputs; AC       earthing             PV module           value not            AC switch            manufacturer
  215KTL-H0; manual Issue        family 3W+PE,             system"; TT, TN-     output is well      published; AFCI      should be            portal and third-
  18 (20 Mar 2024) and           rating not                C, TN-C-S not        insulated to        and PID not in       installed"; cables   party PDF; do
  portal page updated 1          captured;                 recommended;         ground";            captured text        to IEC 62930, EN     not generalise
  Sep 2025 (the 215KTL-          transformerless           dedicated            insulation not                           50618, IEC           to the H3
  H3 manual was not                                        transformer; no      detected when                            60364-5-52 and       hardware
  located)                                                 winding shared       grid-tied with a                         -54
                                                           with other           DC switch
                                                           models               turned on;
                                                                                threshold not
                                                                                captured




                                                                                                                                                   Page 68 of 134

---

## PDF page 69 / 134

Earthing, inverter topology and protection in utility-scale solar




  Model and document             Ratings                   AC earthing and     DC earthing and      Residual current,     External AC          Evidence
                                                           transformer         insulation           arc fault, PID        protection
                                                                               monitoring

  Huawei SUN2000-                1,500 V DC                "supports the IT    Pole earthing not    RCMU                  Three-phase AC       Confirmed,
  460KTL-H0 / 506KTL-            (withstands 1,600         earthing system     captured;            "immediately          switch per           third-party-
  H1/H2/H3; manual Issue         V), rated 1,200 V,        in PV-only          insulation under 1   disconnects",         inverter,            hosted
  03 (30 Mar 2026);              full load 950 to          scenarios"; TT,     MΩ to be             value not             "Multiple
  datasheet                      1,470 V, 6 MPPT of        TN-C, TN-C-S not    troubleshot;         published; AFCI       inverters shall
                                 up to 6 inputs, 105       recommended;        insulation           and PID not listed;   not connect to
                                 A and 180 A SC per        dedicated           resistance           DC and AC Type II     the same AC
                                 MPPT; AC                  transformer; no     detection, PV        SPDs                  switch"; no
                                 "577.4/1000 V AC,         winding shared      string fault                               rating, no RCD
                                 3W+PE"; 460 kW            with other          detection, SSLD                            type
                                 rated, 506 kVA,           models; Huawei      and SCLD
                                 292.2 A max; THDi         JUPT                supported
                                 under 1 %;                transformer
                                 transformerless           stations shown;
                                                           no withstand or
                                                           inverters-per-
                                                           winding figure
                                                           (on a first fault
                                                           the healthy
                                                           phases sit at
                                                           1,000 V to earth)

  SMA Sunny Highpower            1,100 V (100-21) or       "The low-voltage    "The product         All-pole RCMU to      "Maximal output      Confirmed,
  PEAK3, SHP 100-21 to           1,500 V DC, MPP to        side must be        must not be          IEC 62109-2 and       overcurrent          manufacturer-
  180-21; online manual, EU      1,450 V, one MPP          configured in a     operated with PV     VDE 0126-1-1,         protection 250       hosted, no page
  and UK                         tracker with 1 or 2       star formation      modules whose        disconnects on        A"; AC and DC        date
                                 inputs for external       and the neutral     outputs are          residual jumps        Type 2 SPDs;
                                 combiners, 180 A,         point must be       grounded"            above 30 mA;          external relay
                                 325 A ISC; AC 600,        grounded";          (destroys the        events 3601 and       plus switching
                                 660 or 690 V, no N;       requirements in     product); frame      3701; external        device as the
                                 100 to 180 kW, 151 A      SMA's               earthing allowed;    RCD not required,     trip path per the
                                 max;                      transformer note    coupling             if used Type B        planning
                                 "Transformerless,         (not retrieved);    capacitance of       1,000 or 1,500 mA,    guideline (earlier
                                 non-isolated"             no IT or TN         all modules at       one per inverter;     finding)
                                                           wording on the      most 32 µF;          no arc fault in the
                                                           page                insulation           protective-
                                                                               monitoring fixed     devices table; no
                                                                               at Riso above 50     PID in the inverter
                                                                               kΩ (33 kΩ for 100-
                                                                               21), event 3501

  SMA Sunny Tripower X           1,000 V DC, 3 MPPT        Approved "TN-C,     Grounded             All-pole RCMU;        DC load-break        Confirmed,
  (STP 12-50 to 25-50) and       of 2, 24 A per input;     TN-S, TN-C-S,       module outputs       external RCD not      switch; max          manufacturer-
  CORE2 (STP 110-60);            AC 230/400 V "3-          and TT";            prohibited;          required,             output               hosted;
  online manuals                 (N)-PE", 12 to 25         "Operation of the   coupling             compatible Type       overcurrent          included to
                                 kW (CORE2 110             inverter in IT or   capacitance at       A or B at or above    protection 50 A;     show that one
                                 kW);                      Delta IT grids is   most 6 µF; Riso      100 mA (CORE2         SPD Type 1+2 or      maker's models
                                 transformerless           not permitted";     above 100 kΩ         Type B at or above    2 optional           differ (33, 50 or
                                                           with an MV          fixed                1,100 mA), one per                         100 kΩ; 32 or 6
                                                           transformer the                          inverter; ArcFix                           µF; Type B 1,000
                                                           LV side in star                          arc-fault                                  to 1,500 mA or
                                                           with the neutral                         interrupter                                Type A/B 100
                                                           earthed; TT                              available, default                         mA)
                                                           footnote on                              state not stated;
                                                           leakage-current                          no PID
                                                           potential
                                                           differences




                                                                                                                                                    Page 69 of 134

---

## PDF page 70 / 134

Earthing, inverter topology and protection in utility-scale solar




  Model and document             Ratings                   AC earthing and        DC earthing and    Residual current,     External AC          Evidence
                                                           transformer            insulation         arc fault, PID        protection
                                                                                  monitoring

  GoodWe                         1,500 V DC, MPP           "The grid              No pole-earthing   "Residual Current     AC breaker 250       Confirmed,
  GW225K/250K(N)-HT;             500 to 1,500 V, 12        structures             sentence           Monitoring" row,      A                    third-party-
  HT Series manual V1.1 (14      MPPT of 2, 30 A           supported ... are      captured; "PV      faults "GFCI Chk      recommended,         hosted (OCR);
  Dec 2023)                      and 50 A SC per           IT" with L1, L2, L3,   Insulation         Fail" and "DCi        one per inverter,    internal tension
                                 MPPT, backfeed 0          PE in the figure,      Resistance         High"; external       "Multiple            on IT against
                                 A; AC "800, 3L/PE",       yet section 6.4        Detection" row,    RCD "Type A" at       inverters cannot     four- or five-
                                 640 to 920 V; 250         says "The AC           fault "ISO Fail"   "2500mA or            share one AC         wire terminals,
                                 kW, 180.5 A max;          terminals can be       (check cables,     higher" when the      circuit breaker"     likely template
                                 max output                connected in           frame earthing,    DC leakage                                 text
                                 overcurrent               three-phase            "AC side is        component
                                 protection 258 A;         four-wire or           properly           exceeds the limit,
                                 non-isolated              three-phase five-      grounded");        per local law;
                                                           wire"; no              threshold          AFCI row and
                                                           winding, neutral       unknown            fault 17; anti-PID
                                                           or inverters-per-                         optional, PID
                                                           winding                                   recovery row
                                                           requirement
                                                           captured

  Growatt MAX 175 to             1,500 V DC, MPP           Section 3.6 "Grid      No pole-earthing   RCMU yes, error       Own AC breaker       Confirmed,
  253KTL3-X HV; manual           500 to 1,500 V, 12 or     Types" is a single     sentence           201, limits           per model: 200       third-party-
  GR-UM-255-A-03, date           15 MPPT of 2, 30 A        figure (462 V,         captured;          unknown; AFCI         or 250 A at 1,000    hosted;
  not captured                   and 50 A SC; AC           800 V) with no         "Insulation        optional, error       V a.c. (175 to 216   manufacturer
                                 800 V, 640 to 920 V,      TN, TT or IT text;     resistance         200; anti-PID         kW), 250 or 320      PDFs robots-
                                 "3W+PE", 253 kW,          no transformer         monitoring Yes",   optional, warning     A (225 to 253        blocked
                                 182.6 A; THDi under       or neutral             error 203,         219; error 303 "NE    kW); sharing
                                 3 %;                      requirement            threshold          abnormal"             forbidden; no
                                 transformerless           captured; fault        unknown                                  load between
                                                           310 "Ground zero                                                inverter and
                                                           protected"                                                      breaker
                                                           suggests
                                                           checking
                                                           "whether there is
                                                           an isolation
                                                           transformer on
                                                           the output side"
                                                           and says "For PV-
                                                           connect ground
                                                           version, N and PE
                                                           may be connect",
                                                           implying a PV-
                                                           negative-
                                                           grounded variant

  Solis 215 to 255K-EHV-         1,500 V DC, MPP           Nothing stated in      No pole-earthing   Built-in night-only   "An over-current     Confirmed for
  5G (-PLUS); manual Ver         580 to 1,500 V, start     the captured           sentence           anti-PID at 650 V     protection           what is stated,
  1.2, date not captured         600 V; AC "3/PE,          pages; terminals       captured;          DC (section 5)        device must be       third-party-
  (the S6-GC350K manual          800" V, 640 to 920        L1, L2, L3, PE only    insulation,                              used between         hosted; much
  was not located)               V; 255 kVA at 30                                 residual and arc                         the inverter and     unknown
                                 °C, 184 A; night                                 protection not                           the grid" to
                                 consumption                                      captured                                 IEC/EN 60947-3;
                                 under 2 W "without                                                                        rating column
                                 anti-PID";                                                                                garbled
                                 transformerless

  Sineng SP-350K-H1;             1,500 V DC, MPP           Nothing stated;        Insulation         AFCI and PID not      DC and AC Type       Confirmed from
  datasheet (uploaded 29         500 to 1,500 V, 12        the datasheet          monitoring yes;    listed                II SPDs; DC          datasheet; no
  Jan 2024), product             MPPT at 45 A              diagram's text         leakage current                          switch rating not    manual to check
  page, certificates (Dec        (datasheet) or 40         layer shows "N"        protection yes;                          listed
  2024); no user manual          A (product page),         and "PE" beside        DC reverse
  exists on the maker's          24 strings (optional      A, B, C                connection;
  download page                  28 or 32); AC 800 V,      (unverified            thresholds
                                 640 to 920 V, 352         reading of a           unknown
                                 kW at 30 °C, 254 A        figure)
                                 max;
                                 transformerless

  Chint CPS SCH275KTL-           1,500 V DC, 12            Unknown                "ground fault      "leakage current      Unknown              Unverified
  DO/EU; distributor page        MPPT; 275 kW, 800                                monitoring"        protection", AFCI,                         throughout
  only, maker's site             V AC, 680 to 880 V,                                                 "built-in anti-PID
  unreachable                    198.5 A                                                             and PID recovery"




                                                                                                                                                     Page 70 of 134

---

## PDF page 71 / 134

Earthing, inverter topology and protection in utility-scale solar




Across the string table, three things stand out. First, the thresholds that govern first-fault
detection, the insulation value and the residual-current step, are published as fixed values
by SMA alone (33, 50 or 100 kΩ; 30 mA), and left to "local regulations" with no default by
Sungrow, Huawei, GoodWe and Growatt. Second, Sungrow is the only maker that
quantifies the LV insulation consequence of its earthing requirement (906 V) or limits the
inverters per winding (15); Huawei prohibits mixing models on a winding and publishes
neither figure, even at 1,000 V AC where a first fault puts 1,000 V on the healthy phases.
Third, the one-device-per-inverter rule is universal but the device is a "switch" (Huawei), a
"circuit switch" with a breaker or fuse (GoodWe), a "breaker" with a rating (Sungrow,
Growatt) or an overcurrent device to IEC 60947-3 (Solis), and no document explains why
sharing is prohibited (section 9).

The central-inverter table. Every product keeps the galvanic barrier in the station MV
transformer, the inverter itself being "transformerless", "TL" or " 无变压器  "; every one that
states the winding runs it unearthed; every one offers negative grounding or floating DC;
and every one claims a DC ground-fault or insulation monitor at the inverter which, with a
floating winding, sees the whole DC network behind that inverter in operation (confirmed
by wording only for SMA; "Yes" or "device fitted" without method for the rest).




                                                                                      Page 71 of 134

---

## PDF page 72 / 134

Earthing, inverter topology and protection in utility-scale solar




  Model and                      Ratings                  Isolation and LV winding     DC grounding          External             Evidence
  document                                                                             and monitoring        protection

  SMA Sunny Central              MPP 880 to               External MV                  IEC sheet:            AC breaker as        Confirmed,
  UP (SC 4000 to                 1,325 V, 1,500 V         transformer "YNd11 or        insulation            the output-side      manufacturer-
  4600 UP; US                    max, 4,750 A             YNy0 depending on the        monitoring            disconnection        hosted;
  variants);                     (US sheet 8,400          order option", inverter-     standard, remote      point; DC SPD        grounding
  datasheets                     A SC); 4,000 to          side delta or unearthed      ground-fault          Type I and II; DC    chapter
  SC4xxxUP-DS-en-                4,600 kVA at 35          star; LV IT (inferred from   monitoring            fuses in the         unverified
  33 and US-27; test             °C; 600 to 690 V,        vector group and the HE      optional; US          inverter; MV
  instructions v1.0 (29          3,850 A                  and CP manuals)              sheet: ground-        switchgear in
  Apr 2020); MVPS                                                                      fault and             the station; 12-
  manual v1.1 (15 Sep                                                                  insulation            monthly GFDI
  2025)                                                                                monitoring            and IMD
                                                                                       optional; Remote      function test;
                                                                                       GFDI fuse             GFDI trip stops
                                                                                       replaceable; one-     the inverter until
                                                                                       pole fused            repair, IMD
                                                                                       (grounded)            warning then
                                                                                       arrays                stop
                                                                                       supported; which
                                                                                       pole, rating and
                                                                                       thresholds
                                                                                       unknown
                                                                                       (grounding
                                                                                       chapter not
                                                                                       retrievable); 14
                                                                                       kΩ minimum
                                                                                       before entering
                                                                                       the field; "double
                                                                                       grounding of the
                                                                                       MV Power
                                                                                       Station"
                                                                                       recommended

  Power Electronics              934 or 976 V to          MV transformer               "Ground Fault         Fuses, motorised     Confirmed,
  Freesun HEM /                  1,500 V; 5,495 A         integrated (HEM) or          Protection: GFDI      DC disconnects;      manufacturer-
  HEMK GEN3;                     continuous,              external (HEMK); skid        and insulation        circuit breaker      hosted
  datasheets V2.0.3              8,000 A DC SC;           transformers "Dy11" or       monitoring            (HEMK) or MV
  (17 and 27 Aug                 4,999 to 5,260           "Dy11y11", star point not    device"; polarity     switchgear
  2026), V2.0.4 (21              kVA at 30 °C;            brought out (IT inferred)    and floating          (HEM); Type II
  Aug 2026); UL 1741,            660 or 690 V;                                         selection not         AC and DC SPDs;
  NEC 2023, IEC                  HEM with the                                          stated                fault behaviour
  62109                          MV transformer                                                              not documented
                                 in the same
                                 enclosure at 20
                                 to 34.5 kV

  Ingeteam INGECON               "up to 1.8 MVA           "TRANSFORMERLESS             "Optionally ... DC    Motorised AC         Partly confirmed;
  SUN PowerMax                   at 1500 V";              CENTRAL INVERTERS            fuses, smart          breaker              mostly unknown
  1500 Vdc B series;             model table not          WITH A SINGLE POWER          grounding kit and     standard; DC
  catalogue excerpt              retrieved                BLOCK" with "a direct        input current         load-break and
  page 1 (third-party                                     close-coupled                monitoring";          motorised DC
  host; maker's site                                      connection with the MV       protection            switches
  robots-blocked)                                         transformer"                 against insulation
                                                                                       failures; polarity,
                                                                                       IMD type and
                                                                                       winding
                                                                                       requirement
                                                                                       unknown




                                                                                                                                         Page 72 of 134

---

## PDF page 73 / 134

Earthing, inverter topology and protection in utility-scale solar




  Model and                      Ratings                  Isolation and LV winding    DC grounding        External            Evidence
  document                                                                            and monitoring      protection

  ABB/FIMER                      935 to 1,350 V,          External MV                 "Standard ... DC    AC breaker          Confirmed,
  PVS980-58 (4,348 to            1,500 V max;             transformer by busbar       inputs with         option; AC and      manufacturer-
  5,000 kVA) and                 5,300 A, 16 kA           coupling; one secondary     negative            DC short-circuit    hosted
  PVS980-CS skid;                DC SC; 4,348 to          winding per inverter;       grounding, fuses    and overcurrent
  datasheets Rev C               5,000 kVA at 25          "Distribution network       on positive pole    standard; fused
  (26 Mar 2021), skid            °C; 600 to 690           type: TN and IT" with       only" (20 or 24     DC busbars
  Rev B (2021);                  V; max AC SC             footnote "Inverter side     inputs, two
  operation manual               from the                 must be IT type"            garbled copies);
  Rev C (15 Jul 2019,            network 66 kA 1                                      "Floating DC"
  French translation)            s                                                    option; "Ground
                                                                                      fault monitoring:
                                                                                      Yes"; MIRU
                                                                                      insulation
                                                                                      measurement
                                                                                      and MGND
                                                                                      functional
                                                                                      grounding units
                                                                                      with parameter
                                                                                      group 210
                                                                                      "Grounding
                                                                                      supervision",
                                                                                      thresholds not
                                                                                      retrievable

  Sungrow                        MPP 895 to               Integrated MV               "PV array           "DC load switch     Confirmed,
  SG3300/4400UD-                 1,500 V, 4 × 1,435       transformer "Dy11", 8 %     grounding:          + fuse" (250 to     manufacturer-
  MV, SG4400UD-                  A, 4 × 3,528 A           (UD-MV); "Dy1               Negative            630 A); AC          hosted
  MV-US, SG4950HV-               SC; 4,400 kVA            (Optional: Dy11, Yny0,      grounding or        breaker at the
  MV; datasheets V21             at 45 °C; LV 0.63        YNd1)" (US); "Dy11y11"      floating"; US "28   inverter and MV
  (25 Mar 2025), US              kV (HV-MV 0.55           (HV-MV); star point not     inputs negative     side or MV load
  V29, HV V17 (2025);            kV); MV 10 to 35         brought out in all listed   grounding, or 24    switch and fuse
  manual Ver42 (Jan              kV                       groups                      inputs floating";   (US); DC Type II,
  2026, truncated)                                                                    manual figures      AC Type II (Type
                                                                                      for both; "thin     I+II DC on HV-
                                                                                      film without        MV); emergency
                                                                                      grounding"          stop opens AC
                                                                                      permitted;          breaker and DC
                                                                                      "Insulation         load switch
                                                                                      monitoring: Yes";
                                                                                      "Grid / ground
                                                                                      fault monitoring:
                                                                                      Yes / Yes";
                                                                                      method,
                                                                                      thresholds and
                                                                                      fault codes
                                                                                      unknown (text
                                                                                      truncated), one
                                                                                      entry "Neutral
                                                                                      point shift"




                                                                                                                                       Page 73 of 134

---

## PDF page 74 / 134

Earthing, inverter topology and protection in utility-scale solar




  Model and                      Ratings                  Isolation and LV winding     DC grounding       External           Evidence
  document                                                                             and monitoring     protection

  Sineng EP-4400-                895 to 1,500 V;          "隔离方式: 无变压器"                 DC grounding       DC fuse plus       Confirmed for
  HA-UD/35, EP-3300-             5,740 A; 4,400           (transformerless) for                    接地
                                                                                       not stated; "      load switch; AC    what is stated,
  HA-UD, EP-2500-                kW rated, 5,060          the LV units; vector         故障监测     "         frame circuit      manufacturer-
  HC-UD; Chinese                 kW max; 0.63/35          group not stated             (ground-fault      breaker or MV      hosted; much
  product pages and              kV (the /35                                           monitoring)        load switch; DC    unknown
  one-page                       integrates the                                        standard;          and AC surge
  datasheets                     transformer);                                         insulation         protection
  (uploads 2024 to               EP-2500 at 600                                        monitoring not
  2025); no standards            V                                                     named
  listed

  TMEIC Solar Ware               MPPT 875 to              External MV                  "Ground Fault      "Fuse and          Confirmed
  Ninja PVU-                     1,300 V, 1,500 V         transformer implied          Detection" under   Contactor, Anti-   listing; mostly
  L0800GR-2 to 0880;             max; 800 to 880          ("Up to 6 Ninja units on     DC protection;     islanding"; no     unknown
  brochure ©2023;                kW at 25 °C;             the same MV power            "DC Zone           breaker named;
  Samurai page                   600 to 660 V;            station"); winding           monitoring is      SPD not stated
                                 702 A at 50 °C;          requirement not stated       standard";
                                 input fuses 160                                       polarity, IMD or
                                 to 500 A;                                             GFDI not stated
                                 Samurai 2,500
                                 to 3,360 kW

  Gamesa Electric                835 to 1,500 V           Station transformer          "DC Ground         Two motorised      Confirmed,
  Proteus PV 4100 to             (MPPT to 1,300           "Dy11y11 KNAN", two LV       Fault and          DC switches and    manufacturer-
  4700 and Proteus               V); Isc up to            star windings, one per       Insulation         two motorised      hosted
  PV Station;                    9,000 A; 4,095           power module, star           Detection";        AC breakers
  datasheets April               to 4,709 kVA at          points not brought out;      polarity or        (one per power
  and July 2025;                 40 °C; 600 to            footnote "UL version:        floating not       module); Type
  catalogue 2025                 690 V                    Padmounted Dyn               stated; "Max 24    1+2 SPD AC and
                                                          (without external            fuse +/-           DC; station MV
                                                          switchgear)", neutral        monitored"         protection
                                                          brought out, its earthing    (fusing on both    switchgear or
                                                          not stated; DC input         poles suggests     fuses; reverse-
                                                          ports "2, not galvanically   floating,          polarity
                                                          isolated, 1 MPPT"            inferred)          detection



Across the central table: the IEC-market default is a floating array with an IMD, the US
default is functional grounding with a GFDI, and SMA offers both on one product with the
defaults differing by region; single-pole DC fusing is the drawing-level tell of a functionally
grounded pole and two-pole fusing of a floating array; the US pad-mount Dyn convention
with the neutral brought out (Gamesa) is the one place where an earthed LV neutral is
suggested on a central station, and the datasheet does not reconcile it with DC insulation
detection.

Unverified across section 12: the Sungrow SG250HX and SG125CX manuals (pages
errored); the Huawei 215KTL-H3 manual, the SmartPID2000 manual and the inverter alarm
reference; SMA's transformer-requirements note for string inverters and the body of the
UP manual's grounding chapter; the Solis S6-GC350K and GoodWe SolarGo manuals;
Growatt's grid-type text behind its figure; any Chint document from the maker; FIMER's




                                                                                                                                     Page 74 of 134

---

## PDF page 75 / 134

Earthing, inverter topology and protection in utility-scale solar




parameter group 210; Sungrow's UD-MV fault table beyond "Neutral point shift" and the
HV-MV manual; TMEIC's transformer requirements; Gamesa's and Sineng's polarity and
detection methods.


Regulatory and standards assessment
The reference edition is BS 7671:2018+A4:2026. Amendment 4 was signed off by JPEL/64
on 15 January 2026 and published by the IET and BSI on 15 April 2026 "for immediate use";
the previous edition, BS 7671:2018+A2:2022+A3:2024, was withdrawn as a British
Standard on 15 October 2026, so from that date new installations must comply with A4,
installations already under construction to the previous text may be completed subject to
contract, and the IET's page now calls A4 "the current edition" (IET press release, BSI
Knowledge, IET BS 7671 page). What A4 changed, from three summaries cross-checked
(SELECT, IET Wiring Matters 102, the IET press release): new Chapter 57 (stationary
secondary batteries); new Section 545 (functional earthing and bonding for ICT); new
Section 716 (PoE); a major revision of Section 710 (medical IT systems with IMDs);
A3:2024's 530.3.201 on unidirectional and bidirectional devices consolidated; Section 434
redrafted with "inherently short-circuit proof and earth fault proof"; an informative note
and figure on RCDs in series under 531.3.3; 536.4.202 redrafted to permit load curtailment;
Table 537.4 amended and 537.4.2 redrafted; 551.7.1 new indents (c) and (d), 551.7.2 split
into 551.7.2.1 and 551.7.2.2, 551.8 moved to Chapter 57; Chapter 65 and the Appendix 6
forms revised; new Appendix 4 installation methods for buried cables; Chapter 81 on
energy efficiency added. Not changed according to the same sources: Section 411,
Section 419, Chapter 46, Chapter 53 other than the items above, Chapter 64 and Section
712, for which the A2:2022 text stands. Two caveats: the printed A4 text was not opened,
so clause content below is from the IEC parallel text, trade summaries and the IET's own
articles; and one summary, the IET press release, mislabels both new sections as 716, a
drafting slip. The regulation numbers in the matrix carry the evidence class shown;
substance is high-confidence throughout, numbering is what needs checking against the
book.

BS 7671 clauses that govern the inverter collection network, with the commissioning
check that proves each one (applies-to codes: DC array, INV inverter, IT-LV the unearthed
collection network including AC combiners, TX the LV winding and its earthing):




                                                                                    Page 75 of 134

---

## PDF page 76 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to        Commissioning       Evidence
                                     own words                                        check

   411.3.1.1,                        Exposed-                       INV, IT-LV, TX,   642 inspection;     Substance
   411.3.1.2                         conductive-                    structures        643.2 continuity;   high; number
                                     parts connected                                  644 schedule        from
                                     by protective                                                        background
                                     conductors to
                                     the main
                                     earthing
                                     terminal;
                                     extraneous-
                                     conductive-
                                     parts bonded

   411.3.2.1 to .4                   ADS within Table               IT-LV via         643.7 Zs against    Confirmed via
                                     41.1 for final                 411.6.4;          Ia; 643.8 RCDs      NAPIT and BSI
                                     circuits; 5 s (TN)             auxiliary
                                     or 1 s (TT) for                supplies
                                     distribution                   directly
                                     circuits

   411.6.1                           IT: live parts                 IT-LV, TX         Design record;      Confirmed via
                                     insulated from                                   inspection of the   Bender and
                                     earth or earthed                                 LV star-point       Schneider
                                     through high                                     treatment
                                     impedance; first-
                                     fault current
                                     small

   411.6.2                           RA × Id ≤ 50 V,                INV, IT-LV, TX    Electrode test;     Confirmed
                                     exposed-                                         calculated Id
                                     conductive-                                      with the
                                     parts earthed                                    connected
                                     individually, in                                 inverters'
                                     groups or                                        leakage
                                     collectively




                                                                                                                 Page 76 of 134

---

## PDF page 77 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to    Commissioning       Evidence
                                     own words                                    check

   411.6.3                           Permitted                      IT-LV         Device schedule     Confirmed
                                     devices: IMD,
                                     RCM, insulation-
                                     fault location,
                                     overcurrent
                                     devices, RCDs;
                                     RCDs may trip
                                     on first fault
                                     from capacitive
                                     leakage

   411.6.3.1                         IMD required                   IT-LV, TX     642 presence;       Disputed on
                                     where IT is used                             643.10 functional   number (BSI's
                                     for continuity of                            alarm test;         2018 summary
                                     supply; audible                              setting record      says 411.6.3.1
                                     or visual alarm                                                  and .2
                                     persisting while                                                 "deleted"; IEC
                                     the fault                                                        60364-4-41
                                     persists; first                                                  retains
                                     fault to be                                                      411.6.3.1; see
                                     removed with                                                     section 8);
                                     the shortest                                                     substance
                                     practicable delay                                                confirmed

   411.6.4                           Second fault: 2 Ia             IT-LV every   Calculation or      Confirmed
                                     Zs ≤ U (no                     feeder and    measurement of
                                     neutral) with TN               combiner      the double-fault
                                     times where                    circuit, TX   loop per circuit
                                     parts are                                    (643.7.3, number
                                     collectively                                 unverified)
                                     earthed; TT
                                     condition where
                                     earthed in
                                     groups

   411.6.5                           RCD used in IT:                IT-LV         643.8               Confirmed
                                     its non-operating                                                existence (BSI
                                     residual current                                                 2018); content
                                     at least the first-                                              background
                                     fault current




                                                                                                             Page 77 of 134

---

## PDF page 78 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to       Commissioning    Evidence
                                     own words                                       check

   419                               Where ADS                      IT-LV when       Design           Confirmed
                                     cannot be                      only inverters   justification;   purpose (BSI
                                     achieved                       feed a fault     bonding          2018)
                                     ("electronic                   (transformer     continuity
                                     equipment with                 open)
                                     limited short-
                                     circuit current"):
                                     supplementary
                                     bonding, non-
                                     conducting
                                     location, earth-
                                     free bonding,
                                     separation

   431.2.3                           IT with                        Only if a        642              Background
                                     distributed                    neutral is
                                     neutral:                       distributed
                                     overcurrent                    (unusual for
                                     detection in the               three-wire
                                     neutral of every               collection)
                                     circuit

   433.1.1, 433.3.1,                 Ib ≤ In ≤ Iz;                  INV feeders      Design           Confirmed via
   433.3.3                           overload                       (current-        calculation;     NICEIC for
                                     protection may                 limited          documented       433.3
                                     be omitted                     source), IT-LV   omission
                                     where the
                                     source cannot
                                     deliver overload
                                     current or where
                                     disconnection
                                     would cause
                                     danger




                                                                                                             Page 78 of 134

---

## PDF page 79 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to        Commissioning       Evidence
                                     own words                                        check

   434.1, 434.2.1                    Prospective fault              IT-LV, TX LV      643.7 Ipf against   Confirmed
   (A4), 434.3,                      current                        tails,            device Icu at 800   that 434.2.1
   434.5.1, 434.5.2,                 determined at                  combiners         V; design           was revised;
   434.5.3                           every relevant                                   calculation;        content
                                     point; omission                                  assembly            background
                                     permitted                                        certificate
                                     between
                                     generator or
                                     transformer and
                                     its switchgear;
                                     breaking
                                     capacity at or
                                     above
                                     prospective
                                     current unless
                                     backup declared;
                                     k²S² ≥ I²t;
                                     assemblies to
                                     IEC 61439 ratings

   461, 462.1 to                     Isolation for                  INV AC and        642; 643.10         Background;
   462.3, 463 to                     every circuit and              DC, IT-LV, TX                         Chapter 46
   465                               item; all live                                                       reinstated by
                                     conductors (any                                                      A1:2020
                                     IT neutral                                                           (confirmed)
                                     included);
                                     secured against
                                     reclosure;
                                     mechanical
                                     maintenance,
                                     emergency and
                                     functional
                                     switching

   530.3.201 (A3,                    Devices suitable               INV output        Device marking      Confirmed
   consolidated                      for the direction              devices, IT-LV,   against schedule    existence
   A4)                               of energy flow                 TX LV




                                                                                                                 Page 79 of 134

---

## PDF page 80 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to         Commissioning        Evidence
                                     own words                                         check

   531.3.3                           RCD type (A, F,                INV AC side        643.8                Confirmed
                                     B) for the                     where RCDs                              amended
                                     residual                       are used
                                     waveform; A4
                                     added a note on
                                     series RCDs

   "531.2.4" (brief)                 Not found in any               IT-LV              643.8                Unknown on
                                     2018 or A4                                                             number
                                     source; the IT-
                                     RCD substance
                                     sits in 411.6.3 and
                                     411.6.5

   536.4.1, 536.4.2,                 Selectivity                    IT-LV cascades     Manufacturer         Confirmed
   536.4.202 (A4)                    where necessary                (inverter          selectivity tables   that 536.4.202
                                     to prevent                     device,            in the design        changed
                                     danger; backup                 combiner,          record
                                     per                            winding ACB)
                                     manufacturer
                                     data; load
                                     curtailment
                                     permitted

   537.2, 537.3,                     Devices for                    INV AC and DC      642                  Confirmed
   Table 537.4                       isolation and                  isolators, IT-LV                        amended
   (A4)                              switching;
                                     semiconductor
                                     devices not for
                                     isolation;
                                     disconnector
                                     and switch-
                                     disconnector
                                     now defined




                                                                                                                   Page 80 of 134

---

## PDF page 81 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to       Commissioning        Evidence
                                     own words                                       check

   538.1, 538.2,                     IMDs to BS EN                  IT-LV, TX        642 presence;        Background;
   538.4                             61557-8 between                                 643.10 alarm test;   A4 made no
                                     live conductors                                 setting record       change
                                     and earth with                                                       (confirmed)
                                     set response
                                     value and alarm;
                                     fault-location
                                     systems to
                                     61557-9; RCMs to
                                     BS EN 62020

   542.1 to 542.4,                   Earthing                       All; 543.7 for   642; 643.2;          Background;
   543.1 to 543.4,                   arrangement by                 inverter EMC-    electrode test       high on
   543.7, 544                        system type;                   filter leakage                        substance
                                     electrodes;
                                     earthing
                                     conductor; main
                                     earthing terminal
                                     with test link;
                                     cpc sizing by
                                     adiabatic or
                                     Table 54.7; no
                                     switching device
                                     in a cpc; PEN
                                     only with ESQCR
                                     authorisation or
                                     on a private
                                     source;
                                     enhanced cpc
                                     above 10 mA
                                     protective-
                                     conductor
                                     current; bonding

   545 (A4)                          Functional                     SCADA and        642                  Confirmed
                                     earthing and                   comms in                              existence
                                     bonding for ICT,               inverter
                                     pink                           stations
                                     identification




                                                                                                                 Page 81 of 134

---

## PDF page 82 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to       Commissioning   Evidence
                                     own words                                       check

   641, 642.3,                       Initial                        All; the IMD     The schedules   Background
   643.2, 643.3.1                    verification                   has no natural   themselves      on numbering;
   Table 64,                         before service                 row on the                       A4 changed
   643.3.2, 643.7.3,                 against the                    standard                         the forms
   643.8, 643.10,                    design;                        schedule of                      (confirmed)
   644 and                           inspection                     test results
   Appendix 6                        including
                                     diagrams and
                                     protective
                                     measures;
                                     continuity;
                                     insulation
                                     resistance at
                                     1,000 V DC and 1
                                     MΩ for circuits
                                     above 500 V (an
                                     800 V network);
                                     SPDs and
                                     vulnerable
                                     equipment
                                     disconnected or
                                     tested at 250 V;
                                     IT first- and
                                     second-fault
                                     verification; RCD
                                     tests; functional
                                     tests of
                                     assemblies and
                                     monitoring
                                     devices;
                                     certificate with
                                     schedules




                                                                                                            Page 82 of 134

---

## PDF page 83 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to      Commissioning   Evidence
                                     own words                                      check

   712.1, 712.312.2,                 Scope silent on                DC, INV, the    642; 62446-1    Five numbers
   712.410.101,                      the earthing of                AC connection   records         confirmed
   712.410.102,                      the inverter                                                   from IET
   712.412.101,                      output network;                                                Wiring
   712.411.3.2.1.2,                  a DC conductor                                                 Matters 104
   712.433.101,                      may be earthed                                                 (IET WM 104);
   712.521.101,                      only with simple                                               others
   712.537, 712.6                    separation; DC                                                 background;
                                     equipment                                                      Dutch NEN
                                     energised even                                                 1010 numbers
                                     when                                                           (712.530.3.4,
                                     disconnected;                                                  712.536.2.2)
                                     DC protection by                                               must not be
                                     double insulation                                              cited as BS
                                     or SELV/PELV;                                                  7671
                                     Class II; Type B
                                     RCD where no
                                     simple
                                     separation; DC
                                     overload
                                     omission where
                                     Iz ≥ 1.25 Isc; DC
                                     cables erected
                                     to minimise
                                     earth faults;
                                     isolation of the
                                     inverter on both
                                     sides;
                                     verification by
                                     reference to BS
                                     EN 62446-1




                                                                                                           Page 83 of 134

---

## PDF page 84 / 134

Earthing, inverter topology and protection in utility-scale solar




   Clause                            Requirement in                 Applies to       Commissioning     Evidence
                                     own words                                       check

   551.1, 551.2.2,                   Generating sets                INV, IT-LV, TX   Design study to   Confirmed
   551.4,                            including PV;                                   IEC 60909; 642;   existence of
   551.4.3.2.1,                      fault currents                                  G99 witness       the A4 items;
   551.5, 551.7.1                    assessed for                                    tests             content from
   (A4 (c), (d)),                    each source and                                                   the 2024 draft
   551.7.2.1 and .2                  combination;                                                      (IET webinar
   (A4)                              shock protection                                                  Q&A)
                                     effective in
                                     every operating
                                     mode, island and
                                     connected;
                                     independent
                                     earthing where
                                     the set is a
                                     switched
                                     alternative;
                                     overcurrent
                                     protection
                                     counting each
                                     source; "a
                                     suitable
                                     protective
                                     device where
                                     energy flow is
                                     bidirectional"; no
                                     source on the
                                     load side of an
                                     RCD in stated
                                     conditions; the
                                     set on the supply
                                     side of all
                                     protective
                                     devices


The other standards and legislation:




                                                                                                              Page 84 of 134

---

## PDF page 85 / 134

Earthing, inverter topology and protection in utility-scale solar




   Instrument                                    What it requires or      Applies to     Evidence
                                                 covers

   IEC 60364-4-                                  Same 411.6 structure     IT-LV          Background;
   41:2005+A1:2017 (HD                           as BS 7671                              national deviations
   60364-4-41:2017)                                                                      lie mainly in 411.3.3
                                                                                         and 411.3.4

   IEC 60364-7-712:2017                          Basis of Section 712;    DC, INV        Confirmed
   and Edition 3 (21                             Edition 3 lists                         existence (IEC
   October 2025)                                 "requirements for PV                    60364-7-712:2025);
                                                 power generation                        content unknown
                                                 plants" among its
                                                 changes, content not
                                                 opened

   IEC 60502-1:2021                              Extruded cables to 1     IT-LV cables   Scope confirmed
                                                 kV (Um 1.2 kV) and 3                    (EVS); Table 1 read
                                                 kV; DC use where                        by the first-fault
                                                 the maker declares                      pass; the
                                                 it; earth-fault-                        standards pass
                                                 duration categories                     carried the older
                                                 A, B and C; Table 1                     "next-higher U0"
                                                 recommends U0 =                         claim from
                                                 0.6 kV for Category                     memory,
                                                 C at Um 1.2 kV, the                     superseded
                                                 step-up for Category
                                                 C beginning only at
                                                 Um 3.6 kV, so 0.6/1 kV
                                                 cable is within the
                                                 standard on an 800 V
                                                 IT network, and the
                                                 case for 1,000 V to
                                                 earth rests on the
                                                 standing first-fault
                                                 voltage 200 to 320 V
                                                 above the cable's U0
                                                 of 600 V, on the DC
                                                 offset and on the
                                                 1,500 V DC
                                                 requirement
                                                 (section 6)




                                                                                                      Page 85 of 134

---

## PDF page 86 / 134

Earthing, inverter topology and protection in utility-scale solar




   Instrument                                    What it requires or      Applies to               Evidence
                                                 covers

   IEC 60287, IEC 60909-                         Cable ratings;           All cables; IT-LV, TX,   Background
   0:2016, IEC 60076-1                           maximum and              HV
                                                 minimum fault
                                                 currents with
                                                 converters as limited
                                                 sources; ±10 %
                                                 impedance tolerance

   IEC 61557-8:2014 Ed 3,                        IMDs for IT systems      IT-LV, INV               Confirmed scope
   61557-9:2014                                  to 1,000 V AC and                                 (iTeh)
                                                 1,500 V DC, Annex C
                                                 PV-IMD, Annex D
                                                 insulation monitoring
                                                 function in inverters;
                                                 fault-location
                                                 systems

   IEC 62109-1:2010,                             Converter safety;        INV                      Scope confirmed;
   62109-2:2011                                  array insulation                                  clause content
                                                 check and residual-                               background
                                                 current monitoring
                                                 for non-isolated
                                                 inverters as product
                                                 requirements,
                                                 monitoring the array
                                                 and the inverter's
                                                 own residual current,
                                                 not the collection
                                                 network




                                                                                                                Page 86 of 134

---

## PDF page 87 / 134

Earthing, inverter topology and protection in utility-scale solar




   Instrument                                    What it requires or     Applies to            Evidence
                                                 covers

   IEC 62446-                                    Handover                DC, INV, AC           Confirmed (IEC
   1:2016+A1:2018,                               documentation           connection            webstore, Fluke
   62446-2:2020                                  (wiring diagram,                              summary); the IR
                                                 datasheets, test                              test-voltage table
                                                 results); inspection                          and SPD wording
                                                 including 5.2.9 AC                            not opened
                                                 side; Category 1
                                                 tests with AC
                                                 circuits to IEC
                                                 60364-6, DC
                                                 continuity, polarity,
                                                 Voc, Isc, insulation
                                                 resistance; Category
                                                 2 I-V and
                                                 thermography;
                                                 maintenance

   IEC 62548-                                    Array design to the     DC; HV; DC and INV;   Confirmed scopes
   1:2023+A1:2025, IEC                           DC terminals;           IT-LV panels          (sections 2 and 10)
   TS 62738:2018, IEC                            ground-mounted
   63112:2021, IEC                               plants with clause 11
   63027:2023, IEC                               MV/HV only; PV
   61439, IEC 60947-2                            earth-fault
   and -3                                        protection
                                                 equipment
                                                 acknowledging an
                                                 unearthed AC side;
                                                 DC arc detection;
                                                 assemblies; breakers
                                                 and switches




                                                                                                           Page 87 of 134

---

## PDF page 88 / 134

Earthing, inverter topology and protection in utility-scale solar




   Instrument                                    What it requires or     Applies to    Evidence
                                                 covers

   EAWR 1989 regs 4, 8,                          Systems constructed     Whole plant   Confirmed
   12, 13, 14, 16 with                           and maintained to                     (HSR25)
   HSR25                                         prevent danger,
                                                 inspection and
                                                 testing essential to
                                                 maintenance (paras
                                                 62 to 74); earthing
                                                 "or by other suitable
                                                 means", isolated
                                                 systems still need
                                                 precautions and
                                                 where a first fault
                                                 references the
                                                 system to earth
                                                 "earth fault
                                                 detection, insulation
                                                 monitoring" (paras
                                                 147 to 148); cutting
                                                 off and isolation,
                                                 with 12(3) excepting
                                                 sources themselves;
                                                 equipment made
                                                 dead must not
                                                 become charged,
                                                 stored energy and
                                                 capacitance may
                                                 need temporary
                                                 earths (190 to 195);
                                                 live work conditions;
                                                 competence




                                                                                                   Page 88 of 134

---

## PDF page 89 / 134

Earthing, inverter topology and protection in utility-scale solar




   Instrument                                    What it requires or      Applies to             Evidence
                                                 covers

   ESQCR 2002 reg 8(1)                           Generator and            The inverter-to-       Confirmed text
   to (5)                                        distributor networks     transformer network    (ESQCR reg 8)
                                                 to remain earthed;       falls within 8(5)
                                                 LV supply neutrals       (reasonably
                                                 connected with           inferred), so ESQCR
                                                 earth; consumers         does not itself
                                                 may not combine          require an earthed
                                                 neutral and              LV neutral there and
                                                 protective functions;    the "alternative
                                                 (5) excludes             arrangements" are in
                                                 networks inside a        practice the BS 7671
                                                 "generating station"     IT provisions and
                                                 ("premises ...           EAWR reg 8
                                                 principally used for
                                                 the purpose of
                                                 generating energy")
                                                 provided adequate
                                                 alternative
                                                 arrangements
                                                 prevent danger

   ENA EREC G99                                  Section 8 on earthing    HV interface, TX HV    Contents
                                                 (8.1 general, 8.2 HV-    side                   confirmed from a
                                                 connected, 8.3 LV-                              truncated copy
                                                 connected) citing BS                            (G99/NI); Section
                                                 7671, BS 7430, ENA                              8 body unknown
                                                 TS 41-24; 5.6(b) DNO
                                                 networks
                                                 "adequately
                                                 earthed"; 6.4.2(d)
                                                 generator's earthing
                                                 and HV neutral-
                                                 disconnection
                                                 precautions
                                                 declared; 7.3.4(b)
                                                 star points
                                                 "permanently
                                                 connected to earth"
                                                 for short-term
                                                 parallel; nothing seen
                                                 addresses the plant-
                                                 internal LV network



                                                                                                             Page 89 of 134

---

## PDF page 90 / 134

Earthing, inverter topology and protection in utility-scale solar




   Instrument                                    What it requires or      Applies to   Evidence
                                                 covers

   CDM 2015 regs 4, 9, 11,                       Client arrangements;     Design and   Confirmed text for
   12(5) to (10), 13 to 15                       designer duties; the     handover     reg 12 (CDM reg
                                                 health and safety file                12)
                                                 holding information
                                                 "likely to be needed"
                                                 for later work, kept
                                                 "appropriately
                                                 reviewed, updated
                                                 and revised", so the
                                                 as-built SLD,
                                                 earthing
                                                 arrangement and
                                                 IMD settings belong
                                                 in it


Where the LV installation ends and the HV obligations begin. BS 7671's scope is the LV
installation up to 1,000 V AC and 1,500 V DC: the array, the inverters, the IT collection
network, the LV winding connections and LV switchgear of the step-up transformer, and
the auxiliaries. The HV side, the transformer HV winding, ring main units, HV cables and
substation earthing, falls under BS EN 61936-1 and BS EN 50522:2022, ENA TS 41-24, G99
Section 8.2 for HV-connected plants, and ESQCR reg 8(2) where the HV network belongs
to a generator or distributor. The transformer is the hinge: its LV winding configuration,
delta or unearthed star, is what makes the collection network IT; BS 7671 411.6 and 538
govern that network, and nothing in G99 or IEC TS 62738 was found to address the choice.
The national comparison, from sections 3 and 15: IEC 60364-4-41 and BS 7671 condition the
IMD on "continuity of supply", Bender reads DIN VDE 0100-410:2018-10 411.6.3.1 as
mandating an IMD on every IT system (the DIN text was not opened), and the NEC
permits ungrounded LV systems only with ground detectors in supervised industrial
settings (background).

Contradictions recorded: the 411.6.3.1 numbering (above); the IET press release's double
"716"; the content of 551.7.1(c) and (d) described from the 2024 draft; the insulation test
voltage for 1,500 V arrays (a manufacturer note says most sites test at 1,000 V, the IEC
62446-1 table not opened); national renumbering of Section 712; and the IEC 60502-1
Category C claim, now superseded by the Table 1 reading. Unverified: the printed A4 text
for every clause above; G99 Section 8 and 9.6 body text; IEC 60364-7-712:2017 and 2025
clause structure; the IEC 62446-1 test-voltage table; IEC 62109-2 clauses; CDM reg 4 sub-
paragraphs and HSE L153 on the health and safety file; how ESQCR 8(5) "adequate
alternative arrangements" is interpreted for inverter collection networks.




                                                                                                  Page 90 of 134

---

## PDF page 91 / 134

Earthing, inverter topology and protection in utility-scale solar




Evidence from actual installation and commissioning practice
This section asks what the published practice documents require, what they are silent on,
and what the few independent datasets show. The pattern across all four questions is the
same: the hazard is recognised in the academic and manufacturer literature, and absent
from the commissioning guides, acceptance checklists and incident datasets that would
show whether it is being managed.

Second-fault and earthing studies. The issue is recognised academically: a 2026 peer-
reviewed review of insulation monitoring in LV IT networks states that "Large photovoltaic
farm systems are also generally connected to isolated neutral distribution systems", that
in high-power farms with long cables the double-ground-fault current can be "too low" for
overcurrent devices so that disconnection at the first fault may be needed, shows the
earth capacitance and insulation resistance of a 15 MW farm varying with weather and
time of day, warns that DC-test-current IMD methods find only the resistive component
while passive methods are sensitive to capacitance changes, and notes that only one IMD
may be connected per galvanically connected network, so coupled or multi-transformer
networks need a multi-IMD configuration that must be recorded (Energies 2026, 19(18),
4396). Threshold setting is site-specific: Sandia, SunPower and DNV GL recommend
insulation thresholds "on a case-by-case basis, most likely as part of array
commissioning", with examples of 7.89 and 7.48 kΩ for two large arrays and 2.2 to 14 kΩ for
a hypothetical 500 kW array depending on module leakage, and found the inverter itself
provided most of the array's insulation path (97.6 % and 86.5 %) (SAND2015-4667C); this
is DC-side evidence and says nothing about AC-side IMDs. No published second-fault
study, earthing study or independent engineer's report for an IT inverter collection
network was found. The two commissioning guides opened, Natural Power's acceptance
best practice and the Greater South East Net Zero Hub's Guide 15, list earthing continuity
and resistance tests and protection relays, and neither mentions an IT earthing study,
double-fault loop verification or an IMD (Natural Power, Hub Guide 15). Absence of
publication is not evidence that studies are not done, since such studies are contractual
deliverables; it is evidence that nobody checks for them from outside. Manufacturer
framing concentrates on the DC side: Schneider's 2016 piece places the IMD "at the
inverter connection" of ungrounded PV systems and does not discuss the AC collection
network, and IEC 61557-8 Annexes C and D and IEC 63112 are likewise array-oriented, so
AC-side monitoring of the collection network falls between the PV product standards and
the generic IT rules of 411.6 and 538.

Installed equipment against issued-for-construction drawings. No published or
anonymised case of an IMD shown on a single-line diagram but not installed was found;
the lead that prompted this question remains uncorroborated. The mechanisms that
should catch it: IEC 62446-1 clause 4 requires a handover wiring diagram and 5.2.9 an AC-
side inspection, with AC circuits tested to IEC 60364-6, and a 60364-6 verification of an IT



                                                                                    Page 91 of 134

---

## PDF page 92 / 134

Earthing, inverter topology and protection in utility-scale solar




system includes the first-fault indication and second-fault condition (inferred); BS 7671
642.3 inspection includes the presence of diagrams, protective measures and monitoring
devices, and 644 with Appendix 6 requires schedules of inspection and test results, but
the standard schedule is organised per circuit and protective device, and an IMD is a
system-level device with no natural row on it, so it can be omitted without the certificate
looking incomplete; 643.10 functional testing is the only hook for proving an IMD alarms.
Hub Guide 15 makes works acceptance "a physical check of the installation" validated by a
third-party technical assessor "on behalf of the employer", with a practical-acceptance
pack that must include "as-built drawings, including asset numbers" and "a full suite of
electrical test certificates"; Natural Power puts an "as-built drawing package" in the
handover pack and has the independent technical adviser "witness or conduct their own
tests", mentioning "compliance with drawings" only for sensors; NREL's O&M best
practice recommends third-party inspection and commissioning "to spot operation
problems before acceptance" and curated as-built drawings and equipment inventories
(NREL 73822); CDM 2015 reg 12(5) to (10) places the as-built record in the health and
safety file with a duty to keep it reviewed and updated. The gap: none of the practice
documents opened names an explicit reconciliation of installed protection and monitoring
devices against the issued-for-construction SLD as an acceptance condition; the closest
is "as-built drawings with asset numbers".

IMD commissioning records, alarm configuration and periodic testing. The regulatory
expectation is there: HSR25 para 148 expects "earth fault detection, insulation
monitoring" on isolated systems, para 68 treats inspection and testing as essential to
maintenance, and para 69 says records are not legally required but help demonstrate
compliance. The practice evidence is not: none of Natural Power, Hub Guide 15 or the
readable part of NREL's guide mentions IMD commissioning records, alarm thresholds or
periodic IMD tests, and the SolarPower Europe and Solar Energy UK guidance was already
established as silent. What was found is how thresholds are tuned in the field: a string-
inverter maker's support note gives a default PV insulation threshold of 500 kΩ and
suggests lowering it to 100 kΩ "to reduce nuisance trips in damp conditions" after
confirming there are no physical faults (Solis support), and Huawei's 2023 safety white
paper advises operators handling insulation alarms to "reset the 'Insulation impedance
protection point' parameter" (section 15); desensitisation of this kind can mask
developing faults, and no document opened records who authorises it or where the new
value is written down. Sandia recommends threshold determination at commissioning and
used morning baseline checks, with no periodic-verification procedure. IEC 61557-8
Edition 3 expanded the type and routine tests; whether it mandates a user-operable test
function was not confirmed from the preview.

Cable failures at commissioning and test-procedure errors. The installation-damage list is
consistent across independent sources: NREL names ground faults from "wire scaping
against a module frame", wire ties that "pinch wires too tightly", wires pulled without


                                                                                    Page 92 of 134

---

## PDF page 93 / 134

Earthing, inverter topology and protection in utility-scale solar




strain relief, rodent damage, bundling and UV degradation of ties and grommets, with
preventive re-torquing of conductor fasteners; Natural Power lists physical damage to
cables and conduit, missing torque marks, combiner sealing and "Soil compaction of roads
and electrical trenches" among visual findings; Mayfield's consultancy piece says most
ground faults result from "improper installation or damaged components" and
recommends the IEC 62446 wet insulation test for intermittent faults (Mayfield 2023); the
Solis note adds damaged wire insulation, water in junction boxes, badly crimped
connectors, pinched conductors, wet combiners and failed harness connectors. On test
procedure the same note states "Megger testing must NEVER be performed into an
inverter or electronic device", requires strings, combiners and feeders to be disconnected
first, and reports that "Most utility-scale sites test at 1000 VDC even for 1500 V systems"
unless the module maker requires 1,500 V; BS 7671 643.3.2 requires SPDs and other
equipment liable to be damaged or to influence the result to be disconnected, or the test
done at 250 V DC with the 1 MΩ minimum; and for the AC IT network Table 64 puts circuits
above 500 V in the 1,000 V DC test band, which 0.6/1 kV cables are rated for, so a test
applied with inverters, SPDs or IMDs still connected gives false low readings or damages
electronics. The regulator evidence from Australia belongs here: Queensland's Electrical
Safety Office visited more than 30 solar farms and issued 67 improvement and
infringement notices for poor isolation, unlicensed work on 1,500 V DC mains and string
cables, "not testing earthing continuity between all PV module frames", reversed polarity
where "the testing conducted was inadequate", and a combiner-box fire, with LV AC
networks and inverter stations not mentioned (Queensland ESO via Safety Solutions,
2019); Energy Safe Victoria's 2021 guidance says "the most significant area of non-
compliance is in regards to the correct earthing requirements of PV systems", from small-
scale audits (ESV 2021). No independent statistics on failure causes at UK utility-scale
commissioning were found; what exists is guidance and one manufacturer note, not
incident data.

Contradictions recorded: the insulation test voltage for 1,500 V arrays (manufacturer
practice of 1,000 V against an IEC 62446-1 table not opened); the 411.6.3.1 numbering
carried from section 8; and the Sandia report's own 750 kW against 1.5 MW description of
its arrays. Unverified: the anonymised lead of an IMD drawn and not installed; IEC 62446-
1's test-voltage table and SPD-disconnection wording; IEC 62446-2 content; NREL's O&M
guide sections 6 to 9 and the SolarABCs blind-spot report (hosts unreachable); the later
sections and reference list of the Energies 2026 review; and any UK incident data at utility
scale.




                                                                                    Page 93 of 134

---

## PDF page 94 / 134

Earthing, inverter topology and protection in utility-scale solar




Investigating whether an industry-wide blind spot exists
The question was put to a separate pass with the instruction to find evidence against the
hypothesis as hard as evidence for it. The verdict it reached, and this report adopts, is
that a systemic documentation and responsibility gap is reasonably inferred from multiple
independent sources, while a systemic safety outcome, undetected first faults persisting,
second faults not cleared, injuries and fires on string-inverter IT networks, is not
demonstrated, because no investigation body, insurer or dataset opened records that
category. The correct description on present evidence is an unmonitored, under-specified
interface whose consequences are unmeasured.

Evidence for a blind spot, by source type:




                                                                                  Page 94 of 134

---

## PDF page 95 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                    Class

   Conference and journal                                  No CIGRE, CIRED, IEEE PVSC        Literature gap reasonably
   papers                                                  or EU PVSEC paper takes the       inferred from a small
                                                           LV collection network             sample; the Huawei paper is
                                                           between transformerless           vendor-affiliated
                                                           string inverters and the MV
                                                           transformer as its subject; a
                                                           CIGRE 2026 SC B5 paper
                                                           models a 2.445 MW plant as
                                                           "inverter interface,
                                                           transformers, and the grid"
                                                           and studies faults at both
                                                           sides of the substation with
                                                           the plant-internal LV network
                                                           absent, consistent with
                                                           protection studies treating
                                                           the plant as an aggregated
                                                           source and stopping at the
                                                           point of common coupling
                                                           (CIGRE B5 2026); a Huawei-
                                                           affiliated 2026 paper on
                                                           string-level ground-fault
                                                           localisation states that
                                                           ground faults "constitute a
                                                           notable portion of inverter
                                                           failures", that "GF cases are
                                                           rare in real world, and
                                                           controlled GF experiments
                                                           are destructive", that in TN
                                                           networks a fault "can cause a
                                                           fault current to flow through
                                                           the inverter, potentially
                                                           damaging its internal
                                                           circuitry" and in IT systems "a
                                                           second fault may still create a
                                                           DC-side current loop",
                                                           without discussing start-up-
                                                           only insulation measurement,
                                                           RCMU limits or many
                                                           inverters on one network
                                                           (arXiv 2602.12289)




                                                                                                                 Page 95 of 134

---

## PDF page 96 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                     Class

   Manufacturer and IMD-                                   Bender's 2025 brochure: in         Confirmed; commercial
   vendor documents                                        string-inverter plants "The IT     interest
                                                           grid now extends from the
                                                           photovoltaic panels to the
                                                           secondary winding of the
                                                           transformer", "a brief
                                                           insulation measurement is
                                                           carried out within the string
                                                           inverter" before connection,
                                                           and a central IMD then
                                                           monitors "the entire IT
                                                           system during 'system
                                                           operation'"; its isoPV1685DP
                                                           sheet: "only one ISOMETER
                                                           should be connected in a
                                                           galvanically connected
                                                           system" and "Custom
                                                           parameter settings are
                                                           necessary" (Bender 2025);
                                                           Schneider's ComPacT NSX DC
                                                           guide: "Under certain
                                                           conditions, a double ground
                                                           fault can occur in
                                                           photovoltaic systems that are
                                                           isolated from ground", a
                                                           device not designed for it may
                                                           cause "property damage or
                                                           personal injury", and
                                                           operators should "detect the
                                                           initial isolation breakdown
                                                           (first fault) using an isolation
                                                           monitoring system"




                                                                                                                 Page 96 of 134

---

## PDF page 97 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                    Class

   Manufacturer warnings and                               SMA: the inverter measures        Confirmed; the N-earthing
   service bulletins                                       insulation "before it connects    warning is exactly the
                                                           to the utility grid", detection   winding-earthing-error
                                                           in operation relies on            warning the hypothesis
                                                           "integrated residual current      predicts
                                                           monitoring", "the grid
                                                           disconnection cannot occur
                                                           quickly enough to prevent
                                                           damage to the inverter
                                                           components", current
                                                           through the grid bridge "can
                                                           exceed 1 kA", and "any
                                                           damage caused by a ground
                                                           fault during operation is not
                                                           considered a fault of the
                                                           inverter", a documented
                                                           contractual boundary placing
                                                           the consequence on the
                                                           installation; Huawei's 2023
                                                           white paper: "If the neutral
                                                           (N) wire of a non-electrically
                                                           isolated inverter is grounded"
                                                           the power module can short-
                                                           circuit and fail, multi-point
                                                           grounding can produce "a
                                                           high voltage of 3000 V",
                                                           insulation must be measured
                                                           before start with alarm below
                                                           Umaxpv/30 mA, the handling
                                                           advice is to "reset the
                                                           'Insulation impedance
                                                           protection point' parameter",
                                                           and inverters "cannot
                                                           determine the specific fault
                                                           point", with nothing on the
                                                           AC-side IT arrangement,
                                                           external IMDs or warranty
                                                           (Huawei 2023)




                                                                                                                 Page 97 of 134

---

## PDF page 98 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                     Class

   Fire and accident                                       BRE for BEIS (Issue 2.9, 2018):    Confirmed; the only UK
   investigations                                          80 incidents, DC isolators         dataset is rooftop-
                                                           about 30 %, 36 % attributed        dominated and structurally
                                                           to poor installation, six solar-   unable to see utility-scale
                                                           farm incidents, solar farms        AC-side events
                                                           under "a tightly controlled
                                                           maintenance agreement" so
                                                           many incidents likely
                                                           unreported; the database has
                                                           a field for "Earth fault
                                                           (insulation fault) alarm
                                                           involved" and draws no
                                                           conclusion on AC-side faults,
                                                           IMDs, IT systems or
                                                           transformerless inverters
                                                           (BRE 2018); Fraunhofer ISE,
                                                           TÜV Rheinland and the
                                                           Munich fire service (EU
                                                           PVSEC 2013): about 400
                                                           German reports 1995 to 2012,
                                                           180 where the PV system
                                                           caused the fire, installation
                                                           faults and product defects
                                                           about 35 % each, "Dominant
                                                           section in terms of fire risk is
                                                           the DC section", but also "the
                                                           AC section of systems is far
                                                           more often involved in fires
                                                           than expected" and
                                                           transformer stations "may be
                                                           underrated for sustained full-
                                                           power operation" (Laukamp
                                                           2013); NREL's 2015 field guide
                                                           on the US DC-side blind spot
                                                           is the precedent for how a PV
                                                           protection gap became
                                                           recognised, field fires, a white
                                                           paper, then a code change; no
                                                           HSE, OSHA, METI, WorkSafe
                                                           or Canadian finding of an
                                                           undetected AC first fault or a
                                                           disabled IMD on a string-
                                                           inverter plant was found



                                                                                                                   Page 98 of 134

---

## PDF page 99 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                    Class

   Regulator audits                                        Queensland's 67 notices at        Confirmed, via trade press
                                                           more than 30 solar farms          and the regulator
                                                           (section 14), LV AC networks
                                                           not mentioned; Energy Safe
                                                           Victoria's earthing non-
                                                           compliance finding from
                                                           small-scale audits

   Training syllabuses                                     BPEC's Level 3 solar PV           One syllabus confirmed;
                                                           course for competent              others by title or
                                                           electricians lists design,        background
                                                           installation, commissioning,
                                                           maintenance and fault-
                                                           finding with no mention of
                                                           earthing arrangements, IT
                                                           systems, insulation
                                                           monitoring, transformerless
                                                           inverters, AC-side testing or
                                                           utility-scale plants (BPEC);
                                                           the EAL award is titled for
                                                           small-scale systems; there is
                                                           no UK qualification specific to
                                                           utility-scale LV collection-
                                                           network commissioning, IT
                                                           competence sitting, if
                                                           anywhere, in the 2382 and
                                                           2391 courses, which treat IT
                                                           systems briefly




                                                                                                                  Page 99 of 134

---

## PDF page 100 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                    Class

   Procurement specifications                              A South African public            Reasonably inferred that
   and utility checklists                                  employer's works information      public procurement and
                                                           for a 900 kWp-plus plant: "A      inspection documents leave
                                                           neutral earthing design is        the arrangement to
                                                           required" with no                 "design"; the sample is
                                                           arrangement named, no IMD,        three documents, none a
                                                           RCM or AC earth-fault             utility-scale string-inverter
                                                           requirement, and IEC 62446        specification
                                                           not referenced (CSIR 2017);
                                                           DEWA's mechanical-
                                                           completion checklist for
                                                           plants with LV and MV
                                                           transformers: "Earthing
                                                           system of PV plant installed
                                                           according to design", "Test
                                                           insulation of AC circuits ...
                                                           (max. 1000 VDC for 1 min.)",
                                                           no earthing-arrangement,
                                                           IMD, RCD-type or loop-
                                                           impedance item (DEWA
                                                           2020); Sydney Water's small-
                                                           scale specification requires
                                                           an earth-fault alarm to IEC
                                                           62109-2 and nothing on the
                                                           arrangement; the IFC's utility-
                                                           scale developer's guide (2015)
                                                           has no LV earthing, star-point,
                                                           IMD or RCM content and
                                                           recommends independent
                                                           advisers review modules, not
                                                           LV earthing (IFC 2015)




                                                                                                                  Page 100 of 134

---

## PDF page 101 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source type                                             What was found                     Class

   Industry failure datasets                               IEA PVPS Task 13 (2021):           Confirmed; the industry's
                                                           "event databases (solar            own datasets cannot show
                                                           logbooks) are not                  an AC earth-fault pattern
                                                           harmonised", risk definitions      because they do not code
                                                           "not fully structured"; kWh        for it
                                                           Analytics' sixth risk
                                                           assessment (301 utility-scale
                                                           sites, 935 site-years):
                                                           inverters about 59 % of
                                                           energy lost to corrective
                                                           actions, 21 % of actions on
                                                           connectors, combiners and
                                                           wiring, no category for earth
                                                           faults, insulation faults or AC-
                                                           side failures (pv magazine
                                                           USA 2024)


Evidence against. No protection or earthing study for an LV string-inverter collection
network was found, so the strongest counter-argument is engineering reasoning rather
than a published study: every transformerless inverter certified to IEC 62109-2 carries an
array insulation check before grid connection, with a threshold of the order Vmax/30 mA,
and a residual-current monitor tripping on 300 mA continuous (10 mA/kVA above 30 kVA)
and on 30, 60 and 150 mA steps within 300, 150 and 40 ms (background); because the DC
and AC sides are galvanically connected the start-up check also sees an AC-cable
insulation fault, so a first fault is normally caught at the next start-up, and a second fault
whose current passes through an inverter's output trips that inverter's RCMU. The limits
of that argument are the case this report is about: a first fault arising during the day
produces only capacitive current on an IT network and is not seen until the next start-up,
and a cross-country fault between two inverters' AC cables is fed from the transformer,
not through either RCMU, so clearance depends on the upstream overcurrent devices
and the loop impedance, the 411.6.4 condition that section 8 shows a shared ACB cannot
be assumed to meet. No independent-engineer or lender's-engineer scope including LV
earthing and IMD verification was found. Bender publishes no installed-base or project-
count figures, so the existence of a PV-specific IMD range (isoPV1685DP for "large
photovoltaic systems up to AC 1000 V and DC 1500 V, configured as IT systems") shows
the problem is recognised by IMD vendors, not that IMDs are commonly fitted on string-
inverter AC networks. The strongest "against" item is standards activity: IEC 60364-7-712
Edition 3, published 21 October 2025, lists "requirements for PV power generation plants"
among its changes, so TC 64 has moved to cover generation plants within the LV
installation standard; whether its text addresses AC-side earthing, IT systems or IMDs is



                                                                                                                 Page 101 of 134

---

## PDF page 102 / 134

Earthing, inverter topology and protection in utility-scale solar




unknown, and whether BS 7671 Section 712 will follow is unknown. Germany is the other:
Bender reads DIN VDE 0100-410:2018-10 411.6.3.1 as "IT systems must be monitored with
an insulation monitoring device", and if accurate, German installations would carry IMDs
irrespective of the "continuity of supply" condition in BS 7671, a plausible reason the issue
is less visible in the German-language literature. The claim that IT networks on PV plants
have operated for a decade without a pattern of second-fault incidents is unverifiable: the
Huawei paper's "rare in real world" is an assertion without data, and the datasets that
exist either pre-date 1,500 V string plants, are rooftop-dominated or have no AC earth-
fault category. The evidence base is biased in both directions, toward dramatic rooftop
fires and away from quietly resolved utility-scale faults, which BRE itself says go
unreported because O&M fixes them quickly.

Assessment. The documentation and competence gap is confirmed at the level of
standards scope (section 2), guidance (section 14 and the IFC), public procurement and
utility checklists (three documents, none specifying the arrangement or an IMD), and
installer training, independently of manufacturers and consistently across the UK, South
Africa, the UAE, Australia and the IFC template, which makes it more than local; but the
sample is small and none of the procurement documents is a utility-scale string-inverter
ground-mount specification. The manufacturer documents cut both ways: SMA's over-1
kA scenario and warranty exclusion, Huawei's neutral-earthing warning, Bender's and
Schneider's double-fault statements show the mechanisms are understood by the makers
and IMD vendors, so the knowledge exists and sits in manuals and marketing rather than
in codes, scopes and syllabuses. The causes, each with its evidence: standards scope
boundaries (IEC 62548-1 to the DC terminals, IEC TS 62738 from MV, Section 712 silent,
60364-7-712:2025 claiming to add plant requirements); contractual boundaries (SMA's
exclusion, Huawei's advice to reset the protection point, employers' requirements saying
"according to design" without stating the design, IE scopes not found to include IMD
verification); weak commissioning at utility scale (Queensland); limited specialist
knowledge (small-scale qualifications, practitioner forums showing confusion on
grounded against ungrounded behaviour); inadequate data (no harmonised ticket
taxonomy, no earth-fault category, under-reported farms); and the technology shift
Bender describes, from central inverters with built-in IMDs to many transformerless
string inverters on one galvanically connected network with a one-IMD-per-network rule.

What would settle it: a representative as-built survey by an independent engineer or
insurer of fifty or more string-inverter plants across jurisdictions recording the LV
earthing arrangement actually installed, the presence, placement and settings of IMDs,
whether inverter insulation thresholds were lowered, and whether the 411.6.4 loop
impedance was verified at commissioning; OEM alarm telemetry split AC and DC with
fault durations before clearance across a fleet, of the kind Huawei quoted for one floating
plant (17,685 low-insulation alarms in a month, section 7); a harmonised O&M ticket
category for AC-side insulation and earth faults applied retrospectively to portfolios such


                                                                                    Page 102 of 134

---

## PDF page 103 / 134

Earthing, inverter topology and protection in utility-scale solar




as kWh Analytics' 301 sites; insurer claims coding for AC earth faults and transformer-LV
cable failures on string-inverter plants; staged tests on a representative LV collection
network, a cross-country fault between two inverter cables, measuring clearance by
upstream devices against inverter RCMUs; and the text of IEC 60364-7-712:2025 and any
TC 82 project on the AC side.

Contradictions recorded: Bender's "large photovoltaic systems are generally planned,
designed and operated as unearthed grids" against SMA's earthed-star-point
requirement, two manufacturer positions and no standard adjudicating; Bender's reading
of DIN VDE 0100-410 against BS 7671's "continuity of supply" condition, the DIN text not
opened; the Huawei paper's "rare in real world" against the Huawei white paper's 17,685
alarms a month, different definitions and plant types; Fraunhofer's "AC section ... far more
often involved in fires than expected" against BRE's DC-isolator finding, different
populations and decades; Huawei's warning that earthing the neutral of a non-isolated
inverter can short the power module against SMA requiring an earthed star point,
product-specific design; and IEC 60364-7-712:2025 adding plant requirements against this
report's position that Section 712 is silent, an edition lag. Unverified: any CIGRE, CIRED,
IEEE PVSC or EU PVSEC paper on LV IT collection networks (Chinese-language or
conference-only literature may exist); any insurer loss-prevention text naming IT
networks, IMDs or AC earth faults (FM Global gated, GCube and the HSB/EPRI connector
deck blocked, FM DS 7-106 not opened); IE and lender's-engineer scopes (DNV, Enertis,
Everoze, Natural Power, RINA not opened); PV IMD market sizes; the content of IEC
60364-7-712:2025 and the TC 82 work programme; the DIN VDE wording; the IET Code of
Practice second edition's treatment of large plants; the City & Guilds 2399 and EAL
handbooks; Japanese, US, Canadian and New Zealand accident analyses; and the "decade
without incidents" claim. One process note: that pass made 16 searches against a 15-
search budget and reported it.


Quantitative models
A shared 4,000 A busbar breaker does not clear a second earth fault between two
inverter feeders in any case modelled here, and at 300 m it never trips at all; a 400 A
device at each feeder clears every case up to 200 m in 20 ms. That is the central result of
an illustrative model, not a commissioned protection study: every input is an assumption
stated below, the device curves are simplified, and a real plant needs the manufacturer's
curves and the measured network. The code is reproducible and is given in full at the end
of the section.

Assumptions for the two representative systems:




                                                                                   Page 103 of 134

---

## PDF page 104 / 134

Earthing, inverter topology and protection in utility-scale solar




   Parameter                                        800 V system                                   1,000 V system

   LV winding                                       4.95 MVA, 9.5% impedance, X/R 10, one          5.0 MVA, 9.5%, X/R 10
                                                    of two windings on a 9.9 MVA
                                                    transformer

   HV source                                        500 MVA fault level at 33 kV                   500 MVA

   Inverters per winding                            14 at 254 A (352 kVA transformerless)          10 at 292 A (506 kW
                                                                                                   class)

   Feeder                                           one 400 mm² aluminium single core per          same
                                                    phase, 0.103 Ω/km at 90 °C, 0.08 Ω/km
                                                    reactance; lengths 50 to 300 m

   Protective conductor                             200 mm² aluminium (half the line size),        same
                                                    0.206 Ω/km; k = 94 (thermosetting
                                                    insulation)

   Feeder device                                    400 A MCCB, instantaneous at 10 × In           same
                                                    (4,000 A), 20 ms

   Busbar device                                    4,000 A ACB, long-time I²t set to 10 s at 6    3,200 A ACB, same
                                                    × In, short-time pickup 6 × In at 0.3 s        settings

   Network capacitance                              cables 0.15 µF per km per core on tray;        same per inverter
                                                    inverter filter 0.2 µF per phase per
                                                    inverter; array to earth per inverter 1.2 µF
                                                    dry, 36.5 µF front wet, 72.7 µF both faces
                                                    wet (from SMA's 60 to 110 nF per kWp
                                                    applied to 475 kWp)

   Bonding and fault                                0.05 Ω structure bonding between the           same
   resistance                                       two fault points; 0 Ω at each fault; earth
                                                    grid 0.5 Ω to remote earth; varied in the
                                                    sensitivity runs

   DC bus                                           1,180 V operating, 1,500 V maximum; anti-      same
                                                    PID common-mode 906 V


Conductor-to-earth voltages follow from the arrangement alone and need no model: 462
V healthy and 800 V after a first fault on the 800 V system, 577 V and 1,000 V on the 1,000
V system; the IEC 60364-4-44 temporary overvoltage allowance adds 1,200 V for 5 s; a
restriking fault at 6 to 8 times phase voltage reaches 2,800 to 3,700 V on 800 V and 3,500
to 4,600 V on 1,000 V; a DC pole-to-earth fault on an operating inverter puts the AC
winding at about 1,240 V peak against earth on 800 V (1,400 V at a 1,500 V bus) and 1,410 V




                                                                                                                Page 104 of 134

---

## PDF page 105 / 134

Earthing, inverter topology and protection in utility-scale solar




peak on 1,000 V (1,570 V at a 1,500 V bus); and the anti-PID offset holds the whole network
near 906 V DC above earth in normal running. The three-phase fault at the busbar is 34 kA
on the 800 V winding and 28 kA on the 1,000 V winding, consistent with a 36 kA incomer.

The first fault. With the inverters off, the first-fault current is the charging current of
cables and filters, 1.3 A on the 800 V winding and 1.2 A on 1,000 V, and the touch voltages
are below a volt. With the inverters connected the array capacitance is impressed with
the full displacement through the bridges: 3.7 A with dry modules, 76 A with the front
glass wet and 149 A with both faces wet on the 800 V winding (3.3, 67 and 133 A on 1,000
V). Against the 50 V condition of BS 7671 411.6.2, the local touch voltage on bonded steel
stays under 30 V in every case, but the voltage against remote earth through a 0.5 Ω grid
reaches 38 V with wet fronts and 75 V with both faces wet, above the limit. The condition
is transient in practice, because each inverter is passing 5 to 10 A of residual current and
its monitor trips within 40 to 300 ms, which removes the array capacitance and drops the
fault current back to the cable value; the price is that a wet-day first fault on the AC side
disconnects the whole winding's generation, which is the continuity the IT arrangement
was supposed to preserve.

The second fault, line-to-line through the earth between two feeders of equal length, with
the 2 Ia Zs ≤ U test of 411.6.4 taken with Ia at the MCCB's instantaneous pickup:


  Feeder          Second-             One-          2 Ia Zs ≤ 800 V   400 A MCCB      4,000 A   Line and PE   PE within
  length          fault               path                            clears          ACB       within        limit under
                  current,            Zs                                              clears    adiabatic     the MCCB
                  800 V                                                                         limit under
                                                                                                the ACB

  50 m            8.8 kA              24 mΩ         yes               20 ms           74 s      no            yes

  100 m           6.6 kA              39 mΩ         yes               20 ms           134 s     no            yes

  150 m           5.2 kA              54 mΩ         yes               20 ms           213 s     no            yes

  200 m           4.3 kA              70 mΩ         yes               20 ms           310 s     no            yes

  300 m           3.2 kA              101           no at             no              never      no           depends
                                      mΩ            instantaneous     instantaneous   (below                  on thermal
                                                    pickup            trip; thermal   1.05 × In)              curve
                                                                      region


On the 1,000 V system the currents are 10.2, 7.7, 6.2, 5.2 and 3.9 kA for the same lengths;
the ACB takes 36 to 240 s and the MCCB clears instantaneously up to 200 m.

Three conclusions are robust to the assumptions. First, the busbar ACB cannot protect
individual feeders against a second fault: the current is one to two times its rating, it sits
in the long-time region for minutes, and in every case the let-through energy exceeds the
adiabatic withstand of both the 400 mm² line and the 200 mm² protective conductor,
which means conductor damage and a fire at the fault point before the device opens; at



                                                                                                                Page 105 of 134

---

## PDF page 106 / 134

Earthing, inverter topology and protection in utility-scale solar




300 m the fault is below the ACB's pickup and persists indefinitely. Second, a protective
device at each feeder sized for the inverter clears every modelled case within the
required time up to 200 m, and the protective conductor survives; at 300 m the
regulation's test is still met if Ia is taken at the device's 5 s operating current rather than
its instantaneous pickup, which is what 411.6.4 permits for a distribution circuit, but the
designer must show it. A load-break switch at the feeder provides none of this. Third, the
parameters that matter are not the ones usually argued about: transformer impedance
between 6% and 12% changes the 150 m fault current by 4%, while bonding resistance
between the two fault points changes it from 7.4 kA at zero to 1.3 kA at 0.5 Ω, and 0.1 Ω of
resistance at each fault point halves it. The quality of the structure bonding and the
nature of the fault decide whether a second fault is a clean trip or a slow fire.

The inverters themselves contribute about 1.2 times rated current, 4.3 kA for the whole
800 V winding, for a few cycles before they trip on voltage, and the direction of the fault
current is from the transformer whether or not they are connected; a second fault that
occurs after the inverters have already tripped on a first fault is fed by the grid alone,
which is the case the busbar ACB sees least well.

What the model does not do: it uses balanced steady-state phasors and ignores the DC
offset and common-mode components; it treats devices with two-point curves rather
than manufacturer characteristics; it ignores arc voltage at the fault, which reduces
current and lengthens clearing; it assumes the two faults are on different feeders and at
their far ends; and it does not model the first-fault RCMU trips dynamically. Each of these
is a reason to commission a proper study, not a reason to ignore the direction of the
results.

   #!/usr/bin/env python3
   """Illustrative fault model for an LV IT collection network behind
   transformerless string inverters.
   Not a commissioned protection study. All inputs are stated assumptions;
   change them in SYSTEMS below.
   Run: python3 -I it_model.py
   """
   import math

   W = 2 * math.pi * 50                            # rad/s at 50 Hz

   SYSTEMS = {
            "800 V": dict(
           u_ll=800.0, s_winding_mva=4.95, uk_pct=9.5, xr=10.0,
   hv_fault_mva=500.0,
                    n_inv=14, i_inv=254.0, feeder_m=(50, 100, 150, 200, 300),
                    line_r_ohm_km=0.103, line_x_ohm_km=0.08,   # 400 mm2 Al single core
   at 90 C




                                                                                        Page 106 of 134

---

## PDF page 107 / 134

Earthing, inverter topology and protection in utility-scale solar




                    pe_r_ohm_km=0.206,                              # 200 mm2 Al protective
   conductor (S/2)
                    k_line=94, csa_line=400, k_pe=94, csa_pe=200,
                    mccb_in=400.0, mccb_inst_x=10.0, acb_in=4000.0, acb_lt_tr_s=10.0,
   acb_sd_x=6.0, acb_sd_t=0.3,
           c_filter_uF_per_phase_per_inv=0.2, c_cable_uF_per_km_core=0.15,
                    c_array_uF_per_inv=dict(dry=1.2, front_wet=36.5, both_wet=72.7),
                    vdc_bus=1180.0, vdc_max=1500.0, anti_pid_cm_v=906.0,
            ),
            "1000 V": dict(
                u_ll=1000.0, s_winding_mva=5.0, uk_pct=9.5, xr=10.0,
   hv_fault_mva=500.0,
           n_inv=10, i_inv=292.0, feeder_m=(50, 100, 150, 200, 300),
                    line_r_ohm_km=0.103, line_x_ohm_km=0.08, pe_r_ohm_km=0.206,
                    k_line=94, csa_line=400, k_pe=94, csa_pe=200,
                    mccb_in=400.0, mccb_inst_x=10.0, acb_in=3200.0, acb_lt_tr_s=10.0,
   acb_sd_x=6.0, acb_sd_t=0.3,
           c_filter_uF_per_phase_per_inv=0.2, c_cable_uF_per_km_core=0.15,
                    c_array_uF_per_inv=dict(dry=1.2, front_wet=36.5, both_wet=72.7),
                    vdc_bus=1180.0, vdc_max=1500.0, anti_pid_cm_v=906.0,
            ),
   }



   def z_source(p):
       """Transformer + HV source impedance per phase, referred to the LV
   winding (ohm, complex)."""
       u = p["u_ll"]
            z_t = p["uk_pct"] / 100 * u ** 2 / (p["s_winding_mva"] * 1e6)
            r_t = z_t / math.sqrt(1 + p["xr"] ** 2)
            x_t = r_t * p["xr"]
            x_src = u ** 2 / (p["hv_fault_mva"] * 1e6)
            return complex(r_t, x_t + x_src)



   def feeder_z(p, length_m, conductor="line"):
            if conductor == "line":
                return complex(p["line_r_ohm_km"], p["line_x_ohm_km"]) * length_m /
   1000
            return complex(p["pe_r_ohm_km"], 0.0) * length_m / 1000



   def voltages(p):
            u, uph = p["u_ll"], p["u_ll"] / math.sqrt(3)
            uph_pk = uph * math.sqrt(2)
            return dict(




                                                                                       Page 107 of 134

---

## PDF page 108 / 134

Earthing, inverter topology and protection in utility-scale solar




                    phase_to_earth_healthy=uph,
                    phase_to_earth_first_fault=u,
                    tov_iec60364_4_44=1200.0 + u,
                    restrike_6x=6 * uph, restrike_8x=8 * uph,
                    dc_pole_healthy=p["vdc_bus"] / 2,
                    ac_phase_pk_after_dc_pole_fault=p["vdc_bus"] / 2 + uph_pk,
                    ac_phase_pk_after_dc_pole_fault_vmax=p["vdc_max"] / 2 + uph_pk,
                    anti_pid_cm=p["anti_pid_cm_v"],
            )



   def first_fault(p, length_m=100, inverters="off", wetness="dry", r_bond=0.2,
   r_grid=0.5):
            """Capacitive first-fault current and the resulting touch voltages."""
            uph = p["u_ll"] / math.sqrt(3)
       c_cable = p["c_cable_uF_per_km_core"] * 1e-6 * length_m / 1000 *
   p["n_inv"]       # per phase
            c_filter = p["c_filter_uF_per_phase_per_inv"] * 1e-6 * p["n_inv"]
   # per phase
       c_ph = c_cable + c_filter
       i_cap = 3 * W * c_ph * uph
   # classic IT first-fault current
            if inverters == "on":
                    c_arr = p["c_array_uF_per_inv"][wetness] * 1e-6 * p["n_inv"]
                    i_cap += W * c_arr * uph
       return dict(i_fault_a=i_cap, touch_v_local=i_cap * r_bond,
   touch_v_remote=i_cap * r_grid, limit_v=50.0)



   def device_time(p, i_fault, device):
       """Very simplified operating-time estimates. Real curves must come from
   the manufacturer."""
            if device == "mccb":
                return 0.02 if i_fault >= p["mccb_in"] * p["mccb_inst_x"] else
   float("nan")
            if device == "acb":
                i_sd = p["acb_in"] * p["acb_sd_x"]
                    if i_fault >= i_sd:
                        return p["acb_sd_t"]
                    ratio = i_fault / p["acb_in"]
                    if ratio <= 1.05:
                        return float("inf")
                return p["acb_lt_tr_s"] * (6.0 / ratio) ** 2
            raise ValueError(device)




                                                                                      Page 108 of 134

---

## PDF page 109 / 134

Earthing, inverter topology and protection in utility-scale solar




   def adiabatic_ok(p, i_fault, t_s, conductor):
       k, s = (p["k_line"], p["csa_line"]) if conductor == "line" else
   (p["k_pe"], p["csa_pe"])
       if math.isinf(t_s) or math.isnan(t_s):
                    return False
            return i_fault ** 2 * t_s <= (k * s) ** 2



   def second_fault(p, la_m, lb_m, r_bond=0.05, r_fault=0.0):
       """Line-to-line fault through the earth: L1 of feeder A to frame, L2 of
   feeder B to frame."""
            u = p["u_ll"]
            zs = z_source(p)
            z_loop = (2 * zs + feeder_z(p, la_m) + feeder_z(p, la_m, "pe")
                                 + feeder_z(p, lb_m) + feeder_z(p, lb_m, "pe") + 2 * r_fault +
   r_bond)
            i = u / abs(z_loop)
            zs_single = abs(zs + feeder_z(p, la_m) + feeder_z(p, la_m, "pe"))
            return dict(i_fault_a=i, z_loop_ohm=abs(z_loop), zs_single_ohm=zs_single)



   def three_phase(p, length_m):
            uph = p["u_ll"] / math.sqrt(3)
            return uph / abs(z_source(p) + feeder_z(p, length_m))



   def main():
       for name, p in SYSTEMS.items():
                    print("=" * 78)
           print(f"{name} system: winding {p['s_winding_mva']} MVA, uk
   {p['uk_pct']}%, {p['n_inv']} inverters of {p['i_inv']} A")
                    for k, val in voltages(p).items():
                        print(f" {k:40s} {val:8.0f} V")
                    print(f"              three-phase fault at busbar      {three_phase(p,
   0)/1000:8.1f} kA")
           for inv in ("off", "on"):
               for wet in (("dry",) if inv == "off" else ("dry", "front_wet",
   "both_wet")):
                                      f = first_fault(p, 100, inv, wet)
                   print(f"    inverters {inv:3s} {wet:9s}: Id
   {f['i_fault_a']:7.1f} A, touch local {f['touch_v_local']:5.1f} V, remote
   {f['touch_v_remote']:6.1f} V")
           for L in p["feeder_m"]:
                             s = second_fault(p, L, L)
                             i = s["i_fault_a"]
                             t_m, t_a = device_time(p, i, "mccb"), device_time(p, i, "acb")




                                                                                          Page 109 of 134

---

## PDF page 110 / 134

Earthing, inverter topology and protection in utility-scale solar




                             cond = 2 * p["mccb_in"] * p["mccb_inst_x"] * s["zs_single_ohm"]
   <= p["u_ll"]
                             print(f"                  {L:4d} m     {i/1000:6.1f} kA    Zs
   {s['zs_single_ohm']*1000:6.1f} mohm                                2IaZs<=U {cond}    MCCB {t_m:6.3f} s      ACB
   {t_a:7.1f} s                  "
                                          f"line/ACB {adiabatic_ok(p, i, t_a, 'line')}             PE/ACB
   {adiabatic_ok(p, i, t_a, 'pe')} PE/MCCB {adiabatic_ok(p, i, t_m, 'pe')}")
           for uk in (6.0, 9.5, 12.0):
               print(f"    uk {uk:4.1f}%: {second_fault(dict(p,
   uk_pct=uk),150,150)['i_fault_a']/1000:5.1f} kA")
                    for rb in (0.0, 0.05, 0.2, 0.5):
               print(f"    bonding {rb:4.2f} ohm:
   {second_fault(p,150,150,r_bond=rb)['i_fault_a']/1000:5.1f} kA")
                    for rf in (0.0, 0.05, 0.1, 0.2):
                        print(f"    fault resistance {rf:4.2f} ohm each:
   {second_fault(p,150,150,r_fault=rf)['i_fault_a']/1000:5.1f} kA")
           print(f" Inverter contribution while connected: about {1.2 *
   p['i_inv'] * p['n_inv']/1000:4.1f} kA for a few cycles")



   if __name__ == "__main__":
            main()




Diagrams
Three drawings carry the argument of the report: what a first fault does on each earthing
arrangement, what path a second fault takes and which device sees it, and what each
monitoring device can and cannot see. The quantities on them are from the models
section; the connections are generic and name no plant.




first fault on TN-S and on IT · same fault, two outcomes



                                                                                                             Page 110 of 134

---

## PDF page 111 / 134

Earthing, inverter topology and protection in utility-scale solar




On TN-S the fault current returns through copper to the earthed star point and a device
clears it; on IT the only return is the network's stray capacitance, nothing operates, and
the healthy lines stand at line-to-line voltage against the frames until the fault is found.




second fault across two feeders · the loop and the devices on it

The loop runs from one phase of the winding out along feeder A, through the first fault
into the steel, through the bonding to the second fault, and back along feeder B to
another phase. Two devices sit on it: the feeder devices, which see a current many times
their rating, and the busbar breaker, which sees a current near its rating and treats it as
load.




monitoring zones on one inverter block · four devices, one gap



                                                                                      Page 111 of 134

---

## PDF page 112 / 134

Earthing, inverter topology and protection in utility-scale solar




The inverter's own test reaches the array and only before start; its residual-current
monitor reaches a fault only if the current returns through the inverter; the AC cable
between the inverter and the busbar, and the whole plant while it runs, are inside no zone
but the winding monitor's. Where that monitor is absent the band at the bottom is empty,
and the AC cable after a tripped inverter is live from the transformer with nothing
watching it.


Twenty questions for inverter manufacturers and design engineers
Each question is written so that the answer is a document, a number or a drawing rather
than an assurance. The first ten go to the inverter manufacturer; the second ten go to the
designer, EPC or owner's engineer.

 1. State, for this model and firmware, the permitted earthing arrangements of the AC
    network (earthed star, unearthed star, delta, high-resistance earthed), the maximum
    number of inverters per winding, and whether the answer changes when anti-PID, PID
    recovery or night-time reactive power is enabled. Cite the manual section and revision.
 2. Define the 906 V (or equivalent) conductor-to-earth requirement for connected
      equipment: is it a DC offset, an r.m.s. value, a peak, a withstand test level, or a
      combination, and under which operating modes does it apply? Provide the waveform
      or the measurement it is derived from.
 3. During grid operation, what does the inverter's insulation measurement cover, if
      anything, and at what interval? If it covers only the pre-connection state, state the
      threshold formula, the default, the adjustable range, who can change it, and whether
      changes are logged.
 4. State the residual-current monitoring limits (continuous and step), whether they are
    adjustable, the range, the access level needed, and the array capacitance to earth up
      to which the protective functions are validated.
 5. Does the inverter detect, locate or respond to an earth fault on the AC network
    between its terminals and the transformer? If its residual-current monitor can trip on
    capacitive current from such a fault, how does the operator distinguish that event from
    a DC-side fault?
 6. Confirm whether the inverter's pre-connection insulation test interferes with a central
    insulation monitoring device on the same winding, and provide the recommended
    coordination (sequencing, profile, coupling device) with named IMD products you have
    tested.
 7. State the inverter's short-circuit current contribution (magnitude and duration) into an
      AC fault, the condition under which it disconnects, and whether it provides any trip
      signal to upstream switchgear.




                                                                                     Page 112 of 134

---

## PDF page 113 / 134

Earthing, inverter topology and protection in utility-scale solar




 8. For the integrated DC switch: standard, utilisation category (IEC 60947-3 DC-PV2 or
    other), rated breaking current, and the conditions under which the manual forbids
    operating it. State how a single string can be isolated under fault, if at all.
 9. State the DC-link capacitance (or the energy at rated DC voltage), the discharge
    means (passive or active), the time to 50 V with the discharge means intact and with it
      failed, and the test by which an operator proves the link discharged.
10. List the arc-fault detection standard and class (UL 1699B, IEC 63027 classification),
    whether parallel arcs and arcs to the enclosure are detected, the default enabled state
    per country data set, the automatic restart count, and whether the inverter's own
      input connectors are inside the detection zone.
11. Provide the earthing study: the system earthing arrangement of each LV winding (TN-
    S, IT or HRG), the single-line diagram showing it, and the calculation showing the first-
    fault condition RA x Id <= 50 V with the measured or assumed network capacitance.
12. Provide the second-fault study: prospective second-fault current for faults in the same
      feeder, different feeders and across the busbar, with transformer impedance on the
      winding base, feeder and protective-conductor impedances, inverter contribution, the
      protective device assumed to clear each case, its operating time against the 411.6.4
      condition, and the adiabatic check of each protective conductor.
13. State the protective device at each inverter feeder (MCCB, fused switch or switch-
      disconnector), its breaking capacity against the fault level at both ends of the feeder,
      and the time-current coordination with the busbar ACB. If feeders rely on the
      upstream ACB, show the ACB's settings see a second fault at the far end of the longest
      feeder.
14. State the insulation monitoring device per winding: product, standard, coupling device
      and voltage range including DC offset, pre-warning and alarm values with the
      justification against IEC 62548-1 Table 2 or DIN VDE 0100-530, the response time at the
      plant's measured capacitance, and where the alarm is annunciated and latched.
15. State whether an insulation fault location system is provided, the number of channels,
      and the target time from alarm to identified feeder or string. If none, describe the
      written procedure for locating a first fault while the plant runs.
16. State the cable voltage designation for the LV collection network (U0/U) and the IEC
    60502-1 category assumed, with the manufacturer's confirmation that the cable is
    suitable for sustained line-to-line voltage to earth if a first fault may persist; state the
      same for the transformer LV winding, busbars, switchgear, SPDs and instrument
      transformers.
17. Provide the commissioning record for every monitoring and protective device on the
    single-line diagram, reconciled by serial number against the installed item, with the
      functional test of each IMD (test resistor, reading, alarm, SCADA receipt, latching) and




                                                                                         Page 113 of 134

---

## PDF page 114 / 134

Earthing, inverter topology and protection in utility-scale solar




      the threshold register of every inverter's insulation and residual-current settings
      against design.
18. State the operating rule for a first-fault alarm: who owns it, the time to acknowledge,
    locate and clear, what work is prohibited while it stands, and where the record is kept.
    Show how a cancelled or lowered-threshold alarm is captured.
19. Provide the safe-isolation procedure for an inverter block that follows the
    manufacturer's instructions: string current clamped below the manufacturer's limit
      before any DC switch or connector is operated, the discharge wait, proving dead pole
      to pole and each pole to earth on both sides, discharge and earthing, and the live-work
      justification for any work on illuminated strings.
20. State how the as-built single-line diagram, device schedule and settings register will be
      kept current through the O&M period, who signs changes to protection or monitoring
      settings, and how the lender's engineer and insurer verify them at each review.


Commissioning and technical due-diligence checklist
The checklist is ordered as a reviewer would meet the plant: design documents first, then
the installed hardware, then the functional tests, then the operating arrangements. Each
item is a yes-or-no with evidence, and the evidence named is the minimum that would
satisfy a lender's engineer or insurer. Items marked IT apply only where an LV winding is
run unearthed.

Design documents

      The single-line diagram states the system earthing arrangement of each LV winding
      (TN-S, IT or high-resistance earthed) and of the DC array, and the inverter manual
      revision that requires it is referenced on the drawing.
      The earthing study shows the first-fault condition of BS 7671 411.6.2 (RA x Id <= 50 V)
      with the network capacitance used, and states how that capacitance was estimated or
      measured. IT.
      A second-fault study exists for faults within a feeder, between feeders and across the
      busbar, with the clearing device, operating time against 411.6.4 and the adiabatic check
      of every protective conductor. IT.
      The protection coordination study covers each inverter feeder device, any AC
      combiner device and the busbar ACB, with fault levels at both ends of the longest
      feeder and let-through energy against cable and PE withstand.
      Cable, transformer winding, switchgear, SPD and instrument-transformer insulation
      ratings are stated against the sustained line-to-line voltage to earth and the
      manufacturer's withstand requirement (906 V or as stated), with the IEC 60502-1
      category assumed for the cables. IT.



                                                                                      Page 114 of 134

---

## PDF page 115 / 134

Earthing, inverter topology and protection in utility-scale solar




      An insulation monitoring device is specified per galvanically separate winding with
      coupling device, voltage and capacitance range, pre-warning and alarm values and
      their justification, and an insulation fault location system or a written location
      procedure. IT.
      Inverter insulation and residual-current thresholds and arc-fault settings are listed as
      design values with the access level that may change them.
      DC string protection is justified: strings per MPPT against module reverse-current
      rating, fuse selection where required, connector type and manufacturer matched to
      the inverter's, cable support and segregation to IEC 62548-1 and IEC TS 62738.

Installed hardware

      A protection and monitoring device schedule reconciles every device on the issued-
      for-construction single-line diagram against the installed item by serial number and
      photograph; no provisional acceptance while any listed device is absent.
      The LV winding star points are connected as the drawing states (earthed, or unearthed
      with the IMD coupling connected), confirmed by inspection at the transformer, not
      inferred from the inverter.
      Feeder devices are what the specification calls for (MCCB, fused switch or switch-
      disconnector), labelled with their rating and breaking capacity, and the ACB settings
      match the coordination study.
      Cable designations on the LV network match the design (U0/U), terminations are
      bimetallic where aluminium meets copper, and protective conductors are the designed
      size.
      DC connectors are one make and type at every mating pair, open ends are capped,
      string cables are supported at the specified interval with ties of the specified material,
      and no cable lies on a sharp edge, on the ground or in water.
      Labels required by BS 7671 for IT systems and by the inverter manual (including any
      warning of the common-mode offset and the discharge time) are fitted.

Functional tests

      Each IMD is tested with a known resistor from one live conductor to earth: reading
      recorded, alarm at the set value, alarm received at SCADA and at the attended point,
      alarm latching while the resistor remains. IT.
      With all inverters connected, each winding's IMD is proved to see its own system only,
      and the inverter pre-connection tests are proved not to disturb it. IT.
      Every inverter's insulation threshold, residual-current limits and arc-fault state are
      read back and recorded in the threshold register against the design values.




                                                                                        Page 115 of 134

---

## PDF page 116 / 134

Earthing, inverter topology and protection in utility-scale solar




      IEC 62446-1 Category 1 tests on every string: continuity and bonding, polarity, Voc, Isc
      or Impp, insulation resistance at the correct test voltage with a tester rated for the
      system voltage and at or above 1 MOhm, recorded per string as the monitoring
      baseline; Category 2 I-V and thermography on a sample.
      Second-fault loop verified on the LV network: measured loop impedance between two
      feeders through the protective conductors compared with the study, and the clearing
      device's setting confirmed. IT.
      Alarm-to-ticket test: an IMD alarm and an inverter insulation alarm each open a
      timestamped ticket at the operations desk and start the response clock defined in the
      O&M contract.
      The safe-isolation procedure is demonstrated on one inverter: AC isolated and locked,
      string current clamped below the manufacturer's limit, DC switches opened, discharge
      wait, proving dead pole to pole and each pole to earth on both sides with a proved
      instrument, discharge and earthing, permit issued.

Operating arrangements

      A named person owns insulation and residual-current alarms, the alarm log and the
      thresholds; nobody else resets or changes them, and changes are recorded with a
      justification.
      The first-fault response rule is written: acknowledgement, location and clearance
      times, work prohibited while a fault stands, and de-energisation of the section if the
      time is exceeded. IT.
      IMD functional tests are repeated at a stated interval and after firmware changes;
      thresholds are reviewed against the trend of healthy insulation values each year. IT.
      Connector, tie and cable-support inspection and replacement are in the maintenance
      plan with sampling rates and replacement intervals.
      Shocks, flashes and alarms cleared by disconnection are reported to the owner within
      a stated time and to the regulator where required, and safety stops are excluded from
      the availability guarantee.
      The as-built single-line diagram, device schedule and threshold register are kept
      current and are presented at each lender's and insurer's review.


Knowledge library schema
The library separates what a document says (a requirement, with its source and revision)
from what the world is (an inverter model, a transformer arrangement) and from what we
calculated (a fault scenario). Every record carries a unique identifier, a source reference, a




                                                                                       Page 116 of 134

---

## PDF page 117 / 134

Earthing, inverter topology and protection in utility-scale solar




revision, a jurisdiction, the equipment it applies to, an evidence class and a last-verified
date, so that a reader can tell a manufacturer's sentence from an independent
measurement from an estimate.

Record types and their identifiers:


   Type                                    Prefix           What one record is    Key fields beyond the common set

   Source                                  SRC              One document at one   title, publisher, type (manual,
                                                            revision              standard, paper, incident report,
                                                                                  marketing), revision, date, url,
                                                                                  section, independence
                                                                                  (independent or manufacturer)

   Standard clause                         STD              One clause of one     standard, edition, clause,
                                                            standard edition      requirement in plain words,
                                                                                  applies_to (dc_array, inverter,
                                                                                  lv_network, transformer,
                                                                                  installation), verification method

   Inverter model                          INV              One model or family   maker, model, topology (string or
                                                            at one manual         central), isolation, dc_vmax,
                                                            revision              ac_vnom, power, mppt_count,
                                                                                  strings_per_mppt, string_fusing,
                                                                                  dc_switch_category,
                                                                                  dc_link_energy_j, discharge_time_s

   Manufacturer                            REQ              One stated            inverter_id, topic (ac_earthing,
   requirement                                              requirement from      dc_grounding, anti_pid,
                                                            one manual            withstand_voltage,
                                                                                  external_protection, monitoring,
                                                                                  isolation), requirement,
                                                                                  exact_fragment, condition (for
                                                                                  example anti-PID enabled),
                                                                                  source_id

   Earthing                                EAC              One arrangement of    network (dc_array or lv_ac),
   configuration                                            one network           arrangement (TN-S, TN-C-S, TT, IT,
                                                                                  HRG, negative_grounded,
                                                                                  positive_grounded, floating),
                                                                                  star_point_treatment,
                                                                                  neutral_distributed,
                                                                                  first_fault_detection,
                                                                                  second_fault_clearance




                                                                                                               Page 117 of 134

---

## PDF page 118 / 134

Earthing, inverter topology and protection in utility-scale solar




   Type                                    Prefix           What one record is    Key fields beyond the common set

   Transformer                             TRX              One winding           vector_group, windings, lv_voltage,
   arrangement                                              arrangement           rating_mva, impedance_pct,
                                                                                  inverters_per_winding,
                                                                                  shield_winding,
                                                                                  lv_withstand_to_earth

   Cable                                   CAB              One cable type as     role (dc_string, ac_feeder, pe),
                                                            used in one role      conductor, csa_mm2,
                                                                                  designation_u0_u, standard,
                                                                                  iec60502_category_assumed,
                                                                                  rated_to_earth_v

   Protection or                           DEV              One device type in    position (inverter_feeder, busbar,
   monitoring device                                        one position          winding, string), device_class
                                                                                  (MCCB, ACB, fused_switch,
                                                                                  switch_disconnector, IMD, IFLS,
                                                                                  RCM, RCD, GFDI, AFDD), standard,
                                                                                  rating, setting, breaking_capacity,
                                                                                  utilisation_category

   Fault scenario                          FLT              One calculated or     network, scenario (healthy,
                                                            observed case         first_fault,
                                                                                  second_fault_same_feeder,
                                                                                  second_fault_cross_feeder,
                                                                                  dc_pole_fault,
                                                                                  ac_fault_with_inverters_on), inputs,
                                                                                  results (conductor_to_earth_v,
                                                                                  fault_current_a,
                                                                                  loop_impedance_ohm,
                                                                                  clearing_time_s, touch_voltage_v),
                                                                                  method, observed_or_calculated

   Finding                                 FND              One conclusion of     statement, evidence_class,
                                                            this report           supporting_source_ids,
                                                                                  contradicting_source_ids,
                                                                                  open_question_id

   Open question                           OPQ              One unresolved item   question, evidence_needed,
                                                                                  owner_type (manufacturer, test lab,
                                                                                  modelling, field), priority


Common fields on every record: id, record_type, source_ids, revision, jurisdiction (UK, EU,
US, AU, CN, global), applies_to, evidence_class (confirmed, reasonably_inferred,
disputed, unverified, unknown), last_verified (ISO date), verified_by, notes.



                                                                                                                Page 118 of 134

---

## PDF page 119 / 134

Earthing, inverter topology and protection in utility-scale solar




Relationships are stored as a separate edge table so that the same inverter can require
one configuration under anti-PID and permit another without it:

   edge_id,from_id,relation,to_id,condition,source_id,evidence_class
   E-0001,INV-SG350HX-v24,requires_ac_earthing,EAC-LV-IT-STAR-
   UNEARTHED,anti_pid_enabled,SRC-SUNGROW-SG350HX-UM-V24,confirmed
   E-0002,INV-SG350HX-v24,prohibits_dc_grounding,EAC-DC-FLOATING,always,SRC-
   SUNGROW-SG350HX-UM-V24,confirmed
   E-0003,INV-SHP180-21,requires_ac_earthing,EAC-LV-TNS-STAR-EARTHED,always,SRC-
   SMA-SHP-21-MANUAL,confirmed
   E-0004,EAC-LV-IT-STAR-UNEARTHED,requires_device,DEV-IMD-PER-
   WINDING,continuity_of_supply,STD-BS7671-411.6.3.1,confirmed
   E-0005,EAC-LV-IT-STAR-UNEARTHED,implies_cable_category,CAB-AC-FEEDER-CAT-
   C,first_fault_not_promptly_cleared,STD-IEC60502-1-CAT,reasonably_inferred


The relation vocabulary is closed: requires_ac_earthing, permits_ac_earthing,
prohibits_ac_earthing, prohibits_dc_grounding, permits_dc_grounding, requires_device,
requires_withstand, requires_external_protection, implies_cable_category,
applies_clause, covered_by_monitoring, not_covered_by_monitoring, cleared_by,
contradicts, supersedes.

The inverter table in CSV, with one example row:

   id,maker,model,family,topology,isolation,dc_vmax_v,ac_vnom_v,power_kva,mppt_c
   ount,strings_per_mppt,string_fusing,dc_switch_category,dc_link_energy_j,disch
   arge_time_s,manual_revision,manual_date,jurisdiction,source_id,evidence_class
   ,last_verified
   INV-SG350HX-
   v24,Sungrow,SG350HX,HX,string,none,1500,800,352,12,2,none,unstated,unknown,15
   00,v24,unknown,EU,SRC-SUNGROW-SG350HX-UM-V24,confirmed,2026-10-21


The JSON form of a manufacturer requirement record, which is the record type most of
the library will contain:




                                                                                 Page 119 of 134

---

## PDF page 120 / 134

Earthing, inverter topology and protection in utility-scale solar




   {
       "id": "REQ-SG350HX-v24-ACEARTH-01",
       "record_type": "manufacturer_requirement",
       "inverter_id": "INV-SG350HX-v24",
       "topic": "ac_earthing",
       "requirement": "LV star point must not be earthed when anti-PID is enabled;
   connected LV equipment must withstand at least 906 V to earth",
     "exact_fragment": "If the LV side winding is in Y shape, neutral point
   grounding is prohibited.",
       "condition": "anti_pid_enabled",
       "applies_to": ["lv_network", "transformer"],
       "source_ids": ["SRC-SUNGROW-SG350HX-UM-V24"],
       "source_section": "5.6.1",
       "revision": "v24",
       "jurisdiction": "EU",
       "evidence_class": "confirmed",
       "last_verified": "2026-10-21",
       "verified_by": "report author",
     "notes": "A Polish-language edition reportedly states 1,500 V; unverified
   against the English edition."
   }


The queries the schema is built to answer, each a join on the edge table: which 800 V
inverters require IT earthing (INV joined to EAC through requires_ac_earthing, filtered on
ac_vnom_v = 800); which models need external AC fault detection (REQ where topic =
external_protection, or EAC where first_fault_detection is external); which architectures
permit DC negative grounding (edges of type permits_dc_grounding); which installations
require central monitoring (EAC joined to DEV through requires_device); which inverter
manuals specify particular protective-device arrangements (REQ where topic =
external_protection, grouped by device class); and, for any fault scenario, which clauses
apply and which sources support the result (FLT joined to STD through applies_clause
and to SRC through source_ids). Calculated results live only in FLT records marked
observed_or_calculated = calculated, so that no simulation output can be mistaken for a
measurement.

The CSV headers for all eleven tables and the JSON Schema for each record type are
delivered as files alongside this report.


Unanswered questions register
Each question below is one the research could not close. The register states why it
matters, what would settle it and who holds the answer; priority A means it changes a
design or safety conclusion in this report, B means it changes a number or a citation, C



                                                                                   Page 120 of 134

---

## PDF page 121 / 134

Earthing, inverter topology and protection in utility-scale solar




means it completes the library. The machine-readable version, one row per unverified
item from all ten passes, is the unverified_items table of the library (section 20 and the
deliverables).


  No.         Question                                 Why it matters           What would settle it    Who holds it        Priority

  1           Does the printed BS                      Every public             Open the book at        The author; the     A
              7671:2018+A4:2026                        statement this work      411.6.3; thirty         IET
              carry the IMD duty at                    has made cites           seconds for anyone
              411.6.3.1 ("an insulation                411.6.3.1; a wrong       holding a copy
              monitoring device shall                  number discredits a
              be provided" where IT                    right argument
              is used for continuity
              of supply), or was it
              renumbered in 2018 as
              BSI's changes
              document implies?

  2           What does Sungrow                        It is the only           A written answer        Sungrow             A
              mean by "906 V": r.m.s.,                 quantified LV            from Sungrow
              peak, a test level, and                  insulation               engineering; the
              at what line voltage                     consequence of an        Polish edition's
              and link voltage?                        IT requirement in        sentence in context
                                                       any manual, and the
                                                       reconstruction
                                                       √(750² + 508²) is this
                                                       report's, not the
                                                       maker's

  3           Why did Huawei move                      The change is the        A written answer; the   Huawei              A
              from "can also apply to                  clearest evidence        330 and 506 kW
              the AC power system                      that the IT              engineering notes
              with the neutral point                   preference is a
              grounding of the step-                   choice; the reason
              up transformer" (2020)                   would say whether it
              to TT, TN-C and TN-C-S                   was leakage, RCMU
              "not recommended"                        behaviour, the AC-
              (2024 to 2026)?                          injected PID module
                                                       or warranty
                                                       exposure

  4           What LV insulation                       No figure is             Huawei's                Huawei              A
              level and what                           published; a 0.6/1 kV    transformer-station
              inverters-per-winding                    cable at 1,000 V line-   requirements (JUPT
              limit does Huawei                        to-line on IT is         series) and the
              require at 800 V and at                  outside its U0 on the    SmartPID2000
              1,000 V AC, where a                      healthy phases           manual
              first fault puts 1,000 V                 during a first fault
              on the healthy phases?




                                                                                                                          Page 121 of 134

---

## PDF page 122 / 134

Earthing, inverter topology and protection in utility-scale solar




  No.         Question                                 Why it matters           What would settle it     Who holds it         Priority

  5           Can the shared 4,000                     Sections 8 and 9         The block's              The designer and     A
              A ACB of the reference                   conclude it cannot       transformer test         the owner's
              block be shown to                        be shown with            certificate              engineer
              clear the far-end                        normal margins on        (impedance on the
              second-fault loop                        two independent          winding base), the
              within 5 s, and what is                  models; the              DNO fault level, the
              its Icu at 800 V?                        transformer test         ACB's Icu/Ics/Icw at
                                                       certificate, the 33 kV   800 V, cable
                                                       fault level and the      reactances, PE sizes
                                                       ACB certificate          and bonding
                                                       decide it                resistances; then the
                                                                                eight-step check of
                                                                                section 9

  6           Is the "one IMD per                      Decides whether          The text of IEC 61557-   The standard         A
              galvanically connected                   fourteen inverters'      8 Ed 3 Annex D and       (licensed);
              system" rule in IEC                      internal monitors        5.x; a Bender or         Bender; the
              61557-8, and does                        satisfy the duty or      Schneider application    author
              Annex D's PV-IMF                         whether a winding-       note on inverter-
              count as an IMD for                      level IMD is             internal monitoring; a
              411.6.3.1 when the AC                    required, and            bench test of two
              side is IT?                              whether two              devices on one
                                                       monitors on one          network
                                                       network interfere

  7           What are the default                     A threshold lowered      The commissioning        The EPC and the      A
              and the field-set                        to stop damp-            record and the           O&M contractor
              insulation and residual-                 weather trips is the     inverter parameter
              current thresholds on                    mechanism by which       export; the O&M log
              the reference block's                    a first fault becomes
              inverters, who                           invisible; no practice
              authorised any change,                   document records
              and where is it                          who may change it
              recorded?

  8           Is IEC 60502-1 Table 1                   It is the basis of the   Open the standard at     The author           B
              read correctly: U0 = 0.6                 correction in section    Table 1                  (holds a copy)
              kV for Category C at                     6 and of the 1,000 V-
              Um 1.2 kV, step-up only                  to-earth argument
              from Um 3.6 kV?                          resting on the DC
                                                       offset rather than on
                                                       the category

  9           What does IEC 60364-                     If TC 64 has already     The 2025 text; the       IEC; the IET         B
              7-712 Edition 3                          written the missing      IET's intention for
              (October 2025) say                       rule, the gap is         Section 712
              about the AC side of                     closing and the
              generation plants, IT                    report's position
              networks, IMDs and                       must say so; BS 7671
              RCMs?                                    Section 712 aligns to
                                                       the 2017 edition




                                                                                                                            Page 122 of 134

---

## PDF page 123 / 134

Earthing, inverter topology and protection in utility-scale solar




  No.         Question                                 Why it matters           What would settle it      Who holds it          Priority

  10          What do IEC 62446-1's                    Manufacturer             The standard's table      The standard          B
              insulation test-voltage                  practice tests at        and clause                (licensed)
              table and its SPD and                    1,000 V; the 1,000 V
              inverter disconnection                   band of BS 7671
              clause say, and is 1,500                 Table 64 covers the
              V required for 1,500 V                   AC network; a wrong
              arrays?                                  test voltage
                                                       damages electronics
                                                       or under-tests the
                                                       array

  11          What is the current BS                   Needed for the           The book                  The author            B
              7671 Chapter 53                          standards matrix;
              regulation, if any, for                  the substance is in
              RCD selection in IT                      411.6.5
              systems (the brief's
              "531.2.4")?

  12          What are SMA's                           SMA is the one           The TI file "Important    SMA                   B
              reasons for the                          maker on the other       Requirements for
              earthed star point, and                  side of the fork; its    Medium-Voltage
              what is the external                     reasoning document       Transformers" for the
              relay and switching-                     (transformer             SHP; the planning
              device trip path in its                  requirements TI)         guideline
              planning guideline?                      was not found and
                                                       the relay trip path is
                                                       an earlier finding not
                                                       re-opened

  13          Does any product                         The inverters'           IEC 62109-2 clause        IEC TC 82; a test     B
              standard test RCMU or                    protection is            text; a test-house        house
              Riso performance                         certified on an          answer; a staged test
              when the AC side is IT                   assumed network;
              with large network                       the IT network with
              capacitance?                             14 arrays'
                                                       capacitance is a
                                                       different one

  14          Did the SolarABCs                        They anchor the          The primary reports       SolarABCs;            B
              2012 report and the                      blind-spot               (hosts unreachable        NREL; Sandia
              Mount Holly 2011                         precedent in section     from here)
              investigation say what                   10
              the secondary sources
              say?

  15          What was the cause of                    They are the only        Energy Safe               ESV; Envista          B
              the February 2025                        recent PV step-up        Victoria's finding; the
              Victorian transformer                    failures in the public   forensic firm's data
              fire, and of the three                   record and neither
              transformer failures in                  names the LV
              the June 2026 forensic                   earthing
              case?




                                                                                                                              Page 123 of 134

---

## PDF page 124 / 134

Earthing, inverter topology and protection in utility-scale solar




  No.         Question                                 Why it matters          What would settle it    Who holds it      Priority

  16          What do IEEE C57.159-                    The clause content      The guide               IEEE              B
              2016 and its revision                    is background           (paywalled)
              say about DC offset,                     knowledge in
              harmonic spectra,                        section 11
              cycling and winding
              connection for PV
              transformers?

  17          What does G99                            Section 13 found        The full G99 text       ENA               B
              Section 8 say, and does                  nothing in the
              anything in it reach the                 truncated copy
              plant-internal LV
              network?

  18          What are the Sungrow                     The breaker rule is     The manuals             Sungrow           B
              SG350HX manual's                         cited in sections 9
              exact words on the                       and 12 from the
              400 A breaker and PE                     earlier reading; the
              = S/2, and do the                        manual could not be
              SG250HX and                              fetched in the
              SG125CX manuals say                      second-fault pass
              the same?

  19          Is Huawei's SSLD                         Fuse-free design is     A Huawei certificate    Huawei; the       B
              certified as string                      justified only at two   or test report; the     standard
              overcurrent protection                   strings per MPPT;       IEC 62548-1 clause
              under IEC 62548-1,                       four or five strings
              with four to five strings                exceed the module's
              per MPPT?                                reverse-current
                                                       rating

  20          What GFDI pole, fuse                     Completes the           The UP operating        SMA               C
              rating and IMD                           central-inverter        manual's grounding
              thresholds does SMA's                    matrix                  chapter (English)
              UP generation use, and
              what is "Float
              Controller
              preparation"?

  21          What are the                             Completes section       The SolarGo manual;     The makers        C
              mechanisms of                            5; GoodWe's IT          Growatt's PDF; any
              GoodWe's, Growatt's                      statement sits          Chint document
              and Chint's optional                     beside four- and
              anti-PID, and is Chint's                 five-wire terminal
              claim real?                              text

  22          What is the installed                    The single fact that    An as-built survey of   Independent       A
              base of PV IMDs, and                     would turn              fifty or more plants;   engineers;
              how many string-                         "documentation          Bender's and            insurers; the
              inverter plants in the                   gap" into "practice     Schneider's sales       vendors
              UK have a winding-                       gap" or dissolve it     data
              level IMD?




                                                                                                                       Page 124 of 134

---

## PDF page 125 / 134

Earthing, inverter topology and protection in utility-scale solar




  No.         Question                                 Why it matters         What would settle it   Who holds it         Priority

  23          Is there a harmonised                    The industry's         A retrospective        kWh Analytics;       B
              O&M ticket category                      datasets cannot see    coding exercise        IEA PVPS Task 13
              for AC-side insulation                   the event class
              and earth faults
              anywhere, and what
              would kWh Analytics'
              301 sites show if one
              were applied?

  24          What does DIN VDE                        Explains why the         The DIN text; a      DIN; a German        C
              0100-410:2018-10                         issue is less visible in German EPC's         EPC
              411.6.3.1 actually say,                  German literature        standard design
              and do German plants                     and offers a
              carry IMDs as a matter                   comparator
              of course?

  25          Were the ESQCR reg                       Decides whether        Ofgem or HSE           Ofgem; HSE           C
              8(5) "adequate                           the IT choice has a    correspondence; a
              alternative                              regulatory reading     DNO's view
              arrangements" for a                      beyond BS 7671
              generating-station LV
              network ever
              interpreted by the
              regulator for inverter
              collection networks?

  26          How long does                            Sets the duration of   The grid-code ride-    The DNO; the         B
              inverter-fed current                     the inverter           through profile; the   EPC
              persist after the ACB                    contribution in the    inverters' anti-
              opens under the                          fault study and the    islanding settings
              applicable grid code's                   exposure in an
              ride-through                             islanded second
              requirement?                             fault

  27          What is the arc energy                   SMA says "over 1 kA"   A manufacturer test    SMA; a test          C
              and clearing time for a                  and "cannot occur      report or a staged     house
              grid-fed DC earth fault                  quickly enough"; no    test
              inside a                                 number exists
              transformerless string
              inverter on a TN
              network?


The three questions that change conclusions if answered the wrong way are 1, 5 and 22: a
renumbered regulation would require every public statement to be corrected, a block
whose ACB can be shown adequate would soften section 9's conclusion for that block,
and a survey showing winding-level IMDs are routinely fitted would reduce the blind spot
to a documentation problem. None of the three can be settled from a desk.




                                                                                                                        Page 125 of 134

---

## PDF page 126 / 134

Earthing, inverter topology and protection in utility-scale solar




Roadmap
The work so far is a desk study with evidence classes attached. What follows is the order
in which the open questions should be closed, chosen so that the cheapest checks come
first and each phase feeds the next. Dates are offered as a working rhythm, not
commitments.

Phase 1, the licensed texts (one week, no cost beyond time). The author holds BS 7671, IEC
62548-1, IEC TS 62738 and IEC 60502-1; the IET, BSI and IEC previews cover much of the
rest. Open and record, in the standard_clause table of the library with a quoted fragment
of no more than a sentence and the evidence class set to confirmed: BS 7671 A4 411.6.1 to
411.6.5 with the exact number carrying the IMD duty (question 1); 411.3.2.3 and .4; 433.3.1
and .3; 434.2, 434.3, 434.5; 536.4; 537 and Table 537.4; 538.1 to 538.4; 543.1.3 and .4 with
Tables 54.2 to 54.7; 551.7.1 and 551.7.2 as published; 643.3.2 and Table 64; 643.7 and 643.10;
the Section 712 numbers; any Chapter 53 clause for RCDs in IT (question 11); IEC 60502-1
Table 1 (question 8). Buy or borrow IEC 61557-8 Ed 3 and IEC 62446-1 for questions 6 and
10. Correct sections 6, 8, 9 and 13 of this report wherever a number moves, and reissue the
shareable notes if 411.6.3.1 has to change.

Phase 2, written questions to the makers (two to six weeks). Send each maker a short,
specific letter and keep the replies as source records. Sungrow: the definition of 906 V,
the design case behind it, the basis of the 15-inverters-per-winding limit, whether TN
operation is permitted with anti-PID disabled, and the HX default ISO and leakage
thresholds (questions 2, 18). Huawei: the reason TT and TN became "not recommended",
the LV withstand and inverters-per-winding requirements at 800 and 1,000 V, the
SmartPID2000's day and night behaviour, and the SSLD certification (questions 3, 4, 19).
SMA: the transformer-requirements note and the planning guideline's relay trip path, and
the reasoning for the earthed star against the IT alternative (question 12). GoodWe,
Growatt and Chint: the earthing statement and the PID mechanism (question 21). Bender
and Schneider: the one-IMD rule, whether an inverter's PV-IMF counts, and the behaviour
of two monitors on one network (question 6). Write the answers into the
manufacturer_requirement table with the letter and reply as the source; a non-reply is
itself a record.

Phase 3, the reference block's protection study (one to two months, engineer's time).
Obtain the transformer test certificate, the DNO's 33 kV fault level, the ACB's certificate
at 800 V, the feeder schedule with lengths, PE sizes and materials, and the bonding
design, then run the eight-step check of section 9 for every feeder and the busbar, using
the two models of sections 8 and 16 as the bracket and replacing their assumptions with
measured values (questions 5, 26). Record the result as a fault_scenario record per case
with the device, time and k²S² margin. If the ACB cannot be shown adequate, the per-
feeder device at the combiner is the design change, and the study is the evidence for it; if
it can, section 9's conclusion is softened for that block and the report says so.


                                                                                      Page 126 of 134

---

## PDF page 127 / 134

Earthing, inverter topology and protection in utility-scale solar




Phase 4, measurements at commissioning and in service (aligned with the next
energisation). Specify and witness: the insulation resistance of the AC network at 1,000 V
DC with inverters, SPDs and IMDs disconnected (643.3.2); the IMD's response value,
alarm path and functional test (643.10), with the setting recorded; a measured first-fault
current and touch voltage against the 50 V limit of 411.6.2, which can be done with a
deliberate high-resistance earth on one phase at low irradiance; the double-fault loop
impedance of the two longest feeders by measurement, not only by calculation; the
inverter insulation and residual-current thresholds as set, exported and signed; and a
record of who may change them (question 7). Add each item to the commissioning
checklist of section 19 if it is not already there, and to the health and safety file under
CDM reg 12.

Phase 5, the field evidence that would settle the blind-spot question (six to twelve
months, with partners). Propose to one independent engineer and one insurer an as-built
survey of fifty or more string-inverter plants recording the LV earthing arrangement, IMD
presence and settings, threshold changes and whether 411.6.4 was verified (question 22).
Propose to an O&M operator or to kWh Analytics a ticket category for AC-side insulation
and earth faults, applied retrospectively (question 23). Ask one maker for fleet alarm
telemetry split by AC and DC with durations before clearance. Seek the two incident
findings (question 15). Each of these needs a counterpart; the podcast and the WhatsApp
group are the recruiting ground, and the anonymised library is what is offered in return.

Phase 6, standards and guidance (ongoing). Obtain IEC 60364-7-712:2025 and read its
generation-plant clauses (question 9); if they address the AC side, write to JPEL/64
asking whether Section 712 will follow and offering sections 6 to 9 of this report as
evidence; if they do not, the same letter asks for an IT-network clause. Offer the IET a
Wiring Matters piece on IT collection networks, since the only existing article on
unearthed PV wiring stops at the DC side. Offer Solar Energy UK and SolarPower Europe a
commissioning annex. Keep the IEC TC 82 work programme under review for a 62548-2 or
a 62738 revision.

Phase 7, the library (continuous). Load the ten passes' sources into the sources table (the
compiled CSV delivered with this report), the unverified items into the open_question
table, the manufacturer statements into manufacturer_requirement with document,
edition and hosting, and the model results into fault_scenario; validate against the
schema; version the library by date; and re-verify any record whose source is a web page
at least yearly, since the Sungrow manual moved from Ver24 to Ver28 inside one year and
the Huawei wording changed between editions. A record whose source has changed is
marked disputed until re-read.

Phase 8, publication (after phases 1 to 3). Reissue the shareable notes with the
corrections of phase 1; publish the anonymised engineering report once the reference
block's study is complete, with the fault model and schema as open files; and keep the



                                                                                       Page 127 of 134

---

## PDF page 128 / 134

Earthing, inverter topology and protection in utility-scale solar




executive summary to the five statements in section 1, each with its evidence class, so
that nothing is said in public that is not either confirmed or marked as inference.


Source register
The complete register, one row per distinct document cited by any of the ten passes with
publisher, edition, date, jurisdiction, URL, section used, confidence, whether it was
opened and how it was hosted, is the sources table of the library, delivered as a CSV and a
schema-validated JSON file alongside this report, together with an unverified-items table
and a list of blocked hosts. The register below is the curated subset that carries the
report's load-bearing claims, grouped by type, with the sections that rely on each. "Class"
is the confidence the pass assigned: H opened, primary and independent or
manufacturer-primary; M opened but secondary, trade press or a third-party copy of a
maker's document; L not opened, abstract or title only.

Standards bodies, regulators and legislation:


   Source                                                     Publisher, edition or    Sections    Class
                                                              date

   IET and BSI publish                                        IET, 15 April 2026       8, 13       H (one numbering
   Amendment 4:2026                                                                                slip)

   BS 7671:2018+A4:2026 get the                               BSI; IET, accessed 21    13          H
   latest amendment and IET BS                                Oct 2026
   7671 page

   2026 Amendment 4 What's                                    SELECT; NICEIC;          8, 9, 13    M to H
   New; NICEIC Amendment 4;                                   BEAMA/EDA, 2026
   BEAMA/EDA deck

   BS 7671:2018 major changes                                 BSI, 2018                8, 13       H

   Wiring Matters 104,                                        IET, 2025, 2024, 2012,   9, 13       H to M
   unearthed DC PV wiring;                                    undated
   Wiring Matters 102, A4
   impact; Wiring Matters 2012,
   coordination; protective
   earthing webinar Q&A

   HSR25 Electricity at Work                                  HSE, 2015; 2011          8, 13, 14   H
   Regulations guidance; HSE
   IS2/2011 unearthed
   distribution systems




                                                                                                               Page 128 of 134

---

## PDF page 129 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                     Publisher, edition or       Sections            Class
                                                              date

   ESQCR 2002 reg 8; EAWR                                     legislation.gov.uk          13, 14              H
   1989; CDM 2015 reg 12

   ENA EREC G99/NI Issue 1                                    ENA via NIE Networks,       13                  M (truncated)
   Amendment 1                                                Dec 2023

   IEC 62548-                                                 IEC webstore                2, 13, 15           H (abstracts only)
   1:2023+AMD1:2025; IEC                                      abstracts
   62548:2016; IEC 62109-2:2011;
   IEC TS 62738:2018; IEC
   63112:2021; IEC 63027:2023;
   IEC 62446-1; IEC 60364-7-
   712:2025

   IEC 61557-8:2014 preview; IEC                              iTeh                        2, 7, 13            H (scope and annex
   63112 preview; IEC 62548-1                                                                                 headings)
   preview

   IEC 60502-1:2021; IEC 62109-                               EVS catalogue               6, 13               H (scope); Table 1
   2; IEC 63112                                                                                               read by the first-fault
                                                                                                              pass

   UL 1699B revision notice; DIN                              Intertek; DIN Media         10                  H
   EN IEC 63027

   IEEE C57.159-2016; PC57.159                                IEEE SA                     11                  H (status only)
   PAR


Independent laboratories, academic and investigative sources:


   Source                                                       Publisher, date                       Sections        Class

   Field guide for testing PV                                   NREL (Brooks), Oct 2015               2, 10           H
   systems for ground faults, SR-
   5D00-65050

   Understanding fault                                          NREL, Jan 2010                        8               H
   characteristics of inverter-
   based DER, TP-550-46698

   O&M best practices, 3rd ed.,                                 NREL, Dec 2018                        2, 14           H
   TP-7A40-73822

   PV ground fault and blind spot                               Sandia, 2013                          2, 10           M (abstract)
   simulations, SAND2013-3459



                                                                                                                              Page 129 of 134

---

## PDF page 130 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                       Publisher, date                 Sections   Class

   Ground fault detection final                                 Sandia (Lavrova, Flicker,       4          H
   report, SAND2016-0145R                                       Johnson), Dec 2015

   Isolation monitor thresholds,                                Sandia, SunPower, DNV GL,       14         H
   SAND2015-4667C                                               2015

   Quantifying PV fire danger                                   Sandia (Johnson), 2014          10         M
   reduction with AFCI

   Insulation monitoring systems                                Energies 19(18) 4396, Sept      7, 14      H (partial
   in LV IT networks, a review                                  2026                                       read)

   Ground faults in                                             Bellinaso et al. 2019;          4          H; M
   transformerless PV                                           Despotović and Vuković
   converters; Leakage current                                  2024
   of PV inverters

   PV fire hazard, analysis of                                  Fraunhofer ISE, TÜV             10, 15     H
   incidents; Fire risk guideline,                              Rheinland and others, 2013;
   DOE translation                                              2015/2018

   Fires and solar PV systems,                                  BRE for BEIS, May 2018          15         H
   Issue 2.9

   DC arc flash on PV equipment;                                EPRI/National Grid; ATF 2017;   10         H to M
   ATF arc mapping; Firehouse                                   Firehouse 2016
   PV investigation

   CIGRE TB 642; TB 939                                         CIGRE, 2015, 2024, 2023,        11, 15     H
   summary; Sendai 2023 IDT                                     2026
   failures; CIGRE B5 2026

   Loss of effective system                                     SEL 2014; IEEE Houston 2011;    11         H
   grounding; Grounding for                                     TNB Research c. 2003
   industrial systems;
   Ferroresonance in a
   distribution network

   Machine-learning evaluation                                  IEEE Access 2020; IEA PVPS      11, 15     H
   of inverter maintenance                                      2021
   records; IEA PVPS T13-23

   Property losses, lessons                                     AEGIS, July 2025; Envista       11         H; M
   learned; Repeated                                            Forensics, June 2026
   transformer failures at a solar
   plant




                                                                                                                    Page 130 of 134

---

## PDF page 131 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                       Publisher, date                       Sections     Class

   String-level ground-fault                                    Huawei Montreal and                   15           M (vendor-
   localisation                                                 University of Toronto, arXiv                       affiliated)
                                                                2026


Manufacturer documents (text is the maker's; hosting as stated):


   Source                                                   Edition                    Sections            Class

   Sungrow SG285 to 350HX                                   Sept 2026; 2025;           5, 7, 8, 9, 12      H
   user manual, Ver28;                                      2024; 2022; 2025
   SG333HX datasheet V6;
   SG350HX datasheet V22;
   SG3125HV-MV datasheet;
   SG3300/4400UD-MV
   datasheet V21

   Huawei SUN2000-100 to                                    2023; undated; 2024;       2, 5, 9, 10,        H portal and
   115KTL-M2 quick guide;                                   2025; 2026; undated;       12, 15              datasheets; M third-
   330KTL-H1 datasheet;                                     2020; 2018; 2016; 2023                         party copies
   330KTL manual Issue 13; 196
   to 215KTL portal;
   460/506KTL manual Issue
   03; 506KTL datasheet; 90 to
   105KTL manual Issue 11;
   SmartPID2000 EU and CN;
   2016 training deck; Smart
   safety technology white
   paper




                                                                                                                           Page 131 of 134

---

## PDF page 132 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                   Edition                 Sections         Class

   SMA Short-circuit currents                               various, 2010 to 2025   2, 4, 5, 8, 9,   H
   TI; Insulation error TI;                                                         12, 15
   Leakage current TI; PV
   Offset Box TI; PID TI; SHP
   MV transformer
   requirements; STP MV
   transformer requirements;
   SHP PEAK3 online manual;
   STP X manual; CORE2
   manual; PEAK3 datasheet;
   SC-HEM grounded
   operation; SC HE operating
   manual; SC HE installation
   guide; SC CP-JP manual; SC
   MV datasheet; SC UP
   datasheet; MV Power
   Station manual

   GoodWe GT manual V1.2;                                   Dec 2025; Dec 2023;     8, 9, 10, 12,    H to M
   GoodWe HT manual V1.1;                                   undated; undated;       14
   GoodWe SMT page;                                         Ver 1.2; undated;
   Growatt MAX HV manual;                                   2024; V03
   Solis 215 to 255K manual;
   Solis isolation support note;
   Sineng SP-350K-H1
   datasheet; Fronius Tauro
   Direct datasheet

   FIMER PVS980-58                                          2021; Aug 2026; 2025;   12               H; Ingeteam M
   datasheet Rev C; Power                                   2023; 2025; undated
   Electronics HEMK GEN3;
   Gamesa Proteus PV
   inverters and stations;
   TMEIC Ninja brochure;
   Sineng EP-4400 datasheet;
   Ingeteam B series excerpt

   Bender, IT systems in the                                undated to 2025         7, 8, 11, 15     H for IEC substance;
   standards; RCDs in IT                                                                             M as vendor
   systems; Renewable
   energies brochure 2025;
   Renewable energy
   prospectus; isoPV1685DP
   excerpt



                                                                                                                     Page 132 of 134

---

## PDF page 133 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                   Edition                   Sections         Class

   Schneider EIG, IT fault                                  current wiki and          8, 9, 15         H as a statement of
   protection; IT                                           product pages                              IEC text; M as vendor
   implementation; PE sizing;
   switching devices; circuit-
   breaker characteristics;
   UPS earthing, IT; ComPacT
   NSX DC ground faults

   Mersen fuse sizing per                                   various                   9, 10, 11        M (vendor)
   NEC; Mersen
   HelioProtection; Stäubli
   connector liability
   statement; IMO DC isolator
   brochure; ETI DC switching;
   Fluke DC ground faults;
   Hitachi transient voltage; I-
   Gard ungrounded systems;
   Danisense DC injection


Trade press, analysts, practice and procurement documents:


   Source                                                           Publisher, date                        Sections       Class

   Record 2017 shipments, string                                    pv magazine; Wood Mackenzie;           2              H to
   overtakes central; 2019 inverter                                 PV Tech                                               M
   market; GTM 2016 forecast; Wood
   Mackenzie 2023 shipments; PV
   Tech Research 2026

   ABB PVS-175 US shipments;                                        Solar Power World; EE Power; PV        2              M
   Sungrow SG250HX; Sungrow                                         Tech; pv magazine USA
   SG125HV; NEC 2017 for
   contractors; NEC and UL
   developments 2023

   Australia removes DC isolator                                    pv magazine titles, 2016 to 2025       10, 11, 15     M
   mandate; isolator fires in state
   data; Victorian transformer fire;
   burnt-out incompatible
   connectors; GCube hail claims;
   kWh Analytics risk assessment




                                                                                                                        Page 133 of 134

---

## PDF page 134 / 134

Earthing, inverter topology and protection in utility-scale solar




   Source                                                           Publisher, date                Sections      Class

   Queensland solar farm                                            2019; 2021; 2023; 2023; 2024   8, 9, 11,     M to
   inspections; ESV compliant PV                                                                   14            H
   guidance; EC&M ground-fault
   trips; NAPIT disconnection times;
   NICEIC overload omission

   Natural Power commissioning best                                 undated; July 2022; 2023       14            M to
   practice; Hub Guide 15; Mayfield                                                                              H
   ground-fault testing

   CSIR employer's works                                            2017; 2020; 2015; undated      15            H
   information; DEWA inspection
   checklist; IFC utility-scale
   developer's guide; BPEC solar PV
   course


Sources that could not be opened and are cited by existence only: the SolarABCs blind-
spot report and the Ball 2013 report (host blocked); OSTI full texts of the Sandia 2013
simulations; the German 2015 fire study's project domain (repurposed); SMA's string-
inverter transformer-requirements note and the UP manual's grounding chapter;
Sungrow's SG250HX, SG125CX and HV-MV manuals; Huawei's 215KTL-H3 and
SmartPID2000 manuals and alarm reference; the Solis S6-GC350K and GoodWe SolarGo
manuals; any Chint manufacturer document; Ingeteam's own pages; FM Global data
sheets, GCube reports and the HSB/EPRI connector deck; the IET EngX forums; VDE
previews of IEC 60947-2 and 60364-7-712; the licensed texts of BS 7671, IEC 60364-4-41,
IEC 61557-8, IEC 62109-2, IEC 62446-1, IEEE C57.159 and CIGRE TB 577 and 537, which are
cited from background knowledge and marked as such wherever they appear.




                                                                                                               Page 134 of 134

