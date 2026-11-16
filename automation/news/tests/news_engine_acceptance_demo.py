"""Synthetic OFFLINE CLI replay for Agent 3 independent acceptance.

All people, projects, publishers and URLs in this fixture are invented.
No network requests or publisher content retrieval occur.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    articles = [
        {"url": "https://fixture.example.org/solar/east-meadow?utm_source=test",
         "title": "East Meadow Solar Farm consultation submitted",
         "source_id": "fixture_press", "source": "Fixture Press",
         "pub_date": "2026-11-16", "first_seen": "2026-11-16T12:00:00Z",
         "source_receipt_sha256": "a" * 64,
         "content": "DO NOT STORE OR MATCH: REPD 9999"},
        {"url": "https://fixture.example.org/solar/east-meadow?utm_medium=mail",
         "title": "East Meadow Solar Farm consultation submitted",
         "source_id": "fixture_press", "source": "Fixture Press",
         "pub_date": "2026-11-16", "first_seen": "2026-11-16T12:00:00Z",
         "source_receipt_sha256": "a" * 64},
        {"url": "https://fixture.example.org/markets/uk-renewables",
         "title": "UK energy markets see further investment",
         "source_id": "fixture_press", "source": "Fixture Press",
         "date": None, "first_seen": "2026-11-16T12:10:00Z"},
    ]
    sources = [
        {"id": "fixture_press", "publisher": "Fixture Press", "kind": "reporting",
         "rights_status": "unknown", "enabled": False,
         "output_policy": "headline_link_only"}
    ]
    projects = [{"id": "1018", "name": "East Meadow Solar Farm",
                 "namespace": "repd", "technology": "solar"}]
    with tempfile.TemporaryDirectory(prefix="news-engine-synthetic-") as tmp:
        root = Path(tmp)
        for name, payload in (("articles", articles), ("sources", sources), ("projects", projects)):
            (root / (name + ".json")).write_text(json.dumps(payload), encoding="utf-8")
        cmd = [sys.executable, "-m", "automation.news.engine",
               "--articles", str(root / "articles.json"),
               "--sources", str(root / "sources.json"),
               "--projects", str(root / "projects.json"),
               "--output", str(root / "out.json")]
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        result = json.loads((root / "out.json").read_text(encoding="utf-8"))
    assert result["counts"] == {
        "articles": 2, "provisional_project_edges": 1,
        "verified_project_edges": 0, "rights_unresolved_articles": 2,
    }
    project_row = next(row for row in result["articles"] if row["project_candidates"])
    market_row = next(row for row in result["articles"] if not row["project_candidates"])
    assert len(project_row["observed_article_urls"]) == 2
    assert project_row["project_candidates"][0]["status"] == "PROVISIONAL"
    assert market_row["published_at"] is None
    assert all(row["publication_eligibility"].startswith("WITHHELD") for row in result["articles"])
    assert "DO NOT STORE" not in json.dumps(result)
    print(json.dumps({
        "label": "SYNTHETIC OFFLINE FIXTURE — NOT REAL SOURCES OR VERIFIED EVIDENCE",
        "schema": result["schema"], "counts": result["counts"],
        "project_candidate": project_row["project_candidates"][0],
        "market_news_has_no_project_binding": market_row["project_candidates"] == [],
        "observed_original_url_variants": len(project_row["observed_article_urls"]),
        "publication": project_row["publication_eligibility"],
    }, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
