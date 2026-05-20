# Fix V7 GIS SLD Mobile Tools Energy Layer Clearance

UTC created: 2026-05-20T23:44:01.465360+00:00

## Purpose

Move the mobile tools overlay lower in both TOOLS ON and TOOLS OFF states so operating asset toggles can be selected.

## Actions

- added mobile tools clearance override so energy layer buttons remain clickable

## Manual acceptance test

1. Open V7 GIS SLD on mobile.
2. Confirm SOLAR OP, ONSHORE WIND, OFFSHORE WIND and BESS OP are visible and clickable.
3. Toggle TOOLS OFF and confirm the collapsed tools button does not cover energy layer buttons.
4. Toggle TOOLS ON and confirm the expanded tools group sits lower.
5. Confirm MWp sizing input still appears with TOOLS ON and hides with TOOLS OFF.
