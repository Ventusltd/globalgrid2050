# Optional Data Centre location actions

This small adapter adds **Screen¹** to the existing Data Centre table using
the audited address projection in `Ventusltd/data-grid-gb` PR10. It edits no
page frame, historical edition, existing collector, shared Data Centre model or
grid engine. The release owner must copy the two runtime files into a new
immutable edition and wire them after the existing Data Centre component mounts.

The default input is pinned to data-owner commit
`b33190f2a95a2046e108c2ba465c6a9195759892`, 183,561 bytes and SHA-256
`6f68e078d9b57057acdda679288730e638553f68df884dfd747c5049e56ea88e`.
It retains 100 source IDs: 39 Wikidata points, 25 approximate postcode points
and 36 unknown locations. The 54-row UK view has 34 usable screening actions;
the 100-row global view retains those same 34 actions. Its 30 other mapped
international records keep their original map/source links without claiming
local network screening coverage. Unknown-country points have no GB screening
action. These are observed snapshot counts, not permanent
coverage targets or verified facility counts.

All 38 exact-ID records with address statements have a compact **Reported
address** disclosure and their original Wikidata revision, including foreign
sites and records without coordinates. Every reported address statement is
retained verbatim as plain text; an address does not establish facility identity.
The shared sources disclosure also links the exact full 100-record GeoJSON.

## Wire into a new edition

Load `actions.css` once. After the existing component has rendered into its
host, call once:

```js
import {attachLocationActions} from './scripts/dc-locations/actions.mjs';
const locationActions = await attachLocationActions(datacentreHost);
// When the owning view is permanently destroyed:
// locationActions.disconnect();
```

Catch optional-load failures at the host and leave the original Data Centre
table, search, exports and source links usable. The adapter follows that
component's existing row renders and exact `.ggdc-id` identities. It does not
infer a row binding from a name. Unknown geometries have no invented action.
Rerenders, same-row identity changes and duplicate mounts cannot retain another
record's screening link. Disconnect restores source messages it temporarily hid.

The one shared footer reads **¹ UK screening coverage. Screening only; not a grid-capacity assessment.**
Postcode locations are marked approximate beside the action; original source
revisions are linked. One collapsed **Location sources and accuracy** disclosure
links separate Wikidata CC0 and postcode-provider terms and carries the actual
OS/Royal Mail/National Statistics/NRS geometry attribution from the pinned
projection. It preserves the distinction between the address statement and
the postcode coordinates. Marker, source text and address strings use plain text
DOM methods. No article body, raw publisher markup or producer-provided action
URL is rendered.

The loader checks the immutable source URL, finite byte budget, exact received
bytes/digest, schema, actual counts, original source IDs, geometry and separate
postcode/Wikidata terms. It accepts no mutable branch URL, credential URL,
internal address, arbitrary host or executable URL. Direct action generation
rechecks coordinates and reconstructs the existing GridAtlas coordinate route.

This invokes GridAtlas's location screening with no invented REPD ID, capacity
or operating status. It does not automatically select the separate rich DC
30/30/30 card. Actual public receiver sampling at the CyrusOne LON1 approximate
postcode point completed five nearest measurements with entity kind `location`.
Desktop results were visible. Pixel 7 emulation initially showed the receiver's
collapsed title bar; one physical tap expanded the existing result sheet. Its
initial minus icon did not reflect that collapsed state. Do not claim the
initial mobile result was visible or that this fixes that separate receiver UI.

## Checks

```sh
node --test automation/news/dc-locations/tests/contracts.test.mjs
node automation/news/dc-locations/tests/browser.mjs /original-product-checkout /data-grid-checkout /artifact-directory
```

The browser harness requires Playwright. `PLAYWRIGHT_MODULE` may identify an
existing installation, and `PLAYWRIGHT_BROWSERS_PATH` may identify its browser
cache. It uses the actual original V9.28 Data Centre renderer and exact pinned
address bytes at Android portrait, Android landscape and desktop widths. It
checks UK/global scopes, search, point/null actions, source identity changes,
marker/footer uniqueness, duplicate fetches, corrupted input isolation,
cleanup, no page overflow and a portrait–landscape–portrait transition.

The external navigation target is captured in that deterministic harness;
the actual public GridAtlas receiver was tested separately without route mocks.
Touch emulation is not a native Android handset test. Homepage promotion and
new-edition acceptance remain the release owner's responsibility.
