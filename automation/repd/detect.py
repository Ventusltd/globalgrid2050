"""Discover the current REPD release on GOV.UK and emit a release descriptor.

Two sources, both read through an injectable fetcher (see fetch.Response):
  * GOV.UK Content API JSON (as pipelinenews tooling/check-repd-source-v2.mjs:
    details.attachments[], public_updated_at);
  * the publication page HTML (as scripts/repd_updater.py discover_latest_sources:
    attachment links + "Last updated <d Month yyyy>").

Differences from repd_updater.py, deliberately:
  * no silent fall-back to hard-coded July URLs; failure is an error;
  * /csv-preview/ links and non-asset hosts are ignored (the first-match rule in
    repd_updater could pick the preview page);
  * quarter is read from the file names and cross-checked against the attachment
    title month; any disagreement fails closed;
  * "already current" compares URLs AND quarter against a baseline descriptor
    (repd_updater compared only manifest_v4 source_url).
Detection never assigns an expected sha256: hashes are pinned only after fetch +
review (see fetch.py).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

try:
    from . import config
    from .fetch import Fetcher, Response, file_name, urllib_fetcher, utc_now
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from automation.repd import config  # type: ignore
    from automation.repd.fetch import Fetcher, Response, file_name, urllib_fetcher, utc_now  # type: ignore

ASSET_HOST = "assets.publishing.service.gov.uk"


class DetectError(RuntimeError):
    pass


# ---------------------------------------------------------------- parsing
class _Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[dict] = []
        self.text: list[str] = []
        self._a: Optional[dict] = None
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        if tag == "a":
            self._a = {"href": dict(attrs).get("href") or "", "text": []}

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1
        if tag == "a" and self._a is not None:
            self._a["text"] = " ".join(" ".join(self._a["text"]).split())
            self.links.append(self._a)
            self._a = None

    def handle_data(self, data):
        if self._skip:
            return
        s = data.strip()
        if s:
            self.text.append(s)
            if self._a is not None:
                self._a["text"].append(s)


def _attachment(url: str, title: str) -> Optional[dict]:
    p = urlparse(url)
    if p.netloc != ASSET_HOST or "/csv-preview/" in p.path:
        return None
    name = file_name(url)
    low = name.lower()
    role = "csv" if low.endswith(".csv") else "xlsx" if low.endswith(".xlsx") else None
    if not role or ("repd" not in low and "repd" not in (title or "").lower()):
        return None
    return {"role": role, "url": url, "title": title or "", "file_name": name}


def parse_publication_html(html: str, base: str = config.SOURCE_PAGE) -> dict:
    p = _Links()
    p.feed(html)
    atts, seen = [], set()
    for a in p.links:
        url = urljoin(base, a["href"].strip())
        att = _attachment(url, a["text"])
        if att and url not in seen:
            seen.add(url)
            atts.append(att)
    text = " ".join(p.text)
    last = None
    m = re.search(r"Last updated:?\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})", text, re.I)
    if m:
        last = datetime.strptime(m.group(1), "%d %B %Y").strftime("%Y-%m-%d")
    return {"source": "publication_html", "attachments": atts, "page_last_updated": last,
            "govuk_public_updated_at": None}


def parse_content_api(payload) -> dict:
    meta = json.loads(payload) if isinstance(payload, (str, bytes)) else payload
    atts = []
    for item in (meta.get("details") or {}).get("attachments") or []:
        url = item.get("url") or ""
        att = _attachment(urljoin("https://www.gov.uk", url), item.get("title") or "")
        if att:
            atts.append(att)
    pua = meta.get("public_updated_at")
    return {"source": "content_api", "attachments": atts,
            "page_last_updated": pua[:10] if pua else None, "govuk_public_updated_at": pua}


# ---------------------------------------------------------------- descriptor
def _pick(atts: list[dict], role: str) -> dict:
    cands = [a for a in atts if a["role"] == role]
    if not cands:
        raise DetectError(f"no REPD .{role} attachment found on the publication")
    by_q = {}
    for a in cands:
        yq = config.quarter_from_filename(a["file_name"]) or config.quarter_from_label(a["title"])
        if yq is None:
            raise DetectError(f"cannot tell the quarter of attachment {a['url']}")
        a["yq"] = yq
        by_q.setdefault(yq, []).append(a)
    latest = max(by_q)
    if len({a["url"] for a in by_q[latest]}) > 1:
        raise DetectError(f"ambiguous: several .{role} attachments for {config.quarter_text(*latest)}: "
                          + ", ".join(a["url"] for a in by_q[latest]))
    return by_q[latest][0]


def build_descriptor(parsed: dict) -> config.ReleaseDescriptor:
    csv, xlsx = _pick(parsed["attachments"], "csv"), _pick(parsed["attachments"], "xlsx")
    if csv["yq"] != xlsx["yq"]:
        raise DetectError(f"CSV is {config.quarter_text(*csv['yq'])} but XLSX is {config.quarter_text(*xlsx['yq'])}")
    yq = csv["yq"]
    for a in (csv, xlsx):
        tq = config.quarter_from_label(a["title"])
        if tq is not None and tq != yq:
            raise DetectError(f"attachment title {a['title']!r} names {config.quarter_text(*tq)} "
                              f"but file {a['file_name']} is {config.quarter_text(*yq)}")
    m = re.search(r"(January|April|July|October)\s+20\d\d", csv["title"] + " " + xlsx["title"], re.I)
    if m:
        label = m.group(0).title()
    else:  # derive from quarter: Q1->April, Q2->July, Q3->October, Q4->January next year
        month = {1: "April", 2: "July", 3: "October", 4: "January"}[yq[1]]
        label = f"{month} {yq[0] + 1 if yq[1] == 4 else yq[0]}"
    desc = config.ReleaseDescriptor(
        release_id=config.release_id_for(*yq), label=label, quarter=config.quarter_text(*yq),
        csv_url=csv["url"], xlsx_url=xlsx["url"], page_last_updated=parsed.get("page_last_updated"),
        govuk_public_updated_at=parsed.get("govuk_public_updated_at"),
        dataset_title=csv["title"] or None,
        provenance=[f"detected from {parsed['source']} at {utc_now()}"],
    )
    return desc.validate()


def compare(candidate: config.ReleaseDescriptor, baseline: Optional[config.ReleaseDescriptor]) -> str:
    if baseline is None:
        return "NO_BASELINE"
    cq, bq = candidate.release_id, baseline.release_id
    if (candidate.csv_url, candidate.xlsx_url) == (baseline.csv_url, baseline.xlsx_url):
        return "UNCHANGED"
    if cq == bq:
        return "REPLACED_SAME_QUARTER"   # correction re-upload: new URLs, needs a new review
    if cq > bq:                          # '2026q3' > '2026q2' sorts correctly for 20xx
        return "NEW_RELEASE"
    raise DetectError(f"publication shows {cq}, older than baseline {bq}")


def detect(fetcher: Fetcher, kind: str = "api", baseline: Optional[config.ReleaseDescriptor] = None) -> dict:
    url = config.CONTENT_API if kind == "api" else config.SOURCE_PAGE
    resp = fetcher(url)
    if not resp.status_chain or resp.status_chain[-1][0] != 200:
        raise DetectError(f"{url}: final status {resp.status_chain}")
    body = resp.body.decode("utf-8")
    parsed = parse_content_api(body) if kind == "api" else parse_publication_html(body, resp.final_url)
    desc = build_descriptor(parsed)
    return {"schema": "globalgrid2050.repd-detect-report.v1", "detected_at": utc_now(),
            "source_url": url, "source_final_url": resp.final_url, "status_chain": resp.status_chain,
            "status": compare(desc, baseline),
            "baseline_release_id": baseline.release_id if baseline else None,
            "descriptor": desc.to_dict()}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Detect the current REPD release")
    ap.add_argument("--kind", choices=["api", "html"], default="api")
    ap.add_argument("--from-file", help="offline: saved Content API JSON or page HTML")
    ap.add_argument("--baseline", help="descriptor of the last ingested release")
    ap.add_argument("--out", help="write detect_report.json and detected_<id>.json here")
    a = ap.parse_args(argv)
    if a.from_file:
        raw = Path(a.from_file).read_bytes()
        fetcher = lambda url: Response(url, url, [[200, url]], raw)  # noqa: E731
    else:
        fetcher = urllib_fetcher()
    baseline = config.load(a.baseline) if a.baseline else None
    try:
        report = detect(fetcher, a.kind, baseline)
    except (DetectError, config.DescriptorError) as exc:
        print(f"DETECT FAILED: {exc}", file=sys.stderr)
        return 2
    if a.out:
        out = Path(a.out)
        out.mkdir(parents=True, exist_ok=True)
        (out / "detect_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        rid = report["descriptor"]["release_id"]
        (out / f"detected_{rid}.json").write_text(json.dumps(report["descriptor"], indent=2) + "\n", encoding="utf-8")
    d = report["descriptor"]
    print(f"{report['status']}: {d['release_id']} {d['label']} csv={d['csv_url']} xlsx={d['xlsx_url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
