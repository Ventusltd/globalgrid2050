# Iteration 0036

# Kuiper: the gathered work gathers again

## What changed in this release

- On the permanent address, pressing an application swept the pulse and dropped the dark, and then the
  work never gathered: no small record of the application, no name. It does again. One part of the page
  was looking for the piece that moves the dots in the wrong place once it was published, and saying
  nothing when it did not find it.
- If a piece of the page ever cannot be loaded again, the page now says so, in words, on the card.
- Releases are now put together and checked in the exact shape they are published in before they go
  out, not only in the folder they were built in, which is where this fault hid.

## What this is not

Not a design, not a rating and not a connection offer. Provided as is, without warranty of any kind;
a chart, not a design.

## Tested unattended before publishing

Score 24 of 24, 2026-09-19T23:37:33Z.

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
