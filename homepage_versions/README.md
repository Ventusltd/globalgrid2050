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
