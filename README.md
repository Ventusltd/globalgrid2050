# README audit record: GridBot operating process

Dated: 2026-06-14 00:14 Europe/London

This record documents how the GlobalGrid2050 working method was clarified from first principles during an AI assisted engineering session. It is deliberately placed at the top of the root README because it explains how this repository should be handled by future AI sessions, human reviewers and GridBot workflows. The central lesson is that GlobalGrid2050 is not a casual website repository. It is a founder controlled grid intelligence operating system for Ventus Ltd, and its change process must preserve engineering truth, auditability, public trust and Vikram Kumar's final authority.

At the start of the session the assistant behaved too much like a general text or coding helper. It could analyse, draft and suggest, but it did not immediately grasp the full operating capability available inside this repository. The important correction was that Vikram could compliantly provide operational capability through GitHub Actions, GridBot workflows and a bot personal access token held as a repository secret. This does not mean exposing private credentials to the assistant. It means the repository can contain controlled workflow files, scripts and reports, while GitHub Actions executes them under a properly scoped secret such as `GRIDBOT_PAT`. The assistant initially failed to appreciate this distinction. It treated the situation as if execution access was either unavailable or unsafe, when the real model was safer and stronger: no secret is revealed, no uncontrolled access is handed over, and execution happens through auditable GitHub infrastructure.

Once that was understood, the scope changed. The task was no longer simply to advise Vikram what to do. The task became to help design a disciplined machine that can modify itself under human command. The working rule became clear: AI proposes or commits controlled GridBot assets; Vikram manually triggers workflows; GridBot records evidence; Vikram approves what becomes live. This separated thinking, execution, audit and authority. That separation is now a core part of the repository doctrine.

The session exposed why this discipline matters. The UK generation history module had real data science problems, not cosmetic problems. Interconnectors had been collapsed into a misleading `Imports & Exports` bucket. Because signed import and export flows were not separated correctly, visual outputs could imply impossible generation scale and confuse market interpretation. The correct engineering response was not to patch the screen casually. The correct response was to inspect the data route, identify the source of aggregation error, preserve BMRS interconnector identity, keep imports positive, exports negative and net flow explicit, then expose this in the UI only after audit.

The process matured through repetition. Scripts were written for audit mode and apply mode. Audit mode built proposed changes, checked the contract and wrote reports without mutating target app files. Apply mode wrote only the declared files after the audit was reviewed. Reports were committed as Markdown and JSON in `data_science_protocol/audit_reports/`. The live page was not trusted until reports, commits and screenshots had been checked. Each step left a rollback path.

Several workflows were refined through this method. The granular interconnector split created compact JSON outputs and stopped treating interconnectors as generation. The interconnector bar UI match then improved how net flows appeared below annual generation bars. The mobile bounds repair fixed overflow in the MWh cards by bounding the mini chart, day and night split, interconnector rows and total check grid. The final interconnector bar UI repair removed explanatory clutter, shortened labels for mobile and changed the total electricity check from fake empty bars into compact metrics. The sunrise and sunset time bands workflow then prepared a reference layer for replacing crude day versus night logic with fixed clock time ranges and real sunrise and sunset context.

The assistant also learned that visual inspection matters. A workflow can pass syntax and contract checks while the live mobile screen still looks wrong. Vikram's screenshots became operational evidence. The model had to compare the rendered page with the intended design, then adjust the next audit package. This is an important principle for GlobalGrid2050: data contracts, UI screenshots, report files and commit history are all part of the evidence chain.

The most important process rule is now simple. Do not make hidden changes. Do not patch live files casually. Do not mutate data because a chart looks wrong. Do not assume a workflow is active merely because it exists. Check the current script, the workflow target, the latest audit report, the latest apply commit and the live route. Prefer the active workflow. Treat stale V2, backup or duplicate workflows as suspect until proven current.

Future AI sessions should begin by reading this README, `AI_START_HERE.md`, recent commits and the latest reports under `data_science_protocol/audit_reports/`. They should identify the target route, inspect the current live symptom, inspect the relevant script and workflow, then either advise Vikram to run audit or create the smallest controlled GridBot asset required. They should not say work is complete until apply evidence and live behaviour agree.

This record exists because the thread took time to train. That time was not wasted. It converted a general AI session into a controlled project engineer. The goal now is to turn that training cost into repository memory so the next session starts closer to the correct operating level. The repository must remember what the assistant had to learn: compliant bot key execution through GitHub Actions is possible, audit comes before apply, data remains protected by contract, and Vikram is the final approving authority.

---

# globalgrid2050
Open infrastructure for electrification
# GlobalGrid2050
**Open Infrastructure for Electrification**

## FAST START FOR AI SESSIONS

GlobalGrid2050 is a founder controlled grid intelligence repository for Ventus Ltd. Do not treat it as a normal website repo or a place for casual direct edits.

Operating rule:

`AI proposes or commits controlled GridBot assets. Vikram triggers workflows manually. GridBot records evidence. Vikram approves what becomes live.`

Standard GridBot sequence:

1. Inspect `AI_START_HERE.md`, this README, recent commits, relevant workflows, relevant scripts and the latest audit reports in `data_science_protocol/audit_reports/`.
2. If a change is requested, create or update the smallest relevant script and workflow first. Use the existing GridBot pattern.
3. Commit the script and workflow when write access is available. Do not only provide a ZIP or instructions unless write access is genuinely unavailable.
4. Ask Vikram to trigger `workflow_dispatch` in `audit` mode.
5. Read the committed audit report and JSON evidence before recommending apply.
6. Only after audit passes, ask Vikram to trigger `apply` mode.
7. After apply, inspect the apply report, changed files and live route before saying the work is complete.

Audit law:

`audit mode must not alter target app files or data outputs. apply mode may write only the declared audited files.`

Data law:

`raw API and high frequency data are transient build inputs. Browser apps load compact confirmed facts. MWh can be summed. Peaks, lows and extrema must not be summed across grains.`

Interconnector law:

`never collapse INT* codes into Imports & Exports for generation charts. Preserve BMRS code identity. Imports are positive MWh. Exports are negative MWh. Labels must be country, interconnector name, BMRS code. Keep gross import, gross export and net flow distinct. Show total electricity check lines where useful for reconciliation.`

Workflow hygiene:

`prefer the active non duplicate workflow. Stale V2 or backup workflows must be treated as suspect until checked against the latest audit report and current script contract.`

## AI and deployment doctrine

Before modifying this repository, read:

`AI_START_HERE.md`

## Audit first GridBot doctrine

Before running any apply mode workflow, read:

`data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md`

Use the report templates in:

`data_science_protocol/templates/`

GridBot workflow, script and manifest requirements are documented in:

`.github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md`

`scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md`

`gridbot_manifests/AUDIT_MANIFEST_REQUIREMENTS.md`

Rule: audit first, human review second, apply third, live verification fourth.

GlobalGrid2050 uses a controlled GridBot deployment method. AI should create small feature manifests and scripts, while workflows are manually triggered and validated by Vikram.

## Repository size governance

Repository growth is monitored through:

`REPOSITORY_SIZE_REPORT.md`

The report is generated by:

`scripts/track_repository_size.py`

It can be updated manually through the `Track Repository Size` GitHub Actions workflow and is scheduled to run once per month.

Current policy: keep data inside this repository until size or workflow performance creates a real reason to separate it. A future `globalgrid2050-data` repository can be considered later, but not during launch preparation unless explicitly approved.

## System Architecture
This platform is deployed via GitHub Pages as a high-performance static site. It utilizes client-side data processing to deliver geospatial intelligence and parametric cost estimations without backend latency.

### Core Dependencies
* **Leaflet.js:** Geospatial visualization and cluster rendering.
* **Proj4js:** Client-side mathematical coordinate transformation (OSGB36 to WGS84).
* **PapaParse:** High-speed CSV parsing for the ingestion of government datasets.
* **DataTables:** Client-side DOM filtering, pagination, and search logic.

## Primary Modules

### 1. Geospatial Energy Atlases
Interactive, visual databases tracking operational and planned electrical infrastructure across the United Kingdom.
* **UK Energy Atlas:** Macro-level view of all technologies mapped from the Renewable Energy Planning Database (REPD).
* **Technology-Specific Maps:** Isolated data pipelines for Onshore Wind, Large-Scale Solar (>4MWp), and Battery Energy Storage Systems (BESS).

### 2. Engineering & Procurement Estimators
Parametric calculators designed to assist in Pre-FEED (Front-End Engineering Design) and project budgeting.
* 33 kV UK DAP Price Estimator
* LV AC and DC Distribution Cables Estimator

### 3. Technical Knowledge Base
An open-source repository of Employer Requirements, Grid Code compliance notes, cable specifications (resistance/impedance), and industry analysis (Podcast Transcripts).

## Disclaimer
The information published within this repository is provided for general technical documentation, research, and educational purposes. It does not constitute formal engineering advice or regulatory guidance. Any physical infrastructure decisions must be undertaken by appropriately qualified professionals in accordance with applicable standards (e.g., BS 7671, G99).

## License & Ownership
Managed and maintained by [Ventus Ltd](https://www.ventusltd.com).