#!/usr/bin/env python3
"""Replace informal or science-fiction wording on the public homepage with plain business language.

What it touches: the reader-visible text of index.html only, meaning the words inside <summary>, the link
labels and the <small> descriptions in the menu's template strings. What it never touches: hrefs, ids, class
names (for example `details.nest`, which is CSS), query strings (`?graph=vedic`), or any identifier in the
script. A term inside a URL is an address, not language, and changing it would break the link.

Default is a dry run: it prints every visible occurrence with its proposed replacement and changes nothing.
`--apply` rewrites index.html in place. The homepage rules still apply before applying: take the numbered
snapshot in homepage_versions/ first, then commit, push and compare served bytes.

    python scripts/plain_language.py            # report only
    python scripts/plain_language.py --apply    # rewrite index.html

The dictionary is deliberately small and exact-phrase first, so a word that is also a product name (the
Spider dashboard's own title "Spider Sandbox" is Vikram's design and is listed here as a decision, not
replaced by default) is never rewritten by accident.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / "index.html"

# exact phrases first (longest match wins), then single words; matching is case-insensitive and the
# replacement keeps the original's initial capital
PHRASES = [
    ("Spider universe", "Code relationship map"),
    ("universe journey experiment", "code navigation experiment"),
    ("Spider universe, ten versions", "Code relationship map, ten versions"),
    ("particle universe", "block and function map"),
    ("ring journey", "ring navigation"),
    ("line river", "line view"),
]
WORDS = [
    ("universe", "code map"),
    ("galaxy", "map"),
    ("constellation", "group"),
    ("swarm", "set of agents"),
    ("particles", "items"),
    ("particle", "item"),
    ("cosmic", "estate-wide"),
]
# Product names left alone by default; each is a decision for the owner, listed in the report.
DECISIONS = ["Spider Sandbox", "Spider", "Periodic Table", "Grid Engine", "Grid Atlas"]

VISIBLE = re.compile(r"(<summary>)(.*?)(</summary>)|(>)([^<>]*?)(<small>)|(<small>)(.*?)(</small>)|(\">)([^<>]+?)(</a>)", re.S)


def keep_case(src: str, rep: str) -> str:
    return rep[0].upper() + rep[1:] if src[:1].isupper() else rep


def rewrite_text(text: str, log: list[str]) -> str:
    out = text
    for a, b in PHRASES + WORDS:
        pat = re.compile(r"\b" + re.escape(a) + r"\b", re.I)
        def sub(m, b=b):
            r = keep_case(m.group(0), b)
            log.append(f"  {m.group(0)!r} -> {r!r}")
            return r
        out = pat.sub(sub, out)
    return out


def main() -> int:
    apply = "--apply" in sys.argv
    src = INDEX.read_text(encoding="utf-8")
    log: list[str] = []

    def visible(m: re.Match) -> str:
        g = m.groups()
        # the match is one of four shapes; the text is the middle group of whichever matched
        for i in (0, 3, 6, 9):
            if g[i] is not None:
                return g[i] + rewrite_text(g[i + 1], log) + g[i + 2]
        return m.group(0)

    out = VISIBLE.sub(visible, src)
    print(f"{len(log)} visible replacement(s) proposed in {INDEX.name}:")
    for line in log:
        print(line)
    for name in DECISIONS:
        n = len(re.findall(r"\b" + re.escape(name) + r"\b", src))
        if n:
            print(f"  decision for the owner: {name!r} appears {n} time(s) as a product name; left unchanged")
    urls = len(re.findall(r"href=\"[^\"]*(universe|vedic|chemistry|stars)[^\"]*\"", src))
    print(f"  {urls} link address(es) contain such words and are left exactly as they are")
    if not apply:
        print("dry run: nothing written (use --apply)")
        return 0
    if out == src:
        print("nothing to change")
        return 0
    INDEX.write_text(out, encoding="utf-8")
    print("index.html rewritten; take the homepage_versions snapshot before committing")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
