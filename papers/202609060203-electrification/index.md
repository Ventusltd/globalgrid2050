# Electrification and the Size of Britain’s Electricity System

## From fossil-fuel reduction to electricity demand, winter peaks and network reinforcement

**Ventus Ltd / GlobalGrid2050 — Technical discussion paper**  
**Research edition prepared:** 6 September 2026, 02:03:18 BST (01:03:18 UTC).  
**Evidence vintages:** UK statistics for 2025; NESO FES 2025, version 5; CCC Seventh Carbon Budget, February 2025; the identified Atlas/data-grid-gb snapshots.  
**Scope:** National energy accounting and transparent engineering sensitivities, not a site-specific connection assessment. The preparation time is not a dataset observation time or evidence of website publication.

## Contents

- [Headline dashboard](#paper-section-1)
- [Abstract](#paper-section-2)
- [1. Establishing the correct starting point](#paper-section-3)
- [2. Begin with the official pathways](#paper-section-4)
- [3. Why a 70% fossil-energy reduction does not calculate future electricity](#paper-section-5)
- [4. What a 480 TWh system means](#paper-section-6)
- [5. Different electrified loads create different engineering problems](#paper-section-7)
- [6. “Doubling the grid” has several meanings](#paper-section-8)
- [7. What the mapped substations actually establish](#paper-section-9)
- [8. A research programme for Pipeline News and GridAtlas](#paper-section-10)
- [9. Conclusions](#paper-section-11)
- [Evidence limits](#paper-section-12)
- [References](#paper-section-13)

---

<a id="paper-section-1"></a>

## Headline dashboard

| Headline | Value | Meaning and date |
|---|---:|---|
| UK primary energy | **1,890 TWh/year** | Calculated from 162.5 Mtoe, 2025; excludes non-energy use. [2,3] |
| UK final electricity consumption | **Approximately 276 TWh/year** | Calculated from the rounded 23.7 Mtoe figure for 2025. [2,3] |
| The 480 TWh case | **54.8 GW average** | Illustrative annual system-demand case; not an official forecast. |
| GB electricity system demand in 2050 | **705–797 TWh/year** | Three NESO net-zero pathways; includes grid-fed electrolysis and losses. [1] |
| GB winter peak in 2050 | **120–144 GW** | NESO pathways, after demand flexibility other than vehicle-to-grid. [1] |
| Captured Atlas substation layer | **5,800 mapped features** | Hash-verified captured release; not a national physical-asset census. [11] |

The dashboard is a dated research snapshot, not a live operational feed. Annual statistics, future scenarios and calculated examples must retain their separate labels.

<a id="paper-section-2"></a>

## Abstract

Deep electrification transfers energy services from fuels delivered to engines, boilers and industrial processes towards electricity delivered through generation, transmission and distribution infrastructure. It can substantially reduce fuel input while increasing electrical demand, because useful services—not historical fuel quantities—must be replaced.

This paper examines whether a 70% reduction in fossil-fuel primary-energy use implies a doubling of Britain’s grid. It finds that no unique electricity requirement follows from that percentage alone. A 480 TWh electricity case represents 60% growth against a rounded 300 TWh reference, whereas deeper electrification can require a substantially larger system. The physical consequences depend on peak coincidence, geography, generation location, network security and flexibility, rather than annual energy alone.

The practical conclusion is a programme of selective but extensive reinforcement: larger and additional transformers, circuits, substations, transmission connections, control systems and customer installations. Some locations may require more than double their existing capability; others can accommodate growth through spare capacity, changed operation or dependable flexibility. This makes project-level and network-level intelligence complementary rather than separate studies.

<a id="paper-section-3"></a>

## 1. Establishing the correct starting point

Energy statistics require an explicit measurement boundary. **Primary energy**, **final electricity consumption**, **electricity generation** and **electricity system demand** answer different questions.

DESNZ’s *UK Energy in Brief 2026* reports 2025 inland primary-energy consumption of **162.5 Mtoe**, excluding non-energy use. Its temperature-corrected figure is **164.9 Mtoe**. These are not interchangeable. Final energy across all fuels is **127.7 Mtoe**, while electricity generation is **293.6 TWh**. [2]

The conversion is:

**1 Mtoe = 11.63 TWh.**

Thus 162.5 Mtoe corresponds to approximately 1,890 TWh. This is a conversion of units, not an estimate of how much electricity would replace those fuels. The earlier working estimate of 1,600 TWh should therefore not be used as this paper’s 2025 primary-energy baseline. [2,3]

The historical suggestion of roughly 400 TWh of annual UK electricity demand is reasonable: a contemporary ministerial table reported **406.633 TWh for 2005**. That is a historical statistical vintage, not a claim to have reconstructed the latest revised series. The unit is TWh/year, not TWp/year. [4]

Historical throughput does not prove present spare capacity. New loads can appear behind different substations, while generation connections and power-flow patterns change. A national annual total cannot reveal whether a particular feeder can accept an additional load.

**Geography also matters.** UK statistics include Northern Ireland; NESO’s GB pathways and the GB transmission system do not. The captured Atlas layer includes Northern Ireland records. The three scopes must not be silently merged. [1,2,11]

<a id="paper-section-4"></a>

## 2. Begin with the official pathways

**NESO FES 2025, version 5**, provides the 2050 benchmark: [1]

| 2050 pathway | Consumer electricity, TWh/year | System electricity, TWh/year | Winter peak, GW |
|---|---:|---:|---:|
| Holistic Transition | **567** | **705** | **120** |
| Electric Engagement | **646** | **785** | **144** |
| Hydrogen Evolution | **540** | **797** | **122** |

System demand includes customer demand, on-grid electrolysis serving GB hydrogen demand, and losses. Consumer electricity is the narrower measure. Peak demand follows NESO’s Average Cold Spell definition and already incorporates demand flexibility except vehicle-to-grid. These definitions must accompany the figures; flexibility must not be deducted twice. [1]

FES 2024 references: **290 TWh system demand; 267 TWh consumer electricity; 58 GW peak**. [1] Calculated against those references, the table implies approximately **2.43–2.75 times system energy**, **2.0–2.4 times consumer electricity** and **2.1–2.5 times peak demand**.

The pathways are alternatives, not additive project requirements or probability-weighted forecasts. Neither they nor the calculations below establish that a particular 70% fossil-energy reduction must produce one particular electricity total.

**No exact 62.5 GW present-day peak is used.** A value inferred from rounded reserve-margin figures is not an independently established peak observation.

An independent benchmark reinforces the network implication. The CCC’s Seventh Carbon Budget projects **692 TWh gross electricity demand in 2050**, with an additional **89 TWh** for hydrogen production from surplus generation. Its accounting should not be assumed identical to NESO’s. Crucially, its Balanced Pathway requires reinforcement of all major transmission boundaries, with **average capability doubling by 2035 and tripling by 2050**. Distribution reinforcement is concentrated in the 2030s. These are pathway results, not a claim that every substation must double. [5]

<a id="paper-section-5"></a>

## 3. Why a 70% fossil-energy reduction does not calculate future electricity

Let **F₀** be fossil-fuel primary-energy use in a defined baseline. A 70% reduction means:

**F₁ = 0.30 × F₀.**

It does not mean that future electricity equals 30% of total primary energy. In particular, **1,600 × 0.30 = 480 TWh is a remainder calculation, not an electrification model**. Total primary energy includes non-fossil sources; fossil reduction must be applied to the fossil component.

The calculation must instead follow the service being supplied. For a simple replacement:

**Electricity required = displaced fuel energy × old conversion efficiency ÷ new electrical conversion performance.**

For heat pumps, the last term is a coefficient of performance rather than an ordinary efficiency: environmental heat contributes to useful heat output. Heat is moved, not created from nothing. [6]

The following examples are deliberately assumed engineering cases—not measured national averages:

| Service previously using 100 TWh of fuel | Explicit assumptions | Electricity for equivalent service |
|---|---|---:|
| Building heat | Boiler efficiency 90%; heat-pump seasonal performance 3.0 | **30.0 TWh** |
| Road propulsion | Fuel-to-motion efficiency 25%; electricity-at-meter-to-motion efficiency 80% | **31.25 TWh** |
| Industrial heat | Fuel conversion 90%; electrical process efficiency 95% | **94.74 TWh** |

Therefore similar fuel reductions can produce very different electrical requirements. Process temperature, operating hours, building fabric and technology choice must be represented explicitly.

A separate accounting trap concerns electricity that is already produced from fossil fuels. Replacing a gas power station’s fuel with non-fossil generation changes the generation mix and primary-energy losses; it does **not** create a second copy of the existing customer electricity demand.

A complete national model would reconcile sectoral useful services, existing electricity, efficiency improvements, direct electrification, hydrogen and synthetic fuels, residual fossil use, imports, storage losses and new activities. International transport and non-energy uses require declared boundaries too. A 70% fossil-energy reduction is also not automatically a 70% emissions reduction: fuel composition and carbon capture affect that relationship.

This paper therefore retains **480 TWh as a sensitivity case**, not as the proven consequence of the fossil-reduction assumption.

<a id="paper-section-6"></a>

## 4. What a 480 TWh system means

Using an 8,760-hour model year:

**Average power (GW) = annual electricity (TWh) ÷ 8.76.**

A 300 TWh system averages **34.2 GW**; a 480 TWh system averages **54.8 GW**. The difference is **180 TWh/year**, equivalent to **20.5 GW of additional average demand**. Relative growth is 60%. Against the different 290 TWh FES reference, it would be approximately 65.5%.

Average demand does not determine peak demand. Define load factor as annual average demand divided by peak demand, using the **same geographical and electrical boundary** for both.

| Assumed load factor for the 480 TWh case | Calculated peak |
|---|---:|
| 70% | **78.3 GW** |
| 60% | **91.3 GW** |
| 50% | **109.6 GW** |

These are arithmetic sensitivities, **not independently modelled GB winter forecasts or confidence intervals**. They replace the earlier unsupported suggestion that 480 TWh necessarily requires an 85–110 GW peak.

They show why scheduling matters: identical annual consumption can require substantially different peak capability. However, a national load factor cannot establish utilisation at any particular transformer. A data centre, residential district and charging depot can have very different profiles and different local peaks.

For network planning, scenarios require chronological demand and generation profiles, several weather years, credible outages and explicit flexibility constraints. Annual totals alone cannot demonstrate security of supply.

<a id="paper-section-7"></a>

## 5. Different electrified loads create different engineering problems

### Electric vehicles: annual energy versus charging coincidence

Consider **10 million vehicles**, each taking **2,500 kWh/year at the charging meter**. This assumed fleet consumes **25 TWh/year**, or **2.85 GW averaged over the year**.

Delivering that energy uniformly within eight hours each night would require approximately **8.56 GW during that window**. By contrast, ten million 7 kW chargers operating simultaneously would draw **70 GW**. Even a 20% coincidence assumption gives **14 GW**.

The simultaneous case is a stress test, not a forecast. The engineering questions are how many vehicles need charging at the same time, where they are connected, their required departure times and whether controls remain dependable during constrained periods. Depot and motorway charging cannot automatically be assigned the same flexibility as overnight domestic charging.

Demand management changes the required profile; it does not eliminate the annual energy requirement. The joint DESNZ–Ofgem–NESO Clean Flexibility Roadmap makes flexibility a system-planning workstream rather than an assumed free resource. [7]

### Heat pumps: winter conditions must be modelled separately

Assume **10 million homes**, each needing **10 MWh/year of useful heat**, supplied at a seasonal performance factor of three. Annual electricity is approximately **33.3 TWh**.

For a separate cold-period calculation, assume each home needs 5 kW of heat and the contemporaneous coefficient of performance is two. Simultaneous electrical demand would be **25 GW**.

These assumptions are illustrative. Their purpose is to show that seasonal efficiency cannot simply be reused for a cold design condition. Building heat loss, heat-pump sizing, controls, thermal storage and supplementary resistance heating determine the actual requirement. The IEA identifies building fabric and appropriate sizing as important to heat-pump performance. [6]

Electrified heat must therefore sit alongside EVs and data centres in the winter study—not be treated as a minor residual load.

### Data centres: a concentrated connection requirement

A facility drawing up to **100 MW at its grid connection**, at an assumed annual load factor of 90%, consumes **0.788 TWh/year**. At power factor 0.95, 100 MW corresponds to approximately **105 MVA** before any equipment-specific design allowances.

This is a facility-level illustration, not a forecast that all proposed campuses reach that utilisation. An IT nameplate rating is not automatically whole-facility demand: cooling, power conversion and other auxiliaries must be reconciled. Equally, adding power-usage-effectiveness overhead to an already whole-facility figure would double count it.

The IEA identifies both geographic concentration and different development timescales between data centres and energy infrastructure as integration challenges. A modest national percentage can therefore become a decisive local network requirement. [8]

Connection applications, contracted capacity, construction stages and actual operational load should be separate records. Backup equipment should not be assumed available for routine grid support without an explicit operational basis.

### Industry and electrolysis: conversion routes matter

Industrial electrification must be assessed process by process. A heat pump serving suitable-temperature heat is a different proposition from replacing a high-temperature fuel-fired process with direct electric heating.

For illustration, a **1 GW electrolyser** running at 70% annual utilisation consumes **6.13 TWh/year**. At an assumed 70% electricity-to-hydrogen efficiency on a stated calorific-value basis, it delivers approximately **4.29 TWh of hydrogen**, before subsequent conversion losses.

Electrolysis may be scheduled away from constrained periods, but that requires appropriate production, storage and customer arrangements. Electricity used to make hydrogen must not be counted again as a separate primary supply when the hydrogen is subsequently consumed.

<a id="paper-section-8"></a>

## 6. “Doubling the grid” has several meanings

### Generation capacity

Annual generation, installed capacity and dependable winter output are different quantities.

A hypothetical fleet producing 480 TWh/year at a combined capacity factor of 40% would need approximately **137 GW of nameplate capacity** on energy arithmetic alone. This assumes that the fleet supplies the stated requirement and sets aside imports, curtailment and storage losses; it is not an optimised generation mix or an adequacy result.

A credible plan must also cover prolonged renewable shortages, plant outages, ramping and operating reserves. Annual renewable output cannot establish what is available on a particular winter evening.

NESO’s “total installed capacity” includes storage and interconnectors, not just generation. [1]

### Transmission transfer capability

Transmission capability depends on the location of generation and demand, electrical impedances, network topology and credible contingencies. Greater transfers between regions can require major investment even where national annual demand grows more slowly.

The CCC’s boundary-capability finding is therefore more relevant to transmission reinforcement than simply multiplying existing circuit kilometres by an electricity-demand ratio. [5]

NESO’s ETYS explicitly relates scenarios to changing network flows and reinforcement needs. [9] The resulting work can include new circuits, reconductoring, transformer capacity, substations, offshore connections, HVDC links and system-support equipment. Which intervention is appropriate remains a network-study question.

### Distribution and primary substations

The local problem occurs behind specific equipment: 132/33 kV or 66/33 kV transformations, 33/11 kV primaries, 11 kV feeders, distribution transformers and low-voltage circuits. Voltage arrangements differ by network.

Consider an illustrative primary substation with **two 30 MVA transformers**. Installed transformer capacity is 60 MVA. With no alternative supply or permitted overload, losing one transformer leaves only **30 MVA** available.

If the relevant peak increases from **24 to 42 MVA**, demand has grown by 75%, not doubled. Nevertheless, the assumed post-outage capability is exceeded. Larger transformers, additional units, network transfers, dependable flexibility or a new supply point require consideration.

Conversely, another substation with adequate usable capacity might accommodate substantial energy growth without replacement. A third could face a new customer larger than its entire historical demand. There is no defensible rule that all sites should receive the same percentage uplift.

### Thermal capacity is necessary but insufficient

At fixed voltage and power factor, increasing power increases current. With unchanged resistance, instantaneous resistive losses increase with current squared. This explains the importance of conductor sizing and voltage choice; it does not imply that whole-system losses must quadruple whenever national demand doubles.

Engineering assessments also need voltage regulation, reactive-power requirements, protection coordination, earthing, fault duty, power quality and stability. Parallel network paths can change fault levels; inverter-dominated connections can change the characteristics of fault response. Cable-route thermal conditions and installation constraints remain relevant even when the electrical model appears satisfactory.

NESO’s 2026 operability update confirms that stability, frequency services, reserves and visibility of distributed resources are active workstreams alongside infrastructure expansion. [10]

### Storage and flexibility

Storage requires both a power rating and an energy duration. A hypothetical **50 GW shortfall lasting 48 hours requires 2,400 GWh**, before storage losses and reserves.

A fleet described only as “40 GW of batteries” cannot be assessed against that requirement. Charging opportunities, stored energy, discharge capability, location and duration all matter. National flexibility can also fail to relieve a particular local bottleneck if it is connected on the wrong side of that constraint.

<a id="paper-section-9"></a>

## 7. What the mapped substations actually establish

The captured Atlas source was examined as data, rather than counted visually from overlapping screen symbols.

Its identified substation GeoJSON contains **5,800 features with 5,800 distinct feature IDs**. The captured bytes match the recorded SHA-256. A literal semicolon-separated voltage-tag count finds **5,799 records with at least one numeric declared voltage of 33 kV or more**, and one without such a numeric declaration. This is a tag-based result, not validation that every entry is an operational AC substation of that voltage. [11]

This updates the approximate 4,800 working figure for **that captured layer**, but does not establish a complete UK or GB inventory. Feature IDs are not proof of unique physical sites. The source includes Northern Ireland, and record completeness, co-location, AC/DC classification, operating status and voltage evidence still require reconciliation.

The separate pinned transmission-model snapshot contains **1,392 circuit rows and 1,472 transformer rows**. Counting both ends of each transformer row produces **2,944 endpoint occurrences**, not 2,944 transformer units. These are counts of source-model records, not independently surveyed machines. [12]

A publication must therefore distinguish mapped features, physical sites, busbars, circuits, transformer units and winding connections. Capacity should not be summed across successive voltage levels as though each transformation represented additional electricity supply.

The appropriate next step is to associate mapped assets with operator identities, connected topology, ratings, load profiles, committed projects, security limits and planned reinforcements. Geographic proximity is a useful screening tool, but it does not establish electrical connection or available capacity.

<a id="paper-section-10"></a>

## 8. A research programme for Pipeline News and GridAtlas

The useful unit of investigation is not merely a point on a map. It is an evidence-backed relationship between **a project, a counterparty, an electrical requirement, a network location and a delivery timetable**.

A practical research record should keep the project’s identity and development status separate from news signals; distinguish developer, owner, contractor and potential electricity buyer; identify whether a proposed load is EV charging, industrial electrification, heating or computing; and relate it to the relevant network through evidence rather than distance alone.

Likewise, proposed generation, storage and load should be tracked separately. A battery’s MW rating is neither its annual generation nor its energy duration. A prospective offtaker is not a confirmed power-purchase agreement. Multiple applications or development stages must not be summed automatically as independent build commitments.

This approach can inform engineering enquiries and market preparation: which schemes may approach procurement, which customers need electrical studies, which locations face reinforcement, and which installation or cable requirements deserve investigation. These are research uses, not guarantees of project delivery or sales.

There is also an immediate planning interface. NESO’s transitional Regional Energy Strategic Plan, launched in January 2026, is intended to inform DNO investment plans for **2028–2033** and identify places where anticipatory investment could support local projects. [13] Relating credible project evidence to that planning framework is more useful than treating every future megawatt as equally certain.

Publishing the research openly is compatible with this purpose: it improves the shared evidence base while developing the author’s understanding of the market and its engineering requirements.

<a id="paper-section-11"></a>

## 9. Conclusions

**A substantially larger electricity system is a well-supported planning proposition. A uniformly doubled physical grid is not.**

The original question contains a sound infrastructure insight but needs corrected accounting. Reducing fossil primary energy by 70% does not calculate future electricity demand. Useful-service requirements, conversion efficiency and new activities determine that result.

A 480 TWh case means **60% more annual electricity than a 300 TWh reference**, with a calculated average of **54.8 GW**. Its peak cannot be deduced without a profile. The explicit load-factor sensitivities show why substantially higher peak capability can be required without a doubling of annual consumption.

Official pathways support a larger long-term transformation, while the CCC’s transmission assessment demonstrates that important transfer requirements can grow faster than simple nationwide asset-count assumptions suggest. [1,5]

For individual locations, the engineering challenge is to determine **which constraint binds, when it binds and which intervention resolves it**. That may involve transformer replacement, additional feeders, higher-voltage connections, route works, protection changes, flexible operation or entirely new infrastructure.

**The strategic value of studying renewable projects, their potential offtakers and the grid together lies in locating that transformation—not just estimating its national total.** Beyond 2050, the same method remains useful, but numerical projections should be rebuilt rather than mechanically extrapolated from the 2050 pathways.

<a id="paper-section-12"></a>

## Evidence limits

This paper combines published statistics and scenarios with explicit arithmetic examples and a reproducible count of captured data. It does not contain a new chronological GB dispatch model, validated AC load flow, fault study, asset-condition survey or independently verified national substation census. Scenario arithmetic is not evidence of connection headroom. Future versions should preserve these boundaries and record changed source vintages.

<a id="paper-section-13"></a>

## References

**[1] NESO.** *Future Energy Scenarios 2025: Pathways to Net Zero*, version 5, November 2025. Table 2 and footnotes, printed p.21; consumer demand, pp.124–125; peak definition and Table 23, pp.127–128. [Report](https://www.neso.energy/document/364541/download). Version 5 revision dated 21 November 2025; figures in this paper are scenario-vintage values, not live 2026 measurements.

**[2] DESNZ.** *UK Energy in Brief 2026*. Published 30 July 2026; dataset added 3 August 2026. Printed pp.9–10 for primary and final energy; p.27 for electricity generation. [Publication and dataset](https://www.gov.uk/government/statistics/uk-energy-in-brief-2026). [Report PDF](https://assets.publishing.service.gov.uk/media/6a6cb5f00c36759b5ccaa2f5/UK_Energy_in_Brief_2026.pdf).

**[3] DESNZ.** *Energy Consumption in the UK 2025*, updated 20 April 2026. Technical definitions of primary/final energy and tonne of oil equivalent. [Accessible publication](https://www.gov.uk/government/statistics/energy-consumption-in-the-uk-2025/energy-consumption-in-the-uk-ecuk-2025).

**[4] UK Parliament, Hansard.** Written Answers, 31 March 2009. Ministerial table of UK generation, electricity demand and energy consumption, 1998–2007. The 2005 electricity-demand entry is 406,633 GWh. [Historical table](https://hansard.parliament.uk/Commons/2009-03-31/debates/6e1ce28e-c100-4866-a321-820cf0b9df5a/WrittenAnswers).

**[5] Climate Change Committee.** *The Seventh Carbon Budget*, 26 February 2025, section 7.5, Electricity Supply. See demand accounting and transmission/distribution reinforcement assumptions. [Report](https://www.theccc.org.uk/publication/the-seventh-carbon-budget/).

**[6] IEA.** *The Future of Heat Pumps* (2022), [How a heat pump works](https://www.iea.org/reports/the-future-of-heat-pumps/how-a-heat-pump-works); and *Energy Efficiency 2024*, [Does a heat pump work in a house with poor insulation?](https://www.iea.org/reports/energy-efficiency-2024/does-a-heat-pump-work-in-a-house-with-poor-insulation). The numerical examples in this paper use explicitly assumed performance values.

**[7] DESNZ, Ofgem and NESO.** *Clean Flexibility Roadmap*, 23 July 2025. [NESO publication page](https://www.neso.energy/industry-information/flexibility/clean-flexibility-roadmap).

**[8] IEA.** *Energy and AI* (2025), chapter “Energy demand from AI”. Used for facility scope, concentrated location and development-timescale considerations, not as a UK demand forecast. [Chapter](https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai).

**[9] NESO.** *Electricity Ten Year Statement*. [Publication and supporting appendices](https://www.neso.energy/publications/electricity-ten-year-statement-etys).

**[10] NESO.** “NESO sets out Operability and Markets update”, 30 March 2026. [Publication](https://www.neso.energy/neso-sets-out-operability-and-markets-update).

**[11] Ventusltd/GridAtlas.** Captured `grid_substations.geojson`, Atlas release `202608300453-atlas-v9`. [Release resource](https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson). Captured 5 September 2026, 16:18:38.106 UTC; underlying asset-observation dates are not established by that capture. Verified captured resource: 1,192,748 bytes; SHA-256 `87976435766a58ddf19c99540b58cd7f18a224148af42ba55075d8851f9e6251`. Counts refer to the supplied captured bytes, not an assertion that the URL was freshly fetched during this review.

**[12] Ventusltd/data-grid-gb.** `derived/gb-transmission-network.v1.json`, commit `1c9909d1138704b29235c27fd769436dda8a0b18`. [Commit-pinned dataset](https://raw.githubusercontent.com/Ventusltd/data-grid-gb/1c9909d1138704b29235c27fd769436dda8a0b18/derived/gb-transmission-network.v1.json). Captured resource: 10,069,966 bytes; SHA-256 `fc331cc20b061f85adf18d890762a164328a1c5e84acef6a23d35d36f849fc8a`. Model-row counts were recomputed from those verified bytes.

**[13] NESO.** *Transitional Regional Energy Strategic Plan*, launched 30 January 2026. [Publication and datasets](https://www.neso.energy/what-we-do/strategic-planning/regional-energy-strategic-planning-resp/transitional-regional-energy-strategic-plan-tresp).
