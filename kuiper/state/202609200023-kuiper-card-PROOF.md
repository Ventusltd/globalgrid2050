# Iteration 0037

# Kuiper: every dot shows the code behind it

## What changed in this release

- Tap any dot of public work and open "See the code behind this": the card now shows real code. It names how many files that piece of work changed, shows the first of them as it stood that day, ten lines above and ten below the first line the work changed, and offers the others one tap away. The file is read from where the work is publicly kept, as it stood at that exact moment in its history, shown in the page; GitHub is one grey word under it for those who want the detail.
- About three taps in four now show real code: 153 of 200 taps chosen by a fixed seed, and 7,704 of the 9,940 pieces of work. The rest changed only data or pictures, or belong to work that is not public, and the card says which.
- Where a file cannot be read the card says so, with the reason, and shows nothing in its place.

## What this is not

Not a design, not a rating and not a connection offer. Provided as is, without warranty of any kind;
a chart, not a design.

## Tested unattended before publishing

Score 24 of 24, 2026-09-19T23:43:51Z.

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
