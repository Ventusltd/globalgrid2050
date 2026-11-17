"""Bounded, offline distillation of two reviewed government HTML publications.

No fetching, OCR, joins or authority transitions. Changed documents require review.
Only short typed facts and content-addressed DOM locators leave this module.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from hashlib import sha256
from html.parser import HTMLParser
import re

from .contracts import validate_claim

OGL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
SCOPE = "government_html_facts_only_no_images_or_third_party_material"
POLICIES = {
    "https://www.gov.uk/government/news/sea-link-development-consent-decision-announced": {
        "sha256": "b9ba26b90820292e0b181da7993d2d3a2180fc2de0ac53cc6239adeb4cccfaeb", "bytes": 68432,
        "publisher": "Planning Inspectorate", "title": "Sea Link development consent decision announced", "kind": "pins"},
    "https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008": {
        "sha256": "c26f93aa307740f8b4ec8ad150b152fb6d30e77f201e5bc31a6da52bba16e0d0", "bytes": 69536,
        "publisher": "Department for Energy Security and Net Zero", "title": "Sea Link: development consent order, Planning Act 2008", "kind": "desnz"},
}
VOID = frozenset("area base br col embed hr img input link meta param source track wbr".split())
IGNORED = frozenset("script style svg template nav footer form iframe noscript".split())


@dataclass(eq=False)
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    parent: object = None
    children: list = field(default_factory=list)

    def text(self):
        if self.tag in IGNORED:
            return ""
        return " ".join(" ".join(c if isinstance(c, str) else c.text() for c in self.children).split())

    def walk(self):
        if self.tag in IGNORED:
            return
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def selector(self):
        if self.tag == "main" and self.attrs.get("id") == "content":
            return "main#content"
        siblings = [c for c in self.parent.children if isinstance(c, Node) and c.tag == self.tag]
        return self.parent.selector() + f" > {self.tag}:nth-of-type({siblings.index(self) + 1})"


class BoundedHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]
        self.count = 0

    def handle_starttag(self, tag, attrs):
        self.count += 1
        if self.count > 20000 or len(self.stack) > 100:
            raise ValueError("HTML structural bound exceeded")
        if len(attrs) != len(dict(attrs)):
            raise ValueError("duplicate HTML attribute")
        node = Node(tag, dict(attrs), self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def day(text):
    """DAY only; never manufacture a midnight instant or expand partial dates."""
    if not re.fullmatch(r"\d{1,2} [A-Z][a-z]+ \d{4}", text):
        raise ValueError("source date is not an explicit English DAY")
    return {"value": datetime.strptime(text, "%d %B %Y").date().isoformat(), "precision": "DAY"}


def unavailable(reason, **extra):
    return {"schema": "globalgrid2050.document-facts.v1", "status": "unavailable", "reason": reason,
            "facts": [], "claims": [], "publishable": False, **extra}


def _distil_html(payload, policy, url, retrieved_at):
    """Internal parser; public entry additionally enforces immutable source/rights pins."""
    parser = BoundedHTML()
    parser.feed(payload.decode("utf-8", errors="strict"))
    mains = [n for n in parser.root.walk() if n.tag == "main" and n.attrs.get("id") == "content"]
    if len(mains) != 1:
        raise ValueError("one visible main#content required")
    main = mains[0]
    nodes = list(main.walk())
    headings = [n.text() for n in nodes if n.tag == "h1"]
    if headings != [policy["title"]]:
        raise ValueError("wrong or ambiguous document title")
    project_ids = set(re.findall(r"\bEN\d{6}\b", main.text() + " " + " ".join(n.attrs.get("href", "") for n in nodes)))
    if project_ids != {"EN020026"}:
        raise ValueError("wrong or ambiguous project identity")
    published = []
    publishers = []
    for n in nodes:
        if n.tag != "dt" or n.text() not in ("Published:", "From:"):
            continue
        siblings = [c for c in n.parent.children if isinstance(c, Node)]
        i = siblings.index(n)
        if i + 1 < len(siblings) and siblings[i + 1].tag == "dd":
            (published if n.text() == "Published:" else publishers).append(siblings[i + 1].text())
    if publishers != [policy["publisher"]] or len(published) != 1:
        raise ValueError("publisher/publication unavailable or ambiguous")
    publication = day(published[0])
    if publication["value"] > datetime.fromisoformat(retrieved_at.replace("Z", "+00:00")).date().isoformat():
        raise ValueError("publication after retrieval")
    paragraphs = [n for n in nodes if n.tag == "p" and any("gem-c-govspeak" in a.attrs.get("class", "").split() for a in _ancestors(n))]
    digest = sha256(payload).hexdigest()
    facts = []

    def fact(name, value, node, unit=None, meaning=None):
        text = node.text()
        facts.append({"id": name, "value": value, "unit": unit, "meaning": meaning,
                      "locator": {"kind": "HTML_PARAGRAPH", "selector": node.selector(),
                                  "paragraph": paragraphs.index(node) + 1,
                                  "text_sha256": sha256(text.encode()).hexdigest(), "document_sha256": digest}})

    def unique(pattern):
        matches = [(n, re.search(pattern, n.text())) for n in paragraphs]
        matches = [(n, m) for n, m in matches if m]
        if len(matches) != 1:
            raise ValueError("missing or ambiguous source fact")
        return matches[0]

    claims = []
    if policy["kind"] == "pins":
        node, match = unique(r"submitted to the Planning Inspectorate for consideration by National Grid Electricity Transmission \(NGET\) Plc on (\d{1,2} \w+ \d{4}) and accepted for examination on (\d{1,2} \w+ \d{4})\.")
        fact("application_submitted", day(match[1]), node)
        fact("application_accepted", day(match[2]), node)
        fact("reported_network_operator", "National Grid Electricity Transmission (NGET) Plc", node)
        node, match = unique(r"recommendations were made to the Secretary of State on (\d{1,2} \w+ \d{4})\.")
        fact("recommendation", day(match[1]), node)
        dates = [f["value"]["value"] for f in facts if isinstance(f["value"], dict)]
        if dates != sorted(dates) or dates[-1] > publication["value"]:
            raise ValueError("milestone chronology ambiguous")
    else:
        labels = [i for i, n in enumerate(paragraphs) if n.text() == "Date of decision"]
        if len(labels) != 1 or labels[0] + 1 >= len(paragraphs):
            raise ValueError("decision DAY unavailable")
        date_node = paragraphs[labels[0] + 1]
        decision = day(date_node.text())
        if decision["value"] > publication["value"]:
            raise ValueError("decision after publication")
        fact("consent_decision", decision, date_node)
        node, match = unique(r"It will have a transmission capacity of up to (\d+(?:\.\d+)?) gigawatts\.")
        if not all(s in node.text() for s in ("Kent and Suffolk", "high voltage direct current")):
            raise ValueError("capacity context unavailable")
        fact("planned_transmission_upper_bound", match[1], node, "GW", "forecast upper bound; not current, available or commissioned capacity")
        claim = {"schema": "globalgrid2050.filing-figure.v1", "claim_id": "planning:EN020026:planned-transmission:" + digest[:16],
                 "status": "machine-provisional", "quantity_kind": "grid_upgrade", "metric": "Planned transmission capacity upper bound",
                 "value": match[1], "scale": "1", "unit": "GW", "original_unit": "up to " + match[1] + " gigawatts",
                 "currency": None, "finance_stage": None,
                 "entity": {"scope": "project", "id": "planning:EN020026", "consolidation_group_id": None, "identity_evidence_url": url},
                 "reporting_period": None, "as_of": decision["value"], "basis": "forecast", "assurance": "unknown",
                 "provenance": {"document_id": "planning:EN020026:" + digest, "document_url": url, "sha256": digest,
                                "page": None, "section": node.selector(), "published_date": publication["value"], "retrieved_at": retrieved_at},
                 "revision": {"id": digest, "supersedes_claim_id": None, "restated": False}}
        claims.append(validate_claim(claim))
    return {"schema": "globalgrid2050.document-facts.v1", "status": "machine-provisional", "publishable": False,
            "project": "planning:EN020026", "title": policy["title"], "publisher": policy["publisher"],
            "authority_role": "government_authority", "source_url": url, "source_version": digest,
            "retrieved_at": retrieved_at, "published_date": publication, "document_type": "HTML",
            "rights": {"licence_url": OGL, "scope": SCOPE, "state": "REVIEW_REQUIRED"},
            "facts": facts, "claims": claims, "unknowns": {"commissioned_date": None, "current_capacity": None,
             "coordinates": None, "repd_join": None}, "revision": {"state": "pinned_original", "supersedes": None}}


def _ancestors(node):
    while node.parent:
        node = node.parent
        yield node


def distil_document(payload: bytes, *, source_url: str, receipt: dict, content_type="text/html"):
    """Read caller-provided bytes only. Receipts are evidence, never review approval."""
    policy = POLICIES.get(source_url)
    if policy is None:
        return unavailable("source_not_approved")
    if not isinstance(payload, bytes) or len(payload) > 1_000_000:
        return unavailable("document_size_or_type")
    if content_type != "text/html":
        return unavailable("pdf_extraction_unavailable_no_approved_pdf_or_extractor")
    digest = sha256(payload).hexdigest()
    if digest != policy["sha256"] or len(payload) != policy["bytes"]:
        return unavailable("source_revision_requires_review", observed_sha256=digest, accepted_sha256=policy["sha256"])
    if not isinstance(receipt, dict) or any(receipt.get(k) != v for k, v in {
            "source_url": source_url, "sha256": digest, "bytes": len(payload), "http_status": 200,
            "licence_url": OGL}.items()) or not str(receipt.get("content_type", "")).startswith("text/html"):
        return unavailable("retrieval_or_rights_receipt_invalid")
    try:
        stamp = receipt["retrieved_at"]
        parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("retrieval timezone unavailable")
        return _distil_html(payload, policy, source_url, stamp)
    except (ValueError, KeyError, UnicodeError, RecursionError) as error:
        return unavailable("distillation_abstained", detail=str(error)[:180])


def main(argv=None):
    """Explicit offline reproduction, not a collector or scheduled publication path."""
    import argparse
    import json
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--receipts", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    rows = json.loads(args.receipts.read_text(encoding="utf-8"))["records"]
    if len(rows) != 2 or {r.get("source_url") for r in rows} != set(POLICIES):
        parser.error("exact two approved source receipts required")
    documents = []
    for i, row in enumerate(rows, 1):
        source = args.source_dir / f"source-{i}.html"
        if source.stat().st_size > 1_000_000:
            parser.error("source exceeds byte bound")
        documents.append(distil_document(source.read_bytes(), source_url=row["source_url"], receipt=row["source_receipt"]))
    payload = {"schema": "globalgrid2050.distilled-document-bundle.v1", "documents": documents,
               "pdf_status": "unavailable: no approved local PDF and no installed extractor; no OCR attempted"}
    args.output.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    return 0 if all(d["status"] == "machine-provisional" for d in documents) else 2


if __name__ == "__main__":
    raise SystemExit(main())
