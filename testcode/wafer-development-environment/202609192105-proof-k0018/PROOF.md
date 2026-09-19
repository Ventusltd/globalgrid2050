# Iteration 0018

# The engineering record, and the code behind any line of it

## What it does

Every piece of engineering work on this site is placed on one disc: oldest in the middle, newest at
the rim, each piece of work its own small arc. Tap a dot to see what that work was and the day it
was done. Where the code for that line is carried here, the page shows it: ten lines above the
tapped line, ten below, the tapped line marked, and a link that opens that exact line on GitHub as
it stood that day.

## What changed in this version

- The card is now the pop card used across the rest of this site: a black panel with an amber
  title, a small cross to put it away (or press Escape), and one coloured word that says how much
  of the answer is proved: OK, EMPTY, LOAD, WAIT or FAIL, with a sentence beside it saying why.
- Where the code for a line is carried here, the card shows it in one window: ten lines above the
  tapped line and ten below, numbered, with the tapped line marked by an amber bar. The code is read
  from this site, so nobody is sent to GitHub to read it. GitHub is one link away for the detail and
  the history.
- Above the code the card says exactly what is on the screen: the file, where it came from, which
  lines of how many, and how many are above and below the tapped one.
- Where the file has since been removed, or the text carried for it does not match the record, the
  card says so in a sentence and shows nothing around the line rather than showing something it
  cannot stand behind.
- A page that stops working now says so on the screen instead of sitting at "starting".

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

Score 20 of 20, 2026-09-19T20:42:17Z.

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
