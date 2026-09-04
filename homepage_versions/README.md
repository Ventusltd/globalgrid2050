# Homepage Version Control

This folder stores deliberate homepage snapshots before further public-facing edits are made.

## Rule before creating the next version

Before creating a new homepage version, measure and record:

1. File count in this folder.
2. HTML version file name.
3. Line count.
4. Word count.
5. Character count.
6. Source commit or reason for version.
7. Plain-English change intention.

Do this before editing so the homepage can be reversed, compared and rebuilt without losing navigation, links or working JavaScript.

Every new current product version must also be labelled clearly on the live
homepage, and the version it supersedes must remain there as an explicitly
labelled older-version link. A numbered homepage snapshot is a restore point;
it does not replace the reader-visible older-version row.

The Grid Atlas catalogue is oldest-first and append-only. Preserve every
existing version/generation identity, source commit, checked-at time and
recorded evidence. The only permitted retained-row mutation is a deterministic
stale-current archival: when a proven successor is appended, its predecessor
moves from `LIVE` on the mutable current route to `ARCHIVED` on its own
immutable composition manifest. Any inherited v9.x predecessor accidentally
left claiming `Live Current` receives that same delayed repair. Its version,
generation, source commit, evidence class, checked-at time and browser-proof
text do not change, and no other retained row may change. This prevents the
mutable current route from masquerading as an older runnable version. A missing
generation stays labelled `MISSING`; never manufacture a link or reuse another
product's similarly numbered release. Do not add a successor until its exact
promoted GridAtlas `main` SHA is known.

## Naming

Use this format:

`homepage_v001.html`
`homepage_v002.html`
`homepage_v003.html`

Never overwrite an old version. Create the next numbered file.

## Manual workflow

A manual GitHub Actions workflow now exists:

`.github/workflows/homepage-restore-point-check.yml`

Run it before public homepage edits. It checks that the homepage files exist, measures the current public homepage files, records SHA-256 values and uploads an artifact called:

`homepage-restore-point-report`

The workflow does not change the website. It is a measurement and restore-point confidence check only.

## Baseline snapshot

Version: `homepage_v001.html`
Source: live `index.html` after commit `95408ac795441543fefc46eb1307cdc178cce0f4`
Purpose: preserve the current homepage before removing internal-facing language from the public front end.
Measured by: ChatGPT working session

Metrics for `homepage_v001.html`:

Line count: 318
Word count: 1421
Character count: 13818

Folder file count after this setup:

2 files

1. `README.md`
2. `homepage_v001.html`

## Public-facing rule

Public homepage language should explain the mission, people and contribution route.

Internal architecture language such as boot screen, BIOS, kernel, audit layer and evidence layer belongs in GitHub documentation unless it is intentionally explained for a technical audience.

## Contribution rule

Do not assume contributors are engineers or coders.

GlobalGrid2050 is for project developers, CEOs, entrepreneurs, commercial managers, sales engineers, chartered accountants, lawyers, planners, investors, engineers, manufacturers, students, retired professionals and anyone willing to document useful knowledge.

You do not need to code to start developing.

Start with writing.

## Version 002

Version: `homepage_v002.html`
Source: live `index.html` at commit `febf6b08802f4fdbc913efc693a8a1ca29868359`
Purpose: restore point taken before adding the `202608311645` Pipeline News release
and demoting `202608311610` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v002.html`:

Line count: 186
Word count: 1614
Character count: 19813
SHA-256 (first 16): e3bbe4e5e6ccbdec

Change intention in plain English:

Add one new current entry for the Pipeline News release that puts TOWN and
POSTCODE columns in the project table and makes CAPACITY, COUNTY, TOWN and
POSTCODE sortable by clicking their headings. Move the previous current entry,
`202608311610`, to the top of the superseded list nested beneath it. Nothing
else on the page changes: every other `name:` and `note:` string, the Grid Atlas
V8 sentinel and the GRIDATLAS_V9_AUTOMATION markers stay byte-identical.

Folder file count after this snapshot:

4 files

1. `README.md`
2. `homepage_v001.html`
3. `homepage_v002.html`
4. `202608291526-globalgrid2050`

## Version 003

Version: `homepage_v003.html`
Source: live `index.html` at commit `5fe50782adc57e4d81e2ddc10a9bd30028627c8f`
Purpose: restore point taken before adding the `202608311731` Pipeline News release
and demoting `202608311645` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v003.html`:

Line count: 187
Word count: 1661
Character count: 20190
SHA-256 (first 16): dd3c03b7a5863985

Change intention in plain English:

Add one new current entry for the Pipeline News release that narrows the TOWN
column, restores a reachable horizontal scrollbar under the table, and extends
the one search bar to cover town, postcode and planning authority alongside the
project, operator, county and reference fields it already searched. Move the
previous current entry, `202608311645`, to the top of the superseded list nested
beneath it. Nothing else on the page changes: every other `name:` and `note:`
string, the Grid Atlas V8 sentinel and the GRIDATLAS_V9_AUTOMATION markers stay
byte-identical.

Folder file count after this snapshot:

5 files

1. `README.md`
2. `homepage_v001.html`
3. `homepage_v002.html`
4. `homepage_v003.html`
5. `202608291526-globalgrid2050`

## Version 004

Version: `homepage_v004.html`
Source: live `index.html` at commit 0f1b96fa0e0f5bc9d5b30b0e5a5ba5e1e4b4dbb0
Purpose: restore point taken before adding the `202608311800` Pipeline News release
and demoting `202608311731` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v004.html`:

Line count: 188
Word count: 1711
Character count: 20584
SHA-256 (first 16): 280b57bfae871c13

Change intention in plain English:

Add one new current entry for the Pipeline News release that puts a GRID column
in the project table: the straight-line distance from each project to the
nearest mapped grid circuit, sortable nearest-first and marked BETA. Move the
previous current entry, `202608311731`, to the top of the superseded list
nested beneath it. Nothing else on the page changes: every other `name:` and
`note:` string, the Grid Atlas V8 sentinel and the GRIDATLAS_V9_AUTOMATION
markers stay byte-identical.

Folder file count after this snapshot:

7 files

1. `README.md`
2. `homepage_v001.html`
3. `homepage_v002.html`
4. `homepage_v003.html`
5. `homepage_v004.html`
6. `202608291526-globalgrid2050`

## Version 005

Version: `homepage_v005.html`
Source: live `index.html` at commit 58d91d44db639afba7a96434af56475443a9f2c0
Purpose: restore point taken before adding the `202608311816` Pipeline News release
and demoting `202608311800` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v005.html`:

Line count: 189
Word count: 1801
Character count: 21265
SHA-256 (first 16): 28f5c67a88bd6608

Change intention in plain English:

Add one new current entry for the Pipeline News release that puts a PROJECT SIZE
range filter above the technology buttons, so the register can be narrowed to a
band of megawatts such as 30 to 40 MW. Move the previous current entry,
`202608311800`, to the top of the superseded list nested beneath it. Nothing
else on the page changes: every other `name:` and `note:` string, the Grid
Atlas V8 sentinel and the GRIDATLAS_V9_AUTOMATION markers stay byte-identical.

Folder file count after this snapshot:

8 files

## Version 006

Version: `homepage_v006.html`
Source: live `index.html` at commit ffc356b8f3d224bf6cd4dc2a10808e533560b677
Purpose: restore point taken before adding the `202608311858` Pipeline News release
and demoting `202608311816` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v006.html`:

Line count: 190
Word count: 1886
Character count: 21833
SHA-256 (first 16): bcede5bdc9de01e9

Change intention in plain English:

Add one new current entry for the Pipeline News release that moves the grid
distance out of its own table column and into the ACTIONS column beside the MAP
link, where it can be seen without scrolling the table sideways, and adds a
second distance beside it: how far the project is from the nearest substation at
33 kV or above. Move the previous current entry, `202608311816`, to the top of
the superseded list nested beneath it. Nothing else on the page changes: every
other `name:` and `note:` string, the Grid Atlas V8 sentinel and the
GRIDATLAS_V9_AUTOMATION markers stay byte-identical.

Folder file count after this snapshot:

9 files

## Version 007

Version: `homepage_v007.html`
Source: live `index.html` at commit 34c0b6895031ed4f2c1b1bec47f37582080cedb2
Purpose: restore point taken before adding the `202608312037` Pipeline News release
and demoting `202608311858` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v007.html`:

Line count: 191
Word count: 2015
Character count: 22635
SHA-256 (first 16): 3fe09e2274b8719d

Change intention in plain English:

Add one new current entry for the Pipeline News release whose MAP button finally
opens the Grid Atlas that carries the grid maths, instead of the older atlas that
does not. Move the previous current entry, `202608311858`, to the top of the
superseded list nested beneath it. Nothing else on the page changes: every other
`name:` and `note:` string, the Grid Atlas V8 sentinel and the
GRIDATLAS_V9_AUTOMATION markers stay byte-identical.

Folder file count after this snapshot:

10 files

## Version 008

Version: `homepage_v008.html`
Source: live `index.html` at commit bdbd88dcefed48a0df54d80cad167463ef0ca232
Purpose: restore point taken before adding the `202608312056` Pipeline News release
and demoting `202608312037` into the superseded list beneath it.
Measured by: Claude Code working session

Metrics for `homepage_v008.html`:

Line count: 192
Word count: 2113
Character count: 23261
SHA-256 (first 16): cf4bea662025f9ed

Change intention in plain English:

Add one new current entry for the Pipeline News release that removes the
headlines the register does not bind to a project. 89 of 136 stories were
classified as having no project signal and were being shown anyway, each
captioned with a project it was not about. Move the previous current entry,
`202608312037`, to the top of the superseded list nested beneath it. Nothing
else on the page changes.

Folder file count after this snapshot:

11 files

## Version 009

Version: `homepage_v009.html`
Source: live `index.html` at commit a9777cc19c69823d9964c60cb0d21f44f63d6e3f
Purpose: restore point taken before adding the `202608312109` Pipeline News release.
Measured by: Claude Code working session
SHA-256 (first 16): 5c3012f11eb08907

Change intention in plain English:

Add one new current entry for the Pipeline News release that removes the
headlines and sector topics that were not about the sector, and stops captioning
an unbound story with a project it is not about.

## Versions 010 and 011 — recorded late

`homepage_v010.html` and `homepage_v011.html` exist in this folder with no
entry above. Reading them back: `homepage_v011.html` carries `202608312114` as
the current Pipeline News entry, so it is the restore point taken before adding
`202608312145`; `homepage_v010.html` carries `202608312212`, so it is the
restore point taken before adding `202608312339`. They are numbered out of
chronological order because the ritual's own record was skipped, not because the
snapshots are wrong. Recorded here rather than renumbered: nothing in this
folder is ever overwritten, and a late entry is honest where a renumber would
destroy two restore points to tidy an index.

## Version 012

Version: `homepage_v012.html`
Source: live `index.html` at commit `34ba41db9dd0738b586bbf58a6245cb102f9c4cc`
Purpose: restore point taken before naming the two Pipeline News releases that
were published to this host and reachable from nothing, and before correcting
the Grid Atlas row.
Measured by: Claude Code working session

Metrics for `homepage_v012.html`:

Line count: 200
Word count: 2950
Character count: 27769
SHA-256 (first 16): 1173ddc0d58477d4

Change intention in plain English:

`202609012326` and `202609020025` were both copied into
`pipelinenews_intelligence/`, deployed, and served with HTTP 200. Neither was
named anywhere on this page, so the newest Pipeline News version a reader could
reach was `202608312339` — three versions behind. The publishing runner does not
edit this page by design, and nothing else was checking, so the gap was silent.

This edit does four things:

1. Makes `202609020025` the current Pipeline News entry.
2. Adds `202609012326` to the top of the superseded list beneath it, and demotes
   `202608312339` under that, with its `NEW` badge removed and its supersession
   named.
3. Adds `202608312244` in its correct place in that chain. It is the parent of
   `202608312339` and the one step in the current lineage that was built but
   never mirrored to this host; its directory is published in the same commit.
4. Corrects the Grid Atlas row inside the `GRIDATLAS_V9_AUTOMATION` markers,
   which claimed v9.5 / `202608301624` was the current verified release while
   the live composition was v9.77 / `202609020018`. The markers, the URL and the
   V8 sentinel are unchanged; only the name, note and `data_gridatlas_release`
   move.

Nothing else on the page changes: every other `name:` and `note:` string, the
Grid Atlas V8 sentinel and the `GRIDATLAS_V9_AUTOMATION` markers stay
byte-identical.

`scripts/verify_published_versions.py` is added in the same commit so this
cannot drift silently again. It was verified to fire on the unfixed page before
being trusted: against `homepage_v012.html` it reports all three findings and
exits 1.

Folder file count after this snapshot:

14 files

## Version 013

Version: `homepage_v013.html`
Source: live `index.html` at commit `1b2b4b3`
Purpose: restore point taken before naming the `202609020552` Pipeline News
release, the first cut made after the reachability checker existed.
Measured by: Claude Code working session

Metrics for `homepage_v013.html`:

Line count: 203
Word count: 3262
Character count: 29822
SHA-256 (first 16): fe9d97445f32b4d9

Change intention in plain English:

Add one new current entry for the Pipeline News release whose strip says a
rating quoted without its season flatters the network, and that the Atlas never
sums ratings. Move the previous current entry, `202609020025`, to the top of the
superseded list nested beneath it, with its `NEW` badge removed and its
supersession named. Nothing else on the page changes.

This is the first naming done after `scripts/verify_published_versions.py`
existed, and the checker found the gap on its own: run against the deployed page
before this edit it reported `202609020552` as published and reachable from
nothing, and that the page was presenting `202609020025` first while a newer
snapshot was being served. After this edit it reports 21 published snapshots,
all reachable, newest first.

Folder file count after this snapshot:

15 files

## Version 014

Version: `homepage_v014.html`
Source: live `index.html` at commit `1bbb0b2`
Purpose: restore point taken before naming the `202609020611` Pipeline News
release, the last of the queued overnight steps.
Measured by: Claude Code working session

Metrics for `homepage_v014.html`:

Line count: 204
Word count: 3374
Character count: 30519
SHA-256 (first 16): 93e3a749e7f5be9f

Change intention in plain English:

Add one new current entry for the Pipeline News release whose connections panel
says a kilometre is not a connection and points at the measurement that is: the
panel still reports straight-line kilometres, which is what it measures, while
MAP now reports the count of published circuits, which is what decides whether
two sites are connected at all. Move `202609020552` to the top of the superseded
list beneath it, with its `NEW` badge removed and its supersession named.
Nothing else on the page changes.

The checker found this gap on its own too, as it did for `202609020552`: the
release published itself here and the page linked to nothing.

Folder file count after this snapshot:

16 files

## Version 015

Version: `homepage_v015.html`
Source: live `index.html` at commit 77e4eeaff7e2a383cb764390cbbe2aa7801493fe
Purpose: restore point taken before adding one About & Media entry for the
estate build scan published at `estate_scan/202609021858/`.
Measured by: Claude Code working session

Metrics for `homepage_v015.html`:

Line count: 204
Word count: 3305
Character count: 31486
SHA-256 (first 16): 2fbc82d968b4293a

Change intention in plain English:

Add one new entry to the About & Media area, pointing at a self-hosted page that
reports the measured build state of the fifteen repositories behind the estate:
commits on main, CI/CD outcomes, every workflow whose most recent run failed, and
a fixed-width baseline index so a later scan can be diffed against this one. The
page is self-hosted rather than linked, because the working copy of it sits behind
a private URL the public site cannot reach.

Nothing else on the page changes. The Grid Atlas Overlay V8 catalogue sentinel,
its route, and the GRIDATLAS_V9_AUTOMATION markers are untouched, and all 113
pre-existing `name:` strings and 65 `note:` strings stay byte-identical — the
edit is one inserted line, verified by diff.

Folder file count after this snapshot:

17 files

## Version 016

Version: `homepage_v016.html`
Source: live `index.html` at commit 9f1a7b96
Purpose: restore point taken before removing the note from the
`Estate Build Scan — 202609021858` entry.
Measured by: Claude Code working session

Metrics for `homepage_v016.html`:

Line count: 205
Word count: 3385
Character count: 32030
SHA-256 (first 16): aaf3cc1c1267e205

Change intention in plain English:

Vikram asked for the note to come off the estate build scan entry. The row keeps
its name and its route and loses its description, so it reads as a plain link
like `Blog` and `Podcast Transcripts` beside it. The figures the note carried —
the failing workflow count and the undeployed commit count — are still stated on
the page the row points at, which is where they belong.

Nothing else on the page changes.

Folder file count after this snapshot:

18 files

## Version 017

Version: `homepage_v017.html`
Source: live `index.html` at commit 4ab57063
Purpose: restore point taken before renaming the estate build scan row to `Log`
and repointing it at generation `202609021924`.
Measured by: Claude Code working session

Metrics for `homepage_v017.html`:

Line count: 205
Word count: 3312
Character count: 31572
SHA-256 (first 16): 7b19e3d8b1ad1c7a

Change intention in plain English:

Vikram asked for two things: the row renamed from `Estate Build Scan` to `Log`,
and his username taken off the terminal prompt at the top of the page it points
at. The username is inside published bytes at `estate_scan/202609021858/`, and
published bytes are not edited in place here, so `202609021924` is a new
generation carrying the correction. The row now names that generation. The
superseded folder stays on disk, unlisted, as the record of what was served.

Nothing else on the page changes.

Folder file count after this snapshot:

19 files

## Version 018

Version: `homepage_v018.html`
Source: live `index.html` at commit 9c36d53c
Purpose: restore point taken before repointing the `Log` row at generation
`202609021937`.
Measured by: Claude Code working session

Metrics for `homepage_v018.html`:

Line count: 205
Word count: 3310
Character count: 31558
SHA-256 (first 16): 0f6204a6192b55f0

Change intention in plain English:

The `Log` row moves from `202609021924` to `202609021937`. The page it points at
is rebuilt as a vertical scan log rather than a set of tables: the terminal
prompt line and the source strip are gone, the probe section is gone, and the
per-repository statistics are widened to include tree size, file-type
distribution, largest tracked objects, commit interval, hour and weekday
distribution, per-workflow run durations, branch counts with distance from the
default branch, and a live HTTP probe of every published site.

Nothing else on the page changes.

Folder file count after this snapshot:

20 files

## Version 019

Version: `homepage_v019.html`
Source: live `index.html` at commit 685ce845
Purpose: restore point taken before repointing the `Log` row at generation
`202609021952`.
Measured by: Claude Code working session

Metrics for `homepage_v019.html`:

Line count: 205
Word count: 3310
Character count: 31558
SHA-256 (first 16): 7804abb1b3930772

Change intention in plain English:

Four corrections to the page the `Log` row points at.

The spaced banner is removed. The reveal no longer drags the viewport downward as
lines arrive; the text fills from the top while the reader stays where they are.

Every name is gone. Repositories are ordinals, authors are ordinals, branches and
workflows are ordinals, object paths are sizes only, published URLs are statuses
only, and the head commit subject and SHA are dropped — a SHA is a lookup key back
to a repository, not a statistic. This is enforced in the payload, not only in the
rendering: the embedded JSON was rebuilt from a whitelist, so nothing identifying
survives View Source either. The page fell from 95,700 to 48,933 bytes as a result.

Lines of code are counted for the first time, across all fifteen repositories,
split into text and code-ish totals with a per-language breakdown.

Nothing else on the homepage changes.

Folder file count after this snapshot:

21 files

## Version 020

Version: `homepage_v020.html`
Source: live `index.html` at commit 864b92ea
Purpose: restore point taken before linking the three published Pipeline News
releases that had no row on the homepage.
Measured by: Claude Code working session

Metrics for `homepage_v020.html`:

Line count: 205
Word count: 3310
Character count: 31558
SHA-256 (first 16): fc08fc922d23650b

Change intention in plain English:

Three releases were published to the repository and were serving live, but
nothing on the homepage pointed at them: `202609021945`, `202609022308` and
`202609030009`. A reader arriving at the directory had no route to any of them
and the current row still named `202609020611`.

`202609030009` becomes the current entry and the other two are folded beneath
it, followed by the previous current entry which keeps its own nested list. The
convention is unchanged: one current Pipeline News row, superseded builds under
it.

Nothing else changes. Every pre-existing `name:` and `note:` string is
byte-identical, verified by diff — the previous current entry is moved intact
and re-indented, not rewritten. The Grid Atlas Overlay V8 sentinel, its route,
and the GRIDATLAS_V9_AUTOMATION markers are untouched.

Folder file count after this snapshot:

22 files

## Version 021

Version: `homepage_v021.html`
Source: live `index.html` at commit 87e6da86
Purpose: restore point taken before naming Grid Atlas v9.86 as the current
verified release. The homepage had named v9.77 while nine further versions shipped.
Measured by: Claude Code working session

Metrics for `homepage_v021.html`:

Line count: 209
Word count: 3531
Character count: 33206
SHA-256 (first 16): f55d2d764c67a99d

Change intention in plain English:

The catalogue row inside the GRIDATLAS_V9_AUTOMATION markers named
`202609020018-gridatlas-v9.77`. The live composition at
`/gridatlas/atlas/` served generation `202609030200`, v9.86 — nine versions
further on. globalgrid2050's own publication-truth gate was reporting the gap
as a FAIL, correctly.

`scripts/catalogue_gridatlas_v9.py` cannot make this change. Its
`compile_root()` requires that when the catalogue URL is already present, the
whole entry line matches byte for byte; the current-composition row has a stable
URL, so a generation refresh fails by construction rather than updating. The
compiler exists to insert a row per immutable release, not to move a pointer
row. So this is a governed hand edit, and its invariants are asserted the way
the compiler asserts them: V8 sentinel once, V8 route once, catalogue route
once, both automation markers intact.

One name and one note change. Every other `name:` and `note:` string in the
file is byte-identical, verified by diff, and the row's URL is preserved
unchanged.

Folder file count after this snapshot:

23 files

## Version 022

Version: `homepage_v022.html`
Source: live `index.html` at commit fafa4d2d
Purpose: restore point taken before repairing the one dead Grid Atlas catalogue
link left behind by the release-directory migration.
Measured by: Claude Code working session

Metrics for `homepage_v022.html`:

Line count: 209
Word count: 3655
Character count: 33913
SHA-256 (first 16): 9046d60f8054fd9b

Change intention in plain English:

The row `UK Grid Atlas V9 — 202608291239` linked to
`/gridatlas/202608291239-atlas-v9/`, which answers 404. GridAtlas split one
directory into two roles that used to coincide: the served app now lives at
`/gridatlas/atlas/` and the release artefacts at
`/gridatlas/atlas/releases/<release_id>/`. Before the migration they were one
URL, so nothing written earlier can tell them apart. The row names a release
artefact, so it takes the artefact base; `/gridatlas/atlas/releases/202608291239-atlas-v9/`
answers 200.

Only the URL changes. Every `name:` and `note:` string in the file is
byte-identical, verified by diff. The V8 sentinel, its route and both
GRIDATLAS_V9_AUTOMATION markers are untouched, and AREAS was re-evaluated with
node to confirm it still parses.

This is one instance of an estate-wide class. 338 references to the
pre-migration shape exist across the estate; 122 of the 125 in this repository
are frozen by design — homepage snapshots and published immutable releases,
which are correct to hold the URL that was live when they were cut. Three are
operative here: this row and two files under `state/`, which describe the app
rather than an artefact and are left for the architect.

Folder file count after this snapshot:

24 files

## Version 023

Version: `homepage_v023.html`
Source: live `index.html` at commit a0f93e87
Purpose: restore point taken before adding the Pipeline News 202609031308 row to
the catalogue.
Measured by: Claude Code working session

Metrics for `homepage_v023.html`:

Line count: 210
Word count: 3865
Character count: 33653
SHA-256 (first 16): 2fd3c745dd5c8298

Measured over LF bytes, which is what git stores and what GitHub Pages serves.
A Windows working copy holds CRLF, so a character count taken off the disk is
larger by one per line and describes bytes nobody receives — the same defect
`.gitattributes` in this repository exists to document.

Change intention in plain English:

Pipeline News 202609031308 is published and serving and had no row. It becomes
the current entry, and the entry it supersedes — 202609030009 — moves down to
join the superseded siblings it already carried, at the indent those siblings
already sit at. That is the whole edit: one line inserted, one line modified,
nothing re-indented. The tree shape is unchanged: a current release holding the
superseded ones beneath it, one of which carries the deeper history.

The row says what changed. 202609030009 put the twenty REPD technology types the
spine does not carry into the product's technology row as twenty more tabs,
which made the row twenty-five controls wide. Counted on the payload, nine of
the twenty hold five projects or fewer and one holds a single project, and on a
390 px viewport that row was eleven wrapped lines and 584 px tall — it pushed
the product's own SOLAR, BATTERY, ONSHORE and OFFSHORE down the page. The twenty
are now one labelled control, each option carrying its own project count, and
the row is three lines and 152 px with no horizontal overflow. The twenty also
gain the `?technology=` deep link they never had.

One `note:` string changes — the previous current row loses its NEW mark and
gains its superseded clause — and one name and one note are added. Every other
`name:` and `note:` string in the file is byte-identical, verified by
comparison against `HEAD:index.html`: 185 strings before, 187 after, one
removed and three added, and none of the removals is a name. The Grid Atlas
Overlay V8 row and its route each still occur once, the catalogue route occurs
twice as before, and both GRIDATLAS_V9_AUTOMATION markers are intact. AREAS was
re-evaluated with node: it parses, 11 top-level areas, 118 nodes, 107 with a
URL, and the new row resolves to
`./pipelinenews_intelligence/202609031308/`.

Folder file count after this snapshot:

25 files

## Version 024

Version: `homepage_v024.html`
Source: live `index.html` at commit `9c4a0df3c03a46153765da2dac5c9ae9fd7a01eb`
Purpose: restore point taken before publishing Pipeline News `202609032159` and
before moving the Grid Atlas current-release row off `v9.86 / 202609030200`,
which it had named since 3 September while the live composition moved eleven
versions past it.
Measured by: Claude Code working session

Metrics for `homepage_v024.html`:

Line count: 211
Word count: 4205
Character count: 35642
SHA-256 (first 16): f157fb6ec1d6e3cf

Plain-English change intention:

Two rows change and nothing else. Pipeline News `202609032159` becomes the
current entry, and `202609031308` moves down to the superseded indent its
siblings already sit at, losing its NEW mark and gaining the clause that says
what superseded it. That is one line inserted and one modified; nothing is
re-indented and the tree shape is unchanged.

The Grid Atlas row inside the `GRIDATLAS_V9_AUTOMATION` markers is the second
change, and it is the one that was overdue. It named `v9.86 / 202609030200`
while the live composition was `v9.97 / 202609032222`. The homepage is the only
route a reader has to these releases, so a stale row is not a cosmetic problem:
`scripts/verify_published_versions.py` had been failing on exactly this, and on
the newest Pipeline News release not being mirrored here at all. Both are now
true and the check passes — 27 published snapshots, all reachable, newest
`202609032159`.

The compiler still cannot write that row. `compile_root()` requires the
catalogue URL to occur at most once and the whole entry line to match byte for
byte, and the `os-strip` banner added on 30 August carries the same href, so
the URL occurs twice. It occurred twice before this edit and occurs twice
after; the jam is unchanged and is not what this snapshot is for.

Verified after the edit: three `name:`/`note:` strings removed and five added,
187 to 189, and exactly one of the removals is a `name:` — the Grid Atlas row
this edit deliberately renames. Every other string is byte-identical against
`HEAD:index.html`. The V8 sentinel occurs once with its four leading spaces and
its route once. Both automation markers are intact. AREAS was re-evaluated with
node: it parses, 11 top-level areas, 119 nodes, 108 with a URL, the new row
resolves to `./pipelinenews_intelligence/202609032159/`, and the Grid Atlas
identity `202609032222-gridatlas-v9.97` occurs once.

Folder file count after this snapshot:

26 files

## Version 025

Version: `homepage_v025.html`
Source: live `index.html` at commit `d5aafefb72ad39063db8fe48bf1ccc2d865773fc`
Purpose: restore point taken before publishing Pipeline News `202609032251` — grid
proximity widened from 3,047 rows in two technologies to 4,138 in eleven — and
before moving the Grid Atlas current-release row from `v9.97 / 202609032222` to
`v9.98 / 202609032246`.
Measured by: Claude Code working session

Metrics for `homepage_v025.html`:

Line count: 212
Word count: 4421
Character count: 36886
SHA-256 (first 16): 4c1049f55e151579

Plain-English change intention:

The same two rows as version 024, for the same reason, and the discipline is the
point: two lanes shipped in the same hour and the homepage is the only route a
reader has to either. Pipeline News `202609032251` becomes the current entry and
`202609032159` moves down to the superseded indent its siblings already sit at,
losing its NEW mark and gaining the clause naming what superseded it. The Grid
Atlas row moves to v9.98.

The Pipeline News release was built by another lane and is carried here byte for
byte — 61 files, verified with `diff -rq` against the cut, and its own `--check`
re-run in this session rather than taken on trust. Its widened payload was
counted here independently: 4,138 rows, solar 1,747, bess 1,300, biomass 814,
hydro 150, hydrogen 59, act 37, tidal 18, geothermal 7, caes 4, flywheel 1,
other 1, and the registry's `record_count` reads 4,138 against a 7,403,890-byte
payload.

Verified after the edit: `name:`/`note:` strings 189 to 191, three removed and
five added, and exactly one removal is a `name:` — the Grid Atlas row this edit
deliberately renames. Every other string is byte-identical against
`HEAD:index.html`. The V8 sentinel occurs once with its four leading spaces and
its route once. Both automation markers are intact. AREAS was re-evaluated with
node: it parses, 11 top-level areas, 120 nodes, 109 with a URL, the new row
resolves to `./pipelinenews_intelligence/202609032251/`, the identity
`202609032246-gridatlas-v9.98` occurs once and no `v9.97` string remains.

`scripts/verify_published_versions.py` passes: 28 published snapshots, all
reachable, newest `202609032251`.

Folder file count after this snapshot:

27 files

## Version 026

Version: `homepage_v026.html`
Source: live `index.html` at commit `d62d51258a32cabf1411de16c73501715bad262c`
Purpose: restore point taken before the first *compiled* refresh of the Grid Atlas
current-composition row, moving it from `v9.98 / 202609032246` to
`v9.99 / 202609032315`. No Pipeline News release is published in this version:
the newest cut, `202609032251`, was already mirrored and given its row in
version 025, and no further release had been cut when this snapshot was taken.
Measured by: Claude Code working session

Metrics for `homepage_v026.html`:

Line count: 213
Word count: 4678
Character count: 38389
SHA-256 (first 16): b47f3572b62ea2d0

Plain-English change intention:

One line changes, and for the first time a program rather than a person chooses
it. The homepage named Grid Atlas v9.98 while `https://ventusltd.github.io/gridatlas/atlas/`
had been serving v9.99 since generation 202609032315 — confirmed by fetching the
public composition manifest, not by reading the repository. The row's four
identity fields — the version in `name:`, the `CURRENT VERIFIED · v… · … ·`
prefix of `note:`, `data_gridatlas_release:` and the trailing HTML comment — are
refreshed together so they cannot disagree again.

The 1,471 characters of measurement prose in `note:` are carried through byte for
byte. The compiler does not own that text and does not write it; it owns the
identity only.

What it deliberately does not do: it does not re-word the note, does not touch
the `os-strip` banner that carries the same href, does not touch the immutable
`202608291239-atlas-v9` row beneath the markers, and does not publish any
Pipeline News release.

Verified after the edit:

`name:`/`note:` strings 191 to 191, two removed and two added. Exactly one of the
removals is a `name:` — `UK Grid Atlas V9.98 — Current Verified Release`, the row
this edit deliberately renames — and the other is that row's `note:`. The
remaining 189 of 191 strings are byte-identical against `HEAD:index.html`.

Line count 213 to 213, and exactly one line differs: line 103, the governed row
inside the markers. The `os-strip` banner on line 59, which carries the same
href and is the reason the compiler was jammed, is untouched, as is the immutable
`202608291239-atlas-v9` row on line 105.

The V8 sentinel occurs once with its four leading spaces and its route once.
Both automation markers occur once each. The identity
`202609032315-gridatlas-v9.99` occurs exactly twice — the data attribute and the
trailing comment — and no `v9.98` or `202609032246` string remains.

`AREAS` was re-evaluated with node before and after: it parses, 11 top-level
areas, 120 nodes, 109 with a URL, all four unchanged by this edit. Exactly one
row resolves to `https://ventusltd.github.io/gridatlas/atlas/` and exactly one
row carries `data_gridatlas_release`, now reading
`202609032315-gridatlas-v9.99`.

That the live composition really is v9.99 was established by fetching
`https://ventusltd.github.io/gridatlas/atlas/manifests/202609032315-composition.json`
from the public site, which returns `"generation": "202609032315"` and
`"version": "v9.99"`.

`scripts/verify_published_versions.py` passes: 28 published snapshots, all
reachable, newest `202609032251`.

The edit was made by `scripts/catalogue_gridatlas_v9.py refresh-composition`,
not by hand. The same run against a scratch copy produced a byte-identical
result — SHA-256 `6fa24b75c00b6bb5` both times — so the compiler is
deterministic on this input.

Folder file count after this snapshot:

28 files

## Version 027

Version: `homepage_v027.html`
Source: live `index.html` at commit `5c700a4a`
Purpose: restore point taken before publishing Pipeline News `202609032329`, the release in
which a dash stops asserting a search that never ran.
Measured by: Claude Code working session

Metrics for `homepage_v027.html`:

Line count: 213
Word count: 4678
Character count: 38389
SHA-256 (first 16): 6fa24b75c00b6bb5

Plain-English change intention:

One row inserted and one modified. `202609032329` becomes the current Pipeline News entry
and `202609032251` moves down to the superseded indent its siblings already sit
at, losing its NEW mark and gaining the clause that names what superseded it.
Nothing is re-indented and the Grid Atlas row is untouched — it was moved to
v9.99 in the previous commit and the live composition has not changed since.

The row carries the measurement rather than a claim: 7,680 records, 3,047 with a
grid figure, 4,633 dashed, and the payload's own coverage block reading
with_circuit 3,047 / no_circuit 0 — so the sentence the dash used to carry,
which asserts a search that ran and failed, was true of none of the rows it was
printed on.

Folder file count after this snapshot:

29 files

## Version 028

Version: `homepage_v028.html`
Source: live `index.html` at commit `7d00781b6993b9038a1a8bedf2c88a4eb0109ad4`
Purpose: restore point taken before aligning the stale Grid Atlas banner with the governed v9.99 row.
Measured by: Codex working session

Metrics for `homepage_v028.html`:

Line count: 214
Word count: 4867
Character count: 39499
Byte count: 39842
SHA-256 (first 16): 103915690252df0f

Plain-English change intention:

Only the reader-facing Grid Atlas banner changes: V9.86 / 202609030200 becomes
V9.99 / 202609032315 so it agrees with the governed current-release row. The
governed row, its measurement prose, all other names and notes, every prior
homepage snapshot, the V8 sentinel and route, and both Grid Atlas automation
markers remain unchanged. `AREAS` is re-evaluated but not rewritten.

Folder file count after this snapshot:

29 files (28 numbered snapshots plus this README; the timestamped release directory is not a file)

## Version 029

Version: `homepage_v029.html`
Source: live `index.html` at commit `c9c9f61f6daf1057252e488d93a57a699a1772f0`
Purpose: restore point before restoring the complete recoverable Grid Atlas version lineage to the homepage.
Measured by: Codex working session

Metrics for `homepage_v029.html`:

Line count: 214
Word count: 4867
Character count: 39499
Byte count: 39842
SHA-256 (first 16): 5572fd68181a41cb

Plain-English change intention:

The current Grid Atlas v9.99 row remains linked, but its label now says deployed
and reachable rather than verified while its project-card hit-target regression
is open. A new complete catalogue adds 120 oldest-first, machine-marked lineage
records: legacy V1 through V8; the removed April V9 source; all eight timestamped
base-V9 release folders; every GridAtlas composition state committed on main
from v9.5 through v9.99; and explicit MISSING rows for v9.1 through v9.4, where
no GridAtlas composition exists. Reused version numbers retain every distinct
generation. Evidence-only manifests say that they are not runnable, V9.57 is
labelled as the rejected composition that broke its shell slot, and records
without an honest URL render as disabled text instead of broken links.
Nested catalogue rows wrap long immutable commit hashes rather than widening a
phone viewport.

Every network route was rechecked at `2026-09-04T00:40:53Z`. HTTP 200 proves
reachability, not working behaviour: V2 through V7 and seven base-V9 folders are
`REACHABLE_UNVERIFIED`. V8 alone is `WORKING_VERIFIED`, backed by the mobile
browser Tesco -> `[OK]` click proof rechecked at `2026-09-04T00:47:58Z`. The
202608291237 base-V9 shell is `BROKEN`
because its `repd_browser_registry` dependency returns HTTP 404 even though the
shell URL itself returns 200. Every machine marker and reader-visible note
carries its `checked_at` value.

The publication gate protects the exact V1-to-v9.98 foundation by digest,
requires continuous version identities through the governed current version,
and compares each later edit with the latest numbered snapshot. A new current
version must therefore append its exact generation and promoted commit while
retaining its predecessor. No v9.100 placeholder is added because no v9.100
commit has been promoted to GridAtlas main.

All earlier homepage snapshots and all existing URLs/rows remain preserved.
Only stale truth labels are corrected: the old 202608291239 row is archived,
reachable and unverified; v9.99 discloses its known defect; and V8 is identified
as the last browser-verified working version. The V8 sentinel and route, both
Grid Atlas automation markers, and the complete `AREAS` structure are preserved.

Folder file count after this snapshot:

30 files (29 numbered snapshots plus this README; the timestamped release directory is not a file)

## Version 030

Version: `homepage_v030.html`
Source: live `index.html` at commit `0051b3dc25f803e622c942fc82bc114617cecdd9`
Purpose: restore point before appending the promoted v9.103 Grid Atlas lineage and the three never-live candidates that preceded it.
Measured by: Codex working session

Metrics for `homepage_v030.html`:

Line count: 344
Word count: 9342
Character count: 104493
Byte count: 104835
SHA-256: 32eaeeaabbb87f9c5c9e96111176bfb25230033a86e172b3d3ce5d6bb7fb7433

Plain-English change intention:

The 120 existing Grid Atlas records remain present. Four records are appended,
bringing the catalogue to 124. v9.100 / `202609040021`, v9.101 /
`202609040046`, and v9.102 / `202609040047` are explicitly
`REJECTED_PRE_PROMOTION` and `never live`; each links to its immutable manifest,
carries the exact source commit, and names the defect that stopped promotion.
They are history and audit evidence, not runnable releases. v9.103 /
`202609040058` is the new live record, bound to exact GridAtlas main commit
`03ac1fd5b094c59e21b311a7978c954111d3e330`.

The former v9.99 current row remains in place as archived manifest evidence. Its
stable `/atlas/` URL is not retained on that archived row because the route now
serves v9.103; the immutable `202609032315` manifest is the honest surviving
target. Its known project-card hit-target defect remains visible. The GridAtlas
live pointer deliberately names v9.99 as v9.103's previous live generation,
skipping all three rejected candidates without erasing them.

Public state was rechecked at `2026-09-04T01:14:35Z`. `atlas/current.json` and
all four `202609040021`, `202609040046`, `202609040047`, and `202609040058`
manifests returned HTTP 200 and were byte-exact to GridAtlas main. GitHub Actions
runs `33824798171` (cartridge proof), `33824798137` (builders), and `33824797695`
(Pages) all completed successfully on the exact v9.103 head. A 393x852 Chrome
acceptance run opened the Markinch Pipeline deep link, rendered 28.82 km, kept
all six menus visible and hittable, drove Tesco to authoritative `[OK]`, and
drove DLR to `[OK]` from the hydrated shared UK Metro/Trams source. That is why
v9.103, alongside retained V8, is `WORKING_VERIFIED` rather than merely HTTP
reachable.

Derived catalogue counts after the edit:

- Lifecycle: 8 `LIVE`, 109 `ARCHIVED`, 3 `REJECTED_PRE_PROMOTION`, 4 `MISSING`.
- Evidence: 2 `BROKEN`, 101 `MANIFEST_EVIDENCE`, 4 `NONE`, 13
  `REACHABLE_UNVERIFIED`, 2 `SOURCE_ONLY`, 2 `WORKING_VERIFIED`.

The publication gate now validates the three rejected manifests' identities and
their own `candidate_status`, binds the current homepage row to the exact
GridAtlas main SHA, follows `previous_generation` to v9.99 instead of confusing
numeric v9.102 with a live predecessor, and protects all prior rows against
loss. Every previous homepage snapshot and the local V8 route remain untouched.

Folder file count after this snapshot:

31 files (30 numbered snapshots plus this README; the timestamped release directory is not a file)

## Version 031

Version: `homepage_v031.html`
Source: live `index.html` at commit `7b91a994a6899dbe6ef455126ab99664e12f6793`
Purpose: restore point before publishing the exact Pipeline News `202609040144` wrapper and appending the exact promoted and browser-proven v9.104 Grid Atlas release.
Measured by: Codex working session

Metrics for `homepage_v031.html`:

Line count: 348
Word count: 9377
Character count: 106631
Byte count: 106959
SHA-256: e8ae34f5c3391bbb4f7f37d6cea0c6461221cb210d4781e1a87abf66936372e7

Plain-English change intention:

All 124 Grid Atlas catalogue records already on the homepage remain
byte-for-byte unchanged. Exactly one Grid record is appended: v9.104 /
`202609040134`, bound to GridAtlas main commit
`ab80d45be05eb08b334af8bc93cfeb30d3b9d3d9`. The two Grid current-release
surfaces move to v9.104, while V8, v9.103, the three explicitly never-live
candidates, and every earlier recoverable generation remain visible. The Grid
catalogue therefore contains 125 records.

The same consistency-atomic edit publishes Pipeline News wrapper
`202609040144-pipelinenews` as `pipelinenews_intelligence/202609040144/`. All
64 files are byte-identical to Pipeline main. One new current row is inserted;
`202609032329` is retained immediately below it and labelled superseded. Every
older Pipeline route remains in place.

The public state was checked at `2026-09-04T01:44:37Z`. The public
`atlas/current.json` and immutable `202609040134` manifest returned HTTP 200 and
were byte-exact to commit `ab80d45`. Exact-head GitHub Actions runs
`33826742980` (Pages), `33826743587` (builders), and `33826743594` (cartridge
proof) all completed successfully.

A fresh Chrome extension session then ran the live Markinch Pipeline arrival at
an explicit 393x852 viewport. The card rendered the 28.82 km result. File, Edit,
View, Scope, Grid, and About were all visible and hittable inside fullscreen.
From the Grid menu, Tesco moved from `[WAIT]` to `[OK]`, with the authoritative
control and both mirrors checked. DLR did the same through the hydrated shared
UK Metro/Trams source. The temporary browser viewport was reset and the audit
tab closed after collecting the evidence. This is direct working behaviour, not
an HTTP-only inference, so v9.104 is `WORKING_VERIFIED`.

Pipeline exact-head run `33827954787` completed successfully on main
`3493be1c4ebf3dabbc94135db17f433bb7892a8e`. Its build, deploy, public
byte/pointer readback, public Atlas-link browser proof and public modular
browser proof all passed. At `2026-09-04T02:07:53Z`, the public wrapper's
`index.html`, `release-manifest.json` and `sha256sums.txt` returned HTTP 200 and
were byte-identical to the exact source; their SHA-256 values are respectively
`1e9079e1ebea216b3ed196bec61325f19ea4aeb8963658d938bcb5def0969d97`,
`ca59bba6041dc7c0c33841fc3263c01bad355daeb0273691fdc97f1d0eed9cee`
and `c6435a877b28a1bd17b217e5d991cbc866c7ea9498905b244cbaba0bd6d467ae`.

The run's throttled 393x852 public proof found one 44x44 MAP action for
Markinch with no horizontal overflow, followed the exact REPD 155 link into
Grid Atlas v9.104, produced the first coordinate answer in 484.6 ms, drew five
links to substations at 33 kV or above, reported the nearest at 2.49 km and the
nearest 400 kV substation at 28.82 km. It used no synthetic receiver and
intercepted no route.

The byte-exact imported wrapper retains five upstream whitespace diagnostics:
one blank EOF line in each of its two wider-fleet modules and three trailing
space lines in its `index.html`. Those bytes are covered by the wrapper's own
SHA-256 ledger and cannot be rewritten here without breaking the mirror. The
candidate-owned paths pass `git diff --check` with that immutable subtree
excluded; the subtree separately passes an exact directory comparison and all
63 file hashes declared by its `sha256sums.txt`. Source and mirror each contain
64 files totalling 22,666,028 bytes; their canonical path/size/SHA-256 inventory
digest is `f7357a212753abb7266273d69f18a25474a7b98409fedb062335c374a7dbf789`.

Derived catalogue counts after the append:

- Lifecycle: 9 `LIVE`, 109 `ARCHIVED`, 3 `REJECTED_PRE_PROMOTION`, 4 `MISSING`.
- Evidence: 2 `BROKEN`, 101 `MANIFEST_EVIDENCE`, 4 `NONE`, 13
  `REACHABLE_UNVERIFIED`, 2 `SOURCE_ONLY`, 3 `WORKING_VERIFIED`.

The protected catalogue digest now covers all 124 pre-existing records through
v9.103, and a unit test compares those records directly with the v031 snapshot
before accepting the v9.104 append. The network gate remains fail-closed and now
uses the read-only GitHub workflow token for GitHub API and raw-content requests,
avoiding false `INCOMPLETE` results when the shared anonymous API limit is
exhausted; the token is never sent to GitHub Pages or any other host.

Folder file count after this snapshot:

32 files (31 numbered snapshots plus this README; the timestamped release directory is not a file)

## Version 032

Version: `homepage_v032.html`
Source: live `index.html` at commit `d377a47a180da44d0a42bfc27e228e7a6b3b8e73`
Purpose: restore point before appending the exact promoted v9.105 Grid Atlas release.
Measured by: Codex working session

Metrics for `homepage_v032.html`:

Line count: 350
Word count: 9601
Character count: 108461
Byte count: 108798
SHA-256: d9d0333f026a7e019797ca31106ddd2fb66b7378a75d4fcc6b50859ec2b4e61b

Plain-English change intention:

All 125 Grid Atlas catalogue records already on the homepage remain
byte-for-byte unchanged. Exactly one Grid record is appended: v9.105 /
`202609040219`, bound to GridAtlas main commit
`5cb95611bae0eae031d493b7f2b6b3ef9ce2b995`. The two Grid current-release
surfaces move to v9.105, while V8, the browser-verified v9.103 and v9.104,
the three explicitly never-live candidates, and every earlier recoverable
generation remain visible. The Grid catalogue therefore contains 126 records.

At `2026-09-04T02:32:54Z`, exact-head GitHub Actions runs `33829736615`
(Pages), `33829737083` (builders), and `33829737107` (cartridge proof) had all
completed successfully. The public `atlas/current.json` returned 46,405 exact
bytes with SHA-256
`2f86a1bfd1c07c0bcb05a3bf57a102cd64f83d933db9118c51c3ee5e7790e384`.
The immutable `202609040219` composition returned 47,301 exact bytes with
SHA-256
`90dbbb6b4bd5db2f23a097e6a0042df0aa77dd189410e8a2be33568fd0404bdb`.
Both composed cartridges, both parts manifests, the version ledger and both
live-set pointer forms were also fetched from the public Pages deployment and
matched the exact commit bytes.

A fresh Chrome extension session at a 393x852-class mobile viewport then
confirmed generation `202609040219`, opened Markinch REPD 155, rendered 28.82
km and retained all six menus. Clicking the live Tram proxy left DLR and every
UK Metro/Trams control unchecked and disabled at `[EMPTY]`, with zero console
errors. That is the intended honest state for fetched bytes which cannot
produce renderable features, rather than a false tick or an invisible layer.
This direct mobile acceptance is why v9.105 is `WORKING_VERIFIED`; the claim is
not inferred from HTTP reachability.

Derived catalogue counts after the append:

- Lifecycle: 10 `LIVE`, 109 `ARCHIVED`, 3 `REJECTED_PRE_PROMOTION`, 4 `MISSING`.
- Evidence: 2 `BROKEN`, 101 `MANIFEST_EVIDENCE`, 4 `NONE`, 13
  `REACHABLE_UNVERIFIED`, 2 `SOURCE_ONLY`, 4 `WORKING_VERIFIED`.

The latest-snapshot retention gate now rejects any rewrite of a retained
record, including one historically marked live. A unit test compares all 125
pre-existing serialised rows directly with this v032 snapshot before accepting
the one appended v9.105 row.

Folder file count after this snapshot:

33 files (32 numbered snapshots plus this README; the timestamped release directory is not a file)

## Version 033

Version: `homepage_v033.html`
Source: live `index.html` at commit `9e42af8a1ade776eeafa2be34f0c2bf5345d5c2d`
Purpose: restore point before retiring two stale mutable-current Grid Atlas links.
Measured by: Codex working session

Metrics for `homepage_v033.html`:

Line count: 351
Word count: 9681
Character count: 109329
Byte count: 109666
SHA-256: f77862a52d09c9935d1d632fea9f33336634bd229968df914a7b97d724f46878

Plain-English change intention:

v9.105 remains the one current v9.x catalogue row and continues to use the
canonical mutable application route. Its exact commit, proof text and current
homepage surfaces do not change. v9.103 and v9.104 were each still labelled
`Live Current` on that same route, so clicking either older row now opened
v9.105. Both rows receive the one lifecycle transition this catalogue permits:
`LIVE` becomes `ARCHIVED`, `Live Current` becomes `Archived`, and the mutable
route becomes that generation's immutable composition-manifest URL.

Their version, generation, source commit, `WORKING_VERIFIED` evidence class,
checked-at time and complete browser-proof text remain unchanged. The v9.103
change is the delayed correction of the transition missed when v9.104 was
appended. All other 124 catalogue rows remain byte-for-byte unchanged,
including every standalone V1-V8 route and status.

The retention verifier accepts only that exact transformation of a stale v9.x
current row. It rejects changes to the row's identity or evidence, rejects any
other retained-row edit, and fails if any prior v9.x row still says `Live
Current`, remains `LIVE`, or points at the mutable application route. Tests
exercise both the allowed transition and mutations of its preserved proof.

Derived catalogue counts after the repair:

- Lifecycle: 8 `LIVE`, 111 `ARCHIVED`, 3 `REJECTED_PRE_PROMOTION`, 4 `MISSING`.
- Evidence: 2 `BROKEN`, 101 `MANIFEST_EVIDENCE`, 4 `NONE`, 13
  `REACHABLE_UNVERIFIED`, 2 `SOURCE_ONLY`, 4 `WORKING_VERIFIED`.

Folder file count after this snapshot:

34 files (33 numbered snapshots plus this README; the timestamped release directory is not a file)

## Version 034

Version: `homepage_v034.html`
Source: live `index.html` at commit `6e462c5ca0ff50e8e8d926eec45c9c26a4169922`
Purpose: restore point before archiving v9.105 on its immutable manifest and appending the exact promoted and browser-proven v9.106 Grid Atlas release.
Measured by: Codex working session

Metrics for `homepage_v034.html`:

Line count: 351
Word count: 9709
Character count: 109645
Byte count: 109982
SHA-256: 6817281e2a6d8a12bc119064ebff3af0b4841fe085bf5274e3c501ab4d60a6e9

Plain-English change intention:

All 126 existing Grid Atlas identities remain in the catalogue. The 125 rows
other than the former current v9.105 row remain byte-for-byte unchanged. v9.105
receives only the lifecycle transition permitted by this catalogue: its
version, generation, source commit, `WORKING_VERIFIED` evidence, checked-at
time and complete browser proof are preserved, while `LIVE` becomes
`ARCHIVED` and the mutable application URL becomes its immutable
`202609040219` composition manifest. V8 remains present and unchanged.

Exactly one record is appended at the oldest-first tail: v9.106 / generation
`202609040337`, bound to exact GridAtlas main commit
`2d8cc7bacf80a3f20ecfb96ea24548fcea43a19d`. It is the sole current v9.x row
on the mutable application route, bringing the catalogue to 127 records. Both
reader-facing current-release surfaces name that same identity.

All three exact-head GitHub Actions completed successfully: `33834422562`
(Pages), `33834422882` (next-version builders), and `33834422915` (cartridge,
mobile and corpus proof). A cache-busted public audit fetched 34 composition-
derived artifacts and found all 34 HTTP 200 and byte-identical to the exact
commit. Their combined path-and-hash digest is
`fc0ce52d698936adcbf3c8d136ea0868fb0f280f7cf7dba1992478095eeeaf25`.
The public `current.json` is 46,599 bytes with SHA-256
`7e8fc8c7e2aca9fa1974169085111844e26750be1fb793f54abbf253489cf80a`;
the immutable composition is 47,855 bytes with SHA-256
`4fab4d333f78878482925eea7191f675cac280d556f1703a1f9cf7c93c5d375f`.

The accepted browser receipt used cold 393x852 Chromium and passed five
arrival cases. Supplied-point `NOT_IN_ACTIVE_REGISTER` reference 12453 measured
with link-supplied provenance. Ref-only 12453 explicitly could not measure and
invented no official location or status. An induced
`FAILED` -> retry -> `RESOLVED` reference 12588 reached five links, with the
nearest at 3.432 km, manifest attempts 2, query 0 -> 1, retry 0 -> 1 and shared
epoch 3. An induced `FAILED` -> retry -> `NOT_IN` reference 12453 ended with
zero links and explicit no-coordinate/no-inference. An ordinary active match
for reference 12588 was `VERIFIED` and measured. Every case showed File, Edit,
View, Scope, Grid and About; there were zero post-terminal page, console or
material errors and zero obsolete Pipeline requests.

The exact Pipeline 0144 corpus static gate includes Markinch 155 and proves
that it takes measure-first from supplied coordinates. That is recorded as
static evidence only, not as a fresh v9.106 Markinch browser reading. The
separate v9.105 Markinch 28.82 km browser observation remains intact on the
archived v9.105 record.

Derived catalogue counts after the append:

- Lifecycle: 8 `LIVE`, 112 `ARCHIVED`, 3 `REJECTED_PRE_PROMOTION`, 4 `MISSING`.
- Evidence: 2 `BROKEN`, 101 `MANIFEST_EVIDENCE`, 4 `NONE`, 13
  `REACHABLE_UNVERIFIED`, 2 `SOURCE_ONLY`, 5 `WORKING_VERIFIED`.

The latest-snapshot retention gate compares against this v034 restore point.
It accepts the one deterministic v9.105 archival and the final v9.106 append,
and rejects deletion, reordering or any other retained-row rewrite.

Folder file count after this snapshot:

35 files (34 numbered snapshots plus this README; the timestamped release directory is not a file)
