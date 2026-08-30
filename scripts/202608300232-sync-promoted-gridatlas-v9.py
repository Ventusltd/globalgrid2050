#!/usr/bin/env python3
"""Mirror a promoted GridAtlas V9 release and place it immediately after Atlas V8."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Any

MIN_RENDER_READY_GENERATION = "202608292311"
START = "<!-- GRIDATLAS_V9_AUTOMATION_START -->"
END = "<!-- GRIDATLAS_V9_AUTOMATION_END -->"
V8_ANCHOR = re.compile(
    r"(?is)<a\b(?=[^>]*href\s*=\s*([\"'])[^\"']*repd_grid_atlasv8/?[^\"']*\1)[^>]*>.*?</a>"
)
HREF = re.compile(r"(?is)(href\s*=\s*)([\"'])[^\"']*repd_grid_atlasv8/?[^\"']*\2")
TAG_SPLIT = re.compile(r"(<[^>]+>)")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(value, dict), f"JSON root is not an object: {path}")
    return value


def verify_release(release: Path) -> dict[str, str]:
    sums = release / "sha256sums.txt"
    require(sums.is_file(), f"missing release digest manifest: {sums}")
    records: dict[str, str] = {}
    for number, raw in enumerate(sums.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        digest, separator, relative = raw.partition("  ")
        require(separator == "  ", f"bad sha256 line {number}")
        require(re.fullmatch(r"[a-f0-9]{64}", digest) is not None, f"bad digest line {number}")
        require(relative and not relative.startswith("/") and ".." not in Path(relative).parts, f"unsafe path line {number}")
        path = release / relative
        require(path.is_file(), f"missing release file: {relative}")
        require(sha256(path) == digest, f"release digest mismatch: {relative}")
        records[relative] = digest
    require("index.html" in records, "release index absent from digest manifest")
    require("release-manifest.json" in records, "release manifest absent from digest manifest")
    return records


def copy_verified_tree(source: Path, destination: Path) -> None:
    if destination.exists():
        source_files = sorted(p.relative_to(source) for p in source.rglob("*") if p.is_file())
        destination_files = sorted(p.relative_to(destination) for p in destination.rglob("*") if p.is_file())
        require(source_files == destination_files, "existing GlobalGrid release file closure differs")
        for relative in source_files:
            require(sha256(source / relative) == sha256(destination / relative), f"immutable mirror differs: {relative}")
        return
    shutil.copytree(source, destination)


def replace_visible_text(anchor: str) -> str:
    parts = TAG_SPLIT.split(anchor)
    replacements = (
        (re.compile(r"REPD\s+Grid\s+Atlas\s+V8", re.I), "Grid Atlas V9"),
        (re.compile(r"Grid\s+Atlas\s+V8", re.I), "Grid Atlas V9"),
        (re.compile(r"Atlas\s+V8", re.I), "Atlas V9"),
        (re.compile(r"\bV8\b", re.I), "V9"),
    )
    changed_text = False
    for index, part in enumerate(parts):
        if part.startswith("<"):
            continue
        updated = part
        for pattern, replacement in replacements:
            updated = pattern.sub(replacement, updated)
        changed_text = changed_text or updated != part
        parts[index] = updated
    if not changed_text:
        # Preserve the cloned structure but give the adjacent product an explicit label.
        for index in range(len(parts) - 1, -1, -1):
            if not parts[index].startswith("<") and parts[index].strip():
                parts[index] = "Grid Atlas V9"
                changed_text = True
                break
    require(changed_text, "could not derive a visible V9 label from the V8 catalogue anchor")
    return "".join(parts)


def build_v9_anchor(v8_anchor: str, release_id: str) -> str:
    destination = f"/{release_id}/"
    opening_end = v8_anchor.find(">")
    require(opening_end > 0, "malformed V8 anchor")
    opening = v8_anchor[: opening_end + 1]
    remainder = v8_anchor[opening_end + 1 :]
    opening, count = HREF.subn(lambda match: f"{match.group(1)}{match.group(2)}{destination}{match.group(2)}", opening, count=1)
    require(count == 1, "V8 anchor href could not be rewritten")
    if "data-gridatlas-release=" not in opening:
        opening = opening[:-1] + f' data-gridatlas-release="{release_id}">' 
    return replace_visible_text(opening + remainder)


def update_homepage(homepage: Path, release_id: str) -> None:
    original = homepage.read_text(encoding="utf-8")
    without_old = re.sub(
        rf"(?is)\s*{re.escape(START)}.*?{re.escape(END)}\s*",
        "\n",
        original,
    )
    matches = list(V8_ANCHOR.finditer(without_old))
    require(matches, "Atlas V8 homepage anchor not found")
    # Use the first catalogue occurrence; the gate below proves V8 precedes V9.
    match = matches[0]
    v9_anchor = build_v9_anchor(match.group(0), release_id)
    block = f"\n{START}\n{v9_anchor}\n{END}"
    updated = without_old[: match.end()] + block + without_old[match.end() :]
    require(updated.count(START) == 1 and updated.count(END) == 1, "V9 catalogue marker closure mismatch")
    require(updated.find("repd_grid_atlasv8") < updated.find(f"data-gridatlas-release=\"{release_id}\""), "V8/V9 catalogue order is wrong")
    require(f'href="/{release_id}/"' in updated or f"href='/{release_id}/'" in updated, "V9 homepage href missing")
    homepage.write_text(updated, encoding="utf-8", newline="\n")


_legacy_update_homepage = update_homepage


def _semantic_v8_catalogue_update(homepage: Path, release_id: str) -> None:
    original = homepage.read_text(encoding="utf-8")
    if V8_ANCHOR.search(original):
        _legacy_update_homepage(homepage, release_id)
        return

    generated = re.compile(
        rf"(?is)\s*/\*\s*{re.escape(START)}\s*\*/.*?/\*\s*{re.escape(END)}\s*\*/\s*"
    )
    without_old = generated.sub("\n", original)
    without_old = re.sub(
        rf"(?is)\s*{re.escape(START)}.*?{re.escape(END)}\s*",
        "\n",
        without_old,
    )

    current_row = re.compile(
        r'(?m)^[ \t]*\{[^\n]*name\s*:\s*(["\'])UK Grid Atlas V9 — Current Verified Release\1[^\n]*\},?\s*$'
    )
    without_old = current_row.sub("", without_old)

    v8_row = re.compile(
        r'(?m)^(?P<indent>[ \t]*)\{[^\n]*url\s*:\s*(["\'])[^"\']*repd_grid_atlasv8/?\2[^\n]*\},?\s*$'
    )
    match = v8_row.search(without_old)
    require(match is not None, "Atlas V8 homepage catalogue row not found")
    indent = match.group("indent")
    generation = release_id.split("-", 1)[0]
    block = (
        f"\n{indent}/* {START} */\n"
        f'{indent}{{ name:"UK Grid Atlas V9 — Current Verified Release", '
        f'url:"./{release_id}/", '
        f'note:"CURRENT VERIFIED · {release_id} · actual 400 kV render gates · desktop/mobile · canonical repd_ref deep links · V8 and immutable prior V9 releases preserved", '
        f'data_gridatlas_release:"{release_id}" }}, /* data-gridatlas-release="{release_id}" */\n'
        f"{indent}/* {END} */"
    )
    updated = without_old[: match.end()] + block + without_old[match.end() :]

    current_link = re.compile(
        r'(<a\s+href=)(["\'])[^"\']+\2(>UK Grid Atlas V9 — Current Verified Release</a>)'
    )
    updated = current_link.sub(
        lambda item: f'{item.group(1)}{item.group(2)}./{release_id}/{item.group(2)}{item.group(3)}',
        updated,
    )
    current_strip = re.compile(
        r'(<div class="os-strip"><a[^>]*>UK Grid Atlas V9 — Current Verified Release</a><span class="live-status">).*?(</span></div>)'
    )
    updated = current_strip.sub(
        lambda item: f"{item.group(1)}{generation} · verified live{item.group(2)}",
        updated,
        count=1,
    )

    require(updated.count(START) == 1 and updated.count(END) == 1, "V9 catalogue marker closure mismatch")
    require(
        updated.find("repd_grid_atlasv8") < updated.find(f'data-gridatlas-release="{release_id}"'),
        "V8/V9 catalogue order is wrong",
    )
    require(f'url:"./{release_id}/"' in updated, "V9 homepage route missing")
    homepage.write_text(updated, encoding="utf-8", newline="\n")


update_homepage = _semantic_v8_catalogue_update

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gridatlas", required=True, type=Path)
    parser.add_argument("--site-root", default=".", type=Path)
    parser.add_argument("--homepage", default="index.html")
    args = parser.parse_args()

    state_path = args.gridatlas / "state/live-set.json"
    require(state_path.is_file(), "GridAtlas current pointer is missing")
    state = load(state_path)
    current = state.get("current") or {}
    verification = state.get("verification") or {}
    generation = str(state.get("generation") or "")

    if generation < MIN_RENDER_READY_GENERATION:
        print(json.dumps({"classification": "WAITING_FOR_RENDER_READY_PROMOTION", "generation": generation}, sort_keys=True))
        return 0

    require(str(state.get("schema", "")).startswith("gridatlas.live-set."), "GridAtlas pointer schema mismatch")
    require(str(state.get("classification", "")).startswith("VERIFIED_LIVE_"), "GridAtlas release is not verified live")
    require(verification.get("promotion_eligible") is True, "GridAtlas release is not promotion eligible")
    require(int(verification.get("failed_gates", -1)) == 0, "GridAtlas release has failed gates")

    release_id = str(current.get("release_id") or "")
    require(re.fullmatch(r"\d{12}-atlas-v9", release_id) is not None, "unsafe GridAtlas release id")
    source_release = args.gridatlas / release_id
    require(source_release.is_dir(), f"promoted release directory missing: {release_id}")
    records = verify_release(source_release)

    site_root = args.site_root.resolve()
    homepage = site_root / args.homepage
    require(homepage.is_file(), f"GlobalGrid homepage missing: {homepage}")
    destination = site_root / release_id
    copy_verified_tree(source_release, destination)
    update_homepage(homepage, release_id)

    pointer = {
        "schema": "globalgrid2050.gridatlas-v9-pointer.v1",
        "classification": "MIRRORED_PROMOTED_GRIDATLAS_V9",
        "generation": generation,
        "release_id": release_id,
        "source_repository": "Ventusltd/gridatlas",
        "source_commit": current.get("publication_commit"),
        "source_live_url": current.get("live_url"),
        "globalgrid_live_url": f"https://globalgrid2050.com/{release_id}/",
        "source_sha256sums_sha256": sha256(source_release / "sha256sums.txt"),
        "files": len(records),
        "rollback_release_id": (state.get("rollback") or {}).get("release_id"),
    }
    pointer_path = site_root / "state/gridatlas-v9-current.json"
    pointer_path.parent.mkdir(parents=True, exist_ok=True)
    pointer_path.write_text(json.dumps(pointer, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(pointer, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001
        print(f"GRIDATLAS_GLOBALGRID_SYNC_FAILED: {error}", file=sys.stderr)
        raise
