# Iteration 0003

A2: the 6 mm2 class 5 conductor is no longer drawn from a nominal wire count at an assumed fill. Its diameter is the 3.00 mm a maker publishes (input), its metal is the least that meets the 3.39 ohm/km maximum (17.241 / 3.39 = 5.09 mm2, 85 per cent of the name), and the wire diameter falls out of those two, derived, at about 0.278 mm rather than the nominal 0.300. The title block shows nominal, metal and fill side by side so a name can never be read as an area, and the fill written down is measured off the drawn outline. Four new self tests: the drawn diameter matches the published one, the metal is the least the resistance allows, the drawn metal would meet the maximum resistance, and the fill is below the honeycomb limit.

## Tested unattended before publishing

Score 7 of 7, 2026-09-19T15:31:43Z.

- `selftest=2026-07`: selftest PASS
- `conductor.html:c=al400`: conductor al400 selftest PASS
- `conductor.html:c=cu6c5`: conductor cu6c5 selftest PASS
- `conductor.html:c=cu6c6`: conductor cu6c6 selftest PASS

Built and tested locally, published by a Python timer with no assistant in the loop.
Provided as is, without warranty of any kind; a chart, not a design.
