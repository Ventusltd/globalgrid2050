# Kuiper — generic array drawing

Open index.html through a static HTTP server. This release uses Kuiper's native canvas renderer, camera and FIRE/string geometry engine. It starts with five independent strings of 30 generic modules on one table. Each string has a separate proposed inverter input pair.

Edit dimensions and module parameters, choose sequential/leapfrog/custom wiring, move modules in plan, rotate, undo, trace routes, and export a recipe or component/cable design record. Developed curves are schematic; physical route lengths come from XYZ polylines. Generic connector symbols and enclosure entry positions are assumptions. A proposed cable route does not establish a closed or approved electrical circuit.

The 500 MWp button opens a synthetic indexed hierarchy. Capacity is DC module nameplate with entered module Wp, not grid-export capability. Example commands: `site 1 MWp`, `site 1000 MWp`, `inspect B0001/S001/M030/C+`. Only the visible level is generated. Up to 128 edited strings / 4 MB per scenario are stored locally, with project download/import. No design data is sent to a calculation service.

This release exposes drawing and geometry tools, not a validated network solver or electrical approval. No dormant inherited calculation cartridge is certified by its inclusion. Electrical ratings may be stored as entered parameters but are not solved by this release. No actual site, surveyed placement, source schedule or manufacturer drawing is included.

See NOTICE.md, SOURCE-PROVENANCE.json and licenses/ for licensing, source identities and modifications. RELEASE-MANIFEST.json records shipped file hashes.

Power-block proposals: open the Power blocks panel, enter a DC/AC ratio and inverter assumptions, then build. Whole strings are allocated to inverter nameplates, with actual partial final stations. Download the proposal or selected-station generic route quantities. These proposal IDs are separate from the synthetic site hierarchy. No MPPT, voltage, current, transformer, surveyed routing or equipment approval is established.
