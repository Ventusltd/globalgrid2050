"""Tests for the descriptor-parameterised V6 chain (synthetic fixtures, no network).

Every script reads its release descriptor at import time, so stages run in subprocesses.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import io
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
SCRIPTS = REPO / "scripts"
BUILD = REPO / "automation" / "repd" / "build_v6.py"
sys.path.insert(0, str(BUILD.parent))
import build_v6  # noqa: E402

HEADERS = [
    "Old Ref ID", "Ref ID", "Record Last Updated (dd/mm/yyyy)", "Operator (or Applicant)", "Site Name",
    "Technology Type", "Storage Co-location REPD Ref ID", "Installed Capacity (MWelec)",
    "Development Status (short)", "County", "Region", "Country", "Planning Authority",
    "Planning Application Reference", "Planning Application Submitted", "Planning Application Withdrawn",
    "Planning Permission Refused", "Planning Permission  Granted", "Planning Permission Expired",
    "Under Construction", "Operational",
]
DATE_COLS = {"Record Last Updated (dd/mm/yyyy)", "Planning Application Submitted", "Planning Application Withdrawn",
             "Planning Permission Refused", "Planning Permission  Granted", "Planning Permission Expired",
             "Under Construction", "Operational"}


def make_rows(n=1005, *, variant="a"):
    rows = []
    for i in range(1, n + 1):
        tech = "Solar Photovoltaics" if i % 3 == 0 else ("Battery" if i % 3 == 1 else "Wind Onshore")
        cap = "" if i % 50 == 0 else (str(150 + i % 7) if tech == "Battery" and i % 5 == 0 else str(0.5 + (i % 9)))
        rows.append({
            "Old Ref ID": "", "Ref ID": str(i), "Record Last Updated (dd/mm/yyyy)": "16/01/2026",
            "Operator (or Applicant)": f"Op {i % 40}", "Site Name": f"Site {i}", "Technology Type": tech,
            "Storage Co-location REPD Ref ID": str(i + 1) if i % 97 == 0 else "", "Installed Capacity (MWelec)": cap,
            "Development Status (short)": "Application Submitted", "County": "Kent", "Region": "South East",
            "Country": "England", "Planning Authority": "Dover",
            "Planning Application Reference": f"PA/{i // 2}" if i % 10 else "",
            "Planning Application Submitted": "03/02/2025", "Planning Application Withdrawn": "",
            "Planning Permission Refused": "", "Planning Permission  Granted": "", "Planning Permission Expired": "",
            "Under Construction": "", "Operational": "",
        })
    if variant == "b":
        rows = [r for r in rows if r["Ref ID"] != "7"]                       # retired ref
        rows.append({**rows[0], "Ref ID": str(n + 1), "Site Name": "New Site"})  # new ref
        rows[10]["Planning Application Reference"] = "CHANGED/1"             # dev id change (ref 12)
        rows[20]["Planning Application Submitted"] = "9/14/2026"              # month-first CSV, typed XLSX
        rows[21]["Operational"] = "NA"                                      # NA text date
        rows.insert(30, dict(rows[30]))                                      # identical duplicate row
    return rows


def write_sources(tmp: Path, rows, name, *, conflict=False):
    from openpyxl import Workbook

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=HEADERS, lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    csv_path = tmp / f"{name}.csv"
    csv_path.write_bytes(buf.getvalue().encode("cp1252"))
    wb = Workbook()
    ws = wb.active
    ws.title = "REPD"
    ws.append(HEADERS)
    for k, row in enumerate(rows):
        out = []
        for h in HEADERS:
            v = row[h]
            if h in DATE_COLS and v and v != "NA":
                fmt = "%m/%d/%Y" if v == "9/14/2026" else "%d/%m/%Y"
                v = datetime.strptime(v, fmt)
            elif h == "Installed Capacity (MWelec)" and v:
                v = float(v)
            elif h == "Ref ID":
                v = int(v)
            if conflict and k == 31 and h == "Site Name":
                v = "Conflicting name"
            out.append(v)
        ws.append(out)
    xlsx_path = tmp / f"{name}.xlsx"
    wb.save(xlsx_path)
    return csv_path, xlsx_path


def counts(rows):
    seen, solar, bess = set(), 0, 0
    for r in rows:
        if r["Ref ID"] in seen:
            continue
        seen.add(r["Ref ID"])
        cap = float(r["Installed Capacity (MWelec)"]) if r["Installed Capacity (MWelec)"] else None
        if cap is None:
            continue
        solar += r["Technology Type"] == "Solar Photovoltaics" and cap > 1.0
        bess += r["Technology Type"] == "Battery" and cap > 100.0
    return len(rows), len(seen), solar, bess


def descriptor(tmp, csv_path, xlsx_path, rows, suffix, **extra):
    total, unique, solar, bess = counts(rows)
    data = {
        "release_id": suffix, "quarter_label": "Q9", "output_suffix": suffix,
        "csv_url": "https://assets.publishing.service.gov.uk/media/x/REPD.csv",
        "xlsx_url": "https://assets.publishing.service.gov.uk/media/x/REPD.xlsx",
        "publication_date": "2026-11-13", "dataset_title": "Synthetic REPD", "expected_rows": total,
        "expected_unique_refs": unique, "expected_solar_gt1": solar, "expected_bess_gt100": bess,
        "expected_csv_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
        "expected_xlsx_sha256": hashlib.sha256(xlsx_path.read_bytes()).hexdigest(),
        "duplicate_row_policy": "drop_identical", "date_rule": "xlsx_typed_wins",
    }
    data.update(extra)
    path = tmp / f"{suffix}.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def run_build(desc, out, root, csv_path, xlsx_path):
    return subprocess.run(
        [sys.executable, str(BUILD), "--descriptor", str(desc), "--out", str(out), "--input-root", str(root),
         "--csv", str(csv_path), "--xlsx", str(xlsx_path), "--validated-at", "2026-11-13T00:00:00+00:00"],
        capture_output=True, text=True,
    )


def clean_env():
    env = dict(os.environ)
    for key in [k for k in env if k.startswith("REPD_")]:
        env.pop(key)
    return env


def test_default_descriptor_is_july():
    code = ("import repd_sources_v6 as s, build_project_identity_v6 as b;"
            "print(s.EXPECTED_ROWS, s.EXPECTED_UNIQUE_REFS, s.EXPECTED_SOLAR_GT1, s.EXPECTED_BESS_GT100,"
            "s.EXPECTED_CSV_SHA256[:8], s.EXPECTED_XLSX_SHA256[:8], s.MANIFEST.name, s.REPORT.name,"
            "s.CANONICAL_CSV.name, b.IDENTITY_OUT.name, b.PROJECTS_OUT.name, s.DATE_RULE, s.DUPLICATE_ROW_POLICY)")
    out = subprocess.run([sys.executable, "-c", code], cwd=SCRIPTS, env=clean_env(), capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert out.stdout.split() == [
        "14657", "14657", "3445", "269", "84c1b5f9", "624a0a97", "manifest_v6.json",
        "repd_source_reconciliation_v6.json", "latest_repd_v6_canonical.csv", "project_identity_v6.json",
        "major_projects_v6.json", "csv", "reject",
    ]


def test_descriptor_requires_out_dir_and_new_suffix(tmp_path):
    rows = make_rows()
    c, x = write_sources(tmp_path, rows, "a")
    env = clean_env()
    env["REPD_RELEASE_DESCRIPTOR"] = str(descriptor(tmp_path, c, x, rows, "2026q1"))
    out = subprocess.run([sys.executable, "-c", "import repd_sources_v6"], cwd=SCRIPTS, env=env, capture_output=True, text=True)
    assert out.returncode != 0 and "REPD_OUT_DIR is required" in out.stderr
    bad = json.loads(Path(env["REPD_RELEASE_DESCRIPTOR"]).read_text())
    bad["output_suffix"] = "v6"
    Path(env["REPD_RELEASE_DESCRIPTOR"]).write_text(json.dumps(bad))
    env["REPD_OUT_DIR"] = str(tmp_path / "o")
    out = subprocess.run([sys.executable, "-c", "import repd_sources_v6"], cwd=SCRIPTS, env=env, capture_output=True, text=True)
    assert out.returncode != 0 and "never v6" in out.stderr


def test_two_release_chain_and_stability(tmp_path):
    root = tmp_path / "repo"
    (root / "dist").mkdir(parents=True)
    rows_a = make_rows()
    ca, xa = write_sources(tmp_path, rows_a, "a")
    res = run_build(descriptor(tmp_path, ca, xa, rows_a, "2026q1"), tmp_path / "outa", root, ca, xa)
    # no baseline yet: chain stages pass but the stability step needs the baseline files
    assert "[PASS] build_project_identity_v6.py" in res.stdout, res.stdout + res.stderr
    for stem in ("project_identity", "major_projects"):
        (root / "dist" / f"{stem}_v6.json").write_bytes((tmp_path / "outa" / "dist" / f"{stem}_2026q1.json").read_bytes())
    (root / "dist" / "major_project_news_v6.json").write_text(json.dumps(
        {"repd_bound": True, "globalgrid_id_required": True, "headline_count": 0, "items": []}))
    (root / "dist" / "project_news_links_v6.json").write_text(json.dumps(
        {"schema": "globalgrid2050.project-news-links.v6", "article_count": 0, "links": []}))
    before = build_v6.hash_manifest(root, build_v6.DEFAULT_PROTECTED)

    rows_b = make_rows(variant="b")
    cb, xb = write_sources(tmp_path, rows_b, "b")
    res = run_build(descriptor(tmp_path, cb, xb, rows_b, "2026q2"), tmp_path / "outb", root, cb, xb)
    assert res.returncode == 0, res.stdout + res.stderr
    assert build_v6.hash_manifest(root, build_v6.DEFAULT_PROTECTED) == before
    dist = tmp_path / "outb" / "dist"
    rec = json.loads((dist / "repd_source_reconciliation_2026q2.json").read_text())
    assert rec["metrics"]["csv_rows"] == 1006 and rec["metrics"]["csv_unique_refs"] == 1005
    assert rec["metrics"]["representation_differences"]["csv_month_first_date"] == 1
    assert rec["metrics"]["representation_differences"]["na_date_text"] == 1
    ident = json.loads((dist / "project_identity_2026q2.json").read_text())
    by_ref = {r["repd_ref"]: r for r in ident["records"]}
    assert by_ref["22"]["planning_application_submitted"] == "2026-09-14"
    assert by_ref["23"]["operational"] is None
    canon = list(csv.DictReader(io.StringIO(
        (tmp_path / "outb" / "data" / "latest_repd_2026q2_canonical.csv").read_text(encoding="utf-8-sig"))))
    canon_by_ref = {r["Ref ID"]: r for r in canon}
    assert canon_by_ref["23"]["Operational"] == "" and canon_by_ref["22"]["Planning Application Submitted"] == "14/09/2026"
    assert len(canon) == 1005
    st = json.loads((dist / "project_identity_2026q2_stability.json").read_text())
    assert st["gg_project_id"] == {**st["gg_project_id"], "changed": 0, "new": 1, "retired": 1, "retired_refs": ["7"]}
    assert [c["repd_ref"] for c in st["gg_development_id"]["changed"]] == ["12"]
    run = json.loads((tmp_path / "outb" / "build_v6_run_2026q2.json").read_text())
    assert run["protected_files"]["unchanged"] is True and run["protected_files"]["count"] == 4
    assert not (root / "dist" / "manifest_v6.json").exists()


def test_conflicting_duplicate_fails_closed(tmp_path):
    rows = make_rows(variant="b")
    c, x = write_sources(tmp_path, rows, "b", conflict=True)
    res = run_build(descriptor(tmp_path, c, x, rows, "2026q2"), tmp_path / "o", tmp_path, c, x)
    assert res.returncode != 0
    assert "conflicting duplicate Ref ID" in res.stdout + res.stderr
    assert not (tmp_path / "o" / "dist" / "project_identity_2026q2.json").exists()


def test_hash_wrong_fails_and_writes_no_identity(tmp_path):
    rows = make_rows()
    c, x = write_sources(tmp_path, rows, "a")
    desc = descriptor(tmp_path, c, x, rows, "2026q1", expected_csv_sha256="0" * 64)
    res = run_build(desc, tmp_path / "o", tmp_path, c, x)
    assert res.returncode == 1
    rec = json.loads((tmp_path / "o" / "dist" / "repd_source_reconciliation_2026q1.json").read_text())
    assert rec["pass"] is False and any("Q9 CSV immutable SHA-256" in e for e in rec["errors"])
    assert not (tmp_path / "o" / "dist" / "manifest_2026q1.json").exists()


def test_hash_manifest_detects_change(tmp_path):
    (tmp_path / "dist").mkdir()
    f = tmp_path / "dist" / "x.json"
    f.write_text("1")
    before = build_v6.hash_manifest(tmp_path, ["dist/*"])
    f.write_text("2")
    assert build_v6.compare_manifests(before, build_v6.hash_manifest(tmp_path, ["dist/*"])) == ["changed: dist/x.json"]
    f.unlink()
    assert build_v6.compare_manifests(before, build_v6.hash_manifest(tmp_path, ["dist/*"])) == ["removed: dist/x.json"]


ORIGINAL = Path(os.environ.get("REPD_V6_ORIGINAL_SCRIPTS", "/nonexistent")) / "repd_sources_v6.py"


@pytest.mark.skipif(not ORIGINAL.exists(), reason="set REPD_V6_ORIGINAL_SCRIPTS to the unmodified scripts/ dir")
def test_default_path_matches_original_reconcile(tmp_path):
    """Differential: unmodified vs parameterised reconcile(), default descriptor, passing fixture."""
    rows = make_rows()
    c, x = write_sources(tmp_path, rows, "a")
    total, unique, solar, bess = counts(rows)
    outputs = []
    for name, path in (("orig", ORIGINAL), ("new", SCRIPTS / "repd_sources_v6.py")):
        spec = importlib.util.spec_from_file_location(f"src_{name}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.utc_now = lambda: "2026-08-22T00:00:00+00:00"
        mod.EXPECTED_ROWS, mod.EXPECTED_SOLAR_GT1, mod.EXPECTED_BESS_GT100 = total, solar, bess
        mod.EXPECTED_UNIQUE_REFS = unique
        mod.EXPECTED_CSV_SHA256 = hashlib.sha256(c.read_bytes()).hexdigest()
        mod.EXPECTED_XLSX_SHA256 = hashlib.sha256(x.read_bytes()).hexdigest()
        canonical, report, manifest = mod.reconcile(c.read_bytes(), x.read_bytes())
        assert report["pass"], report["errors"]
        outputs.append((canonical.to_csv(index=False), json.dumps(report), json.dumps(manifest)))
    assert outputs[0] == outputs[1]


BASELINE = Path(os.environ.get("REPD_V6_BASELINE_ROOT", "/nonexistent"))


@pytest.mark.skipif(not (BASELINE / "dist" / "project_identity_v6.json").exists(),
                    reason="set REPD_V6_BASELINE_ROOT to a globalgrid2050 checkout")
def test_july_identity_stage_regenerates_byte_identical(tmp_path):
    """Default (July) descriptor: rebuild the identity stage from the committed July outputs and
    require dist/project_identity_v6.json, major_projects_v6.json and manifest_v6.json byte-identical.
    (The July raw CSV/XLSX bytes are not available, so the reconcile stage is covered by the
    differential test instead.)"""
    import shutil

    tree = tmp_path / "tree"
    (tree / "dist").mkdir(parents=True)
    (tree / "data").mkdir()
    shutil.copytree(SCRIPTS, tree / "scripts")
    for name in ("manifest_v6.json", "repd_source_reconciliation_v6.json",
                 "major_project_news_v6.json", "project_news_links_v6.json"):
        shutil.copy(BASELINE / "dist" / name, tree / "dist" / name)
    subprocess.run([sys.executable, str(Path(__file__).with_name("reconstruct_v6_canonical.py")),
                    str(BASELINE / "dist" / "project_identity_v6.json"),
                    str(tree / "data" / "latest_repd_v6_canonical.csv")], check=True)
    for stage in ("validate_v6_manifest_provenance.py", "build_project_identity_v6.py", "validate_project_identity_v6.py"):
        res = subprocess.run([sys.executable, stage], cwd=tree / "scripts", env=clean_env(), capture_output=True, text=True)
        assert res.returncode == 0, res.stdout + res.stderr
    for name in ("project_identity_v6.json", "major_projects_v6.json", "manifest_v6.json"):
        assert (tree / "dist" / name).read_bytes() == (BASELINE / "dist" / name).read_bytes(), name
