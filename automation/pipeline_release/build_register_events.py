#!/usr/bin/env python3
"""Reduce the REPD register-change events to the rows a Pipeline News version carries.

  build_register_events.py <version folder>

Reads dist/news/repd_events_2026q3.json (events derived from comparing the July and October
2026 REPD releases) and writes <version folder>/events/register_changes.json with the events
whose REPD Ref ID is in the version's spine, in the feed's own order. Nothing is rescored or
reworded: type, date, headline and score are the feed's. Keyed by REPD Ref ID only.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = "dist/news/repd_events_2026q3.json"


def main():
    folder = Path(sys.argv[1])
    raw = (ROOT / SRC).read_bytes()
    feed = json.loads(raw)
    refs = set()
    manifest = json.loads((folder / "data/v9.1/build_manifest.json").read_text())
    for part in manifest["project_partitions"]:
        refs |= {str(p["repd_ref"]) for p in json.loads((folder / part["path"]).read_text())["projects"]}
    events = [{"ref": str(e["ref"]), "type": e["event_type"], "date": e.get("event_date"), "date_source": e.get("event_date_source"),
               "headline": e["headline"], "score": e.get("score"), "previous_status": e.get("previous_status"), "status": e.get("status")}
              for e in feed["events"] if str(e["ref"]) in refs]
    counts = {}
    for e in events:
        counts[e["type"]] = counts.get(e["type"], 0) + 1
    out = {"schema": "globalgrid2050.pipeline-news.register-changes.v1",
           "label": "Register changes, %s to %s REPD" % (feed["previous"]["label"], feed["new"]["label"]),
           "note": "Changes found by comparing two official REPD releases. These are register events, not news stories: each line is generated from REPD fields only. A status change is dated by the register and can lag the real-world decision.",
           "source": SRC, "source_sha256": hashlib.sha256(raw).hexdigest(), "source_events": feed["event_count"],
           "events_in_this_version": len(events), "projects_with_an_event": len({e["ref"] for e in events}),
           "max_score": feed.get("max_score"), "counts": counts, "events": events}
    (folder / "events").mkdir(exist_ok=True)
    (folder / "events/register_changes.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({k: out[k] for k in ("events_in_this_version", "projects_with_an_event", "source_events", "counts")}))


if __name__ == "__main__":
    main()
