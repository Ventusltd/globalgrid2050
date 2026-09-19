# Proof 6: the phone

The wafer is read on a phone, in portrait, held in one hand. Until now it was only ever laid out
for a desktop window, and on a narrow screen three things were wrong: the header and the HUD sat
on top of the wafer, the conductor section's title block ran off the bottom of the screen, and a
phone has no `n`, no `r` and no `/` key, so half the page could not be reached at all.

## What changed

**The camera is given a rectangle, not a window.** The panels are `position:fixed`, so a wafer
centred on the window cannot also be clear of them. `safeBox()` now measures the panels as the
browser actually laid them out, with `getBoundingClientRect`, and returns what is left. `home()`
fits the whole wafer inside that rectangle and puts its centre at the centre of that rectangle,
which on a phone is above the middle of the screen. Nothing is assumed about how tall a panel is.

**Two fingers.** Every pointer that is down is held in one map. One finger drags; two pinch, and
the pinch keeps the world point between the fingers under the fingers, which is the rule the mouse
wheel already obeyed, so a phone and a desktop zooming into the same place land on the same key.
The canvas takes the gestures itself (`touch-action:none`), so the browser no longer steals them
to scroll a page that does not scroll.

**Tap targets.** `new code`, `random line`, `find` and `whole wafer` are now buttons that dispatch
the same keyboard events the keys do, so there is one code path and not two. The long subtitle
would have eaten a third of a phone screen, so it is collapsed and opens on a tap. Nothing was
deleted to make room.

**The conductor section.** On a narrow screen the title block cannot stand beside the drawing, so
it is set out beneath it. Its height is now reserved before a word of it is written, from its row
count, and the section is given whatever is left. That is the opposite of what it did before.

## What failed first

Two things, both caught by a test and not by an opinion.

1. The first patch declared `elTop` and `elFoot` after `resize()` was already called. `resize()`
   calls `layout()`, which reads them, so the page threw a `ReferenceError` on load: a temporal
   dead zone, and a blank wafer. The declarations were moved above the first call.

2. The conductor's title block was placed at `cy + R + 96`, below a drawing that had already been
   sized to fill the band. At 390 by 844 the clear band is 59 px to 719 px and the block's frame
   ended at 727 px: **eight pixels past the footnote**, and the last rows were hidden behind it.
   `T5_everything_is_inside_the_clear_band` was `false` and said so. Reserving the block first
   moved its bottom to 673 px, 46 px clear.

## The self test

A browser window on this machine will not go as narrow as a phone. So `phone.html` gives each page
a real 390 by 844 viewport inside a frame: inside it `innerWidth` is 390, the media queries fire,
and the rectangles are the ones the browser laid out. The rig asserts nothing of its own; it copies
up each frame's verdict. Open `phone.html`, or `index.html?selftest=phone` at any size.

Measured at 390 x 844, both frames PASS:

| test | result |
|---|---|
| wafer: no permanent panel covers the wafer | PASS. Wafer centre (195, 460), radius 150 px. Header clear of the rim by 276 px, HUD by 176 px, footnote by 176 px |
| wafer: the whole wafer is on the screen | PASS |
| wafer: the card fits | PASS. Card 8, 653 to 382, 775, inside 390 x 844 |
| wafer: one finger drags | PASS. A 60 px move asked for 92,596.449483 world units and moved 92,596.449483 |
| wafer: two fingers pinch | PASS. Zoom 0.000648 to 0.001296, exactly doubled when the fingers doubled their distance |
| conductor: title block clear of the section | PASS by 16 px at 390 px wide, 17 px at 1251 px wide |
| conductor: everything inside the clear band | PASS. Block bottom 673 px, band bottom 719 px |
| conductor: reserved rows match the rows written | PASS, 10 and 10 |
| conductor: 61 wires, layers 6, 12, 18, 24, metal area equals nominal | PASS, unchanged |

The three tests that already existed were run again on the changed page and still pass:
`?selftest=new` PASS 4 of 4 (171 commits, 1,731,552,064 lines, boundary key 51,521,788,947, new
band pixel 255, 176, 1 amber, silent centre 11, 14, 21); `?selftest=2026-07` PASS 2 of 2
(838,447,910 lines by running totals equal to the direct sum, 14 green pixels and 2 dark across
the band, 0 of any other colour); conductor at desktop width PASS 6 of 6.

## What this does not claim

The card, when something is selected, does sit over the lower part of the wafer on a phone. That
is deliberate: it is transient, it is dismissed by tapping it, and reserving space for it
permanently would have shrunk the wafer for a panel that is usually not there. The rig proves the
layout at 390 by 844 and at 1251 by 1188. It does not prove every size in between, and it is not a
substitute for holding the actual phone.

Provided as is, without warranty of any kind; a chart, not a design.
