# V6 Repair: Fullscreen Toolbar Grid and Safe Period Selector

Status: prepared by deterministic repair script.

## Why the earlier fix did not work

The live stylesheet still had the original fullscreen toolbar as a flex row. The close button still used margin left auto. That forced the title, Period selector and close button into one row.

The previous selector styling did not survive into the final live stylesheet in the required position, so the browser kept applying the old toolbar contract.

## Fix applied by this script

1. Adds a hard CSS override at the end of `app.css`.
2. Changes fullscreen toolbar from flex to a 2 row grid.
3. Row 1 left is the title.
4. Row 1 right is the close button.
5. Row 2 left is the Period selector.
6. The Period selector uses black background and cyan text, not cyan text on white.
7. The normal in page portrait chart remains `63dvh` with `470px` minimum height.
8. No chart renderer logic is changed.
9. No data logic is changed.
10. No V5 file is changed.
