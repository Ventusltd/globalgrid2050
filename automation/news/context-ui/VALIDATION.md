# Bounded component evidence

2026-11-16: 30 Node tests passed against actual composer CLI output and the
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
affected browser run additionally checks inherited host font size/color,
transparent figure surfaces and retention of the complete native report. Source
states now use readable words (for example, Unknown) without changing their
underlying values. This component harness does not claim a full-page V9.24
comparison; that acceptance remains with COMMAND.
The review correction preserves country/unit/identifier capitalization, displays
every supplied coverage limitation and avoids implying a selected project.
Its affected checks were rerun once after those changes.

The browser checks cover 14 contexts, 3 unchanged figures, unknown and
historical states, clocks, upper bounds, native keyboard disclosure, overflow,
safe links, escaped markup, preserved native history, stale value removal,
preserved neighboring control identity/listener, and latest-request ordering.

| Screenshot | SHA-256 |
| --- | --- |
| `context-375.png` | `5aba18c92dace1a55b883afa48dd3316ce62c720631d180f886b79e8c2f99d1c` |
| `context-768.png` | `03104eb26cbedafcaffd9d29a5726c6eed23e358bc16bd02b3bdb5cfb68a3dd7` |
| `context-1440.png` | `52432b1dcab457b2b395884888ce888ba83503612e84271163e9e9b7ccb32257` |

Screenshots and `proof.json` are local integration artifacts, reproducible with
`browser.mjs`; private workspace locations are not part of the public receipt.
No Android, formal V9.29 integration, source-truth verification, production
serving, workflow, merge, publication or promotion was performed.
