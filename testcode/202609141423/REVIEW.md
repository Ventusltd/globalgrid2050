# Code journey experiment

A new read-only view makes the block-to-family-to-lines journey navigable with native buttons, paged lists, permanent-key deep links and browser back navigation. All memberships remain available when a family belongs to multiple groups. Lists paginate instead of stopping at 150/200 families or 40 relationships. Failed data reads have a visible retry control. Shared-line results disclose their loaded-bucket scope.

The reader core is copied byte-for-byte from GLOBALGRID2050 a88abf09e360184c26300484e6a02e2d0ddf88fb, generation 202609141350. publication.json records the exact page assets; live Stars inputs can subsequently change. No published version is edited.

## Reproduce local checks

With Node 24, in this directory run `npm ci --ignore-scripts` and `npm test`. Fixtures exercise family 241 beyond the old cutoff, all memberships, caller 70, browser history, a missing bucket and retry, and invalid family keys. These are DOM/logic checks, not real-browser, layout, mouse or touch evidence.

## Publication and browser review

Publish the four page assets plus publication.json into a new generation directory. The source can be hosted at any directory depth. Compare every served asset hash to publication.json before attributing measurements to this candidate. The Chrome extension connected to the local MSI browser, but navigation and read/screenshot access were denied. Consequently no first-view latency, viewport result, console/network result or ten-minute interaction session is claimed. Browser review remains outstanding at 430 px and desktop width, including mouse/touch, source-link opening and return.

## Intended review route

Open a block; page to a family; inspect numbered lines; follow uses or used-by; open each containing block; open the pinned source or live page; return with Back. Check each displayed count against the data captured during that session. Also test a family in multiple groups and a bucket request failure. Legacy electron and soul numbers are not substituted for permanent family keys.
