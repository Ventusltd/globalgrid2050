#!/usr/bin/env python3
"""Read-only current Pipeline News/owner bundle and immutable rollback readback.

The legacy directory name is retained. The hash-pinned homepage owner, not the
registry tail or newest public URL, selects the operative release.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://globalgrid2050.com/"
ROLLBACKS = ("202611161244", "202611160020")
FILES = {"index.html", "assets/versioned-homepage.css", "assets/versioned-homepage.js",
         "data/homepage.json", "data/active-pages.json", "data/presentation.json", "data/entity-types.json"}
MAX_BYTES = 2_000_000


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"duplicate JSON key: {key}")
        result[key] = value
    return result


def decode(data):
    return json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique_object)


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("readback redirects are not permitted")


def read(url):
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == "https" and parsed.hostname in {"globalgrid2050.com", "raw.githubusercontent.com"}
            and not parsed.username and not parsed.password and parsed.port in (None, 443), "unsafe readback URL")
    request = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050-Public-Readback/2.0", "Cache-Control": "no-cache"})
    with urllib.request.build_opener(NoRedirects()).open(request, timeout=10) as response:
        require(response.status == 200, f"HTTP {response.status}: {url}")
        length = response.headers.get("Content-Length")
        require(length is None or int(length) <= MAX_BYTES, "oversized response header")
        body = response.read(MAX_BYTES + 1)
        require(len(body) <= MAX_BYTES, "oversized response body")
        return body


def transformed_index(raw):
    """Match scripts/import_homepage_owner.py; parity-tested against its real main."""
    index = raw.decode("utf-8-sig")
    for name in ("versioned-homepage.css", "versioned-homepage.js"):
        source = f"./assets/{name}"
        require(index.count(source) == 1, f"unexpected index reference: {name}")
        index = index.replace(source, f"./homepage-shell/assets/{name}")
    source = 'href="data/homepage.json"'
    require(index.count(source) == 1, "unexpected catalogue fallback reference")
    return (index.replace(source, 'href="./homepage-shell/data/homepage.json"').rstrip() + "\n").encode("utf-8")


def git_value(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def prepare(root=ROOT, fetch=read, git=git_value):
    pin = decode((root / "catalogue/homepage-owner.json").read_bytes())
    require(pin.get("repository") == "Ventusltd/globalgrid2050-homepage"
            and re.fullmatch(r"[0-9a-f]{40}", pin.get("commit", "")), "invalid owner pin")
    require(set(pin.get("files", {})) == FILES, "unexpected owner bundle files")
    bundle = {}
    for name, digest in pin["files"].items():
        require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest), "invalid owner digest")
        body = fetch(f'https://raw.githubusercontent.com/{pin["repository"]}/{pin["commit"]}/{name}')
        require(len(body) <= 1_000_000 and sha(body) == digest, f"owner source hash mismatch: {name}")
        bundle[name] = body
    require(sum(map(len, bundle.values())) < 1_000_000, "owner bundle exceeds size limit")
    config = decode(bundle["data/homepage.json"])
    require(config.get("schema_version") == 1, "unsupported owner catalogue")
    entities = [e for e in config["entities"] if e.get("id") == "pipeline-news"]
    require(len(entities) == 1, "pipeline owner identity missing or ambiguous")
    entity = entities[0]
    current = entity.get("operative_release_id", "")
    require(re.fullmatch(r"[0-9]{12}", current), "invalid operative release identity")
    owner_releases = [r for r in entity["releases"] if r.get("id") == current]
    require(len(owner_releases) == 1 and owner_releases[0].get("status") == "available", "operative release is not available")
    require(owner_releases[0].get("url") == BASE + f"uk_renewables_pipeline/{current}/", "operative release URL mismatch")
    registry = decode((root / "automation/pipeline_release/registry.json").read_bytes())
    records = registry["versions"]
    selected = {}
    for release_id in dict.fromkeys((current, *ROLLBACKS)):
        matches = [v for v in records if v.get("id") == release_id]
        require(len(matches) == 1, "registered release missing or ambiguous")
        entry = matches[0]
        actual_tree = git(root, "rev-parse", f"HEAD:uk_renewables_pipeline/{release_id}")
        require(actual_tree in entry["trees"], f"unregistered source tree: {release_id}")
        html = (root / "uk_renewables_pipeline" / release_id / "index.html").read_bytes()
        require(entry["version"].encode() in html and release_id.encode() in html, "local release identity absent")
        selected[release_id] = {"version": entry["version"], "tree": actual_tree, "html": html}
    manifest = (root / "uk_renewables_pipeline" / ROLLBACKS[0] / "solar1000/manifest.json").read_bytes()
    seed = decode(manifest)
    require(seed["selection"] == "numeric-repd-ref-ascending" and len(seed["ids"]) == len(set(seed["ids"])) == 1000,
            "invalid frozen Solar-1000 selection")
    require(seed["ids"][0] == "1018" and seed["ids"][-1] == "2325" and seed["record_count"] == 7775
            and seed["solar_count"] == 3604 and seed["provisional_candidates"] == 2
            and seed["not_researched"] == 998 and seed["independently_verified"] == 0, "frozen baseline counts changed")
    require((root / "uk_renewables_pipeline" / current / "solar1000/manifest.json").read_bytes() == manifest,
            "operative Solar-1000 differs from frozen baseline")
    ledger = (root / "uk_renewables_pipeline/versions.json").read_bytes()
    return {"source_commit": git(root, "rev-parse", "HEAD"), "pin": pin, "bundle": bundle,
            "root_html": transformed_index(bundle["index.html"]), "current": current,
            "selected": selected, "manifest": manifest, "ledger": ledger}


def check_once(expected, fetch=read):
    observed = {}
    def exact(path, original):
        body = fetch(BASE + path)
        require(body == original, f"served byte mismatch: {path or 'index.html'}")
        observed[path or "index.html"] = sha(body)
        return body
    exact("", expected["root_html"])
    for name, body in expected["bundle"].items():
        if name != "index.html":
            exact("homepage-shell/" + name, body)
    for release_id, source in expected["selected"].items():
        exact(f"uk_renewables_pipeline/{release_id}/index.html", source["html"])
    for release_id in dict.fromkeys((expected["current"], ROLLBACKS[0])):
        exact(f"uk_renewables_pipeline/{release_id}/solar1000/manifest.json", expected["manifest"])
    ledger = decode(exact("uk_renewables_pipeline/versions.json", expected["ledger"]))
    for release_id, source in expected["selected"].items():
        matches = [v for v in ledger["versions"] if v.get("id") == release_id]
        require(len(matches) == 1, "served ledger release missing or ambiguous")
        entry = matches[0]
        require(entry.get("version") == source["version"] and entry.get("verdict") == "PASS"
                and source["tree"] in entry.get("tree", []), "served ledger identity/tree/verdict mismatch")
    return {"status": "PASS", "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "source_commit": expected["source_commit"], "homepage_owner_commit": expected["pin"]["commit"],
            "release": expected["current"], "version": expected["selected"][expected["current"]]["version"],
            "owner_source_index_sha256": sha(expected["bundle"]["index.html"]),
            "transformed_root_sha256": sha(expected["root_html"]), "served_sha256": observed,
            "rollback_releases": list(ROLLBACKS), "solar_1000": 1000,
            "scope": "Exact source-pinned HTTP bytes, operative owner release, ledger and V9.24/V9.23 rollback. Not rights approval, project verification, live MAP/browser acceptance or promotion."}


def bounded_env(name, default, low, high):
    value = int(os.environ.get(name, str(default)))
    require(low <= value <= high, f"{name} outside allowed bounds")
    return value


def main():
    out = Path(os.environ.get("PIPELINE_RECEIPT_PATH", str(Path(tempfile.gettempdir()) / "pipeline-public-receipt.json")))
    receipt = {"status": "FAIL", "scope": "public readback"}
    try:
        attempts = bounded_env("PIPELINE_VERIFY_ATTEMPTS", 3, 1, 4)
        delay = bounded_env("PIPELINE_VERIFY_DELAY_SECONDS", 8, 0, 15)
        expected = prepare()
        for attempt in range(1, attempts + 1):
            try:
                receipt = check_once(expected)
                break
            except (ValueError, OSError, KeyError, TypeError) as exc:
                receipt = {"status": "FAIL", "attempt": attempt, "source_commit": expected["source_commit"], "error": str(exc)}
                print(f"Public readback attempt {attempt}/{attempts}: {exc}", flush=True)
                if attempt < attempts:
                    time.sleep(delay)
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError) as exc:
        receipt = {"status": "FAIL", "error": str(exc)}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt))
    return 0 if receipt["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
