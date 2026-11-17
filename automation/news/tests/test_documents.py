"""Synthetic parser negatives plus optional pinned actual local-byte verification."""
from copy import deepcopy
from hashlib import sha256
import json
import os
from pathlib import Path

import pytest

from automation.news.filings.documents import POLICIES, OGL, BoundedHTML, _distil_html, day, distil_document

URL = list(POLICIES)[1]
POLICY = POLICIES[URL]
STAMP = "2026-11-17T15:48:11Z"


def synthetic(body=None, project="EN020026", extra=""):
    body = body if body is not None else "It is a high voltage direct current link between Kent and Suffolk. It will have a transmission capacity of up to 2 gigawatts."
    return (f'<main id="content"><h1>{POLICY["title"]}</h1><dl><dt>From:</dt><dd>{POLICY["publisher"]}</dd><dt>Published:</dt><dd>30 October 2026</dd></dl>'
            f'<a href="https://example.test/projects/{project}">Project</a><div class="gem-c-govspeak"><p>{body}</p><p>Date of decision</p><p>30 October 2026</p>{extra}</div></main>').encode()


def parse(data):
    return _distil_html(data, POLICY, URL, STAMP)


def test_synthetic_typed_power_has_exact_units_meaning_and_locator():
    data = synthetic()
    result = parse(data)
    assert result["publishable"] is False
    claim = result["claims"][0]
    assert (claim["value"], claim["unit"], claim["basis"], claim["as_of"]) == ("2", "GW", "forecast", "2026-10-30")
    assert claim["quantity_kind"] == "grid_upgrade"
    assert result["unknowns"]["current_capacity"] is None
    locator = result["facts"][1]["locator"]
    assert locator["paragraph"] == 1 and locator["document_sha256"] == sha256(data).hexdigest()
    assert locator["selector"] == "main#content > div:nth-of-type(1) > p:nth-of-type(1)"


@pytest.mark.parametrize("body", ["It currently has 2 gigawatts.", "It will have a transmission capacity of up to 2 gigawatt-hours.", "It will have a transmission capacity of up to 400 kilovolts.", "It will have a transmission capacity of up to 2 gigawatts.", "Unknown capacity"])
def test_unit_or_meaning_or_context_ambiguity_abstains(body):
    with pytest.raises(ValueError):
        parse(synthetic(body))


@pytest.mark.parametrize("project", ["EN999999", "EN020026 EN999999", ""])
def test_wrong_crossproject_identity_abstains(project):
    with pytest.raises(ValueError):
        parse(synthetic(project=project))


def test_script_facts_and_title_markup_never_become_authority():
    data = synthetic() + b'<script><p>It will have a transmission capacity of up to 99 gigawatts.</p></script>'
    assert parse(data)["claims"][0]["value"] == "2"
    with pytest.raises(ValueError):
        parse(synthetic().replace(b"Sea Link:", b"<img src=x onerror=alert(1)>Spoof:"))


def test_duplicate_capacity_and_mixed_tables_abstain():
    with pytest.raises(ValueError):
        parse(synthetic(extra='<p>It will have a transmission capacity of up to 3 gigawatts.</p>'))
    with pytest.raises(ValueError):
        parse(synthetic(body='<table><tr><td>2 gigawatts</td><td>3 gigawatts</td></tr></table>'))


@pytest.mark.parametrize("value", ["2026", "October 2026", "30 October 2026T00:00Z", "31 February 2026"])
def test_no_partial_date_expansion_or_fabricated_instants(value):
    with pytest.raises(ValueError):
        day(value)


def test_unknown_unsafe_sources_changed_hash_and_pdf_unavailable():
    for source in ("javascript:alert(1)", URL + "?spoof=1", "https://evil.test/"):
        assert distil_document(b"", source_url=source, receipt={})["reason"] == "source_not_approved"
    revised = distil_document(synthetic(), source_url=URL, receipt={})
    assert revised["reason"] == "source_revision_requires_review" and revised["facts"] == []
    for payload in (b"%PDF scanned image", b"%PDF mixed table unlocated", b"%PDF unknown rights"):
        result = distil_document(payload, source_url=URL, receipt={}, content_type="application/pdf")
        assert result["facts"] == [] and result["status"] == "unavailable"


def test_source_receipts_fail_closed_even_when_policy_hash_is_pinned(monkeypatch):
    data = synthetic()
    monkeypatch.setitem(POLICIES, URL, {**POLICY, "sha256": sha256(data).hexdigest(), "bytes": len(data)})
    receipt = {"source_url": URL, "sha256": sha256(data).hexdigest(), "bytes": len(data), "http_status": 200,
               "content_type": "text/html", "licence_url": OGL, "retrieved_at": STAMP}
    assert distil_document(data, source_url=URL, receipt=receipt)["status"] == "machine-provisional"
    for key, value in (("licence_url", "unknown"), ("http_status", 403), ("sha256", "0" * 64), ("retrieved_at", "2026-01-01")):
        bad = {**receipt, key: value}
        assert distil_document(data, source_url=URL, receipt=bad)["status"] == "unavailable"


def test_actual_pinned_documents_when_local_receipts_available():
    directory = os.environ.get("DOCUMENT_SOURCE_DIR")
    if not directory:
        pytest.skip("actual HTML bytes are private retrieval artifacts; set DOCUMENT_SOURCE_DIR")
    records = json.loads(Path("automation/news/grid_watch/government-facts.json").read_text())["records"]
    results = [distil_document((Path(directory) / f"source-{i}.html").read_bytes(), source_url=row["source_url"], receipt=row["source_receipt"]) for i, row in enumerate(records, 1)]
    assert [r["status"] for r in results] == ["machine-provisional"] * 2
    assert [len(r["facts"]) for r in results] == [4, 2]
    assert results[0]["facts"][0]["value"] == {"value": "2025-03-27", "precision": "DAY"}
    assert results[1]["claims"][0]["value"] == "2"
    assert all(r["publishable"] is False for r in results)
    for i, result in enumerate(results, 1):
        parser = BoundedHTML()
        parser.feed((Path(directory) / f"source-{i}.html").read_text(encoding="utf-8"))
        main = next(n for n in parser.root.walk() if n.tag == "main" and n.attrs.get("id") == "content")
        for fact in result["facts"]:
            found = [n for n in main.walk() if n.selector() == fact["locator"]["selector"]]
            assert len(found) == 1
            assert sha256(found[0].text().encode()).hexdigest() == fact["locator"]["text_sha256"]
