#!/usr/bin/env python3
"""REPD release-candidate orchestrator.

One command runs the whole quarterly pipeline and writes everything under --out:

    detect -> fetch -> clean -> validate -> diff -> build (root, v6, news)
           -> acceptance (optional) -> assemble PR tree -> hash guard -> run report

Nothing inside the repository is written. The repository is read (component code,
previous-release baseline, existing paths) and its protected files are hashed before
and after the run; any difference fails the run ("no truncation of previous work").

Each stage is a plain function ``stage_<name>(ctx) -> dict`` and calls the component
module ``automation.repd.<module>`` when it exists (see STAGES and NOTES.md for the
interface). When a component is absent, the stage either runs a small, clearly
labelled fallback (detect/fetch/clean/validate/diff) or is reported as MISSING
(build stages). A run with a MISSING stage exits 3 unless --allow-partial is given.

Examples
    python -m automation.repd.run --label 2026q3 --offline \
        --csv REPD_Publication_Q3_2026.csv --xlsx REPD_Publication_Q3_2026.xlsx \
        --out /tmp/repd-out
    python -m automation.repd.run --label 2026q3 --out "$RUNNER_TEMP/repd-out"
    python -m automation.repd.run --detect-only --out /tmp/repd-detect
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import fnmatch
import hashlib
import importlib
import inspect
import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Callable

if __package__ in (None, ""):
    # Allow ``python automation/repd/run.py`` as well as ``python -m automation.repd.run``.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

PACKAGE = "automation.repd"
RUN_SCHEMA = "globalgrid2050.repd-run-report.v1"
SOURCE_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
CONTENT_API = "https://www.gov.uk/api/content/government/publications/renewable-energy-planning-database-quarterly-extract"
MAX_PR_FILE_BYTES = 5 * 1024 * 1024  # pr-file-size-guard.yml MAX_MB: '5'
LARGE_FILE_ALLOWLIST = ".github/large-files-allowlist.txt"
LABEL_RE = re.compile(r"^20[0-9]{2}q[1-4]$")
FOLDER_RE = re.compile(r"^20[0-9]{10}$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
CODE_ROOT = Path(__file__).resolve().parents[2]  # the checkout that holds automation/ and scripts/

# Built-in descriptors, used only when automation.repd.config is absent.
KNOWN_RELEASES: dict[str, dict[str, Any]] = {
    "2026q3": {
        "label": "2026q3",
        "quarter": "Q3 2026",
        "title": "Renewable Energy Planning Database (REPD): October 2026 (Q3 2026)",
        "published": "2026-11-13",
        "release_folder": "202611132345",
        "csv_url": "https://assets.publishing.service.gov.uk/media/6af42ff0a4004bdbe54e54a5/REPD_Publication_Q3_2026.csv",
        "xlsx_url": "https://assets.publishing.service.gov.uk/media/6af42ffdb83b3cae0d0a21c9/REPD_Publication_Q3_2026.xlsx",
        "expected_csv_sha256": "48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862",
        "expected_xlsx_sha256": "87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea",
        "expected_rows": 14968,
        "expected_unique_refs": 14967,
        # Last independently validated unique-ref count (July 2026, Q2): row floor.
        "row_floor": 14657,
        # January-era root file; the July official bytes are not in the repo.
        "previous_baseline_path": "repd.csv",
    },
}

# Files that later releases and gates pin by hash (crawl notes 03, 04, 13, 16).
# Globs are relative to the repo root. Missing paths are recorded, not an error.
PROTECTED_GLOBS = [
    "repd.csv",
    "repd-grid-batteries.csv",
    "repd-solar-operational.csv",
    "repd-solar-operational-over-4mw.csv",
    "dist/*.json",
    "dist/*.txt",
    "uk_renewables_pipeline/*.html",
    "uk_renewables_pipeline/2026*/**",
    "uk_renewables_pipeline/v*/**",
    "pipelinenews_intelligence/**",
    "homepage_versions/**",
    "homepage_v127.html",
    "homepage-before-four-nests-20260925.html",
    "index.html",
    ".github/large-files-allowlist.txt",
    ".github/workflows/*.yml",
]
QUICK_PROTECTED_GLOBS = [g for g in PROTECTED_GLOBS if "**" not in g]

# sha256 prefixes recorded by the crawl (03 section 6). A mismatch means the checkout
# is not the frozen baseline the candidate was designed against: fail closed.
KNOWN_PINS = {
    "dist/repd_master.json": "ca5da437ddb832f7",
    "dist/manifest_v4.json": "9c83f953f36c42326",
    "dist/project_identity_v6.json": "d614084c05c03808",
    "dist/major_projects_v6.json": "ad04f772189868b2",
    "dist/major_project_news_v6.json": "40cd71f34bf0bf46",
    "dist/manifest_v6.json": "c75af73e3cb717fe",
    "dist/repd_source_reconciliation_v6.json": "28715150d3f03659",
    "dist/major_project_news_v9_5_1.json": "cea104c3e9cfc079",
    "uk_renewables_pipeline/dashboard.html": "341da90d9c4de1ad",
}


# --------------------------------------------------------------------------- utils
def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, payload: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False, default=str) + "\n", encoding="utf-8")
    return path


class StageError(RuntimeError):
    """A stage failed closed. The message is shown verbatim in the report."""


@dataclasses.dataclass
class RunContext:
    repo_root: Path
    out_dir: Path
    descriptor: dict[str, Any]
    offline: bool = False
    local_csv: Path | None = None
    local_xlsx: Path | None = None
    previous_csv: Path | None = None
    fetcher: Callable[[str], bytes] | None = None
    allow_partial: bool = False
    protected_globs: list[str] = dataclasses.field(default_factory=lambda: list(PROTECTED_GLOBS))
    check_pins: bool = True
    news_accept_expected: bool = True
    code_root: Path = CODE_ROOT
    artifacts: dict[str, Any] = dataclasses.field(default_factory=dict)
    stages: list[dict[str, Any]] = dataclasses.field(default_factory=list)

    @property
    def label(self) -> str:
        return self.descriptor["label"]

    @property
    def folder(self) -> str:
        return self.descriptor["release_folder"]

    def stage_dir(self, name: str) -> Path:
        path = self.out_dir / "staging" / name
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def pr_dir(self) -> Path:
        return self.out_dir / "pr"


# ------------------------------------------------------------- component plumbing
# stage -> (module, candidate function names in preference order)
STAGES: dict[str, tuple[str, list[str]]] = {
    "config": ("config", ["load_release", "load_descriptor", "get_release", "release_descriptor"]),
    "detect": ("detect", ["detect_latest", "detect_release", "discover_latest", "detect"]),
    "fetch": ("fetch", ["fetch_release", "fetch_sources", "fetch"]),
    "clean": ("clean", ["clean_release", "clean_files", "clean"]),
    "validate": ("validate", ["validate_release", "run_gates", "validate"]),
    "diff": ("diff", ["diff_releases", "diff_release", "build_diff", "diff"]),
    "build_root": ("build_root", ["build_root", "build_root_datasets", "build"]),
    "build_v6": ("build_v6", ["build_v6", "build_v6_candidates", "build"]),
    "build_news": ("build_news", ["build_news", "build_news_release", "build_release_folder", "build"]),
}


def load_module(module_name: str):
    """Import automation.repd.<module_name>; None if that module is absent.

    A component that exists but has a broken import of its own raises (fail loudly)."""
    full = f"{PACKAGE}.{module_name}"
    try:
        return importlib.import_module(full)
    except ModuleNotFoundError as exc:
        if exc.name in (full, PACKAGE, "automation"):
            return None
        raise


def find_component(stage: str) -> tuple[Callable | None, str]:
    """Generic probe: return (callable, "module.func") or (None, reason)."""
    module_name, candidates = STAGES[stage]
    full = f"{PACKAGE}.{module_name}"
    module = load_module(module_name)
    if module is None:
        return None, f"module {full} not present"
    for name in candidates:
        fn = getattr(module, name, None)
        if callable(fn):
            return fn, f"{full}.{name}"
    return None, f"module {full} has none of {candidates}"


def call_component(fn: Callable, pool: dict[str, Any]) -> Any:
    """Call fn with the subset of ``pool`` its signature accepts.

    Aliases let components choose natural parameter names. A required parameter that
    cannot be satisfied is an interface mismatch and fails the stage with its name.
    """
    sig = inspect.signature(fn)
    kwargs: dict[str, Any] = {}
    takes_var_kw = any(p.kind is p.VAR_KEYWORD for p in sig.parameters.values())
    for name, param in sig.parameters.items():
        if param.kind in (param.VAR_POSITIONAL, param.VAR_KEYWORD):
            continue
        if name in pool and pool[name] is not None:
            kwargs[name] = pool[name]
        elif param.default is inspect.Parameter.empty:
            raise StageError(
                f"interface mismatch: {getattr(fn, '__module__', '?')}.{fn.__name__} needs '{name}', "
                f"orchestrator offers {sorted(k for k, v in pool.items() if v is not None)}"
            )
    if takes_var_kw:
        for key, value in pool.items():
            kwargs.setdefault(key, value)
    return fn(**kwargs)


def normalise_result(result: Any) -> dict[str, Any]:
    if result is None:
        return {}
    if isinstance(result, dict):
        return result
    if dataclasses.is_dataclass(result):
        return dataclasses.asdict(result)
    if isinstance(result, (str, os.PathLike)):
        return {"path": str(result)}
    if isinstance(result, tuple):
        return {"result": [str(x) if isinstance(x, os.PathLike) else x for x in result]}
    if hasattr(result, "__dict__"):
        return dict(vars(result))
    return {"result": repr(result)}


def first_path(result: dict[str, Any], *keys: str) -> Path | None:
    for key in keys:
        value = result.get(key)
        if value:
            return Path(value)
    return None


def common_pool(ctx: RunContext, out_dir: Path) -> dict[str, Any]:
    d = ctx.descriptor
    return {
        "ctx": ctx, "context": ctx,
        "descriptor": d, "release": d, "config": d, "release_descriptor": d,
        "label": ctx.label, "release_label": ctx.label, "release_id": ctx.label,
        "release_folder": ctx.folder, "folder_id": ctx.folder,
        "repo_root": ctx.repo_root, "repo": ctx.repo_root, "root": ctx.repo_root,
        "out_dir": out_dir, "out": out_dir, "output_dir": out_dir, "staging_dir": out_dir,
        "offline": ctx.offline, "fetcher": ctx.fetcher,
    }


# ------------------------------------------------------------------- hash guard
def iter_protected(repo_root: Path, globs: list[str]) -> list[str]:
    seen: set[str] = set()
    for pattern in globs:
        for path in repo_root.glob(pattern):
            if path.is_file() and not path.is_symlink():
                seen.add(path.relative_to(repo_root).as_posix())
    return sorted(seen)


def hash_manifest(repo_root: Path, globs: list[str]) -> dict[str, Any]:
    files = {rel: sha256_file(repo_root / rel) for rel in iter_protected(repo_root, globs)}
    return {"generated_utc": utc_now(), "repo_root": str(repo_root), "globs": globs,
            "file_count": len(files), "files": files}


def compare_manifests(before: dict[str, Any], after: dict[str, Any]) -> dict[str, list[str]]:
    b, a = before["files"], after["files"]
    return {
        "changed": sorted(k for k in b.keys() & a.keys() if b[k] != a[k]),
        "removed": sorted(b.keys() - a.keys()),
        "added_in_protected_area": sorted(a.keys() - b.keys()),
    }


def check_known_pins(repo_root: Path) -> list[str]:
    problems = []
    for rel, prefix in KNOWN_PINS.items():
        path = repo_root / rel
        if not path.is_file():
            continue  # sparse checkout or older tree: recorded as absent, not checked
        digest = sha256_file(path)
        if not digest.startswith(prefix):
            problems.append(f"{rel}: sha256 {digest[:16]} does not start with pinned {prefix}")
    return problems


# --------------------------------------------------------------- PR path policy
def allowed_new_path_patterns(label: str, folder: str) -> list[str]:
    """Only these NEW repo paths may appear in the candidate PR (fnmatch, '*' crosses '/')."""
    if not LABEL_RE.match(label) or not FOLDER_RE.match(folder):
        raise StageError(f"refusing unsafe release label/folder {label!r}/{folder!r}")
    return [
        f"repd-{label}.csv",
        f"repd-grid-batteries-{label}.csv",
        f"repd-solar-operational-{label}.csv",
        f"repd-solar-operational-over-4mw-{label}.csv",
        f"dist/*_{label}.json",
        f"dist/*_{label}_*.json",
        f"dist/*_{label}.md",
        f"data/repd/{label}/*",
        f"docs/repd/releases/{label}/*",
        f"uk_renewables_pipeline/{folder}/*",
    ]


def is_allowed_new_path(rel: str, label: str, folder: str) -> bool:
    if rel.startswith("/") or ".." in Path(rel).parts or rel.startswith(".github/"):
        return False
    return any(fnmatch.fnmatchcase(rel, pat) for pat in allowed_new_path_patterns(label, folder))


def load_large_file_allowlist(repo_root: Path) -> list[str]:
    path = repo_root / LARGE_FILE_ALLOWLIST
    if not path.is_file():
        return []
    patterns = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            patterns.append(line)
    return patterns


def large_file_allowed(rel: str, patterns: list[str]) -> bool:
    # bash [[ $p == $pat ]] semantics: '*' also matches '/', same as fnmatchcase.
    return any(fnmatch.fnmatchcase(rel, pat) for pat in patterns)


def paths_existing_in_repo(repo_root: Path, rels: list[str]) -> set[str]:
    """Paths that already exist on disk or in git HEAD (works with sparse checkouts)."""
    existing = {r for r in rels if (repo_root / r).exists()}
    for tracked in git_tracked(repo_root, _top_prefixes(rels)):
        if tracked in rels:
            existing.add(tracked)
    return existing


def git_tracked(repo_root: Path, prefixes: list[str]) -> set[str]:
    if not prefixes:
        return set()
    try:
        proc = subprocess.run(
            ["git", "-C", str(repo_root), "ls-tree", "-r", "--name-only", "HEAD", "--", *prefixes],
            capture_output=True, text=True, check=True, timeout=300,
        )
        return set(proc.stdout.splitlines())
    except (OSError, subprocess.SubprocessError):
        return set()  # not a git checkout: filesystem checks only


def release_folder_exists(repo_root: Path, folder: str) -> bool:
    rel = f"uk_renewables_pipeline/{folder}"
    return (repo_root / rel).exists() or bool(git_tracked(repo_root, [rel]))


def _top_prefixes(rels: list[str]) -> list[str]:
    return sorted({r.split("/", 1)[0] if "/" in r else r for r in rels}) or ["."]


# ------------------------------------------------------------- fallback helpers
def default_fetcher(url: str) -> bytes:  # pragma: no cover - network
    from urllib.request import Request, urlopen
    req = Request(url, headers={"User-Agent": "globalgrid2050-repd-release-candidate/1"})
    with urlopen(req, timeout=120) as resp:
        return resp.read()


def fallback_detect(fetcher: Callable[[str], bytes]) -> dict[str, Any]:
    """Read the gov.uk content API and return the newest REPD CSV/XLSX attachment pair."""
    payload = json.loads(fetcher(CONTENT_API).decode("utf-8"))
    details = payload.get("details", {})
    attachments = details.get("attachments") or details.get("documents") or []
    found: dict[str, dict[str, str]] = {}
    for att in attachments:
        if not isinstance(att, dict):
            continue
        url = att.get("url") or att.get("file_url") or ""
        name = url.rsplit("/", 1)[-1]
        match = re.match(r"REPD_Publication_(Q[1-4])_(20\d\d)\.(csv|xlsx)$", name, re.I)
        if not match:
            continue
        quarter, year, ext = match.group(1).upper(), match.group(2), match.group(3).lower()
        found.setdefault(f"{year}{quarter.lower()}", {})[ext] = url if url.startswith("http") else "https://www.gov.uk" + url
    complete = {k: v for k, v in found.items() if "csv" in v and "xlsx" in v}
    if not complete:
        raise StageError("detect: no REPD_Publication_Q?_YYYY csv+xlsx pair on the publication page")
    latest = max(complete)
    return {"label": latest, "csv_url": complete[latest]["csv"], "xlsx_url": complete[latest]["xlsx"],
            "public_updated_at": payload.get("public_updated_at"), "all_pairs": complete}


def read_csv_frame(path: Path):
    import pandas as pd
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise StageError(f"{path.name}: neither UTF-8 nor cp1252")
    import io
    return pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)


def _ref_column(frame) -> str:
    for col in frame.columns:
        if col.strip().lower() in ("ref id", "ref_id", "repd_ref"):
            return col
    raise StageError("no 'Ref ID' column")


# ------------------------------------------------------- component adapters
# Explicit wiring to the real component entry points (as written by the component
# agents on 2026-11-13). Each adapter takes (module, ctx, out) and returns a result
# dict, or raises NotApplicable to fall through to the generic probe / fallback.
class NotApplicable(Exception):
    pass


def _has(mod, *names: str) -> bool:
    return all(hasattr(mod, n) for n in names)


def _json_load(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def descriptor_from_config(obj: Any) -> dict[str, Any]:
    """automation.repd.config.ReleaseDescriptor -> the orchestrator's flat dict."""
    td = obj.to_dict()
    e = td.get("expected") or {}
    d = json.loads(json.dumps(KNOWN_RELEASES.get(td["release_id"], {})))
    d.update({k: v for k, v in {
        "label": td["release_id"], "release_name": td.get("label"), "quarter": td.get("quarter"),
        "title": td.get("dataset_title"), "csv_url": td.get("csv_url"), "xlsx_url": td.get("xlsx_url"),
        "published": td.get("page_last_updated"), "previous_release_id": td.get("previous_release_id"),
        "previous_baseline_path": td.get("baseline_path"),
        "expected_csv_sha256": e.get("csv_sha256"), "expected_xlsx_sha256": e.get("xlsx_sha256"),
        "expected_csv_bytes": e.get("csv_bytes"), "expected_xlsx_bytes": e.get("xlsx_bytes"),
        "expected_rows": e.get("csv_rows"), "expected_unique_refs": e.get("unique_refs"),
        "duplicate_refs": e.get("duplicate_refs") or None,
    }.items() if v not in (None, "")})
    return d


def adapt_detect(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    fetchmod = load_module("fetch")
    if not (_has(mod, "detect", "parse_content_api") and fetchmod is not None):
        raise NotApplicable
    fetcher = ctx.artifacts.get("component_fetcher") or fetchmod.urllib_fetcher()
    rep = mod.detect(fetcher, "api", ctx.artifacts.get("config_descriptor"))
    write_json(out / "detect_report.json", rep)
    det = rep["descriptor"]
    res = {"status": rep["status"], "detected_release_id": det["release_id"],
           "csv_url": det["csv_url"], "xlsx_url": det["xlsx_url"]}
    if det["release_id"] != ctx.label:
        res["warning"] = f"newest release on gov.uk is {det['release_id']}, run requested {ctx.label}"
    elif rep["status"] == "REPLACED_SAME_QUARTER":
        raise StageError("gov.uk now serves different files for this quarter than the pinned descriptor; "
                         "review the correction and update automation/repd/releases/<id>.json first")
    elif rep["status"] == "NO_BASELINE":
        cfg = load_module("config")
        ctx.artifacts["config_descriptor"] = cfg.ReleaseDescriptor.from_dict(det)
        for key in ("csv_url", "xlsx_url"):
            ctx.descriptor.setdefault(key, det[key])
    return res


def adapt_fetch(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    desc = ctx.artifacts.get("config_descriptor")
    if desc is None or not _has(mod, "fetch_release", "local_fetcher", "urllib_fetcher", "file_name"):
        raise NotApplicable
    if ctx.offline:
        if not (ctx.local_csv and ctx.local_xlsx):
            raise StageError("--offline needs --csv and --xlsx")
        src = out.parent / "offline_src"
        src.mkdir(parents=True, exist_ok=True)
        for url, local in ((desc.csv_url, ctx.local_csv), (desc.xlsx_url, ctx.local_xlsx)):
            shutil.copyfile(local, src / mod.file_name(url))
        fetcher = mod.local_fetcher(src)
    else:
        fetcher = ctx.artifacts.get("component_fetcher") or mod.urllib_fetcher()
    receipt = mod.fetch_release(desc, out, fetcher)
    paths = {f["role"]: out / f["path"] for f in receipt["files"]}
    return {"receipt_status": receipt["status"], "csv_path": str(paths["csv"]), "xlsx_path": str(paths["xlsx"]),
            "receipt": str(out / "fetch_receipt.json"), "offline_local_fetcher": ctx.offline}


def adapt_clean(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    if not _has(mod, "main", "clean", "CleaningRejected"):
        raise NotApplicable
    name = f"REPD_canonical_{ctx.label}.csv"
    argv = ["--csv", str(ctx.artifacts["raw_csv"]), "--xlsx", str(ctx.artifacts["raw_xlsx"]),
            "--out", str(out), "--output-name", name, "--overwrite"]
    for kind in ("csv", "xlsx"):
        if ctx.descriptor.get(f"expected_{kind}_sha256"):
            argv += [f"--expected-{kind}-sha256", ctx.descriptor[f"expected_{kind}_sha256"]]
    code = mod.main(argv)
    log_path = out / "cleaning_log.json"
    log = _json_load(log_path) if log_path.is_file() else {}
    if code != 0:
        raise StageError(f"clean.py exit {code}: " + "; ".join(map(str, log.get("reasons", [log.get("status")])))[:2000])
    return {"canonical_csv": str(out / name), "cleaning_log": str(log_path),
            "cleaning_log_text": str(out / "CLEANING-LOG.txt"),
            "rows": (log.get("output") or {}).get("rows"), "output_sha256": (log.get("output") or {}).get("sha256"),
            "counts": log.get("counts")}


def adapt_validate(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    if not _has(mod, "run_check", "load_baseline", "baseline_from_csv", "load_known"):
        raise NotApplicable
    d = ctx.descriptor
    bdir = Path(mod.__file__).resolve().parent / "baselines"
    bfile = bdir / f"{d.get('previous_release_id')}.json" if d.get("previous_release_id") else None
    if bfile and bfile.is_file():
        baseline = mod.load_baseline(str(bfile))
    elif _previous_csv(ctx):
        baseline = mod.baseline_from_csv(str(_previous_csv(ctx)), "previous")
    else:
        raise StageError("validate: no baseline (automation/repd/baselines/<previous_release_id>.json or a previous CSV)")
    kfile = bdir / f"{ctx.label}_known_anomalies.json"
    known = mod.load_known(str(kfile)) if kfile.is_file() else {}
    kcoord = mod.load_known_coordinates(str(kfile)) if kfile.is_file() and hasattr(mod, "load_known_coordinates") else None
    kw = {"known_coordinates": kcoord} if kcoord is not None else {}
    exp_raw = {k: v for k, v in {
        "rows": d.get("expected_rows"), "unique_refs": d.get("expected_unique_refs"),
        "csv_sha256": d.get("expected_csv_sha256"), "xlsx_sha256": d.get("expected_xlsx_sha256"),
        "csv_bytes": d.get("expected_csv_bytes"), "xlsx_bytes": d.get("expected_xlsx_bytes"),
        "duplicate_refs": d.get("duplicate_refs")}.items() if v is not None}
    raw_rep, _ = mod.run_check(str(ctx.artifacts["raw_csv"]), str(ctx.artifacts["raw_xlsx"]), baseline, known,
                               None, False, False, exp_raw or None, **kw)
    n = d.get("expected_unique_refs")
    cand_rep, _ = mod.run_check(str(ctx.artifacts["canonical_csv"]), None, baseline, known, None, True, False,
                                {"rows": n, "unique_refs": n} if n else None, **kw)
    raw_path = write_json(out / f"validation_raw_{ctx.label}.json", raw_rep)
    cand_path = write_json(out / f"validation_{ctx.label}.json", cand_rep)
    failures = [f"raw:{g}" for g in raw_rep["failed_gates"]] + [f"candidate:{g}" for g in cand_rep["failed_gates"]]
    return {"ok": not failures, "failures": failures, "baseline": str(bfile) if bfile and bfile.is_file() else "previous CSV",
            "known_anomalies": len(known), "raw": {"result": raw_rep["result"], "summary": raw_rep["summary"]},
            "candidate": {"result": cand_rep["result"], "summary": cand_rep["summary"]},
            "reports": [str(raw_path), str(cand_path)]}


def adapt_diff(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    if not _has(mod, "run", "build_diff", "render_md"):
        raise NotApplicable
    d = ctx.descriptor
    prev = d.get("diff_previous_path")
    prev = ctx.repo_root / prev if prev else ctx.repo_root / "dist" / "project_identity_v6.json"
    if not prev.is_file():
        prev = _previous_csv(ctx)
    if not prev:
        raise StageError("diff: no previous release file")
    prev_label = f"{d.get('previous_release_id') or 'previous'} ({prev.name})"
    res = mod.run(str(prev), str(ctx.artifacts["canonical_csv"]), str(out), prev_label,
                  f"{ctx.label} ({d.get('release_name') or d.get('quarter') or ''})".strip())
    return {"summary": res.get("summary"), "baseline": str(prev), "markdown": str(out / "changelog.md"),
            "json": str(out / "diff.json")}


def adapt_build_v6(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    if not _has(mod, "main", "stability_report"):
        raise NotApplicable
    desc = ctx.descriptor.get("v6_descriptor")
    if desc:
        desc = Path(desc)
    else:
        # releases/ is owned by config.load_all() (one ReleaseDescriptor per file), so the V6
        # descriptor belongs in releases_v6/; releases/v6_<id>.json is accepted for now.
        here = Path(mod.__file__).resolve().parent
        cands = [here / "releases_v6" / f"v6_{ctx.label}.json", here / "releases" / f"v6_{ctx.label}.json"]
        desc = next((c for c in cands if c.is_file()), cands[0])
    if not desc.is_file():
        raise StageError(f"build_v6: no V6 descriptor {desc}")
    code = mod.main(["--descriptor", str(desc), "--out", str(out), "--input-root", str(ctx.repo_root),
                     "--csv", str(ctx.artifacts["raw_csv"]), "--xlsx", str(ctx.artifacts["raw_xlsx"])])
    run_json = out / f"build_v6_run_{ctx.label}.json"
    if code != 0:
        tail = ""
        if run_json.is_file():
            tail = json.dumps([s for s in _json_load(run_json)["stages"] if s["returncode"]])[:1500]
        raise StageError(f"build_v6.py exit {code} {tail}")
    files = {f"dist/{p.name}": str(p) for p in sorted((out / "dist").glob("*")) if p.is_file()}
    files[f"docs/repd/releases/{ctx.label}/build_v6_run_{ctx.label}.json"] = str(run_json)
    canon = out / "data" / f"latest_repd_{ctx.label}_canonical.csv"
    if canon.is_file():
        ctx.artifacts["v6_canonical"] = canon
    ctx.artifacts["v6_manifest"] = out / "dist" / f"manifest_{ctx.label}.json"
    return {"files": files, "v6_descriptor": str(desc)}


def adapt_build_news(mod, ctx: RunContext, out: Path) -> dict[str, Any]:
    if not _has(mod, "main", "build_identity", "SPINE_LINE_OLD"):
        raise NotApplicable
    d = ctx.descriptor
    manifest = ctx.artifacts.get("v6_manifest")
    if not manifest or not Path(manifest).is_file():
        raise StageError("build_news needs the V6 source manifest (dist/manifest_<id>.json from build_v6)")
    canonical = ctx.artifacts.get("v6_canonical") or ctx.artifacts["canonical_csv"]
    parent = d.get("news_parent", "202609082224")
    work = out / "repo_copy"
    if work.exists():
        shutil.rmtree(work)
    scripts_src = ctx.code_root / "scripts" if (ctx.code_root / "scripts").is_dir() else ctx.repo_root / "scripts"
    shutil.copytree(scripts_src, work / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(ctx.repo_root / "uk_renewables_pipeline" / parent, work / "uk_renewables_pipeline" / parent,
                    symlinks=True)
    (work / "dist").mkdir()
    cmd = [sys.executable, "-m", f"{PACKAGE}.build_news", "--repo", str(work), "--parent", parent,
           "--release", ctx.folder, "--quarter", ctx.label,
           "--dataset", d.get("news_dataset") or f"DESNZ Renewable Energy Planning Database {d.get('quarter', ctx.label)}",
           "--canonical-csv", str(canonical), "--xlsx", str(ctx.artifacts["raw_xlsx"]),
           "--source-manifest", str(manifest), "--scratch", str(out / "scratch"),
           "--hash-report", str(out / f"news_hash_report_{ctx.label}.json")]
    if d.get("expected_unique_refs"):
        cmd += ["--expected-rows", str(d["expected_unique_refs"])]
    if ctx.news_accept_expected:
        cmd.append("--accept-expected")
    edits = ctx.code_root / "automation" / "repd" / "news_inputs" / f"release_text_edits_{ctx.label}.json"
    if edits.is_file():
        cmd += ["--release-text-edits", str(edits)]
    env = dict(os.environ, PYTHONPATH=str(ctx.code_root) + os.pathsep + os.environ.get("PYTHONPATH", ""))
    proc = subprocess.run(cmd, cwd=str(ctx.code_root), capture_output=True, text=True, env=env, timeout=3600)
    (out / "build_news.log").write_text(proc.stdout + "\n--- stderr ---\n" + proc.stderr, encoding="utf-8")
    if proc.returncode != 0:
        raise StageError("build_news failed: " + (proc.stderr.strip() or proc.stdout.strip())[-1500:])
    release = work / "uk_renewables_pipeline" / ctx.folder
    files = {p.relative_to(work).as_posix(): str(p) for p in sorted(release.rglob("*")) if p.is_file()}
    files[f"docs/repd/releases/{ctx.label}/news_hash_report_{ctx.label}.json"] = str(out / f"news_hash_report_{ctx.label}.json")
    return {"files": files, "parent": parent, "text_edits": str(edits) if edits.is_file() else None,
            "accept_expected": ctx.news_accept_expected, "stdout_tail": proc.stdout.strip().splitlines()[-4:]}


ADAPTERS: dict[str, Callable[..., dict[str, Any]]] = {
    "detect": adapt_detect, "fetch": adapt_fetch, "clean": adapt_clean, "validate": adapt_validate,
    "diff": adapt_diff, "build_v6": adapt_build_v6, "build_news": adapt_build_news,
}


def try_adapter(stage: str, ctx: RunContext, out: Path) -> dict[str, Any] | None:
    module = load_module(STAGES[stage][0])
    adapter = ADAPTERS.get(stage)
    if module is None or adapter is None:
        return None
    try:
        res = adapter(module, ctx, out)
    except NotApplicable:
        return None
    res["impl"] = f"{module.__name__} (adapter {adapter.__name__})"
    return res


# ------------------------------------------------------------------- the stages
def stage_detect(ctx: RunContext) -> dict[str, Any]:
    d = ctx.descriptor
    if ctx.offline:
        return {"impl": "offline: release descriptor (no network)", "status_override": "skipped", "label": ctx.label,
                "csv_url": d.get("csv_url"), "xlsx_url": d.get("xlsx_url")}
    out = ctx.stage_dir("detect")
    res = try_adapter("detect", ctx, out)
    fn, where = (None, "") if res else find_component("detect")
    if res:
        pass
    elif fn:
        res = normalise_result(call_component(fn, common_pool(ctx, out)))
        res["impl"] = where
    else:
        res = fallback_detect(ctx.fetcher or default_fetcher)
        res["impl"] = f"run.py fallback_detect ({where})"
    for key in ("csv_url", "xlsx_url"):
        if res.get(key) and not d.get(key):
            d[key] = res[key]
    if res.get("label") and res["label"] != ctx.label:
        res["warning"] = f"newest release on the page is {res['label']}, run requested {ctx.label}"
    write_json(out / "detect.json", res)
    return res


def stage_fetch(ctx: RunContext) -> dict[str, Any]:
    d = ctx.descriptor
    out = ctx.stage_dir("raw")
    res = try_adapter("fetch", ctx, out)
    fn, where = (None, "") if res else find_component("fetch")
    if res:
        csv_path, xlsx_path = Path(res["csv_path"]), Path(res["xlsx_path"])
    elif fn and not ctx.offline:
        res = normalise_result(call_component(fn, common_pool(ctx, out)))
        res["impl"] = where
        csv_path = first_path(res, "csv_path", "csv", "raw_csv")
        xlsx_path = first_path(res, "xlsx_path", "xlsx", "raw_xlsx")
    else:
        files = {}
        for kind, local in (("csv", ctx.local_csv), ("xlsx", ctx.local_xlsx)):
            if ctx.offline:
                if not local:
                    raise StageError(f"--offline needs --{kind}")
                data = Path(local).read_bytes()
                origin = str(local)
            else:
                url = d.get(f"{kind}_url")
                if not url:
                    raise StageError(f"no {kind}_url in descriptor and detect did not supply one")
                data = (ctx.fetcher or default_fetcher)(url)
                origin = url
            name = f"REPD_{ctx.label}.{kind}" if not local else Path(local).name
            target = out / name
            target.write_bytes(data)
            files[kind] = {"path": str(target), "origin": origin, "bytes": len(data), "sha256": sha256_bytes(data)}
        res = {"impl": "run.py offline copy" if ctx.offline else f"run.py urllib fallback ({where})", "files": files}
        csv_path, xlsx_path = Path(files["csv"]["path"]), Path(files["xlsx"]["path"])
    if not csv_path or not csv_path.is_file() or not xlsx_path or not xlsx_path.is_file():
        raise StageError("fetch did not produce both a CSV and an XLSX file")
    checks = {}
    for kind, path in (("csv", csv_path), ("xlsx", xlsx_path)):
        digest = sha256_file(path)
        expected = (d.get(f"expected_{kind}_sha256") or "").lower()
        checks[kind] = {"path": str(path), "sha256": digest, "expected": expected or None,
                        "match": (digest == expected) if expected else None}
        if expected and digest != expected:
            raise StageError(f"{kind} sha256 {digest} != expected {expected}")
    ctx.artifacts.update(raw_csv=csv_path, raw_xlsx=xlsx_path)
    res["sha256_checks"] = checks
    write_json(out / "fetch.json", res)
    return res


def _reuse_ingest_reconcile(ctx: RunContext, out: Path) -> dict[str, Any]:
    """Fallback clean: reuse scripts/repd_q3_2026_ingest.reconcile from the repo (October-specific)."""
    scripts = ctx.repo_root / "scripts"
    if not (scripts / "repd_q3_2026_ingest.py").is_file():
        raise StageError("no clean component and scripts/repd_q3_2026_ingest.py not in repo")
    if ctx.label != "2026q3":
        raise StageError("fallback clean reuses the October-specific ingest script; it refuses other releases")
    sys.path.insert(0, str(scripts))
    try:
        ingest = importlib.import_module("repd_q3_2026_ingest")
    finally:
        sys.path.remove(str(scripts))
    baseline = ctx.previous_csv or (ctx.repo_root / ctx.descriptor.get("previous_baseline_path", "repd.csv"))
    canonical, report = ingest.reconcile(
        ctx.artifacts["raw_csv"].read_bytes(), ctx.artifacts["raw_xlsx"].read_bytes(),
        Path(baseline).read_bytes(), f"previous baseline {Path(baseline).name}", False,
    )
    log = write_json(out / f"cleaning_log_{ctx.label}.json", report)
    if report.get("failures"):
        raise StageError("clean (reused ingest) failures: " + "; ".join(report["failures"]))
    target = out / f"REPD_canonical_{ctx.label}.csv"
    canonical.to_csv(target, index=False, encoding="utf-8-sig")
    return {"canonical_csv": str(target), "cleaning_log": str(log), "rows": int(len(canonical)),
            "stage_label": report.get("stage")}


def stage_clean(ctx: RunContext) -> dict[str, Any]:
    out = ctx.stage_dir("clean")
    res = try_adapter("clean", ctx, out)
    fn, where = (None, "") if res else find_component("clean")
    if res:
        pass
    elif fn:
        pool = common_pool(ctx, out) | {
            "csv_path": ctx.artifacts["raw_csv"], "xlsx_path": ctx.artifacts["raw_xlsx"],
            "csv": ctx.artifacts["raw_csv"], "xlsx": ctx.artifacts["raw_xlsx"],
            "raw_csv": ctx.artifacts["raw_csv"], "raw_xlsx": ctx.artifacts["raw_xlsx"],
        }
        res = normalise_result(call_component(fn, pool))
        res["impl"] = where
    else:
        res = _reuse_ingest_reconcile(ctx, out)
        res["impl"] = f"fallback: scripts/repd_q3_2026_ingest.reconcile ({where})"
    canonical = first_path(res, "canonical_csv", "canonical", "csv_path", "path")
    if not canonical or not canonical.is_file():
        raise StageError("clean did not report an existing canonical_csv")
    ctx.artifacts["canonical_csv"] = canonical
    log = first_path(res, "cleaning_log", "log_json", "log")
    if log:
        ctx.artifacts["cleaning_log"] = log
    return res


def _previous_csv(ctx: RunContext) -> Path | None:
    if ctx.previous_csv:
        return Path(ctx.previous_csv)
    rel = ctx.descriptor.get("previous_baseline_path")
    return (ctx.repo_root / rel) if rel and (ctx.repo_root / rel).is_file() else None


def stage_validate(ctx: RunContext) -> dict[str, Any]:
    out = ctx.stage_dir("validate")
    canonical = ctx.artifacts["canonical_csv"]
    res = try_adapter("validate", ctx, out)
    fn, where = (None, "") if res else find_component("validate")
    if res:
        if not res["ok"]:
            raise StageError("validation gates failed: " + "; ".join(res["failures"]))
        ctx.artifacts["validation_reports"] = res["reports"]
        return res
    if fn:
        pool = common_pool(ctx, out) | {
            "canonical_csv": canonical, "csv_path": canonical, "input_csv": canonical,
            "previous_csv": _previous_csv(ctx), "baseline_csv": _previous_csv(ctx),
            "raw_xlsx": ctx.artifacts.get("raw_xlsx"), "xlsx_path": ctx.artifacts.get("raw_xlsx"),
        }
        res = normalise_result(call_component(fn, pool))
        res["impl"] = where
        ok = res.get("ok", res.get("passed", res.get("pass")))
        failures = res.get("failures") or res.get("errors") or []
        if ok is False or failures:
            write_json(out / "validation.json", res)
            raise StageError("validation gates failed: " + "; ".join(map(str, failures))[:2000])
    else:
        frame = read_csv_frame(canonical)
        ref = _ref_column(frame)
        refs = frame[ref].str.strip()
        failures = []
        if len(frame.columns) != 53:
            failures.append(f"expected 53 columns, found {len(frame.columns)}")
        if (refs == "").any():
            failures.append(f"{int((refs == '').sum())} blank Ref IDs")
        if refs.duplicated().any():
            failures.append(f"{int(refs.duplicated().sum())} duplicate Ref IDs after cleaning")
        floor = int(ctx.descriptor.get("row_floor") or 0)
        if len(frame) < floor:
            failures.append(f"{len(frame)} rows below floor {floor}")
        exp = ctx.descriptor.get("expected_unique_refs")
        if exp and refs.nunique() != int(exp):
            failures.append(f"{refs.nunique()} unique refs != expected {exp}")
        res = {"impl": f"run.py minimal gates ({where})", "rows": int(len(frame)),
               "columns": int(len(frame.columns)), "unique_refs": int(refs.nunique()),
               "row_floor": floor, "failures": failures, "ok": not failures}
        write_json(out / "validation.json", res)
        if failures:
            raise StageError("validation gates failed: " + "; ".join(failures))
    write_json(out / "validation.json", res)
    ctx.artifacts["validation_json"] = out / "validation.json"
    return res


def stage_diff(ctx: RunContext) -> dict[str, Any]:
    out = ctx.stage_dir("diff")
    prev = _previous_csv(ctx)
    if not prev:
        return {"impl": "skipped", "note": "no previous baseline available", "status_override": "skipped"}
    canonical = ctx.artifacts["canonical_csv"]
    res = try_adapter("diff", ctx, out)
    fn, where = (None, "") if res else find_component("diff")
    if res:
        pass
    elif fn:
        pool = common_pool(ctx, out) | {
            "previous_csv": prev, "old_csv": prev, "baseline_csv": prev, "old": prev, "previous": prev,
            "current_csv": canonical, "new_csv": canonical, "canonical_csv": canonical, "new": canonical, "current": canonical,
        }
        res = normalise_result(call_component(fn, pool))
        res["impl"] = where
    else:
        old, new = read_csv_frame(prev), read_csv_frame(canonical)
        o = set(old[_ref_column(old)].str.strip())
        n = set(new[_ref_column(new)].str.strip())
        res = {"impl": f"run.py ref-set diff ({where})", "baseline": str(prev),
               "baseline_unique_refs": len(o), "current_unique_refs": len(n),
               "added": len(n - o), "removed": len(o - n), "common": len(n & o),
               "added_examples": sorted(n - o, key=lambda x: (len(x), x))[:20],
               "removed_examples": sorted(o - n, key=lambda x: (len(x), x))[:20]}
        md = out / f"diff_{ctx.label}.md"
        md.write_text(
            f"# REPD {ctx.label} vs {prev.name}\n\nBaseline unique refs: {len(o)}\n\n"
            f"Current unique refs: {len(n)}\n\nAdded: {len(n - o)}; removed: {len(o - n)}; common: {len(n & o)}\n",
            encoding="utf-8")
        res["markdown"] = str(md)
        write_json(out / f"diff_{ctx.label}.json", res)
        res["json"] = str(out / f"diff_{ctx.label}.json")
    ctx.artifacts["diff"] = res
    return res


ROOT_NAME_MAP = {
    "repd.csv": "repd-{label}.csv",
    "repd-grid-batteries.csv": "repd-grid-batteries-{label}.csv",
    "repd-solar-operational.csv": "repd-solar-operational-{label}.csv",
    "repd-solar-operational-over-4mw.csv": "repd-solar-operational-over-4mw-{label}.csv",
    "dist/repd_master.json": "dist/repd_master_{label}.json",
    "dist/manifest_v4.json": "dist/manifest_v4_{label}.json",
}


def map_root_name(rel: str, label: str) -> str:
    rel = rel.replace("\\", "/")
    if rel in ROOT_NAME_MAP:
        return ROOT_NAME_MAP[rel].format(label=label)
    base = Path(rel).name
    if base in ROOT_NAME_MAP:
        return ROOT_NAME_MAP[base].format(label=label)
    if f"dist/{base}" in ROOT_NAME_MAP:
        return ROOT_NAME_MAP[f"dist/{base}"].format(label=label)
    return rel


def map_v6_name(rel: str, label: str) -> str:
    """dist/project_identity_v6.json -> dist/project_identity_2026q3.json; labelled names kept."""
    rel = rel.replace("\\", "/")
    p = Path(rel)
    if label in p.name:
        return rel if rel.startswith("dist/") else f"dist/{p.name}"
    stem = re.sub(r"_v6$", "", p.stem)
    return f"dist/{stem}_{label}{p.suffix}"


def _collect_files(res: dict[str, Any], out: Path) -> dict[str, Path]:
    """Return {relative repo path: file} from a build result or, failing that, from out/."""
    files = res.get("files") or res.get("outputs") or res.get("written")
    mapping: dict[str, Path] = {}
    if isinstance(files, dict):
        for rel, path in files.items():
            mapping[str(rel)] = Path(path)
    elif isinstance(files, list):
        for item in files:
            path = Path(item["path"] if isinstance(item, dict) else item)
            if not path.is_absolute():
                path = out / path
            try:
                rel = path.relative_to(out).as_posix()
            except ValueError:
                rel = path.name
            mapping[rel] = path
    else:
        for path in sorted(out.rglob("*")):
            if path.is_file():
                mapping[path.relative_to(out).as_posix()] = path
    return mapping


def _build_stage(ctx: RunContext, stage: str, mapper: Callable[[str], str]) -> dict[str, Any]:
    out = ctx.stage_dir(stage)
    res = try_adapter(stage, ctx, out)
    if res is None:
        fn, where = find_component(stage)
        if not fn:
            return {"impl": where, "status_override": "missing",
                    "note": f"component automation/repd/{STAGES[stage][0]}.py not present; nothing built"}
        canonical = ctx.artifacts["canonical_csv"]
        pool = common_pool(ctx, out) | {
            "canonical_csv": canonical, "csv_path": canonical, "input_csv": canonical, "source_csv": canonical,
            "previous_csv": _previous_csv(ctx), "diff": ctx.artifacts.get("diff"),
            "label_suffix": ctx.label, "suffix": ctx.label, "raw_csv": ctx.artifacts.get("raw_csv"),
            "raw_xlsx": ctx.artifacts.get("raw_xlsx"), "xlsx_path": ctx.artifacts.get("raw_xlsx"),
        }
        res = normalise_result(call_component(fn, pool))
        res["impl"] = where
        files = _collect_files(res, out)
    else:
        files = {rel: Path(p) for rel, p in res.pop("files").items()}  # adapters give final repo paths
        mapper = lambda rel: rel  # noqa: E731
    staged = {}
    for rel, path in files.items():
        if not path.is_file():
            raise StageError(f"{stage}: reported file {path} does not exist")
        staged[mapper(rel)] = str(path)
    ctx.artifacts.setdefault("pr_files", {}).update(staged)
    res["pr_paths"] = sorted(staged)
    return res


def stage_build_root(ctx: RunContext) -> dict[str, Any]:
    return _build_stage(ctx, "build_root", lambda rel: map_root_name(rel, ctx.label))


def stage_build_v6(ctx: RunContext) -> dict[str, Any]:
    return _build_stage(ctx, "build_v6", lambda rel: map_v6_name(rel, ctx.label))


def stage_build_news(ctx: RunContext) -> dict[str, Any]:
    prefix = f"uk_renewables_pipeline/{ctx.folder}/"

    def mapper(rel: str) -> str:
        rel = rel.replace("\\", "/")
        if rel.startswith(prefix):
            return rel
        rel = re.sub(r"^uk_renewables_pipeline/[^/]+/", "", rel)
        if rel.startswith(ctx.folder + "/"):
            rel = rel[len(ctx.folder) + 1:]
        return prefix + rel
    return _build_stage(ctx, "build_news", mapper)


def acceptance_waivers(label: str, base: Path | None = None) -> list[str]:
    """REF:COLUMN cells listed under "acceptance_waive_cells" in baselines/<label>_known_anomalies.json."""
    path = (base or Path(__file__).resolve().parent / "baselines") / f"{label}_known_anomalies.json"
    if not path.is_file():
        return []
    cells = json.loads(path.read_text(encoding="utf-8")).get("acceptance_waive_cells") or []
    bad = [c for c in cells if not isinstance(c, str) or ":" not in c or not c.split(":", 1)[0].strip()]
    if bad:
        raise StageError(f"acceptance_waive_cells in {path.name} must be 'REF:COLUMN' strings: {bad}")
    return list(cells)


def stage_acceptance(ctx: RunContext) -> dict[str, Any]:
    """Optional end-to-end gate (automation/repd/tests/acceptance.py) on the root-format datasets."""
    out = ctx.stage_dir("acceptance")
    mod = load_module("tests.acceptance")
    if mod is None or not _has(mod, "main"):
        return {"impl": "module automation.repd.tests.acceptance not present", "status_override": "skipped"}
    pr_files = ctx.artifacts.get("pr_files", {})
    names = {key: ROOT_NAME_MAP[src].format(label=ctx.label) for key, src in (
        ("--full", "repd.csv"), ("--batteries", "repd-grid-batteries.csv"),
        ("--solar-op", "repd-solar-operational.csv"), ("--over4", "repd-solar-operational-over-4mw.csv"),
        ("--master", "dist/repd_master.json"))}
    if not all(n in pr_files for n in names.values()):
        return {"impl": f"{mod.__name__}.main", "status_override": "skipped",
                "note": "root-format datasets were not built (build_root missing); nothing to accept"}
    root = out / "root"
    for rel in names.values():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(pr_files[rel], root / rel)
    argv = ["--official-csv", str(ctx.artifacts["raw_csv"]), "--official-xlsx", str(ctx.artifacts["raw_xlsx"]),
            "--cleaned", str(ctx.artifacts["canonical_csv"]), "--root-dir", str(root),
            "--json", str(out / f"acceptance_{ctx.label}.json")]
    for flag, rel in names.items():
        argv += [flag, rel]
    if (ctx.repo_root / "dist" / "repd_master.json").is_file():
        argv += ["--baseline-master", str(ctx.repo_root / "dist" / "repd_master.json")]
    # Source cells the official CSV cannot carry exactly (e.g. a character outside cp1252 that the
    # CSV shows as '?') differ from the workbook by construction. They are listed, reviewed, under
    # "acceptance_waive_cells" in baselines/<label>_known_anomalies.json and passed as --waive-cell,
    # which acceptance.py reports as waived (never silently). Nothing else is waived.
    waivers = acceptance_waivers(ctx.label)
    for cell in waivers:
        argv += ["--waive-cell", cell]
    code = mod.main(argv)
    if code != 0:
        raise StageError(f"acceptance.py exit {code}; see {out / f'acceptance_{ctx.label}.json'}")
    ctx.artifacts.setdefault("validation_reports", []).append(str(out / f"acceptance_{ctx.label}.json"))
    return {"impl": f"{mod.__name__}.main", "report": str(out / f"acceptance_{ctx.label}.json"),
            "waived_cells": waivers}


def stage_assemble(ctx: RunContext) -> dict[str, Any]:
    """Copy allow-listed NEW paths into out/pr and write pr_manifest.json."""
    files: dict[str, str] = dict(ctx.artifacts.get("pr_files", {}))
    docs = f"docs/repd/releases/{ctx.label}/"
    data = f"data/repd/{ctx.label}/"
    if ctx.artifacts.get("canonical_csv"):
        files[f"{data}REPD_canonical_{ctx.label}.csv"] = str(ctx.artifacts["canonical_csv"])
    if ctx.artifacts.get("cleaning_log"):
        files[f"{docs}cleaning_log_{ctx.label}.json"] = str(ctx.artifacts["cleaning_log"])
    if ctx.artifacts.get("validation_json"):
        files[f"{docs}validation_{ctx.label}.json"] = str(ctx.artifacts["validation_json"])
    for rep_path in ctx.artifacts.get("validation_reports", []):
        files[docs + Path(rep_path).name] = rep_path
    diff = ctx.artifacts.get("diff") or {}
    for key, name in (("markdown", f"changelog_{ctx.label}.md"), ("json", f"diff_{ctx.label}.json"),
                      ("md", f"diff_{ctx.label}.md"), ("report_md", f"diff_{ctx.label}.md"),
                      ("report_json", f"diff_{ctx.label}.json")):
        if diff.get(key) and Path(diff[key]).is_file():
            files[docs + name] = diff[key]
    rejected = {r: "not on the allow-list of new paths" for r in files if not is_allowed_new_path(r, ctx.label, ctx.folder)}
    existing = paths_existing_in_repo(ctx.repo_root, [r for r in files if r not in rejected])
    for rel in existing:
        rejected[rel] = "path already exists in the repository (additive only)"
    if release_folder_exists(ctx.repo_root, ctx.folder):
        rejected[f"uk_renewables_pipeline/{ctx.folder}/"] = "release folder already exists (never replace a release in place)"
    if rejected:
        raise StageError("PR tree refused: " + "; ".join(f"{k}: {v}" for k, v in sorted(rejected.items())))
    allow = load_large_file_allowlist(ctx.repo_root)
    if ctx.pr_dir.exists():
        shutil.rmtree(ctx.pr_dir)
    manifest, oversize = [], []
    for rel, src in sorted(files.items()):
        size = Path(src).stat().st_size
        if size > MAX_PR_FILE_BYTES and not large_file_allowed(rel, allow):
            oversize.append({"path": rel, "bytes": size})
            continue
        dest = ctx.pr_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        manifest.append({"path": rel, "bytes": size, "sha256": sha256_file(dest)})
    proposed = ctx.out_dir / "proposed_large_files_allowlist_additions.txt"
    if oversize:
        proposed.write_text(
            f"# REPD {ctx.label} candidate files over 5 MB (pr-file-size-guard). Proposed exact entries;\n"
            "# the owner adds them in a separate reviewed PR. They are NOT in the candidate PR.\n"
            + "".join(f"{o['path']}\n" for o in oversize), encoding="utf-8")
    write_json(ctx.out_dir / "pr_manifest.json", {
        "label": ctx.label, "release_folder": ctx.folder, "branch": f"repd/{ctx.label}-candidate",
        "allowed_patterns": allowed_new_path_patterns(ctx.label, ctx.folder),
        "files": manifest, "excluded_oversize": oversize})
    return {"impl": "run.py assemble (orchestrator)", "status_override": "ran", "pr_files": len(manifest), "pr_bytes": sum(m["bytes"] for m in manifest),
            "excluded_oversize": oversize}


# ---------------------------------------------------------------------- driver
PIPELINE: list[tuple[str, Callable[[RunContext], dict[str, Any]]]] = [
    ("detect", stage_detect),
    ("fetch", stage_fetch),
    ("clean", stage_clean),
    ("validate", stage_validate),
    ("diff", stage_diff),
    ("build_root", stage_build_root),
    ("build_v6", stage_build_v6),
    ("build_news", stage_build_news),
    ("acceptance", stage_acceptance),
    ("assemble_pr", stage_assemble),
]


def resolve_descriptor(label: str | None, descriptor_file: Path | None, overrides: dict[str, Any]
                       ) -> tuple[dict[str, Any], Any]:
    """Return (flat descriptor dict, config.ReleaseDescriptor or None)."""
    d: dict[str, Any] = {}
    obj = None
    cfg = load_module("config")
    source = "built-in KNOWN_RELEASES"
    if descriptor_file:
        d = json.loads(Path(descriptor_file).read_text(encoding="utf-8"))
        source = str(descriptor_file)
        if cfg is not None and d.get("schema") == getattr(cfg, "SCHEMA", None):
            obj = cfg.ReleaseDescriptor.from_dict(d)
            d = descriptor_from_config(obj)
    elif cfg is not None and label and _has(cfg, "load", "RELEASES_DIR"):
        path = Path(cfg.RELEASES_DIR) / f"{label}.json"
        if path.is_file():
            obj = cfg.load(path)
            d = descriptor_from_config(obj)
            source = f"automation.repd.config ({path.name})"
    if not d and label in KNOWN_RELEASES:
        d = json.loads(json.dumps(KNOWN_RELEASES[label]))
    d.update({k: v for k, v in overrides.items() if v not in (None, "")})
    if not d.get("label"):
        raise StageError("no release label: pass --label (e.g. 2026q3) or --descriptor")
    if not d.get("release_folder"):
        d["release_folder"] = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M")
    if not LABEL_RE.match(d["label"]):
        raise StageError(f"label {d['label']!r} must look like 2026q3")
    if not FOLDER_RE.match(str(d["release_folder"])):
        raise StageError(f"release folder {d['release_folder']!r} must be a 12-digit UTC stamp")
    for key in ("expected_csv_sha256", "expected_xlsx_sha256"):
        if d.get(key) and not SHA_RE.match(str(d[key]).lower()):
            raise StageError(f"{key} is not a sha256 hex digest")
    if obj is not None:
        # CLI overrides of URLs/hashes must reach the component descriptor too
        for key, attr in (("csv_url", "csv_url"), ("xlsx_url", "xlsx_url")):
            if overrides.get(key):
                setattr(obj, attr, overrides[key])
        for kind in ("csv", "xlsx"):
            if overrides.get(f"expected_{kind}_sha256"):
                setattr(obj.expected, f"{kind}_sha256", overrides[f"expected_{kind}_sha256"])
        obj.validate()
    d["_descriptor_source"] = source
    return d, obj


def run_pipeline(ctx: RunContext, stop_after: str | None = None) -> dict[str, Any]:
    started = utc_now()
    out = ctx.out_dir
    repo = ctx.repo_root.resolve()
    if out.resolve() == repo or repo in out.resolve().parents:
        raise StageError(f"--out {out} is inside the repository {repo}; write outside the repo")
    out.mkdir(parents=True, exist_ok=True)
    pin_problems = check_known_pins(repo) if ctx.check_pins else []
    before = hash_manifest(repo, ctx.protected_globs)
    write_json(out / "hash_manifest_before.json", before)
    overall = "ok"
    for name, fn in PIPELINE:
        rec: dict[str, Any] = {"stage": name, "started_utc": utc_now()}
        t0 = time.monotonic()
        try:
            if pin_problems:
                raise StageError("baseline pin check failed before running: " + "; ".join(pin_problems))
            res = fn(ctx)
            rec["status"] = res.pop("status_override", None) or ("fallback" if str(res.get("impl", "")).startswith(("run.py", "fallback", "offline")) else "ran")
            rec["impl"] = res.get("impl")
            rec["result"] = res
        except (Exception, SystemExit) as exc:  # noqa: BLE001 - every failure is reported and fails closed
            # SystemExit too: reused repository scripts (e.g. scripts/repd_updater.py) call sys.exit /
            # raise SystemExit on a missing input. Without this the run aborted with no run report and
            # without the post-run hash guard.
            rec["status"] = "failed"
            rec["error"] = str(exc) if not isinstance(exc, SystemExit) else f"SystemExit({exc.code!r})"
            if not isinstance(exc, StageError):
                rec["traceback"] = traceback.format_exc(limit=8)
        rec["seconds"] = round(time.monotonic() - t0, 2)
        ctx.stages.append(rec)
        if rec["status"] == "failed":
            overall = "failed"
            break
        if rec["status"] == "missing":
            overall = "incomplete" if overall == "ok" else overall
        if stop_after and name == stop_after:
            break
    after = hash_manifest(repo, ctx.protected_globs)
    write_json(out / "hash_manifest_after.json", after)
    delta = compare_manifests(before, after)
    guard = {"stage": "hash_guard", "protected_files": before["file_count"], **delta,
             "known_pin_problems": pin_problems}
    guard["status"] = "failed" if any(delta.values()) else "ran"
    if guard["status"] == "failed":
        overall = "failed"
    ctx.stages.append(guard)
    if overall == "incomplete" and ctx.allow_partial:
        overall = "partial"
    report = {
        "schema": RUN_SCHEMA, "started_utc": started, "finished_utc": utc_now(),
        "overall": overall, "label": ctx.label, "release_folder": ctx.folder,
        "branch": f"repd/{ctx.label}-candidate", "offline": ctx.offline,
        "repo_root": str(repo), "out_dir": str(out),
        "descriptor": dict(ctx.descriptor),
        "news_contract_expected_accepted_from_builder": ctx.news_accept_expected,
        "stages": ctx.stages,
    }
    write_json(out / "run_report.json", report)
    (out / "run_report.md").write_text(render_markdown(report), encoding="utf-8")
    return report


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        f"# REPD release candidate {report['label']} ({report['overall'].upper()})",
        "",
        "Draft candidate generated by `automation/repd/run.py`. It adds new files only; nothing existing is "
        "changed. The owner reviews and merges. Merging a new `uk_renewables_pipeline/` folder to main deploys it.",
        "",
        f"- Release folder: `uk_renewables_pipeline/{report['release_folder']}/`",
        f"- Branch: `{report['branch']}`",
        f"- Offline: {report['offline']}",
        f"- Pipeline News contract `expected` figures taken from builder output: "
        f"{report.get('news_contract_expected_accepted_from_builder')} (review them in contracts/release.v9.*.json)",
        f"- Started {report['started_utc']}, finished {report['finished_utc']}",
        "",
        "| stage | status | implementation | seconds |",
        "|---|---|---|---|",
    ]
    for s in report["stages"]:
        lines.append(f"| {s['stage']} | {s['status']} | {str(s.get('impl', '')).replace('|', '/')} | {s.get('seconds', '')} |")
    lines.append("")
    for s in report["stages"]:
        if s.get("error"):
            lines += [f"**{s['stage']} failed:** {s['error']}", ""]
        if s["stage"] == "hash_guard":
            lines += [f"Hash guard: {s['protected_files']} protected files; changed {len(s['changed'])}, "
                      f"removed {len(s['removed'])}, added in protected area {len(s['added_in_protected_area'])}.", ""]
        if s["stage"] == "assemble_pr" and s.get("result"):
            r = s["result"]
            lines += [f"PR tree: {r['pr_files']} files, {r['pr_bytes']} bytes.", ""]
            for o in r.get("excluded_oversize", []):
                lines.append(f"- EXCLUDED (over 5 MB, not allow-listed): `{o['path']}` ({o['bytes']} bytes)")
            lines.append("")
    return "\n".join(lines) + "\n"


def detect_only(args: argparse.Namespace, fetcher: Callable[[str], bytes] | None = None) -> int:
    """Report-only: is there a release newer than the ones automation/repd knows? Never fails on 'new'."""
    det, cfg, fm = load_module("detect"), load_module("config"), load_module("fetch")
    if det is not None and cfg is not None and fm is not None and fetcher is None and _has(det, "detect"):
        known = cfg.load_all()
        baseline = known[max(known)] if known else None
        rep = det.detect(fm.urllib_fetcher(), "api", baseline)
        dd = rep["descriptor"]
        res = {"impl": "automation.repd.detect.detect", "status": rep["status"], "label": dd["release_id"],
               "csv_url": dd["csv_url"], "xlsx_url": dd["xlsx_url"],
               "public_updated_at": dd.get("govuk_public_updated_at") or dd.get("page_last_updated"),
               "known_labels": sorted(known),
               "new_release": rep["status"] in ("NEW_RELEASE", "REPLACED_SAME_QUARTER", "NO_BASELINE"),
               "detect_report": rep}
    else:
        res = fallback_detect(fetcher or default_fetcher)
        res["impl"] = "run.py fallback_detect"
        known_urls = {r.get("csv_url") for r in KNOWN_RELEASES.values()}
        res["known_labels"] = sorted(KNOWN_RELEASES)
        res["new_release"] = (bool(res.get("csv_url")) and res.get("csv_url") not in known_urls
                              and res.get("label") not in KNOWN_RELEASES)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / "detect_report.json", res)
    print(json.dumps({k: v for k, v in res.items() if k != "detect_report"}, indent=2, default=str))
    return 0


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--label", help="release label, e.g. 2026q3")
    p.add_argument("--release-folder", help="12-digit UTC stamp for uk_renewables_pipeline/<stamp>/")
    p.add_argument("--descriptor", type=Path, help="release descriptor JSON (overrides config.py/built-ins)")
    p.add_argument("--csv-url"); p.add_argument("--xlsx-url")
    p.add_argument("--expected-csv-sha256"); p.add_argument("--expected-xlsx-sha256")
    p.add_argument("--out", type=Path, required=True, help="output directory, outside the repo")
    p.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--offline", action="store_true", help="no network: use --csv/--xlsx local files")
    p.add_argument("--csv", type=Path); p.add_argument("--xlsx", type=Path)
    p.add_argument("--previous", type=Path, help="previous-release CSV baseline (default from descriptor)")
    p.add_argument("--allow-partial", action="store_true", help="exit 0 even if a build component is missing")
    p.add_argument("--quick-guard", action="store_true", help="hash only top-level protected files (no release trees)")
    p.add_argument("--no-pin-check", action="store_true", help="skip the known sha256 baseline pins")
    p.add_argument("--news-review-expected", action="store_true",
                   help="do NOT pass --accept-expected to build_news (stop for a human when contract figures change)")
    p.add_argument("--stop-after", choices=[n for n, _ in PIPELINE])
    p.add_argument("--detect-only", action="store_true", help="report-only new-release check")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.detect_only:
        return detect_only(args)
    try:
        descriptor, config_obj = resolve_descriptor(args.label, args.descriptor, {
            "label": args.label, "release_folder": args.release_folder,
            "csv_url": args.csv_url, "xlsx_url": args.xlsx_url,
            "expected_csv_sha256": (args.expected_csv_sha256 or "").lower() or None,
            "expected_xlsx_sha256": (args.expected_xlsx_sha256 or "").lower() or None,
        })
    except StageError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    ctx = RunContext(
        repo_root=args.repo_root.resolve(), out_dir=args.out.resolve(), descriptor=descriptor,
        offline=args.offline, local_csv=args.csv, local_xlsx=args.xlsx, previous_csv=args.previous,
        allow_partial=args.allow_partial, check_pins=not args.no_pin_check,
        protected_globs=list(QUICK_PROTECTED_GLOBS if args.quick_guard else PROTECTED_GLOBS),
        news_accept_expected=not args.news_review_expected,
    )
    if config_obj is not None:
        ctx.artifacts["config_descriptor"] = config_obj
    try:
        report = run_pipeline(ctx, stop_after=args.stop_after)
    except StageError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    for s in report["stages"]:
        print(f"{s['stage']:<12} {s['status']:<9} {s.get('impl', '') or ''} {s.get('error', '')}")
    print(f"overall: {report['overall']}  report: {ctx.out_dir / 'run_report.md'}")
    return {"ok": 0, "partial": 0, "incomplete": 3}.get(report["overall"], 1)


if __name__ == "__main__":
    sys.exit(main())
