#!/usr/bin/env python3
"""Compile the Sun Star concept into deterministic evidence and checks."""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import hashlib
import json
import platform
import re
import subprocess
from pathlib import Path
from typing import Any


STAMP = "202609150010"


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_record(repo: Path, relative: str) -> dict[str, Any]:
    data = (repo / relative).read_bytes()
    return {"path": relative.replace("\\", "/"), "bytes": len(data), "sha256": digest(data)}


def scan_markdown(repo: Path, relative: str) -> dict[str, Any]:
    data = (repo / relative).read_bytes()
    text = data.decode("utf-8")
    headings = [m.group(2).strip() for m in re.finditer(r"^(#{1,6})\s+(.+?)\s*$", text, re.MULTILINE)]
    links = sorted(set(re.findall(r"https?://[^\s)>\]}\"']+", text)))
    return {
        **file_record(repo, relative),
        "headings": headings,
        "outbound_links": links,
    }


def decode(dictionary: Any, value: Any) -> Any:
    if isinstance(value, int) and isinstance(dictionary, list) and 0 <= value < len(dictionary):
        return dictionary[value]
    return value


def pipeline_summary(repo: Path) -> dict[str, Any]:
    base = repo / "pipelinenews_intelligence"
    releases = sorted(p for p in base.iterdir() if p.is_dir() and re.fullmatch(r"\d{12}", p.name))
    if not releases:
        raise RuntimeError("no timestamped Pipeline News release")
    release = releases[-1]
    files = sorted((release / "data").glob("*fast-projects.json"))
    if len(files) != 1:
        raise RuntimeError(f"expected one fast-projects input in {release.name}, found {len(files)}")
    source = files[0]
    raw = source.read_bytes()
    doc = json.loads(raw)
    fields = doc["fields"]
    dictionaries = doc["dictionaries"]
    index = {name: fields.index(name) for name in fields}

    solar = []
    for row in doc["rows"]:
        technology = decode(dictionaries.get("technology"), row[index["technology"]])
        if str(technology).lower().startswith("solar"):
            capacity = row[index["capacity_mw"]]
            latitude = row[index["latitude"]]
            longitude = row[index["longitude"]]
            status = decode(dictionaries.get("status"), row[index["status"]])
            solar.append({
                "repd_ref": str(row[index["repd_ref"]]),
                "name": str(row[index["name"]]),
                "capacity_mw": float(capacity) if capacity not in (None, "") else 0.0,
                "has_coordinates": latitude not in (None, "") and longitude not in (None, ""),
                "status": str(status),
                "geometry_status": str(decode(dictionaries.get("geometry_status"), row[index["geometry_status"]])),
            })

    by_status: dict[str, int] = {}
    for project in solar:
        by_status[project["status"]] = by_status.get(project["status"], 0) + 1
    relative = source.relative_to(repo).as_posix()
    return {
        "release": release.name,
        "source": {"path": relative, "bytes": len(raw), "sha256": digest(raw)},
        "all_projects": len(doc["rows"]),
        "solar_projects": len(solar),
        "solar_mw": round(sum(p["capacity_mw"] for p in solar), 6),
        "solar_mw_rounded": round(sum(p["capacity_mw"] for p in solar)),
        "solar_with_coordinates": sum(1 for p in solar if p["has_coordinates"]),
        "missing_coordinate_projects": [
            {k: p[k] for k in ("repd_ref", "name", "status", "geometry_status")}
            for p in solar if not p["has_coordinates"]
        ],
        "by_status": dict(sorted(by_status.items())),
    }


def geometry_summary(repo: Path) -> dict[str, Any]:
    relative = "scripts/gridbot_london_solar_daylight_geometry.py"
    source = (repo / relative).read_text(encoding="utf-8")
    tree = ast.parse(source)
    functions = sorted(node.name for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)))
    return {**file_record(repo, relative), "functions": functions}


def podcast_summary(repo: Path) -> dict[str, Any]:
    relative = "podcast_transcripts/index.md"
    data = (repo / relative).read_bytes()
    text = data.decode("utf-8")
    matches = re.findall(r'<li><a href="#([^"]+)">([\s\S]*?)</a></li>', text)
    seen: set[str] = set()
    episodes = []
    for anchor, title in matches:
        if anchor in seen:
            continue
        seen.add(anchor)
        episodes.append({"anchor": anchor, "title": re.sub(r"<[^>]+>|\s+", " ", title).strip()})
    return {
        "path": relative,
        "bytes": len(data),
        "sha256": digest(data),
        "episode_count": len(episodes),
        "first_five": episodes[:5],
    }


def git_commit(repo: Path) -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()


def build_payload(repo: Path) -> dict[str, Any]:
    task_path = repo / "testcode" / STAMP / "task.json"
    task = json.loads(task_path.read_text(encoding="utf-8"))
    pipeline = pipeline_summary(repo)
    expected = task["expected"]
    checks = {
        "pipeline_release": pipeline["release"] == expected["pipeline_release"],
        "solar_projects": pipeline["solar_projects"] == expected["solar_projects"],
        "solar_mw_rounded": pipeline["solar_mw_rounded"] == expected["solar_mw_rounded"],
        "solar_with_coordinates": pipeline["solar_with_coordinates"] == expected["solar_with_coordinates"],
    }
    coordinate_claim = task["claims_from_scope"]["solar_with_coordinates"]
    return {
        "schema": "globalgrid2050.concept-result.v1",
        "stamp": STAMP,
        "task": task,
        "inputs": {
            "task": file_record(repo, f"testcode/{STAMP}/task.json"),
            "deployment_page": scan_markdown(repo, "solar_deployment_statistics/index.md"),
            "components_page": scan_markdown(repo, "solar_components/index.md"),
            "geometry": geometry_summary(repo),
            "podcast": podcast_summary(repo),
            "pipeline": pipeline,
        },
        "checks": checks,
        "all_checks_pass": all(checks.values()),
        "reconciliation_findings": [{
            "field": "solar_with_coordinates",
            "scope_claim": coordinate_claim,
            "observed": pipeline["solar_with_coordinates"],
            "matches": coordinate_claim == pipeline["solar_with_coordinates"],
            "treatment": "five projects remain explicit missing-geometry records; no coordinates inferred",
        }],
        "next_python_products": [
            "capture dated PV Live half-hourly observations with byte-level provenance",
            "parse attributed Solar Power Portal and PV Magazine RSS metadata under feed terms",
            "compile deterministic Sun Star daily JSON using a seed derived from the PV series",
            "render the UK Solar lens only after Claude's shared GRAMMAR.md is verified",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--lane", choices=("local", "ci"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    payload = build_payload(repo)
    result = {
        "lane": args.lane,
        "generated_utc": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "runner": {"python": platform.python_version(), "system": platform.system()},
        "git_commit": git_commit(repo),
        "payload_sha256": digest(canonical(payload)),
        "payload": payload,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"lane": args.lane, "payload_sha256": result["payload_sha256"], "checks": payload["checks"]}, indent=2))
    return 0 if payload["all_checks_pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
