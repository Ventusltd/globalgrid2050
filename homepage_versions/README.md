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
