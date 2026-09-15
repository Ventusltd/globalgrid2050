#!/usr/bin/env python3
"""Recompute every pinned V9 subtree hash from the working tree.

WHY THIS EXISTS
The V9 gates prove byte-exactness by pinning a parent's git subtree hash:

    test "$(git -C "$ROOT" rev-parse 'HEAD:uk_renewables_pipeline/v9.5')" = "763c5b40..."
    assert.equal(gitTree("HEAD:uk_renewables_pipeline/v9.6.1"), "243d1217...")
    "frozen_parent": { "path": "uk_renewables_pipeline/v9.6.2", "subtree": "d978c215..." }

That is a good gate and it is not being weakened here. Its cost is that the
pinned hash covers the version's tests as well as its runtime, so repairing a
test - even a test that has been red for a week - changes the hash the NEXT
version pins, which changes that version's hash, and so on up the chain. The
hashes live in three shapes across shell, JavaScript and JSON, so the edit was
being done by hand and getting done wrong.

There is a fourth shape, found the first time this ran: a bare literal that a
test compares against a contract field, or a manifest field under another name
(`assert.equal(contract.frozen_parent.subtree, "d9a50884...")`,
`"frozen_v9_3_1_subtree": "d9a50884..."`). Those carry no path, so they are
rewritten by value: every 40-hex literal in scope that equals what a v9 subtree
hashed to at --base (default HEAD), or at any earlier pass of this run, becomes
that subtree's current hash. Blob and commit hashes never collide with a tree
hash, so nothing else is touched.

This rewrites all four shapes from git, iterating until nothing moves, so a
repair to any V9 test is a two-step operation instead of a hash rodeo:

    git add -A && git commit -m '...'
    python3 scripts/repin_v9_gates.py --base HEAD~1 && git commit -am 'chore: repin the V9 gate chain'

(--base is the last commit whose pins were all consistent; HEAD when the repair
is still uncommitted in the working tree.)

SCOPE - deliberately narrow
Only uk_renewables_pipeline/v9* is rewritten. The timestamped releases
(uk_renewables_pipeline/<12-digit stamp>/) carry their own frozen copies of
these runners; they are published artefacts whose git tree hash is the barcode
printed in catalogue/homepage-catalogue.json, and rewriting them would silently
rebarcode a published version. If one of those ever needs repinning it is a
republication, not a chore.

NOT TOUCHED: frozen_parent.tree_listing_sha256. Nothing in this repository
derives it and nothing compares it to anything computed - check_v9_4.mjs asserts
the contract's literal equals another literal in the test. It is a decorative
hash. Leave it alone until someone documents what it hashes, or delete it.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPE = re.compile(r"^uk_renewables_pipeline/v9[^/]*/")
MAX_PASSES = 12

SHELL_PIN = re.compile(
    r"""(rev-parse\s+'HEAD:(uk_renewables_pipeline/v9[^']*)'\)"\s*=\s*")([0-9a-f]{40})(")"""
)
JS_PIN = re.compile(
    r"""(gitTree\("HEAD:(uk_renewables_pipeline/v9[^"]*)"\),\s*\n\s*")([0-9a-f]{40})(")"""
)


def git(*args: str, index: str | None = None) -> str:
    env = dict(os.environ)
    if index:
        env["GIT_INDEX_FILE"] = index
    out = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, env=env)
    if out.returncode:
        raise SystemExit(f"git {' '.join(args)} failed: {out.stderr.strip()}")
    return out.stdout.strip()


def working_tree_hashes() -> dict[str, str]:
    """Subtree hash of every uk_renewables_pipeline/v9* directory AS IT IS NOW.

    Read from a throwaway index so the caller's staged state is untouched: the
    point is to pin what is about to be committed, not what was committed last."""
    with tempfile.TemporaryDirectory() as tmp:
        index = str(Path(tmp) / "repin.index")
        git("read-tree", "HEAD", index=index)
        git("add", "-A", "--", "uk_renewables_pipeline", index=index)
        tree = git("write-tree", index=index)
        found = {}
        for line in git("ls-tree", tree, "uk_renewables_pipeline/").splitlines():
            meta, name = line.split("\t", 1)
            mode, kind, sha = meta.split()
            if kind == "tree" and name.rsplit("/", 1)[-1].startswith("v9"):
                found[name.rstrip("/")] = sha
        return found


def tree_hashes_at(rev: str) -> dict[str, str]:
    """Subtree hash of every uk_renewables_pipeline/v9* directory at a committed revision."""
    found = {}
    for line in git("ls-tree", rev, "uk_renewables_pipeline/").splitlines():
        meta, name = line.split("\t", 1)
        mode, kind, sha = meta.split()
        if kind == "tree" and name.rsplit("/", 1)[-1].startswith("v9"):
            found[name.rstrip("/")] = sha
    return found


def rewrite_literals(text: str, literal_map: dict[str, str]) -> tuple[str, int]:
    changes = 0
    for old, new in literal_map.items():
        n = text.count(old)
        if n:
            text = text.replace(old, new)
            changes += n
    return text, changes


def rewrite(text: str, hashes: dict[str, str]) -> tuple[str, int]:
    changes = 0

    def sub(match: re.Match) -> str:
        nonlocal changes
        head, path, old, tail = match.group(1), match.group(2), match.group(3), match.group(4)
        new = hashes.get(path.rstrip("/"))
        if new is None or new == old:
            return match.group(0)
        changes += 1
        return f"{head}{new}{tail}"

    text = SHELL_PIN.sub(sub, text)
    text = JS_PIN.sub(sub, text)
    return text, changes


def rewrite_contract(path: Path, hashes: dict[str, str]) -> int:
    # Rewrite each moved "subtree" value in place, as text, so the contract keeps
    # its own formatting: a re-dump would restyle every list in the file.
    raw = path.read_text(encoding="utf-8")
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError:
        return 0
    changes = 0
    for key, block in doc.items():
        if not isinstance(block, dict):
            continue
        target, subtree = block.get("path"), block.get("subtree")
        if not isinstance(target, str) or not isinstance(subtree, str):
            continue
        new = hashes.get(target.rstrip("/"))
        if new and new != subtree:
            pattern = re.compile(r'("subtree"\s*:\s*")' + re.escape(subtree) + '"')
            raw, n = pattern.subn(lambda m: m.group(1) + new + '"', raw, count=1)
            changes += n
    if changes:
        with path.open("w", encoding="utf-8", newline="") as fh:
            fh.write(raw)
    return changes


def main() -> int:
    argv = sys.argv[1:]
    base = argv[argv.index("--base") + 1] if "--base" in argv else "HEAD"
    files = [
        ROOT / p for p in git("ls-files", "uk_renewables_pipeline").splitlines()
        if SCOPE.match(p) and p.endswith((".sh", ".mjs", ".js", ".json"))
    ]
    former: dict[str, set[str]] = {p: {h} for p, h in tree_hashes_at(base).items()}
    total = 0
    for attempt in range(1, MAX_PASSES + 1):
        hashes = working_tree_hashes()
        literal_map = {
            old: hashes[path]
            for path, olds in former.items() if path in hashes
            for old in olds if old != hashes[path]
        }
        moved = 0
        for path in files:
            if not path.is_file():
                continue
            with path.open(encoding="utf-8", newline="") as fh:
                before = fh.read()
            after, n = rewrite(before, hashes)
            if path.suffix != ".json":
                after, m = rewrite_literals(after, literal_map)
                n += m
            if after != before:
                with path.open("w", encoding="utf-8", newline="") as fh:
                    fh.write(after)
                moved += n
            if path.suffix == ".json":
                moved += rewrite_contract(path, hashes)
                with path.open(encoding="utf-8", newline="") as fh:
                    before = fh.read()
                after, m = rewrite_literals(before, literal_map)
                if m:
                    with path.open("w", encoding="utf-8", newline="") as fh:
                        fh.write(after)
                    moved += m
        for path, sha in hashes.items():
            former.setdefault(path, set()).add(sha)
        print(f"pass {attempt}: {moved} pin(s) rewritten")
        total += moved
        if not moved:
            break
    else:
        print(f"still moving after {MAX_PASSES} passes - the pin graph has a cycle", file=sys.stderr)
        return 1
    print(f"{total} pin(s) rewritten in total; nothing else was touched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
