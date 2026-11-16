# Bounded component evidence

2026-11-16: 29 Node tests passed against actual composer CLI output and the
three hash-verified PR23 renderer files. Checks cover mandatory manifest pin,
bounded/invalid UTF-8 input, all 14 native contexts and receipts, exact coverage,
unknown policy/COP31 fields, forged scope/linkage/state/clock/qualifier, numeric
coercion, source receipt changes, unsafe links, and asynchronous input mutation.

Installed Chrome **157.0.8103.51** passed 17 checks at each of **375, 768 and
1440 px**. Actual exporter bytes and pinned external modules were fulfilled by
Playwright from memory at a loopback origin; no HTTP server or public serving
claim is involved. This is an explicit workaround for observed workstation
socket exhaustion, not a skipped browser check. No external request, page error
or horizontal overflow was observed. The initial 375 px screenshot was visually
inspected at `320a5c46`. After COMMAND's V9.24 presentation correction, the
single affected browser run additionally checks inherited host font size/color,
transparent figure surfaces and retention of the complete native report. Source
states now use readable words (for example, Unknown) without changing their
underlying values. This component harness does not claim a full-page V9.24
comparison; that acceptance remains with COMMAND.

The browser checks cover 14 contexts, 3 unchanged figures, unknown and
historical states, clocks, upper bounds, native keyboard disclosure, overflow,
safe links, escaped markup, preserved native history, stale value removal,
preserved neighboring control identity/listener, and latest-request ordering.

| Screenshot | SHA-256 |
| --- | --- |
| `context-375.png` | `3bad6b5bc74982420a949fd5ba64ad1ff3dfaba3e00e904f78ec6e54481c9675` |
| `context-768.png` | `81b2861fdebe5201c217c6f0be750d1bcfa171bfd5d6d35d5521ee879d14c530` |
| `context-1440.png` | `b200ed4d24ada19ef5bb10a854a27ed093eb9a0753873cc5671e082bfc240233` |

Screenshots and `proof.json` are local integration artifacts, reproducible with
`browser.mjs`; private workspace locations are not part of the public receipt.
No Android, formal V9.29 integration, source-truth verification, production
serving, workflow, merge, publication or promotion was performed.
