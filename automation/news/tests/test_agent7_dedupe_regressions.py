"""Agent 7 regressions: title similarity is not proof of article/event identity."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pipeline_headlines as P  # noqa: E402


def item(*, title="Solar farm planning decision announced", date="2026-11-14T10:00:00Z",
         ref=None, link="https://publisher.example/a", source="Publisher A",
         category="planning_decision", **extra):
    return dict(title=title, date=date, link=link, source=source, category=category,
                first_seen="2026-11-15T12:00:00Z", technology="solar",
                possible_match={"repd_ref": str(ref), "site_name": "Example site", "basis": "county"}
                if ref is not None else None, **extra)


def test_same_title_distinct_years_retains_both():
    a = item(date="2025-01-05T09:00:00Z")
    b = item(date="2026-01-05T09:00:00Z", link="https://publisher.example/b", source="Publisher B")
    assert len(P.dedupe_titles([a, b])) == 2


def test_generic_same_title_different_repd_projects_retains_both():
    a = item(ref=1001)
    b = item(ref=2002, link="https://publisher.example/b", source="Publisher B")
    assert len(P.dedupe_titles([a, b])) == 2


def test_separate_decisions_same_project_retained():
    a = item(ref=1001, decision_reference="P/2026/001")
    b = item(ref=1001, decision_reference="P/2026/002",
             date="2026-11-15T11:00:00Z", link="https://publisher.example/b", source="Publisher B")
    assert len(P.dedupe_titles([a, b])) == 2


def test_undated_same_title_separate_urls_retained():
    a = item(date=None, ref=1001, category="construction")
    b = item(date=None, ref=1001, category="construction",
             link="https://publisher.example/b", source="Publisher B")
    assert len(P.dedupe_titles([a, b])) == 2


def test_same_canonical_article_url_syndicated_collapses():
    a = item()
    b = item(link=a["link"], source="Syndicated B")
    assert len(P.dedupe_titles([a, b])) == 1


def test_two_publishers_same_project_non_decision_near_date_collapses():
    a = item(ref=1001, category="construction")
    b = item(ref=1001, category="construction",
             date="2026-11-15T10:00:00Z",
             link="https://second.example/b", source="Publisher B")
    assert len(P.dedupe_titles([a, b])) == 1


def test_same_title_unknown_project_different_urls_kept():
    a = item()
    b = item(link="https://publisher-b.example/b", source="Publisher B")
    assert len(P.dedupe_titles([a, b])) == 2
