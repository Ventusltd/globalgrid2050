# Kuiper — generic array drawing

Open index.html through a static HTTP server. This release uses Kuiper's native canvas renderer, camera and FIRE/string geometry engine. It starts with five independent strings of 30 generic modules on one table. Each string has a separate proposed inverter input pair.

Edit dimensions and module parameters, choose sequential/leapfrog/custom wiring, move modules in plan, rotate, undo, trace routes, and export a recipe or component/cable design record. Developed curves are schematic; physical route lengths come from XYZ polylines. Generic connector symbols and enclosure entry positions are assumptions. A proposed cable route does not establish a closed or approved electrical circuit.

The 500 MWp button opens a synthetic indexed hierarchy. Capacity is DC module nameplate with entered module Wp, not grid-export capability. Example commands: `site 1 MWp`, `site 1000 MWp`, `inspect B0001/S001/M030/C+`. Only the visible level is generated. Up to 128 edited strings / 4 MB per scenario are stored locally, with project download/import. No design data is sent to a calculation service.

This release exposes drawing and geometry tools, not a validated network solver or electrical approval. No dormant inherited calculation cartridge is certified by its inclusion. Electrical ratings may be stored as entered parameters but are not solved by this release. No actual site, surveyed placement, source schedule or manufacturer drawing is included.

See NOTICE.md, SOURCE-PROVENANCE.json and licenses/ for licensing, source identities and modifications. RELEASE-MANIFEST.json records shipped file hashes.

Power-block proposals: open the Power blocks panel, enter a DC/AC ratio and inverter assumptions, then build. Whole strings are allocated to inverter nameplates, with actual partial final stations. Download the proposal or selected-station generic route quantities. These proposal IDs are separate from the synthetic site hierarchy. No MPPT, voltage, current, transformer, surveyed routing or equipment approval is established.

Editing proposal inputs clears the previous proposal and its routes until rebuilt. Changing the selected station or route dimensions clears only the prepared routes. Downloads are available only for the current prepared results; invalid rebuilds also clear prior results.

The selected-station route preview uses equal-axis local metres, actual proposal inverter IDs and the partial final station count. Hover for trench occupancy or expand the ID list. Road width is an assumption; symbols are enlarged. Changes clear the preview until routes are prepared again. This is generic station geometry, not whole-site placement or electrical approval.

Download station plan SVG saves the current prepared preview as a standalone vector drawing with station/inverter IDs, metre units, equal-axis geometry, route-summary metadata and visible provisional-use limitations. Changing proposal, station or route inputs disables export until routes are prepared again. It does not certify equipment, site fit or installation.

The station trench schedule lists each shared segment once with local endpoints, length and expandable proposed circuit IDs. It supports touch and keyboard inspection without hovering. Occupancy counts are feeders, not conductor counts, cable sizing or thermal approval. Editing inputs clears the schedule until routes are prepared again.

The station plan feeder selector highlights one proposed circuit with a white dashed route and reports its endpoint IDs and route length. Input changes clear the preview and selection. The standalone SVG remains an unselected station plan. This trace does not establish conductor quantities, connectivity approval or cable ratings.

Whole-site route overview: build a power-block proposal, then open Whole-site roads & collection routes below the canvas. Enter station spacing and draw. Counts use exact proposal IDs; access-road union and LV circuit/trench lengths remain separate. Current-table connection metrics are hidden while this overview is active. Module fields, real boundaries and MV circuits are not allocated. Select a station and choose Inspect station feeders to draw its actual proposed inverter IDs and independent feeder routes in the native canvas. Return to Whole-site route overview or Return to module table. Teal routes share trench geometry without becoming electrical junctions. Equipment symbols are enlarged; their box sizes are not manufacturer dimensions. Changed inputs invalidate the overview and its export.
