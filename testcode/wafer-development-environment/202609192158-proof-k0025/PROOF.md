# Iteration 0025

# The engineering record, and the code behind any line of it

## What it does

Every piece of engineering work on this site is placed on one disc: oldest in the middle, newest at
the rim, each piece of work its own small arc. Tap a dot to see what that work was and the day it
was done. Where the code for that line is carried here, the page shows it: ten lines above the
tapped line, ten below, the tapped line marked, and a link that opens that exact line on GitHub as
it stood that day.

## What changed in this version

- There is now a button for every application: GRIDATLAS, PIPELINE NEWS, SPIDER SANDBOX, PERIODIC
  TABLE, REAL SYSTEMS, CABLES, GRID ENGINE, THE SUN and LONDON UNDERGROUND. Nothing has to be typed.
- Press one and a pulse runs out through the record from the middle. Where it has passed, everything
  that is not that application goes dark and the application's own work stays lit. Then its tile
  opens, and one tap is in the application.
- The numbers are shown, and they make the whole: so many pieces of work lit, so many gone dark, so
  many in all, with the dates of the first and the last. What has gone dark has not been removed;
  it is only quiet. WHOLE VIEW puts everything back.
- An address can arrive already isolated, so a link to one application's work can be sent to
  somebody else.
- Which work belongs to which application is asked of the project's own history, not of names, and
  the page checks its count against that, to the unit, for every application.

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

Score 22 of 22, 2026-09-19T21:45:47Z.

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
- `selftest=isolate`: selftest PASS
- `selftest=isolate  w=390x844`: selftest PASS

Built and tested locally, published by a Python timer with no assistant in the loop.
Provided as is, without warranty of any kind; a chart, not a design.
