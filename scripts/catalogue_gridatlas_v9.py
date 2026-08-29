#!/usr/bin/env python3
"""Compile one verified Grid Atlas V9 pointer into the GlobalGrid catalogue.

This compiler is deliberately surgical.  It validates the separately fetched,
commit-pinned Grid Atlas pointer and release manifest, inserts one catalogue row
after the exact V8 sentinel, and writes an immutable timestamped homepage
snapshot.  It never regenerates the homepage from a template.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


CONTROL_GENERATION = "202608291504"
CATALOGUE_SCHEMA = "globalgrid2050.homepage-catalogue-release.v1"
POINTER_SCHEMA = "gridatlas.live-set.v3"
RELEASE_SCHEMA = "gridatlas.timestamped-live-release.v1"
GRIDATLAS_REPOSITORY = "Ventusltd/gridatlas"
GLOBALGRID_REPOSITORY = "Ventusltd/globalgrid2050"
POINTER_PATH = "releases/current-v3.json"
STATE_PATH = "state/live-set.json"
V8_ENTRY = '    { name:"UK Energy Atlas Grid Overlay V8", url:"./repd_grid_atlasv8/" },'
V8_URL = "https://globalgrid2050.com/repd_grid_atlasv8/"
GENERATION_RE = re.compile(r"^[0-9]{12}$")
ATLAS_RELEASE_RE = re.compile(r"^([0-9]{12})-atlas-v9$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


class ContractError(RuntimeError):
    """Raised when a fail-closed catalogue contract is not satisfied."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractError(message)


def read_bytes(path: Path) -> bytes:
    require(path.is_file(), f"Required file is missing: {path}")
    return path.read_bytes()


def read_text(path: Path) -> str:
    return read_bytes(path).decode("utf-8")


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(read_text(path))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"Invalid UTF-8 JSON at {path}: {exc}") from exc
    require(isinstance(value, dict), f"JSON root must be an object: {path}")
    return value


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def canonical_json(value: dict[str, Any]) -> str:
    return json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def validate_sha(value: str, label: str) -> str:
    require(bool(SHA_RE.fullmatch(value)), f"{label} must be a 40-character lowercase Git SHA")
    return value


def validate_catalogue_time(generation: str, incepted_at: str, created_at: str) -> None:
    require(bool(GENERATION_RE.fullmatch(generation)), "Catalogue generation must be YYYYMMDDHHMM")
    try:
        inception = dt.datetime.fromisoformat(incepted_at)
    except ValueError as exc:
        raise ContractError("incepted_at must be an ISO-8601 timestamp with a timezone") from exc
    require(inception.tzinfo is not None, "incepted_at must include a timezone offset")
    london_generation = inception.astimezone(ZoneInfo("Europe/London")).strftime("%Y%m%d%H%M")
    require(london_generation == generation, "Catalogue generation must equal the Europe/London inception minute")
    try:
        created = dt.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError("created_at must be an ISO-8601 UTC timestamp") from exc
    require(created.utcoffset() == dt.timedelta(0), "created_at must be UTC")


def validate_upstream(
    pointer_path: Path,
    release_manifest_path: Path,
    gridatlas_commit: str,
) -> dict[str, Any]:
    gridatlas_commit = validate_sha(gridatlas_commit, "Grid Atlas resolved commit")
    pointer_bytes = read_bytes(pointer_path)
    release_bytes = read_bytes(release_manifest_path)
    pointer = read_json(pointer_path)
    release = read_json(release_manifest_path)

    require(pointer.get("schema") == POINTER_SCHEMA, "Unexpected Grid Atlas pointer schema")
    require(pointer.get("classification") == "VERIFIED_LIVE_ATLAS_V9", "Grid Atlas pointer is not verified live V9")
    current = pointer.get("current")
    require(isinstance(current, dict), "Grid Atlas pointer has no current object")

    release_id = current.get("release_id")
    require(isinstance(release_id, str), "Grid Atlas current release_id is missing")
    match = ATLAS_RELEASE_RE.fullmatch(release_id)
    require(bool(match), "Grid Atlas current release_id is not a timestamped Atlas V9 release")
    atlas_generation = match.group(1)
    expected_route = f"/gridatlas/{release_id}/"
    expected_live_url = f"https://ventusltd.github.io/gridatlas/{release_id}/"

    require(current.get("route") == expected_route, "Grid Atlas pointer route does not match its release_id")
    require(current.get("live_url") == expected_live_url, "Grid Atlas pointer live_url does not match its release_id")
    query_contract = current.get("query_contract")
    require(isinstance(query_contract, dict), "Grid Atlas query contract is missing")
    require(query_contract.get("parameter") == "repd_ref", "Grid Atlas deep-link parameter is not repd_ref")
    golden_value = str(query_contract.get("golden_value", ""))
    require(bool(re.fullmatch(r"[0-9]+", golden_value)), "Grid Atlas golden repd_ref is invalid")
    require(golden_value == "16135", "Grid Atlas current pointer has lost the governed REPD 16135 sentinel")

    verification = pointer.get("verification")
    require(isinstance(verification, dict), "Grid Atlas verification record is missing")
    require(verification.get("promotion_eligible") is True, "Grid Atlas pointer is not promotion eligible")
    require(verification.get("map_state_ready") is True, "Grid Atlas map-state proof is not green")
    require(verification.get("rendered_desktop_mobile") is True, "Grid Atlas desktop/mobile proof is not green")
    require(verification.get("repd_16135_mk430zy") is True, "Grid Atlas REPD 16135 / MK43 0ZY browser proof is not green")
    browser_claim_sha256 = str(verification.get("public_browser_claim_sha256", ""))
    require(bool(re.fullmatch(r"[0-9a-f]{64}", browser_claim_sha256)), "Grid Atlas public browser claim hash is missing")
    release_pages_run_id = verification.get("release_pages_run_id")
    require(type(release_pages_run_id) is int and release_pages_run_id > 0, "Grid Atlas verified Pages run ID is missing")

    require(release.get("schema") == RELEASE_SCHEMA, "Unexpected Grid Atlas release-manifest schema")
    require(release.get("classification") == "LIVE_RELEASE", "Grid Atlas release is not classified LIVE_RELEASE")
    require(release.get("immutable") is True, "Grid Atlas release is not immutable")
    require(release.get("current") is True, "Grid Atlas release manifest is not current")
    require(release.get("release_id") == release_id, "Pointer and release manifest identify different releases")
    require(str(release.get("generation")) == atlas_generation, "Grid Atlas release generation is inconsistent")
    require(release.get("live_url") == expected_live_url, "Grid Atlas release live_url is inconsistent")
    require(release.get("source_commit") == current.get("source_commit"), "Grid Atlas source commit differs between pointer and release")

    route_contract = release.get("route_contract")
    require(isinstance(route_contract, dict), "Grid Atlas release route contract is missing")
    expected_golden_link = f"{expected_live_url}?repd_ref={golden_value}"
    require(route_contract.get("route") == expected_route, "Grid Atlas release route contract is inconsistent")
    require(route_contract.get("query_parameter") == "repd_ref", "Grid Atlas release query parameter is inconsistent")
    require(route_contract.get("golden_deep_link") == expected_golden_link, "Grid Atlas golden deep link is inconsistent")

    truth_contract = release.get("truth_contract")
    require(isinstance(truth_contract, dict), "Grid Atlas truth contract is missing")
    require(truth_contract.get("v8_untouched") is True, "Grid Atlas release does not attest that V8 is untouched")
    require(truth_contract.get("repd_address_search_preserved") is True, "Grid Atlas REPD address-search proof is not green")

    release_sha256 = sha256_bytes(release_bytes)
    require(current.get("release_manifest_sha256") == release_sha256, "Grid Atlas pointer release-manifest hash does not match fetched bytes")

    return {
        "repository": GRIDATLAS_REPOSITORY,
        "resolved_commit": gridatlas_commit,
        "pointer_path": POINTER_PATH,
        "state_mirror_path": STATE_PATH,
        "pointer_sha256": sha256_bytes(pointer_bytes),
        "release_manifest_path": f"{release_id}/release-manifest.json",
        "release_manifest_sha256": release_sha256,
        "release_id": release_id,
        "generation": atlas_generation,
        "route": expected_route,
        "live_url": expected_live_url,
        "golden_deep_link": expected_golden_link,
        "golden_repd_ref": golden_value,
        "source_commit": current.get("source_commit"),
        "publication_commit": current.get("publication_commit"),
        "data_release_id": current.get("data_release_id"),
    }


def atlas_entry(atlas: dict[str, Any]) -> tuple[str, dict[str, str]]:
    name = f"UK Grid Atlas V9 — {atlas['generation']}"
    note = (
        "LIVE VERIFIED · immutable timestamped release · official REPD address/postcode search · "
        "repd_ref deep links · V8 preserved"
    )
    line = f'    {{ name:"{name}", url:"{atlas["live_url"]}", note:"{note}" }},'
    return line, {"name": name, "url": atlas["live_url"], "note": note}


def compile_root(current_html: str, entry_line: str, live_url: str) -> tuple[str, bool]:
    require(current_html.count(V8_ENTRY) == 1, "Exact V8 catalogue sentinel must occur once")
    require(current_html.count('./repd_grid_atlasv8/') == 1, "V8 catalogue route must occur once")
    url_count = current_html.count(live_url)
    require(url_count <= 1, "Current Grid Atlas immutable URL occurs more than once")
    if url_count == 1:
        require(current_html.count(entry_line) == 1, "Current Grid Atlas URL exists but not as the governed catalogue entry")
        compiled = current_html
        changed = False
    else:
        compiled = current_html.replace(V8_ENTRY, f"{V8_ENTRY}\n{entry_line}", 1)
        changed = True
    require(compiled.count(V8_ENTRY) == 1, "V8 sentinel changed during catalogue compilation")
    require(compiled.count('./repd_grid_atlasv8/') == 1, "V8 route changed during catalogue compilation")
    require(compiled.count(entry_line) == 1, "Compiled Grid Atlas catalogue entry must occur once")
    require(compiled.count(live_url) == 1, "Compiled Grid Atlas URL must occur once")
    return compiled, changed


def snapshot_html(root_html: str, catalogue_generation: str) -> str:
    require(root_html.count("<head>\n") == 1, "Root homepage must contain one canonical head opening")
    require("<base " not in root_html.lower(), "Root homepage unexpectedly contains a base element")
    metadata = (
        '<base href="https://globalgrid2050.com/">\n'
        f'<meta name="gg2050-catalogue-generation" content="{catalogue_generation}">\n'
    )
    result = root_html.replace("<head>\n", f"<head>\n{metadata}", 1)
    require(result.count(metadata) == 1, "Timestamped homepage snapshot metadata insertion failed")
    return result


def existing_catalogue_manifests(homepage_versions: Path, atlas_release_id: str) -> list[Path]:
    matches: list[Path] = []
    if not homepage_versions.is_dir():
        return matches
    for path in sorted(homepage_versions.glob("????????????-globalgrid2050/manifest.json")):
        try:
            manifest = read_json(path)
        except ContractError:
            continue
        atlas = manifest.get("atlas")
        if isinstance(atlas, dict) and atlas.get("release_id") == atlas_release_id:
            matches.append(path)
    return matches


def predecessor_record(homepage_versions: Path) -> dict[str, Any] | None:
    candidates = sorted(homepage_versions.glob("????????????-globalgrid2050/manifest.json")) if homepage_versions.is_dir() else []
    if not candidates:
        return None
    path = candidates[-1]
    manifest = read_json(path)
    return {
        "release_id": manifest.get("release_id"),
        "manifest_path": path.relative_to(homepage_versions.parent).as_posix(),
        "manifest_sha256": sha256_bytes(read_bytes(path)),
    }


def validate_existing_snapshot(root: Path, manifest_path: Path, expected_atlas: dict[str, Any], entry_line: str) -> dict[str, Any]:
    manifest = read_json(manifest_path)
    require(manifest.get("schema") == CATALOGUE_SCHEMA, "Existing catalogue manifest has an unexpected schema")
    require(manifest.get("immutable") is True, "Existing catalogue manifest is not immutable")
    require(manifest.get("control_generation") == CONTROL_GENERATION, "Existing catalogue manifest was not built by this control source")
    atlas = manifest.get("atlas")
    require(isinstance(atlas, dict), "Existing catalogue manifest has no Atlas record")
    for key in ("release_id", "live_url", "route", "release_manifest_sha256"):
        require(atlas.get(key) == expected_atlas.get(key), f"Existing catalogue Atlas {key} differs from the current verified pointer")
    catalogue = manifest.get("catalogue")
    require(isinstance(catalogue, dict), "Existing catalogue manifest has no catalogue record")
    snapshot_rel = catalogue.get("snapshot_index_path")
    require(isinstance(snapshot_rel, str), "Existing catalogue snapshot path is missing")
    snapshot_path = root / snapshot_rel
    snapshot_bytes = read_bytes(snapshot_path)
    require(sha256_bytes(snapshot_bytes) == catalogue.get("snapshot_index_sha256"), "Existing catalogue snapshot hash is invalid")
    require(entry_line in snapshot_bytes.decode("utf-8"), "Existing catalogue snapshot does not contain the governed Atlas entry")
    return manifest


def build_manifest(
    *,
    catalogue_generation: str,
    incepted_at: str,
    created_at: str,
    base_commit: str,
    parent_root_sha256: str,
    root_html: str,
    snapshot_rel: str,
    snapshot: str,
    atlas: dict[str, Any],
    entry: dict[str, str],
    predecessor: dict[str, Any] | None,
) -> dict[str, Any]:
    release_id = f"{catalogue_generation}-globalgrid2050"
    public_snapshot_url = f"https://globalgrid2050.com/homepage_versions/{release_id}/"
    return {
        "schema": CATALOGUE_SCHEMA,
        "classification": "IMMUTABLE_CATALOGUE_RELEASE",
        "immutable": True,
        "control_generation": CONTROL_GENERATION,
        "generation": catalogue_generation,
        "release_id": release_id,
        "incepted_at": incepted_at,
        "created_at": created_at,
        "source": {
            "repository": GLOBALGRID_REPOSITORY,
            "base_commit": base_commit,
            "root_index_path": "index.html",
            "parent_root_index_sha256": parent_root_sha256,
        },
        "atlas": atlas,
        "catalogue": {
            "entry": entry,
            "root_index_path": "index.html",
            "root_index_sha256_at_release": sha256_text(root_html),
            "snapshot_index_path": snapshot_rel,
            "snapshot_index_sha256": sha256_text(snapshot),
            "public_snapshot_url": public_snapshot_url,
        },
        "preservation": {
            "v8_entry": V8_ENTRY.strip(),
            "v8_public_url": V8_URL,
            "v8_entry_count": 1,
            "v8_untouched": True,
        },
        "predecessor": predecessor,
        "public_verification": {
            "status": "REQUIRED_AFTER_PAGES_DEPLOYMENT",
            "required_urls": [
                "https://globalgrid2050.com/",
                public_snapshot_url,
                V8_URL,
                atlas["live_url"],
                atlas["golden_deep_link"],
            ],
        },
    }


def apply_catalogue(args: argparse.Namespace) -> dict[str, Any]:
    root = args.root.resolve()
    index_path = root / "index.html"
    homepage_versions = root / "homepage_versions"
    validate_catalogue_time(args.catalogue_generation, args.incepted_at, args.created_at)
    base_commit = validate_sha(args.base_commit, "GlobalGrid base commit")
    atlas = validate_upstream(args.pointer_json, args.release_manifest, args.gridatlas_commit)
    entry_line, entry = atlas_entry(atlas)
    before_html = read_text(index_path)
    parent_hash = sha256_text(before_html)
    compiled_html, root_changed = compile_root(before_html, entry_line, atlas["live_url"])

    existing = existing_catalogue_manifests(homepage_versions, atlas["release_id"])
    require(len(existing) <= 1, "More than one immutable homepage release catalogues the same Atlas release")
    changed_paths: list[str] = []

    if existing:
        manifest_path = existing[0]
        manifest = validate_existing_snapshot(root, manifest_path, atlas, entry_line)
        release_id = str(manifest["release_id"])
        if root_changed:
            index_path.write_text(compiled_html, encoding="utf-8")
            changed_paths.append("index.html")
    else:
        release_id = f"{args.catalogue_generation}-globalgrid2050"
        release_dir = homepage_versions / release_id
        require(not release_dir.exists(), f"Timestamped homepage release path already exists: {release_dir}")
        snapshot = snapshot_html(compiled_html, args.catalogue_generation)
        snapshot_rel = f"homepage_versions/{release_id}/index.html"
        manifest_rel = f"homepage_versions/{release_id}/manifest.json"
        manifest = build_manifest(
            catalogue_generation=args.catalogue_generation,
            incepted_at=args.incepted_at,
            created_at=args.created_at,
            base_commit=base_commit,
            parent_root_sha256=parent_hash,
            root_html=compiled_html,
            snapshot_rel=snapshot_rel,
            snapshot=snapshot,
            atlas=atlas,
            entry=entry,
            predecessor=predecessor_record(homepage_versions),
        )
        release_dir.mkdir(parents=True, exist_ok=False)
        (release_dir / "index.html").write_text(snapshot, encoding="utf-8")
        (release_dir / "manifest.json").write_text(canonical_json(manifest), encoding="utf-8")
        changed_paths.extend([snapshot_rel, manifest_rel])
        if root_changed:
            index_path.write_text(compiled_html, encoding="utf-8")
            changed_paths.append("index.html")

    manifest_path = homepage_versions / release_id / "manifest.json"
    result = verify_catalogue(
        root=root,
        catalogue_manifest=manifest_path,
        pointer_json=args.pointer_json,
        release_manifest=args.release_manifest,
        gridatlas_commit=args.gridatlas_commit,
    )
    result.update(
        {
            "changed": bool(changed_paths),
            "changed_paths": sorted(changed_paths),
            "base_commit": base_commit,
            "control_generation": CONTROL_GENERATION,
        }
    )
    return result


def verify_catalogue(
    *,
    root: Path,
    catalogue_manifest: Path,
    pointer_json: Path,
    release_manifest: Path,
    gridatlas_commit: str,
) -> dict[str, Any]:
    root = root.resolve()
    if not catalogue_manifest.is_absolute():
        catalogue_manifest = root / catalogue_manifest
    catalogue_manifest = catalogue_manifest.resolve()
    require(catalogue_manifest.is_relative_to(root), "Catalogue manifest must remain inside the repository")
    atlas = validate_upstream(pointer_json, release_manifest, gridatlas_commit)
    manifest = read_json(catalogue_manifest)
    require(manifest.get("schema") == CATALOGUE_SCHEMA, "Unexpected catalogue manifest schema")
    require(manifest.get("classification") == "IMMUTABLE_CATALOGUE_RELEASE", "Catalogue release classification is invalid")
    require(manifest.get("immutable") is True, "Catalogue release is not immutable")
    require(manifest.get("control_generation") == CONTROL_GENERATION, "Catalogue control generation is invalid")
    release_id = manifest.get("release_id")
    generation = manifest.get("generation")
    require(release_id == f"{generation}-globalgrid2050", "Catalogue release_id is inconsistent")
    require(bool(GENERATION_RE.fullmatch(str(generation))), "Catalogue manifest generation is invalid")

    manifest_atlas = manifest.get("atlas")
    require(isinstance(manifest_atlas, dict), "Catalogue manifest Atlas record is missing")
    for key in (
        "resolved_commit",
        "pointer_sha256",
        "release_manifest_sha256",
        "release_id",
        "route",
        "live_url",
        "golden_deep_link",
    ):
        require(manifest_atlas.get(key) == atlas.get(key), f"Catalogue Atlas {key} no longer matches the verified pointer")

    entry_line, _ = atlas_entry(atlas)
    root_html = read_text(root / "index.html")
    require(root_html.count(V8_ENTRY) == 1, "Current root no longer preserves the exact V8 sentinel")
    require(root_html.count('./repd_grid_atlasv8/') == 1, "Current root no longer preserves the V8 route exactly once")
    require(root_html.count(entry_line) == 1, "Current root does not contain the governed Atlas entry exactly once")

    catalogue = manifest.get("catalogue")
    require(isinstance(catalogue, dict), "Catalogue output record is missing")
    snapshot_rel = catalogue.get("snapshot_index_path")
    require(isinstance(snapshot_rel, str), "Catalogue snapshot index path is missing")
    expected_snapshot_rel = f"homepage_versions/{release_id}/index.html"
    require(snapshot_rel == expected_snapshot_rel, "Catalogue snapshot path is not its timestamped release folder")
    snapshot_bytes = read_bytes(root / snapshot_rel)
    require(sha256_bytes(snapshot_bytes) == catalogue.get("snapshot_index_sha256"), "Catalogue snapshot SHA-256 is invalid")
    snapshot = snapshot_bytes.decode("utf-8")
    require('<base href="https://globalgrid2050.com/">' in snapshot, "Catalogue snapshot has no functional root base URL")
    require(snapshot.count(entry_line) == 1, "Catalogue snapshot does not contain the Atlas entry exactly once")
    require(snapshot.count(V8_ENTRY) == 1, "Catalogue snapshot does not preserve the V8 entry exactly once")

    return {
        "ok": True,
        "release_id": release_id,
        "catalogue_generation": generation,
        "catalogue_manifest_path": catalogue_manifest.relative_to(root).as_posix(),
        "catalogue_manifest_sha256": sha256_bytes(read_bytes(catalogue_manifest)),
        "snapshot_index_path": snapshot_rel,
        "public_snapshot_url": catalogue.get("public_snapshot_url"),
        "atlas_release_id": atlas["release_id"],
        "atlas_live_url": atlas["live_url"],
        "atlas_golden_deep_link": atlas["golden_deep_link"],
        "atlas_release_manifest_sha256": atlas["release_manifest_sha256"],
        "v8_public_url": V8_URL,
        "root_index_sha256": sha256_text(root_html),
        "released_root_index_sha256": catalogue.get("root_index_sha256_at_release"),
        "root_has_advanced_since_release": sha256_text(root_html) != catalogue.get("root_index_sha256_at_release"),
    }


def path_arg(value: str) -> Path:
    return Path(value)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    subparsers = result.add_subparsers(dest="command", required=True)

    apply_parser = subparsers.add_parser("apply", help="Compile and write the bounded catalogue outputs")
    apply_parser.add_argument("--root", type=path_arg, default=Path.cwd())
    apply_parser.add_argument("--pointer-json", type=path_arg, required=True)
    apply_parser.add_argument("--release-manifest", type=path_arg, required=True)
    apply_parser.add_argument("--gridatlas-commit", required=True)
    apply_parser.add_argument("--base-commit", required=True)
    apply_parser.add_argument("--catalogue-generation", required=True)
    apply_parser.add_argument("--incepted-at", required=True)
    apply_parser.add_argument("--created-at", required=True)
    apply_parser.add_argument("--result-json", type=path_arg)

    verify_parser = subparsers.add_parser("verify", help="Verify committed or staged catalogue bytes")
    verify_parser.add_argument("--root", type=path_arg, default=Path.cwd())
    verify_parser.add_argument("--catalogue-manifest", type=path_arg, required=True)
    verify_parser.add_argument("--pointer-json", type=path_arg, required=True)
    verify_parser.add_argument("--release-manifest", type=path_arg, required=True)
    verify_parser.add_argument("--gridatlas-commit", required=True)
    verify_parser.add_argument("--result-json", type=path_arg)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "apply":
            payload = apply_catalogue(args)
        else:
            payload = verify_catalogue(
                root=args.root,
                catalogue_manifest=args.catalogue_manifest,
                pointer_json=args.pointer_json,
                release_manifest=args.release_manifest,
                gridatlas_commit=args.gridatlas_commit,
            )
        rendered = canonical_json(payload)
        if args.result_json:
            args.result_json.parent.mkdir(parents=True, exist_ok=True)
            args.result_json.write_text(rendered, encoding="utf-8")
        sys.stdout.write(rendered)
        return 0
    except ContractError as exc:
        print(f"CATALOGUE CONTRACT FAILURE: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
