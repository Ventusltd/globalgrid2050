#!/usr/bin/env python3
"""Pin the fail-closed contracts of the Grid Atlas catalogue compiler.

Dependency-free on purpose, like `measure_homepage_version.py`, so it runs in
GitHub Actions and locally with no setup:

    python scripts/test_catalogue_gridatlas_v9.py

The fixture below reproduces the exact condition that jammed `compile_root()`
from 30 August: the composition href
`https://ventusltd.github.io/gridatlas/atlas/` occurs THREE times in one file —
the public `os-strip` banner, the governed catalogue row, and the immutable
`.../atlas/releases/202608291239-atlas-v9/` row which contains it as a *prefix*.
Every account of the jam in this estate said "twice"; a substring count says
three. That is why the row is identified by the GRIDATLAS_V9_AUTOMATION markers
and not by its href, and this file exists so that reasoning cannot be quietly
undone later.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("catalogue_gridatlas_v9.py")
_spec = importlib.util.spec_from_file_location("catalogue_gridatlas_v9", MODULE_PATH)
cg = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(cg)


ROW = (
    '    { name:"UK Grid Atlas V9.98 — Current Verified Release", '
    'url:"https://ventusltd.github.io/gridatlas/atlas/", '
    'note:"CURRENT VERIFIED · v9.98 · 202609032246 · the map opens as the first impression, '
    'and the transformer count is a count of machines", '
    'data_gridatlas_release:"202609032246-gridatlas-v9.98" }, '
    '/* data-gridatlas-release="202609032246-gridatlas-v9.98" */'
)

FIXTURE = "\n".join([
    "<html><head>",
    "</head><body>",
    '      <div class="os-strip"><a href="https://ventusltd.github.io/gridatlas/atlas/">'
    'UK Grid Atlas V9.86 — Current Verified Release</a>'
    '<span class="live-status">202609030200 · verified live</span></div>',
    "<script>",
    "const AREAS = [",
    '  { name:"Grid", children:[',
    cg.V8_ENTRY,
    "    /* <!-- GRIDATLAS_V9_AUTOMATION_START --> */",
    ROW,
    "    /* <!-- GRIDATLAS_V9_AUTOMATION_END --> */",
    '{ name:"UK Grid Atlas V9 — 202608291239", '
    'url:"https://ventusltd.github.io/gridatlas/atlas/releases/202608291239-atlas-v9/", '
    'note:"LIVE VERIFIED · immutable timestamped release" },',
    "  ]},",
    "];",
    "</script></body></html>",
])

ROW_INDEX = FIXTURE.split("\n").index(ROW)
EDITORIAL = "the map opens as the first impression, and the transformer count is a count of machines"


def composition(generation: str, version: str) -> dict[str, str]:
    return {
        "generation": generation,
        "version": version,
        "release_id": f"{generation}-gridatlas-{version}",
        "live_url": cg.COMPOSITION_LIVE_URL,
    }


LIVE = composition("202609032315", "v9.99")


def note_of(html: str) -> str:
    match = cg.COMPOSITION_ROW_RE.match(html.split("\n")[ROW_INDEX])
    assert match is not None, "fixture row no longer matches the governed row shape"
    return match.group("editorial")


class Results:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, label: str, ok: bool, detail: str = "") -> None:
        if not ok:
            self.failures.append(label)
        print("%-4s | %s%s" % ("PASS" if ok else "FAIL", label, ("  -> " + detail) if detail else ""))

    def refuses(self, label: str, html: str, expect_refusal: bool = True,
                comp: dict[str, str] | None = None, **kwargs: object) -> None:
        try:
            cg.refresh_composition_row(html, comp or LIVE, **kwargs)  # type: ignore[arg-type]
            outcome, refused = "ACCEPTED", False
        except cg.ContractError as error:
            outcome, refused = "REFUSED: %s" % error, True
        self.check(label, refused == expect_refusal, outcome[:88])


def main() -> int:
    r = Results()
    lines = FIXTURE.split("\n")

    print("=== the jam itself ===")
    r.check(
        "composition href occurs three times, not twice",
        FIXTURE.count(cg.COMPOSITION_LIVE_URL) == 3,
        "count=%d" % FIXTURE.count(cg.COMPOSITION_LIVE_URL),
    )
    r.check("markers still isolate exactly one row", cg.marked_row_index(lines) == ROW_INDEX)
    r.refuses("a file carrying the duplicate href is ACCEPTED", FIXTURE, expect_refusal=False)

    print()
    print("=== the sentinel contract ===")
    r.refuses("V8 sentinel loses its four leading spaces",
              FIXTURE.replace(cg.V8_ENTRY, cg.V8_ENTRY.lstrip()))
    r.refuses("V8 route occurs twice",
              FIXTURE.replace("</body>", '<a href="./repd_grid_atlasv8/"></a></body>'))
    r.refuses("START marker missing", FIXTURE.replace("GRIDATLAS_V9_AUTOMATION_START", "X", 1))
    r.refuses("END marker duplicated",
              FIXTURE.replace("</body>", "<!-- GRIDATLAS_V9_AUTOMATION_END --></body>"))

    two_rows = lines[:]
    two_rows.insert(ROW_INDEX + 1, ROW)
    r.refuses("two rows inside the marked region", "\n".join(two_rows))

    drifted = lines[:]
    drifted[ROW_INDEX] = ROW.replace(
        'data_gridatlas_release:"202609032246-gridatlas-v9.98"',
        'data_gridatlas_release:"202609032222-gridatlas-v9.97"',
    )
    r.refuses("row identity fields disagree with each other", "\n".join(drifted))

    wrong_url = lines[:]
    wrong_url[ROW_INDEX] = ROW.replace(
        'url:"https://ventusltd.github.io/gridatlas/atlas/"', 'url:"https://example.invalid/"')
    r.refuses("row url is not the governed composition URL", "\n".join(wrong_url))

    entry_line, _ = cg.atlas_entry({
        "generation": "202608291430",
        "live_url": "https://ventusltd.github.io/gridatlas/202608291430-atlas-v9/",
    })
    try:
        cg.compile_root(FIXTURE, entry_line, "https://ventusltd.github.io/gridatlas/202608291430-atlas-v9/")
        r.check("compile_root refuses to flatten a composition row", False, "it overwrote the row")
    except cg.ContractError as error:
        r.check("compile_root refuses to flatten a composition row", "composition model" in str(error))

    print()
    print("=== the refresh ===")
    refreshed, changed, report = cg.refresh_composition_row(FIXTURE, LIVE)
    after = refreshed.split("\n")
    differing = [i for i, (a, b) in enumerate(zip(lines, after)) if a != b]
    r.check("exactly one line changes", changed and differing == [ROW_INDEX], "changed lines=%s" % differing)
    # The outgoing version legitimately survives inside the lag clause, so the
    # assertion is that the four IDENTITY fields moved - not that the string is
    # gone from the file.
    r.check("all four identity fields move together",
            refreshed.count("202609032315-gridatlas-v9.99") == 2
            and "V9.99 — Current" in refreshed
            and "· v9.99 · 202609032315 ·" in refreshed
            and "202609032246" not in refreshed
            and "v9.98" not in refreshed.replace("notes written for v9.98 · ", ""))
    r.check("os-strip banner untouched", after[2] == lines[2])
    r.check("immutable release row untouched", after[ROW_INDEX + 2] == lines[ROW_INDEX + 2])
    r.check("idempotent second run reports no change",
            cg.refresh_composition_row(refreshed, LIVE)[1] is False)

    print()
    print("=== the editorial lag, bounded at one generation ===")
    r.check("identity moving alone flags the prose",
            note_of(refreshed) == "notes written for v9.98 · " + EDITORIAL,
            "lag=%s" % report["editorial_lag"])
    # A *newer* composition arriving while the prose still lags is the case that
    # must stop: it is the second generation of drift, and nobody came back.
    NEXT = composition("202609040100", "v10.00")
    r.refuses("a second unattended refresh while the flag stands", refreshed, comp=NEXT)
    r.refuses("...but --notes-current still lets a human through", refreshed,
              expect_refusal=False, comp=NEXT, notes_current=True)

    cleared, _, cleared_report = cg.refresh_composition_row(refreshed, LIVE, notes_current=True)
    r.check("--notes-current clears the flag and restores the prose",
            note_of(cleared) == EDITORIAL and cleared_report["editorial_lag"] is None)
    r.check("a run that moves nothing adds no flag",
            not note_of(cg.refresh_composition_row(cleared, LIVE)[0]).startswith("notes written for"))

    print()
    print("RESULT: %d failure(s)" % len(r.failures))
    for failure in r.failures:
        print("   FAILED: %s" % failure)
    return 1 if r.failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
