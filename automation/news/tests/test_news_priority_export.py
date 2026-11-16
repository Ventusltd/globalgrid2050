"""Rank publication must keep the legacy file intact and bind its exact bytes."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

from automation.news import build_news_priority as B
from automation.news.tests.test_news_algorithm import article


def document(items=None):
    items = items if items is not None else [article()]
    return {"schema": B.P.SCHEMA, "generated_at": "2026-11-16T13:06:13Z", "status": "ok",
            "counts": {"items": len(items), "with_possible_match": 0, "feeds_ok": 1, "feeds_failed": 0,
                       "by_category": {}}, "limits": {"max_items": 200, "max_age_days": 120},
            "scope": "Headlines only", "feeds": [{"url": "https://news.example/feed", "source": "Example", "status": "ok"}],
            "items": items}


def raw(doc):
    return json.dumps(doc, ensure_ascii=False).encode()


def test_exact_bytes_determinism_and_legacy_input_preserved():
    doc = document([article("https://www.bloomberg.com/news/1", source="Bloomberg"),
                    article("https://www.gov.uk/news/1", "UK solar planning policy announced", source="GOV.UK", category="policy")])
    original = copy.deepcopy(doc)
    first = B.build(raw(doc))
    assert first == B.build(raw(doc)) and doc == original
    assert first["input_sha256"] == hashlib.sha256(raw(doc)).hexdigest()
    assert first["as_of"] == doc["generated_at"]
    assert [e["source"] for e in first["entries"]] == ["GOV.UK", "Bloomberg"]
    assert first["entries"][0]["title"] == doc["items"][1]["title"]
    assert B.build(raw(doc) + b"\n")["input_sha256"] != first["input_sha256"]


@pytest.mark.parametrize("status", ["ok", "partial", "failed"])
def test_health_not_reclassified_and_empty_is_valid(status):
    doc = document([])
    doc["status"] = status
    assert B.build(raw(doc))["entries"] == []
    assert doc["status"] == status


@pytest.mark.parametrize("change", [
    lambda d: d.update(schema="wrong"),
    lambda d: d.update(editorial={}),
    lambda d: d["items"][0].update(editorial={}),
    lambda d: d["counts"].update(items=99),
    lambda d: d["counts"].update(items=True),
    lambda d: d.update(generated_at="2026-02-30T12:00:00Z"),
    lambda d: d["items"][0].update(first_seen="2026-02-30T12:00:00Z"),
    lambda d: d["items"][0].update(first_seen="2026-11-17T12:00:00Z"),
    lambda d: d["items"][0].update(date="2026-02-30T12:00:00Z"),
    lambda d: d["items"][0].update(link="https://127.0.0.1/private"),
    lambda d: d["items"].append(copy.deepcopy(d["items"][0])),
])
def test_malformed_inputs_fail_before_output(change):
    doc = document()
    change(doc)
    with pytest.raises(ValueError):
        B.build(raw(doc))


def test_duplicates_and_oversize_fail():
    for data in (b'{"schema":1,"schema":2}', b'NaN', b"x" * (B.MAX_BYTES + 1)):
        with pytest.raises(ValueError):
            B.build(data)
    doc = document([article("https://news.example/1?utm_source=a"), article("https://news.example/1")])
    with pytest.raises(ValueError, match="canonical"):
        B.build(raw(doc))


def test_schema_growth_requires_explicit_validator_support():
    with pytest.raises(ValueError, match="unsupported"):
        B._validate("x", {"type": "string", "newValidationKeyword": True})


def test_no_freshness_from_collection_time_or_fake_verification():
    doc = document([article(date=None)])
    entry = B.build(raw(doc))["entries"][0]
    assert entry["freshness_state"] == "unknown"
    assert "VERIFIED" not in B.dumps(B.build(raw(doc)))


def test_cli_keeps_previous_output_on_schema_failure_and_never_changes_input(tmp_path):
    source, output = tmp_path / "headlines.json", tmp_path / "priority.json"
    source.write_bytes(raw(document()))
    before = source.read_bytes()
    command = [sys.executable, "-m", "automation.news.build_news_priority", "--input", str(source), "--output", str(output)]
    assert subprocess.run(command, capture_output=True).returncode == 0
    saved = output.read_bytes()
    assert source.read_bytes() == before
    source.write_bytes(b"{}")
    assert subprocess.run(command, capture_output=True).returncode != 0
    assert output.read_bytes() == saved
    assert subprocess.run(command[:-1] + [str(source)], capture_output=True).returncode != 0


def test_empty_saved_placeholder_cannot_be_presented_as_fresh_ranking():
    source = Path("uk_renewables_pipeline/202611161734/news/pipeline_headlines.snapshot.json")
    before = source.read_bytes()
    with pytest.raises(ValueError):
        B.build(before)
    assert source.read_bytes() == before


def test_actual_collector_fixture_output_keeps_every_item(tmp_path):
    from automation.news.tests.test_pipeline_headlines import run
    code, doc = run(tmp_path)
    assert code == 0
    result = B.build(raw(doc))
    assert result["input_count"] == len(doc["items"]) > 0
    assert {entry["link"] for entry in result["entries"]} == {item["link"] for item in doc["items"]}
