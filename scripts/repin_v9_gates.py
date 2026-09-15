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

This rewrites all three shapes from git, iterating until nothing moves, so a
repair to any V9 test is a two-step operation instead of a hash rodeo:

    git add -A && git commit -m '...'
    python3 scripts/repin_v9_gates.py && git commit -am 'chore: repin the V9 gate chain'

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
            block["subtree"] = new
            changes += 1
    if changes:
        indent = 2 if raw.startswith("{\n  ") else 1
        path.write_text(json.dumps(doc, indent=indent, ensure_ascii=False) + "\n",
                        encoding="utf-8", newline="\n")
    return changes


def main() -> int:
    files = [
        ROOT / p for p in git("ls-files", "uk_renewables_pipeline").splitlines()
        if SCOPE.match(p) and p.endswith((".sh", ".mjs", ".js", ".json"))
    ]
    total = 0
    for attempt in range(1, MAX_PASSES + 1):
        hashes = working_tree_hashes()
        moved = 0
        for path in files:
            if not path.is_file():
                continue
            if path.suffix == ".json":
                moved += rewrite_contract(path, hashes)
                continue
            before = path.read_text(encoding="utf-8", newline="")
            after, n = rewrite(before, hashes)
            if n:
                path.write_text(after, encoding="utf-8", newline="")
                moved += n
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
