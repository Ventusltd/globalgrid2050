# Iteration 0009

Conductor page. The title block now folds every value to the width of the block, so no reading, source or disclaimer runs off the edge at any screen size. On a phone the standard citations move into the footnote beneath the drawing, where they can be scrolled; the readings stay beside the section. Type size steps down only as far as it must, and stops at a size that can still be read.

Conductor descriptions state what the conductor is and where it is used. The metal row now reads MINIMUM METAL FOR 3.39 ohm/km, 5.09 mm2, 85 % of the nominal size.

Kuiper page. The headline reads Engineering record, above the count of recorded work and the period it covers. The readout beside it shows what is lit and warns when work is too small to see at the current zoom. Address arithmetic, keys per pixel and zoom scale are no longer shown.

Both pages: what can be found out here, what to do with it, and what it is not.

## Tested unattended before publishing

Score 16 of 16, 2026-09-19T17:35:12Z.

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
