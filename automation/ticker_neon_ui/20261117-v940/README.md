# V9.40 moving headline strip and compact news header

One semantic list retains up to100 original safe headlines, publisher credits
and date semantics from the existing injected `latestHeadlines` selector.
The visual repeat contains only spans, is aria-hidden/inert and has no links or
focusable descendants. Equal-width cycles move continuously on a black strip
with restrained red light and a subtle glass highlight. No ticker search,
buttons or page counts are created.

Keyboard focus switches to a static native-overflow list and keeps each original
link visible. Hover pauses on hover-capable devices. Touch pauses for reading;
a second touch in empty strip space resumes. Reduced motion stays static.
Identical normalized feeds preserve DOM and animation; changed feeds disconnect
their observers/listeners before rebuilding.

The header wrapper imports the unchanged V9.37 view once and moves its actual
query input into the white-on-black masthead. Existing lexical filter bindings,
publisher/topic/category/source-type choices, clear action, provenance, source
clock and possible-match caveats are preserved. It does not create a second
query or a collector. The new edition contains a compact shared binding and
pins the three shared runtime files in contracts/ticker.v940.json.

The explicit audited migration `ticker-neon-v940-v1` replaces the two inherited
V9.36 stationary/paging presentation features. Its original edition/contract
remain immutable. Source selection, canonical data, news snapshots, Solar-1000,
MAP/CSV and the remaining tabs are unchanged.

Validation:

```text
node --test automation/v940_preview/contracts.test.mjs
python -B -m unittest discover -s automation/v940_preview -p test_migration.py -v
node automation/v940_preview/browser.mjs
```

The browser proof samples actual rendered positions, a seamless cycle wrap,
hover/focus/touch pause and resume, 100 unique keyboard links, reduced motion,
same-feed animation identity, one header search reaching past the first12,
source boundary cases0/1/10/71/100, 7,775rows, MAP and no-JavaScript links.
Chromium desktop/touch emulation is not physical handset or assistive-technology
acceptance. A ROOT owns registry/finalization, CI wiring, publication and rollback.
