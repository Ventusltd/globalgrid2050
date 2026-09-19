# Iteration 0030

# Kuiper: the engineering behind this site, and the code behind any line of it

## What it does

Every piece of engineering work on this site is placed on one disc: oldest in the middle, newest at
the rim, each piece of work its own small arc. Tap a dot to see what that work was and the day it
was done. Where the code for that line is carried here, the page shows it: ten lines above the
tapped line, ten below, the tapped line marked, and a link that opens that exact line on GitHub as
it stood that day.

## What changed in this version

- The gathered work is now dots with black between them on every screen. On an ordinary phone or
  laptop screen, which packs two pixels into the space of one, every dot was being drawn at twice its
  size, so the small record of an application's work was a mass of overlapping discs. No dot is now
  ever drawn wider than a third of the gap to its nearest neighbour: while it rests, while it spells
  the name, and at every moment of the flight between, where the gap is measured from where the dots
  actually are. The page checks this on itself as a screen like a visitor's would show it.
- The bright sparks at the rim are gone: light that adds up is how neighbours merge.
- The tile now rises as soon as the dark has fallen, and the work gathers behind it, so OPEN is
  there in about two seconds rather than eight.
- Earlier tonight: a black screen after pressing an application and then NEW CODE is cured, and the
  page presses every button after every other on itself to keep it cured; the row holds seven
  applications; every tile has its sentence; the top box says KUIPER.

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

Score 24 of 24, 2026-09-19T22:34:32Z.

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
- `selftest=buttons  vt=90`: selftest PASS
- `selftest=buttons  w=390x844  vt=90`: selftest PASS

Built and tested locally, published by a Python timer with no assistant in the loop.
Provided as is, without warranty of any kind; a chart, not a design.
