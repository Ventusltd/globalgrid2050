# Iteration 0017

# The engineering record, and the code behind any line of it

## What it does

Every piece of engineering work on this site is placed on one disc: oldest in the middle, newest at
the rim, each piece of work its own small arc. Tap a dot to see what that work was and the day it
was done. Where the code for that line is carried here, the page shows it: ten lines above the
tapped line, ten below, the tapped line marked, and a link that opens that exact line on GitHub as
it stood that day.

## What changed in this version

- Arriving by somebody else's link, the view now flies to the work the address names and an arrow is
  shot from the middle of the record to that exact dot. Only then does the card open. A card that
  appears over a picture of nine thousand pieces of work asks to be taken on trust; an arrow from the
  beginning of the record to one dot does not. The page measures where the arrow's point actually
  lands, at both sizes, and refuses to pass unless it lands on the dot the card is about.
- An address that asks for something this page does not use now says so in one plain sentence, and
  then shows what it can. The last version said this in its note and did not do it: giving out such
  an address was refused, but arriving with one said nothing at all, which is the half a reader
  actually meets.

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

Score 20 of 20, 2026-09-19T20:21:06Z.

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
