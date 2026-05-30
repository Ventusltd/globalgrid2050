# GlobalGrid2050 Operator Manual V1

Status: Version 1, reviewable operating doctrine  
Maintainer authority: Ventus Ltd  
Licence: CERN OHL S v2  
Purpose: Operating doctrine for GlobalGrid2050 and Ventus Core  
Note: This document provides platform guidance. The binding licence remains LICENSE.txt.

Prepared for Ventus Ltd. This manual describes the GlobalGrid2050 and Ventus Core platform, its architecture, data, operating doctrine and the obligations created by the CERN Open Hardware Licence Version 2 Strongly Reciprocal.

No individual persons are named as authors or operators in this manual. Authorship and stewardship are attributed to Ventus Ltd. Operations are attributed to the automation system and GridBot. Decision authority rests with the maintainer.

## 1. Executive summary

GlobalGrid2050 and Ventus Core form an open infrastructure intelligence platform. The platform is deployed through GitHub Pages and Jekyll as a static site. It performs geospatial, engineering and financial work in the browser, supported by automated Python and GitHub Actions pipelines. The automation system, known as GridBot, commits updated data and reports while final judgement remains with the maintainer.

The operating doctrine is simple: human intent, AI reasoning, Python execution, GitHub record, GridBot reporting and human approval. This model allows AI and automation to assist with scale, but not to replace the maintainer's authority.

The platform is licensed under CERN OHL S v2. Using the live website imposes no reciprocal source publication duty. Forking, modifying or conveying covered source does impose obligations. Notices must be retained, modifications must be documented and the Complete Source of any conveyed covered product must be made available under the same licence or a compatible licence. Commercial use is permitted, but silent extraction, relicensing, notice removal or misrepresentation is not permitted.

The work matters because modern power systems are exposed to hidden failure modes. Voltage control, reactive power, inverter behaviour, poor observability, connection clustering, cable losses, financial assumptions and weak commissioning discipline can all produce major project or system consequences. GlobalGrid2050 exists to bring these assumptions into one open spatial and technical reasoning environment.

## 2. Mission

Open infrastructure intelligence means the disciplined organisation of public knowledge into a usable technical platform. The platform is built from open government datasets, planning registries, OpenStreetMap contributors and publicly available infrastructure information. The raw facts are not claimed as private property. The Ventus contribution is the structure: the architecture, pipeline design, data ontology, classification logic, rendering stack, modelling assumptions, documentation and operating doctrine.

The governing principle is that early constraint visibility prevents late stage engineering failure. Infrastructure failure often begins before construction, when land, grid, cable routes, constraints, losses, access, substations, revenue assumptions and delivery risks are analysed separately. GlobalGrid2050 brings those assumptions into one spatial and technical reasoning environment.

The platform is not designed to replace qualified engineers, grid operators or statutory authorities. It is a screening, documentation and intelligence system. It helps reveal patterns, risks and opportunities earlier than conventional fragmented workflows.

## 3. Platform architecture

GlobalGrid2050 is deployed as a static site through GitHub Pages and Jekyll. There is no application server, no database server and no hidden backend latency. The browser is the working environment.

The client side stack includes Leaflet.js for geospatial rendering, Proj4js for coordinate transformation, PapaParse for CSV ingestion and DataTables for filtering, pagination and searchable tables. Shared JavaScript cores and shared CSS files provide common functionality and a consistent dark SCADA style visual identity.

Coordinate transformation is suitable for screening and visualisation. It is not a replacement for survey grade coordinate work. Where legal boundary, construction setting out or protection studies are required, qualified professionals and appropriate survey grade tools must be used.

The architecture uses shared core files, versioned application cartridges and preserved rollback references. Old working versions are not treated as clutter during launch. They are safety memory.

The geometry doctrine is that distance and measurement should respect geodesic metres and Haversine logic where relevant. Small local drawing approximations may be acceptable where explicitly documented as bounded interactive layout behaviour, but engineering calculations must not silently degrade into casual screen geometry.

## 4. Major applications

The REPD Grid Atlas maps operational and planned UK renewable energy infrastructure using the Renewable Energy Planning Database and related public datasets. It displays project status, generation technology, grid lines, substations and supporting infrastructure layers. Versioned atlas applications preserve development history and working references.

The BESS GIS SLD Financial Sandbox is the core breakthrough application. It combines GIS, single line diagram logic, solar topology, battery storage sizing, container assumptions, grid node selection, cable route awareness, baseline capital expenditure, revenue assumptions, degradation logic, electrical loss assumptions and GeoJSON export.

This sandbox is not merely a map and not merely a financial calculator. It is an origination and screening tool that shows how spatial layout, electrical topology, logistics, grid connection, cable losses and project finance interact before procurement and construction assumptions are locked in.

The UK Renewables Pipeline dashboard tracks renewable project development and helps expose the scale, timing and status of the UK project pipeline. The UK Energy and Live Grid Tracker applications display live and historic energy market information including electricity prices, generation mix, carbon intensity, oil prices, metals and other external indicators.

The platform also includes engineering and procurement tools such as price estimators, cable geometry visualisers, conductor resistance references, cable selection tools and technical knowledge pages. These support early stage cable, electrical and procurement judgement.

## 5. Data layer

The repository includes public data layers for grid lines, substations, power plants, roads, railways, ports, airports, data centres, EV chargers, industrial offtakers, emitters, subsea cables, supermarkets and other infrastructure categories.

Primary public data sources include the Renewable Energy Planning Database, OpenStreetMap through the Overpass API, Elexon BMRS, the Carbon Intensity API, Sheffield Solar PVLive, ONS energy data and commodity or market feeds. Where third party data licences apply, those licences must be respected and labelled.

Public source data may contain errors, omissions, outdated records or sensitive information already made public by the original data publisher. GlobalGrid2050 does not claim to validate every third party source as operational truth. The platform organises public intelligence for screening and documentation. Operational decisions require verification by the relevant authority, asset owner or qualified professional.

## 6. Automation and GridBot

The automation model is based on Python, GitHub Actions and GridBot reports.

Python is the heavy processing layer. Scripts collect data, transform datasets, update prices, regenerate JSON, generate reports and support controlled feature installation. GitHub Actions provide repeatable execution. GridBot is the automation identity that commits generated outputs and creates records.

There are 2 different GridBot roles. First, GridBot acts as an authorised GitHub automation identity for direct data pipelines. This is used for live data, price updates, carbon intensity, oil prices, metals, EV charging indexes, JSON feeds and generated reports.

Second, the older GridBot Feature Installer is used for controlled app patches where feature manifests, assertions and reports are necessary. This is appropriate for GIS SLD structural patches, controlled UI changes and large app refactoring split into deterministic operations.

The correct route depends on the task. Data feeds should use direct Python workflow automation. Complex application patches should use feature requests, YAML manifests and the feature installer route. AI must inspect the target files and relevant doctrine before deciding.

## 7. Governance doctrine

The platform governance model is human controlled and automation assisted. The operating sequence is:

1. The maintainer states strategic intent.
2. AI inspects the repository and proposes a small change.
3. AI creates the appropriate script, manifest, workflow or documentation.
4. The maintainer triggers or approves the relevant workflow.
5. GridBot executes through GitHub Actions.
6. GitHub records the commit.
7. The maintainer tests the live page.
8. The maintainer approves or rejects the result.

GridBot authentication is technical access. It is not human approval. AI must not assume that because automation credentials exist it has permission to deploy automatically.

The repository is not a playground for random edits. Large HTML, CSS or JavaScript files must not be blindly rewritten. Feature work should be small, explicit, reversible and documented. Where possible, changes should be applied through manifests, scripts and assertions rather than uncontrolled copy and paste.

Every change must preserve physical geometry, browser stability, dataset traceability, version continuity, feature reversibility, human readability, AI maintainability, commercial usefulness, constraint awareness and engineering truth.

## 8. Versioning and launch freeze

The repository uses versioned application cartridges as rollback protection. Working versions are preserved because they provide stability, comparison, recovery and historical traceability.

During launch preparation, structure should be frozen. The launch posture is: freeze structure, fix function, document risks and clean later. Safe actions include adding documentation that clarifies the current state, adding guardrail files, fixing broken references, patching visible functional defects and adding non destructive inventories.

Protected actions include deleting working version folders, moving shared datasets, archiving workflows, renaming live app folders, performing Git LFS migration, rewriting history or mass refactoring large cartridges for appearance only.

After launch, pruning or restructuring can occur through a controlled archive plan with path checks, tests and explicit human approval.

## 9. CERN OHL S v2 obligations

The repository is licensed under CERN Open Hardware Licence Version 2 Strongly Reciprocal. The licence allows use, study, modification, sharing and commercial activity, but it requires reciprocity when covered source or products based on covered source are conveyed.

A person who merely visits and uses the live website is using the platform. Mere use does not create a duty to publish source under CERN OHL S. A user can view maps, calculators and dashboards without becoming a licensor.

A person who forks, copies, modifies or conveys the covered source must retain notices. If they modify and convey the work, they must document their modifications, include dates or descriptions where required, provide a Source Location where necessary and license the modified covered source under CERN OHL S or a compatible licence.

Commercial use is permitted. A company may sell, charge for or build services around the platform. However, if it conveys a product based on the covered source, it must provide the Complete Source of the whole conveyed work or a durable Source Location under CERN OHL S or a compatible licence.

Misrepresentation is not permitted. The platform is built on public knowledge, but the architecture and organisation are a Ventus Ltd contribution. Forkers and commercial users must not strip attribution, imply authorship that is not true, imply endorsement or present derivative work in a misleading way.

The work is provided as is. Warranty disclaimers and liability exclusions apply under the licence. This manual is guidance only. The binding document remains LICENSE.txt.

## 10. Strategic relevance

Modern grids are increasingly exposed to voltage control, reactive power, inverter behaviour, oscillation, embedded generation visibility and real time observability issues. Large grid events demonstrate that system failure may arise not from renewable energy as such, but from poor voltage control, weak dynamic support, poor reactive power management, overvoltage tripping, oscillations and insufficient system visibility.

GlobalGrid2050 addresses this problem space at the screening and documentation layer. It maps generation, storage, grid lines, substations and constraints. It shows clustering, connection logic, project assumptions and market signals. It can evolve to include reactive power capability, power factor mode, grid forming versus grid following inverter assumptions, overvoltage ride through thresholds and storage duration.

The platform must not claim to be an operational control system. Its value is earlier visibility. It helps investors, developers, engineers and stakeholders see technical and commercial interactions before they become expensive failures.

## 11. Next improvements

Create a plain English licence notes file clearly marked as non binding guidance. It should explain the difference between live website use, forking or modifying and commercial product conveyance. The binding document remains LICENSE.txt.

Separate third party data licence notices from the CERN OHL S notice. This prevents confusion between Ventus covered source and third party data provider rights.

Keep AI_START_HERE.md, ARCHITECTURE.md, LAUNCH_FREEZE.md, WORKFLOW_REGISTRY.md, REPOSITORY_SIZE_REPORT.md and REPO_STRUCTURE.txt current.

Regenerate the repository structure snapshot when top level files or major app versions change.

Maintain the data in repo position until measured repository size or workflow performance creates an objective reason to split data into a separate repository. Do not split during launch unless explicitly approved.

Promote rigorous financial modelling to current sandbox versions where possible. Keep simple payback available only as a clearly labelled simplified view.

Add screening variables for reactive power, power factor mode, grid forming versus grid following inverters, overvoltage ride through, storage duration and connection sensitivity.

Keep public claims disciplined. Describe GlobalGrid2050 as screening, documentation, project origination and infrastructure intelligence. Do not describe it as survey grade, grid offer grade, operational protection or formal regulatory advice.

## 12. Caveats

This manual is an operating doctrine and explanatory guide. It is not legal advice. Licence edge cases, especially the application of a hardware origin licence to software and data workflows, should be reviewed by qualified counsel before commercial reliance.

Some repository counts, file names and workflow numbers may change. The repository should be treated as live and evolving. Any future version of this manual should verify current files directly before making numerical claims.

Third party APIs and datasets may change, fail, move, rate limit access or alter schema. Live dashboards depend on those sources and must be monitored accordingly.

The platform is for documentation, research, screening and decision support. It is not a substitute for professional engineering judgement, survey data, formal studies, grid applications, protection settings, planning advice or regulatory approval.

## 13. Final doctrine statement

GlobalGrid2050 is an open infrastructure intelligence operating system. It combines public data, browser based engineering tools, automated pipelines, versioned applications, traceable GitHub governance and a strongly reciprocal licence.

The mission is to make grid reality visible early enough to improve design, reduce failure, protect project value and restore engineering integrity.

AI proposes. Python processes. GitHub records. GridBot executes. The maintainer approves.

This is the operating doctrine of GlobalGrid2050 and Ventus Core Version 1.
