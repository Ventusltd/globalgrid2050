"""Tests for the orchestrator (automation/repd/run.py). Synthetic fixtures, no network."""
from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
import types
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO))

from automation.repd import run  # noqa: E402

WF = REPO / ".github" / "workflows" / "repd-release-candidate.yml"
WF_CHECK = REPO / ".github" / "workflows" / "repd-new-release-check.yml.disabled"
HEADER = ["Ref ID"] + [f"Col {i}" for i in range(2, 54)]


def write_csv(path: Path, refs: list[str]) -> Path:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(HEADER)
    for ref in refs:
        w.writerow([ref] + ["x"] * 52)
    path.write_text(buf.getvalue(), encoding="utf-8")
    return path


@pytest.fixture
def fake_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / "dist").mkdir(parents=True)
    write_csv(repo / "repd.csv", ["1", "2", "3"])
    (repo / "dist" / "repd_master.json").write_text("{}", encoding="utf-8")
    (repo / "uk_renewables_pipeline" / "202610290230" / "data").mkdir(parents=True)
    (repo / "uk_renewables_pipeline" / "202610290230" / "data" / "x.json").write_text("[]")
    return repo


@pytest.fixture(autouse=True)
def hermetic_modules(monkeypatch):
    """Tests never pick up real components that happen to be installed next to run.py."""
    monkeypatch.setattr(run, "load_module", lambda name: None)


@pytest.fixture
def no_components(monkeypatch):
    """Make every component look absent, regardless of what is installed."""
    monkeypatch.setattr(run, "find_component", lambda stage: (None, f"module automation.repd.{stage} not present"))


def make_ctx(fake_repo: Path, tmp_path: Path, **kw) -> run.RunContext:
    src = tmp_path / "src"
    src.mkdir(parents=True, exist_ok=True)
    csv_path = write_csv(src / "in.csv", ["1", "2", "3", "4"])
    xlsx_path = src / "in.xlsx"
    xlsx_path.write_bytes(b"PK fake xlsx")
    d = {"label": "2026q3", "release_folder": "202611132345", "row_floor": 3,
         "previous_baseline_path": "repd.csv"}
    d.update(kw.pop("descriptor", {}))
    return run.RunContext(repo_root=fake_repo, out_dir=tmp_path / "out", descriptor=d, offline=True,
                          local_csv=csv_path, local_xlsx=xlsx_path, check_pins=False, **kw)


# ---------------------------------------------------------------- interface layer
def test_call_component_passes_only_accepted_kwargs():
    def comp(canonical_csv, out_dir, descriptor=None):
        return {"got": (canonical_csv, out_dir, descriptor)}
    res = run.call_component(comp, {"canonical_csv": "a", "out_dir": "b", "descriptor": {"x": 1}, "extra": 9})
    assert res == {"got": ("a", "b", {"x": 1})}


def test_call_component_reports_interface_mismatch():
    def comp(some_unknown_arg):
        return None
    with pytest.raises(run.StageError, match="interface mismatch.*some_unknown_arg"):
        run.call_component(comp, {"out_dir": "x"})


def test_normalise_result_variants(tmp_path):
    assert run.normalise_result(None) == {}
    assert run.normalise_result(tmp_path) == {"path": str(tmp_path)}
    assert run.normalise_result({"a": 1}) == {"a": 1}


# ------------------------------------------------------------------ path policy
@pytest.mark.parametrize("rel,ok", [
    ("repd-2026q3.csv", True),
    ("repd-grid-batteries-2026q3.csv", True),
    ("dist/project_identity_2026q3.json", True),
    ("dist/repd_master_2026q3.json", True),
    ("dist/project_identity_2026q3_integrity.json", True),
    ("dist/project_identity_2026q3/x.json", False),
    ("uk_renewables_pipeline/202611132345/data/spine.json", True),
    ("docs/repd/releases/2026q3/diff_2026q3.md", True),
    ("repd.csv", False),
    ("dist/repd_master.json", False),
    ("dist/project_identity_v6.json", False),
    ("uk_renewables_pipeline/202609082224/index.html", False),
    ("index.html", False),
    (".github/large-files-allowlist.txt", False),
    ("uk_renewables_pipeline/202611132345/../202609082224/x", False),
])
def test_allowed_new_paths(rel, ok):
    assert run.is_allowed_new_path(rel, "2026q3", "202611132345") is ok


def test_unsafe_label_rejected():
    with pytest.raises(run.StageError):
        run.allowed_new_path_patterns("2026q3; rm -rf /", "202611132345")


def test_large_file_allowlist_semantics(tmp_path):
    (tmp_path / ".github").mkdir()
    (tmp_path / ".github" / "large-files-allowlist.txt").write_text(
        "# comment\nuk_renewables_pipeline/*/fixtures/v6/project_identity_v6.json\n dist/project_identity_v6.json  # x\n")
    pats = run.load_large_file_allowlist(tmp_path)
    assert pats == ["uk_renewables_pipeline/*/fixtures/v6/project_identity_v6.json", "dist/project_identity_v6.json"]
    assert run.large_file_allowed("uk_renewables_pipeline/202611132345/fixtures/v6/project_identity_v6.json", pats)
    assert not run.large_file_allowed("dist/project_identity_2026q3.json", pats)


def test_name_mapping():
    assert run.map_root_name("repd.csv", "2026q3") == "repd-2026q3.csv"
    assert run.map_root_name("dist/repd_master.json", "2026q3") == "dist/repd_master_2026q3.json"
    assert run.map_root_name("repd-2026q3.csv", "2026q3") == "repd-2026q3.csv"
    assert run.map_v6_name("dist/project_identity_v6.json", "2026q3") == "dist/project_identity_2026q3.json"
    assert run.map_v6_name("major_projects_2026q3.json", "2026q3") == "dist/major_projects_2026q3.json"


# ------------------------------------------------------------------- hash guard
def test_hash_manifest_detects_change(fake_repo):
    globs = ["repd.csv", "dist/*.json", "uk_renewables_pipeline/2026*/**"]
    before = run.hash_manifest(fake_repo, globs)
    assert before["file_count"] == 3
    (fake_repo / "repd.csv").write_text("truncated")
    (fake_repo / "uk_renewables_pipeline" / "202610290230" / "data" / "x.json").unlink()
    delta = run.compare_manifests(before, run.hash_manifest(fake_repo, globs))
    assert delta["changed"] == ["repd.csv"]
    assert delta["removed"] == ["uk_renewables_pipeline/202610290230/data/x.json"]


def test_guard_fails_run_when_a_component_writes_into_repo(fake_repo, tmp_path, monkeypatch):
    def evil_clean(csv_path, out_dir):
        (fake_repo / "repd.csv").write_text("overwritten")
        target = Path(out_dir) / "c.csv"
        write_csv(target, ["1", "2", "3", "4"])
        return {"canonical_csv": str(target)}
    comps = {"clean": evil_clean}
    monkeypatch.setattr(run, "find_component",
                        lambda s: (comps[s], f"fake.{s}") if s in comps else (None, "absent"))
    ctx = make_ctx(fake_repo, tmp_path, protected_globs=["repd.csv"])
    report = run.run_pipeline(ctx)
    guard = report["stages"][-1]
    assert guard["stage"] == "hash_guard" and guard["changed"] == ["repd.csv"]
    assert report["overall"] == "failed"


def test_out_dir_inside_repo_refused(fake_repo, tmp_path):
    ctx = make_ctx(fake_repo, tmp_path)
    ctx.out_dir = fake_repo / "out"
    with pytest.raises(run.StageError, match="inside the repository"):
        run.run_pipeline(ctx)


# ------------------------------------------------------------------ end to end
def _fake_components(record: list):
    def clean_release(csv_path, xlsx_path, out_dir, descriptor):
        record.append("clean")
        target = Path(out_dir) / "canonical.csv"
        write_csv(target, ["1", "2", "3", "4"])
        log = Path(out_dir) / "log.json"
        log.write_text("{}")
        return {"canonical_csv": str(target), "cleaning_log": str(log)}

    def validate_release(canonical_csv, previous_csv=None):
        record.append("validate")
        return {"ok": True, "failures": []}

    def build_root(canonical_csv, out_dir):
        record.append("build_root")
        (Path(out_dir) / "dist").mkdir(parents=True, exist_ok=True)
        (Path(out_dir) / "repd.csv").write_text("a\n")
        (Path(out_dir) / "dist" / "repd_master.json").write_text("{}")
        return {"files": ["repd.csv", "dist/repd_master.json"]}

    def build_v6(canonical_csv, out_dir, label):
        record.append("build_v6")
        p = Path(out_dir) / "project_identity_v6.json"
        p.write_text("{}")
        return {"files": {"dist/project_identity_v6.json": str(p)}}

    def build_news(canonical_csv, out_dir, release_folder):
        record.append("build_news")
        p = Path(out_dir) / release_folder / "data" / "spine.json"
        p.parent.mkdir(parents=True)
        p.write_text("[]")
        return {}  # no file list: orchestrator scans out_dir
    return {"clean": clean_release, "validate": validate_release, "build_root": build_root,
            "build_v6": build_v6, "build_news": build_news}


def test_full_pipeline_with_components(fake_repo, tmp_path, monkeypatch):
    record: list[str] = []
    comps = _fake_components(record)
    monkeypatch.setattr(run, "find_component",
                        lambda s: (comps[s], f"fake.{s}") if s in comps else (None, f"module {s} not present"))
    ctx = make_ctx(fake_repo, tmp_path)
    report = run.run_pipeline(ctx)
    assert report["overall"] == "ok", json.dumps(report["stages"], indent=1, default=str)
    assert record == ["clean", "validate", "build_root", "build_v6", "build_news"]
    status = {s["stage"]: s["status"] for s in report["stages"]}
    assert status["clean"] == "ran" and status["diff"] == "fallback" and status["hash_guard"] == "ran"
    manifest = json.loads((ctx.out_dir / "pr_manifest.json").read_text())
    paths = {f["path"] for f in manifest["files"]}
    assert {"repd-2026q3.csv", "dist/repd_master_2026q3.json", "dist/project_identity_2026q3.json",
            "uk_renewables_pipeline/202611132345/data/spine.json",
            "data/repd/2026q3/REPD_canonical_2026q3.csv"} <= paths
    for p in paths:
        assert (ctx.out_dir / "pr" / p).is_file()
    assert (ctx.out_dir / "run_report.md").read_text().startswith("# REPD release candidate 2026q3 (OK)")


def test_missing_build_components_make_run_incomplete(fake_repo, tmp_path, monkeypatch):
    record: list[str] = []
    comps = {k: v for k, v in _fake_components(record).items() if k in ("clean",)}
    monkeypatch.setattr(run, "find_component",
                        lambda s: (comps[s], f"fake.{s}") if s in comps else (None, f"module {s} not present"))
    ctx = make_ctx(fake_repo, tmp_path)
    report = run.run_pipeline(ctx)
    status = {s["stage"]: s["status"] for s in report["stages"]}
    assert status["validate"] == "fallback" and status["build_root"] == "missing"
    assert report["overall"] == "incomplete"
    ctx2 = make_ctx(fake_repo, tmp_path / "b", allow_partial=True)
    assert run.run_pipeline(ctx2)["overall"] == "partial"


def test_existing_release_folder_refused(fake_repo, tmp_path, monkeypatch):
    record: list[str] = []
    comps = _fake_components(record)
    monkeypatch.setattr(run, "find_component",
                        lambda s: (comps[s], f"fake.{s}") if s in comps else (None, "absent"))
    ctx = make_ctx(fake_repo, tmp_path, descriptor={"release_folder": "202610290230"})
    report = run.run_pipeline(ctx)
    failed = [s for s in report["stages"] if s["status"] == "failed"]
    assert failed and failed[0]["stage"] == "assemble_pr" and "already exists" in failed[0]["error"]


def test_sha_mismatch_fails_closed(fake_repo, tmp_path, no_components):
    ctx = make_ctx(fake_repo, tmp_path, descriptor={"expected_csv_sha256": "0" * 64})
    report = run.run_pipeline(ctx)
    assert report["stages"][1]["stage"] == "fetch" and report["stages"][1]["status"] == "failed"
    assert report["overall"] == "failed"


def test_fallback_validate_rejects_duplicates(fake_repo, tmp_path, monkeypatch):
    def clean(csv_path, out_dir):
        t = Path(out_dir) / "c.csv"
        write_csv(t, ["1", "2", "2", "4"])
        return {"canonical_csv": str(t)}
    monkeypatch.setattr(run, "find_component", lambda s: (clean, "fake.clean") if s == "clean" else (None, "absent"))
    report = run.run_pipeline(make_ctx(fake_repo, tmp_path))
    v = [s for s in report["stages"] if s["stage"] == "validate"][0]
    assert v["status"] == "failed" and "duplicate" in v["error"]


def test_oversize_file_excluded_and_proposed(fake_repo, tmp_path, monkeypatch):
    record: list[str] = []
    comps = _fake_components(record)

    def big_v6(canonical_csv, out_dir):
        p = Path(out_dir) / "project_identity_v6.json"
        p.write_bytes(b"0" * (run.MAX_PR_FILE_BYTES + 1))
        return {"files": [str(p)]}
    comps["build_v6"] = big_v6
    monkeypatch.setattr(run, "find_component", lambda s: (comps[s], f"fake.{s}") if s in comps else (None, "absent"))
    ctx = make_ctx(fake_repo, tmp_path)
    report = run.run_pipeline(ctx)
    assert report["overall"] == "ok"
    manifest = json.loads((ctx.out_dir / "pr_manifest.json").read_text())
    assert [o["path"] for o in manifest["excluded_oversize"]] == ["dist/project_identity_2026q3.json"]
    assert "dist/project_identity_2026q3.json" in (ctx.out_dir / "proposed_large_files_allowlist_additions.txt").read_text()


# ---------------------------------------------------------------------- detect
CONTENT = {
    "public_updated_at": "2026-11-13T09:30:00Z",
    "details": {"attachments": [
        {"url": "https://assets.publishing.service.gov.uk/media/a/REPD_Publication_Q2_2026.csv"},
        {"url": "https://assets.publishing.service.gov.uk/media/b/REPD_Publication_Q2_2026.xlsx"},
        {"url": "https://assets.publishing.service.gov.uk/media/c/REPD_Publication_Q3_2026.csv"},
        {"url": "https://assets.publishing.service.gov.uk/media/d/REPD_Publication_Q3_2026.xlsx"},
        {"url": "https://assets.publishing.service.gov.uk/media/e/REPD_Publication_Q4_2026.csv"},
    ]},
}


def test_fallback_detect_picks_newest_complete_pair():
    res = run.fallback_detect(lambda url: json.dumps(CONTENT).encode())
    assert res["label"] == "2026q3" and res["csv_url"].endswith("/c/REPD_Publication_Q3_2026.csv")


def test_detect_only_report(tmp_path, monkeypatch):
    monkeypatch.setattr(run, "find_component", lambda s: (None, "absent"))
    args = run.build_arg_parser().parse_args(["--detect-only", "--out", str(tmp_path)])
    assert run.detect_only(args, fetcher=lambda url: json.dumps(CONTENT).encode()) == 0
    rep = json.loads((tmp_path / "detect_report.json").read_text())
    assert rep["label"] == "2026q3" and rep["new_release"] is False


def test_resolve_descriptor_validation(monkeypatch):
    monkeypatch.setattr(run, "find_component", lambda s: (None, "absent"))
    d, obj = run.resolve_descriptor("2026q3", None, {})
    assert obj is None
    assert d["release_folder"] == "202611132345" and d["row_floor"] == 14657
    with pytest.raises(run.StageError):
        run.resolve_descriptor("2026q3", None, {"release_folder": "../x"})
    with pytest.raises(run.StageError):
        run.resolve_descriptor("2026q3", None, {"expected_csv_sha256": "nothex"})


# -------------------------------------------------------------------- workflows
yaml = pytest.importorskip("yaml")


def _on(doc):
    return doc.get("on", doc.get(True))


def test_release_candidate_workflow_is_manual_and_safe():
    text = WF.read_text(encoding="utf-8")
    doc = yaml.safe_load(text)
    assert list(_on(doc)) == ["workflow_dispatch"]
    assert doc["permissions"] == {"contents": "read"}
    assert doc["jobs"]["build"]["permissions"] == {"contents": "read"}
    assert doc["jobs"]["draft-pr"]["permissions"] == {"contents": "write", "pull-requests": "write"}
    assert "--draft" in text
    assert not re.search(r"HEAD:main|origin main\b|push origin HEAD\b|refs/heads/main", text)
    assert "deploy-pages" not in json.dumps(doc["jobs"])  # never calls the deploy
    assert "pages: write" not in text and "secrets." not in text
    # inputs reach shells only through env
    for job in doc["jobs"].values():
        for step in job["steps"]:
            assert "${{ inputs." not in step.get("run", ""), step.get("name")


def test_disabled_check_is_report_only():
    doc = yaml.safe_load(WF_CHECK.read_text(encoding="utf-8"))
    assert set(_on(doc)) == {"workflow_dispatch", "schedule"}
    assert doc["permissions"] == {"contents": "read"}
    assert "git push" not in WF_CHECK.read_text() and "gh pr" not in WF_CHECK.read_text()


def _freeze_text_from(repo_root: Path):
    src = repo_root / ".github" / "workflows" / "000_freeze_all_workflows_to_manual.yml"
    if not src.is_file():
        return None
    body = yaml.safe_load(src.read_text())["jobs"]["freeze-workflows"]["steps"][1]["run"]
    import textwrap
    code = textwrap.dedent(body.split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0])
    # Keep only the pure function definitions (the script's mkdir/IO lines are cut away).
    code = "import re\n" + "def is_on_line" + code.split("def is_on_line", 1)[1].split("changed_files = []", 1)[0]
    ns: dict = {}
    exec(code, ns)
    return ns["freeze_text"]


def test_workflow_is_fixed_point_of_freeze():
    root = Path(os.environ.get("REPD_REPO_ROOT", REPO))
    freeze_text = _freeze_text_from(root)
    if freeze_text is None:
        pytest.skip("000_freeze_all_workflows_to_manual.yml not available (set REPD_REPO_ROOT)")
    text = WF.read_text(encoding="utf-8")
    new, changed, _ = freeze_text(text)
    assert not changed and new == text


# ------------------------------------------------------------ explicit adapters
def test_adapter_clean_calls_component_main(fake_repo, tmp_path, monkeypatch):
    calls = {}

    def main(argv):
        calls["argv"] = argv
        out = Path(argv[argv.index("--out") + 1])
        name = argv[argv.index("--output-name") + 1]
        write_csv(out / name, ["1", "2", "3", "4"])
        (out / "cleaning_log.json").write_text(json.dumps({"output": {"rows": 4, "sha256": "x"}, "counts": {}}))
        return 0
    fake = types.SimpleNamespace(__name__="automation.repd.clean", main=main, clean=object(),
                                 CleaningRejected=Exception)
    monkeypatch.setattr(run, "load_module", lambda name: fake if name == "clean" else None)
    report = run.run_pipeline(make_ctx(fake_repo, tmp_path))
    st = {s["stage"]: s for s in report["stages"]}
    assert st["clean"]["status"] == "ran" and "adapter adapt_clean" in st["clean"]["impl"]
    assert "--overwrite" in calls["argv"] and st["clean"]["result"]["rows"] == 4


def test_adapter_clean_rejection_fails_closed(fake_repo, tmp_path, monkeypatch):
    def main(argv):
        out = Path(argv[argv.index("--out") + 1])
        (out / "cleaning_log.json").write_text(json.dumps({"status": "REJECTED", "reasons": ["conflicting duplicate 7679"]}))
        return 1
    fake = types.SimpleNamespace(__name__="automation.repd.clean", main=main, clean=object(), CleaningRejected=Exception)
    monkeypatch.setattr(run, "load_module", lambda name: fake if name == "clean" else None)
    report = run.run_pipeline(make_ctx(fake_repo, tmp_path))
    st = {s["stage"]: s for s in report["stages"]}
    assert st["clean"]["status"] == "failed" and "conflicting duplicate 7679" in st["clean"]["error"]
    assert report["overall"] == "failed"


def test_adapter_diff_uses_component_run(fake_repo, tmp_path, monkeypatch):
    seen = {}

    def run_diff(previous, new, out_dir, previous_label, new_label):
        seen.update(previous=previous, new=new)
        Path(out_dir, "changelog.md").write_text("# changes\n")
        Path(out_dir, "diff.json").write_text("{}")
        return {"summary": {"added": 1}}
    fake_clean = types.SimpleNamespace(__name__="automation.repd.clean")  # lacks main: not applicable
    fake_diff = types.SimpleNamespace(__name__="automation.repd.diff", run=run_diff, build_diff=1, render_md=1)
    mods = {"diff": fake_diff}
    monkeypatch.setattr(run, "load_module", lambda name: mods.get(name))
    monkeypatch.setattr(run, "find_component", lambda s: (_fake_components([])["clean"], "fake.clean") if s == "clean" else (None, "absent"))
    ctx = make_ctx(fake_repo, tmp_path)
    report = run.run_pipeline(ctx)
    st = {s["stage"]: s for s in report["stages"]}
    assert st["diff"]["status"] == "ran" and st["diff"]["result"]["summary"] == {"added": 1}
    assert seen["previous"].endswith("repd.csv")  # no dist/project_identity_v6.json in the fake repo
    paths = {f["path"] for f in json.loads((ctx.out_dir / "pr_manifest.json").read_text())["files"]}
    assert "docs/repd/releases/2026q3/changelog_2026q3.md" in paths


def test_acceptance_stage_runs_on_root_outputs(fake_repo, tmp_path, monkeypatch):
    record: list[str] = []
    comps = _fake_components(record)

    def build_root(canonical_csv, out_dir):
        names = ["repd.csv", "repd-grid-batteries.csv", "repd-solar-operational.csv",
                 "repd-solar-operational-over-4mw.csv", "dist/repd_master.json"]
        for n in names:
            (Path(out_dir) / n).parent.mkdir(parents=True, exist_ok=True)
            (Path(out_dir) / n).write_text("x\n")
        return {"files": names}
    comps["build_root"] = build_root
    seen = {}

    def acc_main(argv):
        seen["argv"] = argv
        Path(argv[argv.index("--json") + 1]).write_text("{}")
        return 0
    fake_acc = types.SimpleNamespace(__name__="automation.repd.tests.acceptance", main=acc_main)
    monkeypatch.setattr(run, "load_module", lambda name: fake_acc if name == "tests.acceptance" else None)
    monkeypatch.setattr(run, "find_component", lambda s: (comps[s], f"fake.{s}") if s in comps else (None, "absent"))
    ctx = make_ctx(fake_repo, tmp_path)
    report = run.run_pipeline(ctx)
    st = {s["stage"]: s for s in report["stages"]}
    assert st["acceptance"]["status"] == "ran", st["acceptance"]
    assert seen["argv"][seen["argv"].index("--full") + 1] == "repd-2026q3.csv"
    paths = {f["path"] for f in json.loads((ctx.out_dir / "pr_manifest.json").read_text())["files"]}
    assert "docs/repd/releases/2026q3/acceptance_2026q3.json" in paths
