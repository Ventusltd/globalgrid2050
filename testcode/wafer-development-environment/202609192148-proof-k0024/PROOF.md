# Iteration 0024

# The engineering record, and the code behind any line of it

## What it does

Every piece of engineering work on this site is placed on one disc: oldest in the middle, newest at
the rim, each piece of work its own small arc. Tap a dot to see what that work was and the day it
was done. Where the code for that line is carried here, the page shows it: ten lines above the
tapped line, ten below, the tapped line marked, and a link that opens that exact line on GitHub as
it stood that day.

## What changed in this version

- Tap a dot and the card puts you into the page that work belongs to. The big name on the tile is
  that page's own title, the one you would see in the browser tab, and the button says OPEN THIS
  PAGE. Where the work is part of an application, that is said in small letters above the name.
- The true count, corrected from an earlier draft that overstated it: about one piece of work in
  five has a page of its own (1,974 of 9,940, across some 420 pages, every address checked to
  answer). About 800 more open an application. The rest reach only the front door of the site they
  are served from, and the card says so plainly: "This work has no page of its own yet."
- A front door is never counted or shown as a page of its own. The page checks this on itself: the
  parts must add up to the whole, and no page of its own may be the top of a site.
- Nothing is guessed and nothing is matched by name. These sites are served from the same folders
  the work sits in, so a file's place is already an address: the page itself if the work is a page
  that still stands, otherwise the nearest page above it.
- The link to the history of the work is one small grey word, "source", at the bottom of "See the
  code behind this".

## What it is for

- Find when a calculation, a drawing or a data set was first written, and read it as it stood that day.
- Send somebody the address of one line, or of one whole piece of work.
- See at a glance how much of the engineering behind this site is drawing, how much is data, and when
  it was done.

## Still to come

Previous and next line without leaving the sheet. A line saying which application a piece of code
belongs to, and a button that opens that application. The code carried for every file, rather than
only the ones carried so far.

## What this is not

Not a design, not a rating and not a connection offer. Provided as is, without warranty of any kind;
a chart, not a design.

## Tested unattended before publishing

Score 20 of 20, 2026-09-19T21:38:25Z.

- `selftest=2026-07`: selftest PASS
- `conductor.html:c=al400`: conductor al400 selftest PASS
- `conductor.html:c=cu6c5`: conductor cu6c5 selftest PASS
- `conductor.html:c=cu6c6`: conductor cu6c6 selftest PASS
- `selftest=path:conductor_resistances`: selftest PASS
- `selftest=path:ac_cables_knowledge`: selftest PASS
- `selftest=path:dc_cables_knowledge`: selftest PASS
- `selftest=path:33kv_uk_dap_price_estimator`: selftest PASS
- `selftest=path:lv_ac_dc_price_estimator`: selftest PASS
- `conductor.html:c=cu6c5  w=390x844`: conductor cu6c5 selftest PASS
- `conductor.html:c=al400  w=390x844`: conductor al400 selftest PASS
- `selftest=phone  w=390x844`: selftest PASS
- `conductor.html:c=cu6c6  w=390x844`: conductor cu6c6 selftest PASS
- `selftest=card`: selftest PASS
- `selftest=card  w=390x844`: selftest PASS
- `selftest=card&colour=red`: selftest PASS
- `selftest=card&key=abc  w=390x844`: selftest PASS

Built and tested locally, published by a Python timer with no assistant in the loop.
Provided as is, without warranty of any kind; a chart, not a design.
