# Bounded component evidence

2026-11-16: 29 Node tests passed against actual composer CLI output and the
three hash-verified PR23 renderer files. Checks cover mandatory manifest pin,
bounded/invalid UTF-8 input, all 14 native contexts and receipts, exact coverage,
unknown policy/COP31 fields, forged scope/linkage/state/clock/qualifier, numeric
coercion, source receipt changes, unsafe links, and asynchronous input mutation.

Installed Chrome **157.0.8103.51** passed 15 checks at each of **375, 768 and
1440 px**. Actual exporter bytes and pinned external modules were fulfilled by
Playwright from memory at a loopback origin; no HTTP server or public serving
claim is involved. This is an explicit workaround for observed workstation
socket exhaustion, not a skipped browser check. No external request, page error
or horizontal overflow was observed. The 375 px screenshot was visually
inspected: the News disclosure stays inline and the rejected 480 MW amendment
retains Forecast, UNKNOWN current state, distinct dates and provisional status.

The browser checks cover 14 contexts, 3 unchanged figures, unknown and
historical states, clocks, upper bounds, native keyboard disclosure, overflow,
safe links, escaped markup, preserved native history, stale value removal,
preserved neighboring control identity/listener, and latest-request ordering.

| Screenshot | SHA-256 |
| --- | --- |
| `context-375.png` | `debb98001f954c3bf7c7a7498dde06d607d98b11aacfd8d9547e9cfcf9b573da` |
| `context-768.png` | `755c180179a7fd30c8de2250a3b780df5b366ce2bda3c2dda04a69c89eb92921` |
| `context-1440.png` | `7b3d91d4c737850a0d7d9072133699ab2c9de9fc748cba167b714fd76501e3df` |

Screenshots and `proof.json` are local integration artifacts, reproducible with
`browser.mjs`; private workspace locations are not part of the public receipt.
No Android, formal V9.29 integration, source-truth verification, production
serving, workflow, merge, publication or promotion was performed.
