#!/usr/bin/env python3
"""Run the EXISTING V6 identity chain for a new REPD release, additively.

Stages (unchanged scripts, parameterised by a release descriptor through env vars):
  scripts/validate_repd_sources_v6.py      reconcile official CSV+XLSX (offline bytes or fetch)
  scripts/validate_v6_manifest_provenance.py
  scripts/build_project_identity_v6.py      identity registry + major projects (solar >1 MW, BESS >100 MW)
  scripts/validate_project_identity_v6.py   integrity gates (frozen V6 news/links read, never written)
then an identity-stability report against the previous release.

Every output goes to --out/{dist,data}/ with the descriptor's suffix (e.g. 2026q3). The frozen
*_v6 files are never written. A sha256 manifest of every protected file under --input-root
is taken before and after; any difference fails the run ("no truncation of previous work").
News headlines are NOT regenerated.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
DEFAULT_SCRIPTS = HERE.parents[2] / "scripts"
DEFAULT_PROTECTED = [
    "dist/*",
    "repd*.csv",
    "uk_renewables_pipeline/dashboard*.html",
    "uk_renewables_pipeline/v9.5.1/**/*",
    "uk_renewables_pipeline/202609082224/**/*",
]
STAGES = [
    "validate_repd_sources_v6.py",
    "validate_v6_manifest_provenance.py",
    "build_project_identity_v6.py",
    "validate_project_identity_v6.py",
]
SPINE_TECH = {"Solar Photovoltaics", "Battery", "Wind Onshore", "Wind Offshore"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_manifest(root: Path, patterns: list[str]) -> dict[str, str]:
    files = set()
    for pattern in patterns:
        for name in glob.glob(str(root / pattern), recursive=True):
            if Path(name).is_file():
                files.add(Path(name))
    return {str(p.relative_to(root)): sha256_file(p) for p in sorted(files)}


def compare_manifests(before: dict, after: dict) -> list[str]:
    problems = [f"changed: {k}" for k in before if k in after and before[k] != after[k]]
    problems += [f"removed: {k}" for k in before if k not in after]
    return problems


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def spine_population(records: list[dict]) -> dict:
    rows = [r for r in records if r.get("technology") in SPINE_TECH
            and r.get("capacity_mw") is not None and r["capacity_mw"] >= 1.0]
    by_tech = {t: sum(r["technology"] == t for r in rows) for t in sorted(SPINE_TECH)}
    return {"count": len(rows), "by_technology": by_tech,
            "capacity_mw": round(sum(r["capacity_mw"] for r in rows), 2),
            "rule": "technology in {Solar Photovoltaics, Battery, Wind Onshore, Wind Offshore} and capacity >= 1.0 MW (release.v9.1 spine rule; informational, spine not built here)"}


def stability_report(old_identity: dict, new_identity: dict, old_projects: dict, new_projects: dict,
                     news: dict | None = None) -> dict:
    old = {r["repd_ref"]: r for r in old_identity["records"] if r.get("repd_ref")}
    new = {r["repd_ref"]: r for r in new_identity["records"] if r.get("repd_ref")}
    retained = sorted(set(old) & set(new), key=lambda v: (len(v), v))
    project_id_changed = [ref for ref in retained if old[ref]["gg_project_id"] != new[ref]["gg_project_id"]]
    dev_changed = [
        {"repd_ref": ref, "site_name": new[ref]["site_name"],
         "old_gg_development_id": old[ref]["gg_development_id"],
         "new_gg_development_id": new[ref]["gg_development_id"],
         "old_development_repd_refs": old[ref]["development_repd_refs"],
         "new_development_repd_refs": new[ref]["development_repd_refs"]}
        for ref in retained if old[ref]["gg_development_id"] != new[ref]["gg_development_id"]
    ]
    old_devs = {r["gg_development_id"] for r in old.values()}
    new_devs = {r["gg_development_id"] for r in new.values()}
    old_p = {p["repd_ref"]: p for p in old_projects["projects"]}
    new_p = {p["repd_ref"]: p for p in new_projects["projects"]}
    news_refs = sorted({i.get("repd_ref") for i in (news or {}).get("items", []) if i.get("repd_ref")})
    return {
        "schema": "globalgrid2050.identity-stability.v1",
        "baseline": {"source_dataset_title": old_identity.get("source_dataset_title"),
                     "source_hashes": old_identity.get("source_hashes"), "records": len(old)},
        "candidate": {"source_dataset_title": new_identity.get("source_dataset_title"),
                      "source_hashes": new_identity.get("source_hashes"), "records": len(new)},
        "gg_project_id": {
            "preserved": len(retained) - len(project_id_changed),
            "changed": len(project_id_changed),
            "new": len(set(new) - set(old)),
            "retired": len(set(old) - set(new)),
            "retired_refs": sorted(set(old) - set(new), key=lambda v: (len(v), v)),
            "rule": "GG2050-REPD-<Ref ID>: deterministic, so every retained Ref keeps its ID",
        },
        "gg_development_id": {
            "retained_refs_preserved": len(retained) - len(dev_changed),
            "retained_refs_changed": len(dev_changed),
            "changed": dev_changed,
            "distinct_ids_baseline": len(old_devs),
            "distinct_ids_candidate": len(new_devs),
            "distinct_ids_kept": len(old_devs & new_devs),
            "distinct_ids_new": len(new_devs - old_devs),
            "distinct_ids_retired": len(old_devs - new_devs),
        },
        "major_projects": {
            "baseline_count": len(old_p), "candidate_count": len(new_p),
            "baseline_projects_sha256": old_projects.get("projects_sha256"),
            "candidate_projects_sha256": new_projects.get("projects_sha256"),
            "retained": len(set(old_p) & set(new_p)),
            "entered": len(set(new_p) - set(old_p)),
            "exited": len(set(old_p) - set(new_p)),
            "exited_refs": sorted(set(old_p) - set(new_p), key=lambda v: (len(v), v)),
            "entered_existing_refs": sorted((set(new_p) - set(old_p)) & set(old), key=lambda v: (len(v), v)),
        },
        "frozen_v6_news_bindings": {
            "refs": news_refs,
            "still_in_identity": [r for r in news_refs if r in new],
            "still_in_major_projects": [r for r in news_refs if r in new_p],
            "development_id_changed": [r for r in news_refs if r in old and r in new
                                       and old[r]["gg_development_id"] != new[r]["gg_development_id"]],
        },
        "spine_population_baseline": spine_population(list(old.values())),
        "spine_population_candidate": spine_population(list(new.values())),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--descriptor", required=True, help="release descriptor JSON (e.g. releases_v6/v6_2026q3.json)")
    parser.add_argument("--out", required=True, help="output directory (dist/ and data/ are created inside)")
    parser.add_argument("--input-root", required=True, help="read-only repo checkout (frozen V6 baseline, news inputs)")
    parser.add_argument("--csv", default="", help="offline mode: local official CSV")
    parser.add_argument("--xlsx", default="", help="offline mode: local official XLSX")
    parser.add_argument("--scripts", default=str(DEFAULT_SCRIPTS), help="directory holding the V6 scripts")
    parser.add_argument("--validated-at", default="", help="pin validated_at for byte-reproducible reruns")
    parser.add_argument("--protect", action="append", default=None, help="glob (relative to input root) of files that must not change")
    args = parser.parse_args(argv)

    descriptor_path = Path(args.descriptor).resolve()
    descriptor = load_json(descriptor_path)
    suffix = descriptor["output_suffix"]
    out = Path(args.out).resolve()
    root = Path(args.input_root).resolve()
    scripts = Path(args.scripts).resolve()
    if suffix == "v6":
        raise SystemExit("descriptor output_suffix 'v6' would overwrite frozen V6 files")
    out.mkdir(parents=True, exist_ok=True)
    planned = [out / "dist" / f"{stem}_{suffix}.json" for stem in
               ("repd_source_reconciliation", "manifest", "project_identity", "major_projects")]
    for path in planned:
        if path.exists() and root in path.parents and out == root:
            raise SystemExit(f"refusing to overwrite an existing file in the input root: {path}")

    protected = args.protect or DEFAULT_PROTECTED
    before = hash_manifest(root, protected)
    env = dict(os.environ)
    env.update({"REPD_RELEASE_DESCRIPTOR": str(descriptor_path), "REPD_OUT_DIR": str(out),
                "REPD_INPUT_ROOT": str(root)})
    if args.validated_at:
        env["REPD_VALIDATED_AT"] = args.validated_at
    if bool(args.csv) != bool(args.xlsx):
        raise SystemExit("offline mode needs both --csv and --xlsx")
    if args.csv:
        env["REPD_SOURCE_CSV_FILE"] = str(Path(args.csv).resolve())
        env["REPD_SOURCE_XLSX_FILE"] = str(Path(args.xlsx).resolve())

    results = []
    ok = True
    for stage in STAGES:
        proc = subprocess.run([sys.executable, str(scripts / stage)], cwd=str(scripts), env=env,
                              capture_output=True, text=True)
        tail = (proc.stdout + proc.stderr).strip().splitlines()[-12:]
        results.append({"stage": stage, "returncode": proc.returncode, "output_tail": tail})
        print(f"[{'PASS' if proc.returncode == 0 else 'FAIL'}] {stage}: {tail[-1] if tail else ''}")
        if proc.returncode != 0:
            ok = False
            break

    after = hash_manifest(root, protected)
    problems = compare_manifests(before, after)
    report = {
        "schema": "globalgrid2050.repd-build-v6-run.v1",
        "release_id": descriptor["release_id"],
        "descriptor": str(descriptor_path),
        "descriptor_sha256": sha256_file(descriptor_path),
        "offline_sources": {"csv": env.get("REPD_SOURCE_CSV_FILE"), "xlsx": env.get("REPD_SOURCE_XLSX_FILE")},
        "stages": results,
        "protected_files": {"patterns": protected, "count": len(before), "unchanged": not problems,
                            "problems": problems, "sha256_before": before},
        "outputs": {},
    }
    baseline_identity = root / descriptor.get("baseline_identity", "dist/project_identity_v6.json")
    baseline_projects = root / descriptor.get("baseline_projects", "dist/major_projects_v6.json")
    if ok and not (baseline_identity.exists() and baseline_projects.exists()):
        print(f"[SKIP] stability report: baseline missing under {root}")
    elif ok:
        dist = out / "dist"
        news_path = root / descriptor.get("news_input", "dist/major_project_news_v6.json")
        stability = stability_report(
            load_json(baseline_identity),
            load_json(dist / f"project_identity_{suffix}.json"),
            load_json(baseline_projects),
            load_json(dist / f"major_projects_{suffix}.json"),
            load_json(news_path) if news_path.exists() else None,
        )
        (dist / f"project_identity_{suffix}_stability.json").write_text(json.dumps(stability, indent=2), encoding="utf-8")
        g, d = stability["gg_project_id"], stability["gg_development_id"]
        print(f"[INFO] gg_project_id preserved={g['preserved']} changed={g['changed']} new={g['new']} retired={g['retired']}; "
              f"gg_development_id changed={d['retained_refs_changed']} {[c['repd_ref'] for c in d['changed']]}")
    for sub in ("dist", "data"):
        for path in sorted((out / sub).glob("*")) if (out / sub).exists() else []:
            report["outputs"][f"{sub}/{path.name}"] = {"sha256": sha256_file(path), "bytes": path.stat().st_size}
    (out / f"build_v6_run_{suffix}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    if problems:
        print("[FAIL] protected files changed:", problems[:20])
        return 2
    print(f"[{'PASS' if ok else 'FAIL'}] protected files unchanged ({len(before)} hashed)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
