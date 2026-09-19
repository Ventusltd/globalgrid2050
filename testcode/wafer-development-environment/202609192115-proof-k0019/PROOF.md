# Iteration 0019

# The engineering record, and the code behind any line of it

## What it does

Every piece of engineering work on this site is placed on one disc: oldest in the middle, newest at
the rim, each piece of work its own small arc. Tap a dot to see what that work was and the day it
was done. Where the code for that line is carried here, the page shows it: ten lines above the
tapped line, ten below, the tapped line marked, and a link that opens that exact line on GitHub as
it stood that day.

## What changed in this version

- The code of the cable geometry application is now carried here: its page and its program, 1,773
  lines between them. Tap any dot that belongs to either and the card shows the line, ten above and
  ten below, without leaving this site. Three files are carried in all.
- One line of that program is shown as "[withheld]" rather than as written. A guard checks every
  line before it is carried and holds back any that matches a private name; the line is counted and
  marked, never dropped in silence.
- Every carried file is checked line for line against the project's own history before it is
  released: the first line, the last, and one from the middle of each.
- The card now says that the code window scrolls, up and down for the lines around the tapped one
  and sideways for a long line, rather than leaving a reader to think what is visible is all there is.
- On a wide screen the card no longer has an empty black band under its last line.

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

Score 20 of 20, 2026-09-19T20:53:35Z.

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
