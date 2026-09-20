# Iteration 0041

# Kuiper: the page's own checks for the header

## What changed in this release

Nothing a visitor sees. The checks the page runs on itself now require, with the code open and at the size of the screen in hand, that the application's tile is still at the top of the card and can still be pressed, that the code begins below it, and that the marked line is in view.

## What this is not

Not a design, not a rating and not a connection offer. Provided as is, without warranty of any kind;
a chart, not a design.

## Tested unattended before publishing

Score 24 of 24, 2026-09-20T00:02:45Z.

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
