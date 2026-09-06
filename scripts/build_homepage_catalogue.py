#!/usr/bin/env python3
"""Build the homepage catalogue: every published version, with a real stamp.

WHY A GENERATOR
The homepage used to be a hand-typed list. It drifted: entries with the wrong
title, links to directories that did not exist, a count of "(17)" over fifteen
items, and nine of Codex's Test Code links deleted by a rebuild. A list nobody
generates is a list somebody forgets. This reads the tree and git, and the page
renders what it finds.

THE NAME FORMAT
    yyyymmddhhmm-name-of-the-project
The stamp is UTC. Directories that already carry a 12-digit UTC stamp keep it.
Directories that were named v9.7, v7, dashboard_v5_live.html carry no stamp, so
theirs is read from git: the UTC commit time at which that path first appeared.
That is a fact about the repository, not a guess, and it is recorded per entry
as `stamp_source` so a reader can tell the two apart.

FAMILIES
    pipeline-news   uk_renewables_pipeline/* and pipelinenews_intelligence/*
    grid-atlas      the live Atlas, its /atlas/v/<stamp>/ cuts, and the V1-V9
                    catalogue historical_builds.html already carries
    test-code       Codex's testcode/<stamp>/ releases (atlas / pipeline / cable)
    about-media     papers, knowledge pages, dashboards, archived homepages
Each entry names its family and, where known, its parent, so a million versions
can be filtered, sorted and followed - the page shows three per nest and the
rest on demand.

Run:  python3 scripts/build_homepage_catalogue.py   ->  catalogue/homepage-catalogue.json
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "catalogue" / "homepage-catalogue.json"
STAMP = re.compile(r"^(\d{12})")


def sh(*args: str) -> str:
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=False).stdout.strip()


def first_commit_utc(path: str) -> str | None:
    """UTC stamp of the commit in which this path first appeared. Never typed."""
    iso = sh("git", "log", "--diff-filter=A", "--format=%cI", "--reverse", "--", path).splitlines()
    if not iso:
        iso = sh("git", "log", "--format=%cI", "--reverse", "--", path).splitlines()
    if not iso:
        return None
    return datetime.fromisoformat(iso[0]).astimezone(timezone.utc).strftime("%Y%m%d%H%M")


def provenance(path: str) -> dict:
    """Who published this path, and the git codes a CI run pins.

    AGENT is derived, never typed, and the reason is recorded:
      Claude   a Co-Authored-By: Claude trailer on the publishing commit
      Codex    a Co-Authored-By: Codex trailer; or the path is under testcode/,
               which the coordination board assigns to Codex; or the subject is
               Codex's publish style ("Publish ...", "Deploy 2026...")
      Copilot  a copilot-swe-agent trailer
      (blank)  none of the above. No person is named; the two references are the record.
    Only two Codex commits in this history carry a trailer, so the path and
    subject rules do the work; both are stated in agent_source so a reader can
    check the inference rather than trust it.

    COMMIT is the short SHA of the commit that first added the path. TREE is
    `git rev-parse HEAD:<path>` - the value every pipeline runner pins with
    `test "$(git rev-parse 'HEAD:...')" = "..."`. Putting it in the table means
    a CI pin can be copied from the page instead of computed by hand.
    """
    rel = path.rstrip("/")
    raw = sh("git", "log", "--diff-filter=A", "--reverse", "--format=%H%x1f%s%x1f%(trailers:key=Co-Authored-By,valueonly)", "--", rel)
    line = raw.split(chr(10))[0] if raw else ""
    full, subject, trailers = (line.split(chr(31)) + ["", "", ""])[:3] if line else ("", "", "")
    t = trailers.lower()
    model = None
    mm = re.search(r"(Claude [A-Za-z]+ [\d.]+(?: \([^)]*\))?|copilot-swe-agent(?:\[bot\])?|Codex)", trailers or "")
    if mm:
        model = mm.group(1)
    if "claude" in t:
        agent, why = "Claude", "Co-Authored-By: Claude trailer"
    elif "codex" in t:
        agent, why = "Codex", "Co-Authored-By: Codex trailer"
    elif rel.startswith("testcode/"):
        agent, why = "Codex", "testcode/ is Codex's lane (coordination board)"
    elif re.match(r"^(Publish|Deploy \d{12}|Restore navigation)", subject or ""):
        agent, why = "Codex", "Codex publish-style subject: " + (subject or "")[:50]
    elif "copilot" in t:
        agent, why = "Copilot", "copilot-swe-agent trailer"
    elif full:
        agent, why = None, "no agent trailer on the publishing commit"
    else:
        agent, why = "unknown", "path not in git history"
    tree = sh("git", "rev-parse", f"HEAD:{rel}") if full else ""
    return {"agent": agent, "agent_model": model, "agent_source": why, "commit": full[:10], "commit_full": full,
            "tree": tree if re.fullmatch(r"[0-9a-f]{40}", tree or "") else None}


GRIDATLAS = ROOT.parent / "gridatlas"


def gridatlas_provenance(stamp: str) -> dict:
    """Agent and commit for an Atlas generation, from the gridatlas repository.

    The homepage lives in globalgrid2050 but the Atlas is built in
    Ventusltd/gridatlas, so its rows would otherwise read agent=None. If that
    repository is checked out beside this one, the commit that added
    atlas/manifests/<stamp>-composition.json (or atlas/v/<stamp>) names the
    agent by the same trailer rules. Stated as such in agent_source; absent
    the sibling checkout, the row says so rather than guessing."""
    if not (GRIDATLAS / ".git").exists():
        return {"agent": None, "agent_model": None, "agent_source": "gridatlas checkout not present beside this repository", "commit": None, "commit_full": None, "tree": None}
    def g(*a):
        return subprocess.run(["git", *a], cwd=GRIDATLAS, capture_output=True, text=True, check=False).stdout.strip()
    for rel in (f"atlas/manifests/{stamp}-composition.json", f"atlas/v/{stamp}", f"atlas/releases/{stamp}"):
        raw = g("log", "--all", "--diff-filter=A", "--reverse", "--format=%H%x1f%s%x1f%(trailers:key=Co-Authored-By,valueonly)", "--", rel)
        if raw:
            full, subject, trailers = (raw.split(chr(10))[0].split(chr(31)) + ["", "", ""])[:3]
            t = trailers.lower()
            mm = re.search(r"(Claude [A-Za-z]+ [\d.]+(?: \([^)]*\))?|Codex)", trailers or "")
            if "claude" in t: agent, why = "Claude", f"gridatlas: Co-Authored-By: Claude on the commit adding {rel}"
            elif "codex" in t or re.match(r"^(Publish|Deploy)", subject or ""): agent, why = "Codex", f"gridatlas: {rel}"
            else: agent, why = None, f"gridatlas: no agent trailer on the commit adding {rel}"
            tree = g("rev-parse", f"HEAD:{rel}")
            return {"agent": agent, "agent_model": mm.group(1) if mm else None, "agent_source": why, "commit": full[:10], "commit_full": full,
                    "tree": tree if re.fullmatch(r"[0-9a-f]{40}", tree or "") else None}
    return {"agent": None, "agent_model": None, "agent_source": f"gridatlas: no commit found adding generation {stamp}", "commit": None, "commit_full": None, "tree": None}


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)


def entry(family: str, stamp: str, project: str, url: str, *, stamp_source: str,
          title: str | None = None, parent: str | None = None, kind: str | None = None,
          status: str | None = None) -> dict:
    prov = provenance(url[2:]) if url.startswith("./") else {"agent": None, "agent_source": "external URL - provenance lives in the owning repository", "commit": None, "commit_full": None, "tree": None}
    return {
        **prov,
        "id": f"{stamp}-{slug(project)}",
        "stamp": stamp,
        "family": family,
        "project": project,
        "title": title or project,
        "url": url,
        "kind": kind,
        "parent": parent,
        "status": status,
        "stamp_source": stamp_source,
    }


def has_page(rel: str) -> bool:
    p = ROOT / rel
    return p.is_file() or (p / "index.html").is_file() or (p / "index.md").is_file()


entries: list[dict] = []
skipped: list[str] = []


def add(e: dict) -> None:
    rel = e["url"]
    if rel.startswith("./") and not has_page(rel[2:].rstrip("/")):
        skipped.append(rel)
        return
    entries.append(e)


# ── pipeline-news ────────────────────────────────────────────────────────────
CURRENT_PIPELINE = "202609061329"
for d in sorted((ROOT / "uk_renewables_pipeline").iterdir()):
    if not d.is_dir() or d.name in ("node_modules",):
        continue
    if not (d / "index.html").is_file():
        continue
    m = STAMP.match(d.name)
    if m:
        stamp, src, title = m.group(1), "directory name (UTC)", f"Pipeline News {d.name}"
    else:
        stamp, src, title = first_commit_utc(f"uk_renewables_pipeline/{d.name}"), "git first-commit time (UTC)", f"UK Renewables Pipeline {d.name}"
    if not stamp:
        continue
    add(entry("pipeline-news", stamp, "pipeline-news", f"./uk_renewables_pipeline/{d.name}/",
              stamp_source=src, title=title, kind="release",
              status="current" if d.name == CURRENT_PIPELINE else "archived"))
for f in sorted((ROOT / "uk_renewables_pipeline").glob("dashboard*.html")):
    stamp = first_commit_utc(f"uk_renewables_pipeline/{f.name}")
    if stamp:
        add(entry("pipeline-news", stamp, "pipeline-dashboard", f"./uk_renewables_pipeline/{f.name}",
                  stamp_source="git first-commit time (UTC)", title=f"Pipeline dashboard {f.stem}", kind="dashboard", status="archived"))
for d in sorted((ROOT / "pipelinenews_intelligence").iterdir()):
    m = STAMP.match(d.name)
    if d.is_dir() and m and (d / "index.html").is_file():
        add(entry("pipeline-news", m.group(1), "pipeline-news", f"./pipelinenews_intelligence/{d.name}/",
                  stamp_source="directory name (UTC)", title=f"Pipeline News {d.name}", kind="release", status="archived"))

# ── grid-atlas ───────────────────────────────────────────────────────────────
try:
    import urllib.request
    with urllib.request.urlopen("https://ventusltd.github.io/gridatlas/atlas/current.json", timeout=15) as r:
        cur = json.load(r)
    live_stamp = str(cur.get("generation"))
    live_version = cur.get("composition_version") or cur.get("version") or ""
except Exception:  # offline: the page still builds, the live entry is marked unknown
    live_stamp, live_version = None, ""
if live_stamp and STAMP.match(live_stamp):
    entries.append(entry("grid-atlas", live_stamp, "grid-atlas", "https://ventusltd.github.io/gridatlas/atlas/",
                         stamp_source="atlas/current.json generation (UTC)",
                         title=f"Grid Atlas {live_version} — live".strip(), kind="release", status="current") | gridatlas_provenance(live_stamp))

hb = (ROOT / "historical_builds.html").read_text(encoding="utf-8")
for name, url, note in re.findall(r'\{ name:"([^"]+)", url:"([^"]+)", note:"([^"]*)"', hb.split("GRIDATLAS_VERSION_CATALOGUE_END")[0]):
    gen = re.search(r"generation (\d{12})", note)
    stamp = gen.group(1) if gen else None
    src = "catalogue generation (UTC)"
    if not stamp:
        rel = url.replace("https://globalgrid2050.com/", "")
        if not rel.startswith("http"):
            stamp, src = first_commit_utc(rel.rstrip("/")), "git first-commit time (UTC)"
    if not stamp:
        continue
    u = url.replace("https://globalgrid2050.com/", "./")
    e = entry("grid-atlas", stamp, "grid-atlas", u, stamp_source=src, title=name.replace(" -- ", " — "), kind="release", status="archived")
    if gen and not e.get("agent"):
        e = e | gridatlas_provenance(stamp)
    add(e)
for stamp in re.findall(r"gridatlas/atlas/v/(\d{12})/", (ROOT / "index.html").read_text(encoding="utf-8")):
    entries.append(entry("grid-atlas", stamp, "grid-atlas", f"https://ventusltd.github.io/gridatlas/atlas/v/{stamp}/",
                         stamp_source="path stamp (UTC)", title=f"Grid Atlas cut {stamp}", kind="cut", status="archived") | gridatlas_provenance(stamp))

# ── test-code (Codex) ────────────────────────────────────────────────────────
for d in sorted((ROOT / "testcode").iterdir()):
    m = STAMP.match(d.name)
    if not (d.is_dir() and m):
        continue
    stamp = m.group(1)
    for sub, label in (("atlas", "grid-atlas"), ("pipeline", "pipeline-news"), ("cable", "cable-geometry")):
        if (d / sub / "index.html").is_file():
            add(entry("test-code", stamp, f"test-code-{label}", f"./testcode/{d.name}/{sub}/",
                      stamp_source="directory name (UTC)", title=f"Test Code {label} {stamp}", kind=sub,
                      parent=f"./testcode/{d.name}/", status="test"))
    if (d / "index.html").is_file() and not any((d / s / "index.html").is_file() for s in ("atlas", "pipeline", "cable")):
        add(entry("test-code", stamp, "test-code", f"./testcode/{d.name}/",
                  stamp_source="directory name (UTC)", title=f"Test Code {stamp}", kind="release", status="test"))

# ── about-media ──────────────────────────────────────────────────────────────
ABOUT = [
    ("papers/202609060203-electrification", "electrification-paper", "Electrification and the size of Britain's electricity"),
    ("papers/202609060045-published-fault-level", "fault-level-paper", "Published, dated, never calculated — fault levels"),
    ("grid_engine", "electrification-workbench", "Electrification workbench"),
    ("status.html", "build-status", "Build status"),
    ("historical_builds.html", "historical-builds", "Historical builds — the full archive"),
    ("why_ventusltd_building_globalgrid2050", "why-ventus", "Why VENTUS Ltd is building GlobalGrid2050"),
    ("blog", "blog", "Blog"),
    ("podcast_transcripts", "podcast-transcripts", "Podcast transcripts"),
    ("marketing/earth.html", "earth", "Earth"),
    ("time_to_2050", "hourglass-2050", "Time left today — hourglass to 2050"),
    ("solar_deployment_statistics", "solar-deployment-statistics", "Solar deployment statistics"),
    ("definitions", "definitions", "Definitions"),
    ("power_systems_studies", "power-systems-studies", "Power systems studies"),
    ("sld_single_diagrams_diagrams_and_grids", "single-line-diagrams", "Single line diagrams and grids"),
    ("ac_cables_knowledge", "ac-cables", "AC cables knowledge"),
    ("dc_cables_knowledge", "dc-cables", "DC cables knowledge"),
    ("conductor_resistances", "conductor-resistances", "Conductor resistances"),
    ("33kv_uk_dap_price_estimator", "33kv-price-estimator", "33 kV UK DAP price estimator"),
    ("lv_ac_dc_price_estimator", "lv-price-estimator", "LV AC and DC cables price estimator"),
    ("copper_and_aluminium_prices_historic_trends", "metal-prices", "Copper and aluminium historic prices"),
    ("mv_and_hv_components", "mv-hv-components", "MV and HV components"),
    ("solar_components", "solar-components", "Solar components"),
    ("nsip_solar_farms", "nsip-solar-farms", "NSIP solar farms"),
    ("data/grid_studies_public", "grid-studies", "Grid studies public"),
    ("employers_requirements_BESS", "er-bess", "Employer's requirements — BESS"),
    ("employers_requirments_large_scale_solar", "er-solar", "Employer's requirements — large-scale solar"),
    ("employers_competence", "er-competence", "Employer's competence requirements"),
]
for rel, project, title in ABOUT:
    stamp = first_commit_utc(rel)
    if not stamp:
        continue
    url = f"./{rel}" + ("" if rel.endswith(".html") else "/")
    add(entry("about-media", stamp, project, url, stamp_source="git first-commit time (UTC)", title=title, kind="page", status="live"))
# every archived homepage, including the one this build replaces
for f in sorted((ROOT / "homepage_versions").glob("homepage_v*.html")):
    stamp = first_commit_utc(f"homepage_versions/{f.name}")
    if stamp:
        add(entry("about-media", stamp, "homepage-archive", f"./homepage_versions/{f.name}",
                  stamp_source="git first-commit time (UTC)", title=f"Homepage archive {f.stem}", kind="homepage", status="archived"))

# ── finish ───────────────────────────────────────────────────────────────────
seen: set[str] = set()
unique: list[dict] = []
for e in sorted(entries, key=lambda e: (e["stamp"], e["id"]), reverse=True):
    if e["url"] in seen:
        continue
    seen.add(e["url"])
    unique.append(e)

doc = {
    "schema": "globalgrid2050.homepage-catalogue.v1",
    "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "name_format": "yyyymmddhhmm-name-of-the-project (UTC)",
    "families": ["pipeline-news", "grid-atlas", "test-code", "about-media"],
    "columns": ["stamp-name", "family", "agent", "agent_model", "status", "commit", "tree"],
    "count": len(unique),
    "skipped_unresolvable": skipped,
    "entries": unique,
}
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
by = {}
for e in unique:
    by[e["family"]] = by.get(e["family"], 0) + 1
print(f"catalogue: {len(unique)} entries -> {OUT.relative_to(ROOT)}")
for k, v in sorted(by.items()):
    print(f"  {k:<14} {v}")
if skipped:
    print(f"  skipped (no page): {len(skipped)}")
    for s in skipped[:6]:
        print("    ", s)
