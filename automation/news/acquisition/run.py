"""Weekly evidence candidate builder; probes never write evidence or state."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import tempfile

from .evidence_store import EvidenceStore, export_snapshot
from .fetch import FetchError, fetch_source, load_sources
from .match import match_articles
from .research_queue import MANIFEST_SHA256, load_seed_projects


def collect(out, *, sources_path=None, probe=False, fetcher=fetch_source):
    projects = load_seed_projects()
    sources = load_sources(sources_path, include_disabled=probe)
    if not sources:
        raise FetchError("No enabled source with accepted rights; manual review required")
    # Complete every critical fetch and match before opening or changing state.
    results = [fetcher(source, probe=probe) for source in sources]
    articles = [a for result in results for a in result["articles"]]
    receipts = [result["source"] for result in results]
    matches = match_articles(articles, projects)
    report = {"probe_only": probe, "selected": len(projects), "articles": len(articles),
              "provisional_matches": len(matches), "verified": 0,
              "seed_sha256": MANIFEST_SHA256, "sources": receipts}
    if probe:
        return report
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    database = out / "evidence.sqlite"
    # A failed schema/export cannot corrupt the previous accepted SQLite state.
    # This is staging, not a claim of filesystem-atomic multi-file publication.
    # Workflow publishes the entire validated output in one Git ref update.
    with tempfile.TemporaryDirectory(prefix="evidence-build-") as temporary:
        staged = Path(temporary)
        staged_db = staged / "evidence.sqlite"
        if database.exists():
            shutil.copyfile(database, staged_db)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with EvidenceStore(staged_db) as store:
            store.record_run(projects, articles, matches, now, receipts)
            pointer = export_snapshot(store, staged, expected_project_ids=[p["id"] for p in projects])
        # Check immutable conflicts before copying any candidate file.
        for path in staged.rglob("*"):
            if not path.is_file() or path.name in {"evidence.sqlite", "latest.json"}:
                continue
            destination = out / path.relative_to(staged)
            if destination.exists() and destination.read_bytes() != path.read_bytes():
                raise ValueError("Immutable snapshot conflict; manual review required")
        for path in staged.rglob("*"):
            if path.is_file() and path.name != "latest.json":
                destination = out / path.relative_to(staged)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
        (out / "latest.json").write_bytes((staged / "latest.json").read_bytes())
    report["pointer"] = pointer
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("dist/news/evidence"))
    parser.add_argument("--sources", type=Path)
    parser.add_argument("--probe", action="store_true", help="Health metadata only, including disabled sources")
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = collect(args.out, sources_path=args.sources, probe=args.probe)
        report["result"] = "probe_complete" if args.probe else "candidate_built"
        code = 0
    except Exception as exc:
        # Never dump paths, raw responses, credentials or articles into receipts.
        report = {"result": "blocked", "error_type": type(exc).__name__,
                  "manual_review_required": True, "probe_only": args.probe}
        print(f"BLOCKED ({type(exc).__name__}); manual review required; no publication")
        code = 1
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(report))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
