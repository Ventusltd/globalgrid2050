"""Deterministic, bounded readers for existing grid and podcast owner products."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile
from typing import Any

SCHEMA = "globalgrid.grid-intelligence.v1"
LIMIT = 32 * 1024 * 1024
TOPICS = {
    "grid": r"\b(?:grid|transmission|substation|interconnector)\b",
    "connection": r"\b(?:connections?|queue|curtailment)\b",
    "storage": r"\b(?:batter(?:y|ies)|bess|storage)\b",
    "data_centres": r"\bdata cent(?:re|er)s?\b",
    "finance": r"\b(?:capex|funding|finance|investment)\b",
}


def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False,
                       separators=(",", ":")) + "\n").encode("utf-8")


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def validate_ref(ref: dict) -> None:
    if not re.fullmatch(r"Ventusltd/[A-Za-z0-9_.-]+", ref.get("repository", "")):
        raise ValueError("invalid repository owner")
    if not re.fullmatch(r"[0-9a-f]{40}", ref.get("commit", "")):
        raise ValueError("immutable Git commit required")
    path = ref.get("path", "")
    if not path or PurePosixPath(path).is_absolute() or ".." in PurePosixPath(path).parts or "\\" in path or ":" in path:
        raise ValueError("repository-relative path required")
    if not re.fullmatch(r"[0-9a-f]{64}", ref.get("sha256", "")):
        raise ValueError("SHA-256 required")
    if type(ref.get("bytes")) is not int or not 0 < ref["bytes"] <= LIMIT:
        raise ValueError("source exceeds bounded input contract")


def source_url(ref: dict) -> str:
    validate_ref(ref)
    return f"https://github.com/{ref['repository']}/blob/{ref['commit']}/{ref['path']}"


def read_pinned(repo: Path, ref: dict) -> bytes:
    """Read Git object bytes (not a possibly modified/CRLF working copy)."""
    validate_ref(ref)
    obj = f"{ref['commit']}:{ref['path']}"
    size = int(subprocess.check_output(["git", "-C", str(repo), "cat-file", "-s", obj], timeout=20))
    if size != ref["bytes"]:
        raise ValueError("source size mismatch")
    raw = subprocess.check_output(["git", "-C", str(repo), "show", obj], timeout=20)
    if digest(raw) != ref["sha256"]:
        raise ValueError("source hash mismatch")
    return raw


def declared_layers(shell: str) -> list[dict]:
    """Index static shell declarations only; do not evaluate arbitrary JavaScript."""
    match = re.search(r"const ukConfig\s*=\s*\[(.*?)\n\s*\];", shell, re.S)
    if not match:
        raise ValueError("GridAtlas shell configuration changed")
    rows = []
    for block in re.findall(r"\{\s*id:\s*\"[^\"]+\"[^{}]*\}", match[1]):
        fields = dict(re.findall(r'\b(id|label|type|url):\s*"([^"]*)"', block))
        if not {"id", "label", "type", "url"} <= fields.keys():
            raise ValueError("layer declaration missing contract fields")
        fields.update(data_plane="drawing_declaration", runtime_payload_verified=False,
                      source_licence=None, data_updated_at=None)
        rows.append(fields)
    if not rows or len(rows) != len(re.findall(r"\bid:\s*\"", match[1])):
        raise ValueError("unparsed layer declaration")
    if len({r["id"] for r in rows}) != len(rows):
        raise ValueError("duplicate layer id")
    return rows


def podcast_index(text: str, ref: dict) -> list[dict]:
    """Episode and speaker/timestamp locators; interviews never become project facts."""
    heads = list(re.finditer(r'<h2 id="([^"]+)">([^<]+)</h2>', text))
    if not heads:
        raise ValueError("no transcript episode headings")
    result = []
    for i, head in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        body = text[head.end():end]
        speakers = list(re.finditer(r"^([^\n<>]{1,100})\s+\((\d{1,2}:\d{2}(?:\.\d+)?)\)\s*$", body, re.M))
        topics = {}
        for topic, pattern in TOPICS.items():
            hits = []
            for j, speaker in enumerate(speakers):
                segment = body[speaker.end():speakers[j + 1].start() if j + 1 < len(speakers) else len(body)]
                if re.search(pattern, segment, re.I):
                    hits.append({"speaker": speaker[1].strip(), "timestamp": speaker[2],
                                 "line": text.count("\n", 0, head.end() + speaker.start()) + 1})
            topics[topic] = {"matching_turns": len(hits), "first_locators": hits[:5]}
        line = text.count("\n", 0, head.start()) + 1
        result.append({"id": head[1], "title": html.unescape(head[2]),
                       "source_url": source_url(ref) + f"#L{line}", "line": line,
                       "speaker_turns": len(speakers), "topics": topics,
                       "claim_class": "interview_context_not_verified_project_evidence"})
    if len({r["id"] for r in result}) != len(result):
        raise ValueError("duplicate transcript episode")
    return result


def parquet_source_index(raw: bytes) -> list[dict]:
    """Read the existing small owner catalogue with DuckDB, not drawing payloads.

    Install the estate's automation/news/acquisition/requirements.txt. A private
    temporary copy avoids changing the owner file or running external SQL.
    """
    import duckdb

    if len(raw) > LIMIT or not raw.startswith(b"PAR1") or not raw.endswith(b"PAR1"):
        raise ValueError("invalid bounded Parquet catalogue")
    with tempfile.TemporaryDirectory(prefix="grid-catalogue-") as directory:
        path = Path(directory) / "sources.parquet"
        path.write_bytes(raw)
        con = duckdb.connect(":memory:")
        try:
            cursor = con.execute("SELECT source_id, wiring, features, input_sha256, partition_path, authority_state, licence_state, disposition, publishable FROM read_parquet(?) ORDER BY source_id", [str(path)])
            names = [d[0] for d in cursor.description]
            rows = [dict(zip(names, row)) for row in cursor.fetchall()]
        finally:
            con.close()
    if not rows or len({r["source_id"] for r in rows}) != len(rows):
        raise ValueError("invalid source index identity")
    return rows


def layer_data_context(registry: dict, release: dict, sources: list[dict]) -> list[dict]:
    """Link every layer declaration to owner partition hashes and source caveats."""
    files = {f["path"]: f for f in release["files"]}
    by_source = {r["source_id"]: r for r in sources}
    output = []
    for group in registry["groups"]:
        for layer in group["layers"]:
            data = layer["v9_data"]
            source = by_source[data["source_id"]]
            file = files[data["parquet_url"]]
            output.append({"id": layer["id"], "source_id": source["source_id"],
                           "parquet_path": file["path"], "parquet_sha256": file["sha256"],
                           "partition_bytes": file["bytes"],
                           "source_feature_rows": source["features"],
                           "authority_state": source["authority_state"],
                           "licence_state": source["licence_state"],
                           "owner_disposition": source["disposition"],
                           "source_publishable_flag": source["publishable"],
                           "release_available_flag": layer["available"],
                           "rights_approved_by_this_index": False})
    return sorted(output, key=lambda r: r["id"])


def planned_changes(product: dict, ref: dict, *, node: str | None = None) -> list[dict]:
    """Exact ETYS electrical node lookup, not fuzzy map/REPD/site-name matching.

    A planned change's year is not an actual commissioning date. MVA ratings
    remain individual equipment ratings; no summation or MW/headroom conversion.
    """
    validate_ref(ref)
    if product.get("schema") != "data-grid-gb.etys.normalized.v1" or not re.fullmatch(r"ETYS \d{4}", product.get("edition", "")):
        raise ValueError("unsupported ETYS product")
    if node is not None and (not isinstance(node, str) or not re.fullmatch(r"[A-Z0-9-]{2,20}", node)):
        raise ValueError("exact ETYS node code required")
    output, seen = [], {}
    for table, kind, fields in [
        ("circuit_changes", "circuit_change", ("winter_rating_mva", "spring_rating_mva", "summer_rating_mva", "autumn_rating_mva")),
        ("transformer_changes", "transformer_change", ("rating_mva",)),
    ]:
        rows = product.get(table)
        if not isinstance(rows, list) or product.get("counts", {}).get(table) != len(rows):
            raise ValueError("ETYS count or table mismatch")
        for row_index, row in enumerate(rows):
            if row.get("kind") != kind or not all(isinstance(row.get(k), str) and row[k] for k in ("node_1", "node_2", "owner", "source_sheet", "status")):
                raise ValueError("malformed ETYS change")
            if type(row.get("year")) is not int or not 1900 <= row["year"] <= 2200:
                raise ValueError("unlabelled planned year")
            measures = {}
            for key in fields:
                value = row.get(key)
                if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
                    raise ValueError("invalid individual equipment rating")
                measures[key] = {"value": value, "unit": "MVA"}
            key = digest(canonical({"edition": product["edition"], "row": row}))
            # The owner product contains repeated identical rows. Preserve each
            # source locator; do not invent a circuit identity or silently merge.
            seen[key] = seen.get(key, 0) + 1
            if node is not None and node not in (row["node_1"], row["node_2"]):
                continue
            output.append({"id": "etys:" + key + ":" + str(seen[key]), "kind": kind,
                           "source_table": table, "source_row_index": row_index,
                           "identical_row_occurrence": seen[key],
                           "node_1": row["node_1"], "node_2": row["node_2"],
                           "owner": row["owner"], "source_sheet": row["source_sheet"],
                           "source_row_sha256": digest(canonical(row)),
                           "publication_vintage": product["edition"], "geography": "GB",
                           "planned_year": row["year"], "published_status": row["status"],
                           "actual_commissioned_date": None, "scenario": None,
                           "claim_class": "published_network_plan_not_completion",
                           "review_state": "PROVISIONAL", "ratings": measures,
                           "available_capacity_mw": None, "project_binding": None,
                           "source_url": source_url(ref), "source_sha256": ref["sha256"]})
    return sorted(output, key=lambda r: (r["planned_year"], r["kind"], r["id"]))


def build_index(pins: dict, blobs: dict[str, bytes]) -> dict:
    refs = {r["id"]: r for r in pins["sources"]}
    if len(refs) != len(pins["sources"]) or set(refs) != set(blobs):
        raise ValueError("duplicate or missing pinned input")
    for name, ref in refs.items():
        validate_ref(ref)
        if len(blobs[name]) != ref["bytes"] or digest(blobs[name]) != ref["sha256"]:
            raise ValueError("input drift: " + name)
    load = lambda name: json.loads(blobs[name])
    current = load("atlas_current")
    cartridges = []
    for cartridge in current["cartridges"]:
        source = refs["cartridge_" + cartridge["id"]]
        if source["sha256"] != cartridge["sha256"]:
            raise ValueError("composition cartridge hash mismatch")
        cartridges.append({"id": cartridge["id"], "version": cartridge.get("version"),
                           "source_url": source_url(source), "sha256": source["sha256"],
                           "declared_data_source": cartridge.get("data_source"),
                           "result_class": cartridge.get("result_class"),
                           "runtime_tested_here": False})
    package = load("engine_package")
    exports = []
    for name, path in sorted(package["exports"].items()):
        source = refs["engine_" + name.removeprefix("./")]
        if source["path"] != path.removeprefix("./"):
            raise ValueError("engine export path mismatch")
        exports.append({"export": name, "source_url": source_url(source), "sha256": source["sha256"]})
    etys = load("etys_normalized")
    changes = planned_changes(etys, refs["etys_normalized"])
    points = load("connection_points")
    if points.get("schema") != "data-grid-gb.connection-points.v3" or points["counts"]["connection_points"] != len(points["connection_points"]):
        raise ValueError("connection point schema/count drift")
    data_release, registry = load("atlas_data_release"), load("atlas_data_registry")
    owner_sources = parquet_source_index(blobs["atlas_sources_parquet"])
    data_layers = layer_data_context(registry, data_release, owner_sources)
    shell_layers = declared_layers(blobs["atlas_shell"].decode("utf-8"))
    if {r["id"] for r in shell_layers} != {r["id"] for r in data_layers}:
        raise ValueError("shell/data owner layer coverage mismatch")
    if data_release["candidate_closure"]["sources"] != len(owner_sources):
        raise ValueError("owner source count drift")
    return {"schema": SCHEMA, "sources": list(refs.values()),
            "coverage": {"pinned_files": len(refs), "repositories": sorted({r["repository"] for r in refs.values()}),
                         "all_estate_history_read": False, "runtime_layer_payloads_verified": False,
                         "global_2050_forecast_dataset_indexed": False,
                         "podcast_reference_guide": "not_located_in_bounded_search",
                         "guide_word_count_verified": False},
            "atlas": {"generation": current["generation"], "version": current["composition_version"],
                      "transport_declared": current.get("transport"),
                      "layers": shell_layers,
                      "data_owner": {"repository": "Ventusltd/data-gridatlas",
                                     "release_id": data_release["release_id"],
                                     "layers": data_layers, "sources": owner_sources,
                                     "closure_declared_by_owner": data_release["candidate_closure"],
                                     "boundary": "Source authority/licence caveats are retained even when a release layer is available. No new rights approval."},
                      "cartridges": cartridges,
                      "planes": "Drawing declarations and Parquet/DuckDB search delivery are distinct; declarations do not prove loaded payloads."},
            "engine": {"license_declared": package.get("license"), "exports": exports,
                       "proof_command": "node verify.mjs", "proof_run_claimed_by_this_index": False,
                       "boundary": "Distance is km, equipment ratings are per circuit MVA, published fault metrics remain distinct; none proves capacity or connection."},
            "network": {"schema": points["schema"], "counts": points["counts"], "join": points["join"],
                        "publication_vintage": etys["edition"], "planned_change_rows": len(changes),
                        "repeated_identical_change_rows": sum(x["identical_row_occurrence"] > 1 for x in changes),
                        "planned_years": sorted({x["planned_year"] for x in changes}),
                        "actual_commissioned_date": None, "available_capacity_mw": None,
                        "source_receipts": load("etys_sources")["sources"],
                        "boundary": points["not_a_connection_assessment"]},
            "podcast": podcast_index(blobs["podcast"].decode("utf-8"), refs["podcast"]),
            "ownership_plan": {"source_url": source_url(refs["spider_plan"]),
                               "status": load("spider_plan")["metadata"]["status"],
                               "boundary": "Canonical planned graph, not evidence of implementation; this index is a consumer, not a replacement owner registry."}}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repos", type=Path, required=True, help="Local JSON mapping repository names to checkouts; never committed")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--pins", type=Path, default=Path(__file__).with_name("sources.json"))
    parser.add_argument("--node", help="Export only ETYS planned changes at an exact electrical node")
    args = parser.parse_args()
    pins, repos = json.loads(args.pins.read_bytes()), json.loads(args.repos.read_bytes())
    blobs = {r["id"]: read_pinned(Path(repos[r["repository"]]), r) for r in pins["sources"]}
    index = build_index(pins, blobs)
    if args.node:
        ref = next(r for r in pins["sources"] if r["id"] == "etys_normalized")
        index = {"schema": SCHEMA, "changes": planned_changes(json.loads(blobs["etys_normalized"]), ref, node=args.node)}
    data = canonical(index)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    print(json.dumps({"sha256": digest(data), "bytes": len(data)}))


if __name__ == "__main__":
    main()
