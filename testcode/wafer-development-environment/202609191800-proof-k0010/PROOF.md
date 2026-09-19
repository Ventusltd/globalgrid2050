# Iteration 0010

Both pages are now laid out and checked at the width of a phone screen, 390 by 844, rather than at the wider window a desktop browser gives by default.

Conductor page. The whole section is visible below the controls at every screen size. On a narrow screen a dimension carries its value only, because where that value came from is already a row in the block beneath it.

Kuiper page. The disclaimer is shown on the screen at every size. It was previously written into the page but hidden on a narrow screen, so a reader on a phone never saw it.

Both pages: nothing is cut off at the right edge, and no panel holds text wider than itself.

## Tested unattended before publishing

Score 16 of 16, 2026-09-19T17:53:41Z.

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

Built and tested locally, published by a Python timer with no assistant in the loop.
Provided as is, without warranty of any kind; a chart, not a design.
