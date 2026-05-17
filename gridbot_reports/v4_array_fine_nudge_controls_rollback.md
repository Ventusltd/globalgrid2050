# V4 Array Fine Nudge Controls Rollback Log

UTC created: 2026-05-17

Purpose:
Add fine array positioning controls to V4 so the array can be moved intricately to fit inside a field without moving the point of connection.

Feature scope:

- Fine Nudge Step metres input
- Up arrow
- Down arrow
- Left arrow
- Right arrow
- Nudges array centre geodesically using Turf destination
- Keeps point of connection fixed
- Recalculates customer substation position and export cable length
- Clears pinned cable route after every nudge because the customer substation moves

Touched files:

1. solar-bess-topology-v4/gis-sld-v4-ui.js
2. gridbot_reports/v4_array_fine_nudge_controls_rollback.md

Commit:

1. bc00c5e507b629a8eef9faf6fe89c660f0846ffe
   Message: Add V4 array fine nudge arrow controls

Rollback method:

Revert commit bc00c5e507b629a8eef9faf6fe89c660f0846ffe.

Expected behaviour after rollback:

V4 returns to Pick Up Array movement only, with no fine nudge arrows.

Test checklist:

1. Open https://globalgrid2050.com/solar-bess-topology-v4/
2. Draw grid.
3. Confirm Fine Nudge Step metres input is visible.
4. Set step to 25 m.
5. Click up, down, left and right arrows.
6. Confirm array moves slightly each time.
7. Confirm point of connection remains fixed.
8. Confirm export cable length updates.
9. Drop and draw cable pins, then nudge array.
10. Confirm pins clear after nudge because route endpoints changed.
