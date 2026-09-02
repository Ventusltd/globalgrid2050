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
