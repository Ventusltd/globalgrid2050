# globalgrid2050
Open infrastructure for electrification
# GlobalGrid2050
**Open Infrastructure for Electrification**

GlobalGrid2050 is a data platform and engineering intelligence repository dedicated to documenting and analyzing the physical behavior of electrical energy systems.

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
