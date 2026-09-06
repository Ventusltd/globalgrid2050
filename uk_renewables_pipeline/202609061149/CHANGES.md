# 202609061149

Parent: `202609061004`. Cut because the parent took 8.8 seconds to become
usable and announced the wrong version in its own title.

## Load time

Measured on the live parent, Chrome, `globalgrid2050.com`:

| what | measurement |
|---|---|
| navigation `loadEvent` | 1,799 ms |
| first partition fetch starts | 2,064 ms |
| last partition fetch ends | **8,830 ms** |
| partitions | 16, all issued together |
| transferred | 1,152 KB (gzip; ~10 MB decoded) |
| rows built into the DOM | 7,680 |

Two causes, measured rather than guessed.

**1. The immutable release was being re-downloaded every time.** Every fetch
carried `cache: "no-store"`, including the sixteen partition files. Those live
inside a timestamped release directory and cannot change. Same file, same
session, on the live parent:

    cache: "no-store"    454 ms, 533 ms      every time
    cache: "default"       4 ms,   3 ms      after the first

Sixteen of those is the whole 6.8-second tail on a revisit or a deep link.

**2. Seven thousand six hundred and eighty table rows.** The parent painted the
first 100 and streamed the rest in chunks of 300, which stopped the freeze but
still built every row.

## What changed

- Partition fetches use the HTTP cache. The bytes are identical; the sha256 and
  record-count invariants still run on every load, from cache or network.
- The table shows **20 rows, largest capacity first**, with a pager.
- The tabs and the search box do the narrowing; the pager moves a window.
- Pager controls are 44 px, the smallest reliable touch target.
- The release states its own identity. The parent was cut by copying
  `202609051156` and never renamed, so it announced that stamp in its title and
  its banner - which is exactly why it was impossible to tell which build was
  live.

## What did not change

No REPD record is dropped, filtered, summarised or truncated.

- `all` holds every qualifying record, as before.
- `filtered` holds every record matching the current tabs and search.
- The CSV still exports the full filtered set.
- The count line still states both numbers: **7,680 of 7,680**.

Only the VIEW is windowed. The pipeline is not.

## Defects fixed in this release's own gate

The parent's runner was copied without repointing, so it:

- diffed `uk_renewables_pipeline/v9.7/data/v9.7` - another release's data;
- ran its browser smoke against `/uk_renewables_pipeline/v9.7/` - so every
  timestamped release was browser-testing v9.7 rather than itself.

Both now derive from the release's own directory name, and the gate asserts the
banner and the title carry that same stamp.
