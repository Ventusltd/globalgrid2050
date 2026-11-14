#!/usr/bin/env python3
"""Read-only public Pages smoke/served-byte gate for a dated Pipeline News candidate.

This tool NEVER writes to a repository, Pages, or an external service. It fails
closed if the public site is inaccessible or if public bytes differ from the pinned homepage owner or immutable releases.
"""
import csv
import hashlib
import io
import json
import os
import re
import shutil
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://globalgrid2050.com"
GRID = "https://ventusltd.github.io/gridatlas/atlas/"
CANDIDATE = "202611140306"
Q3 = "202611132345"
OLD = "202609082224"
RELEASE_PATHS = tuple(f"uk_renewables_pipeline/{r}/index.html" for r in (CANDIDATE, Q3, OLD))
OWNER_FILES = {"index.html", "assets/versioned-homepage.css", "assets/versioned-homepage.js",
               "data/homepage.json", "data/active-pages.json", "data/presentation.json", "data/entity-types.json"}


def fetch(url):
    errors = []
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": "GlobalGrid2050-readonly-release-QA/1.0", "Cache-Control": "no-cache"}), timeout=40) as response:
                if response.status != 200:
                    raise ValueError(f"HTTP {response.status}")
                return response.read()
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            errors.append(str(exc))
            if attempt < 3:
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Cannot fetch {url}: {errors}")


def expected_homepage():
    """Pages imports hash-pinned owner bytes at BUILD time; checkout root is not authoritative."""
    pin = json.loads((ROOT / "catalogue/homepage-owner.json").read_text(encoding="utf-8"))
    if pin.get("repository") != "Ventusltd/globalgrid2050-homepage" or not re.fullmatch(r"[0-9a-f]{40}", pin.get("commit", "")):
        raise AssertionError("Invalid homepage owner pin")
    if set(pin.get("files", {})) != OWNER_FILES:
        raise AssertionError("Incomplete homepage owner pin")
    expected = {}
    for name, digest in pin["files"].items():
        if not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise AssertionError("Invalid owner SHA256: " + name)
        data = fetch(f'https://raw.githubusercontent.com/{pin["repository"]}/{pin["commit"]}/{name}')
        if len(data) > 1000000 or hashlib.sha256(data).hexdigest() != digest:
            raise AssertionError("Owner source SHA256 mismatch: " + name)
        if name == "index.html":
            index = data.decode("utf-8-sig")
            for asset in ("versioned-homepage.css", "versioned-homepage.js"):
                source = "./assets/" + asset
                if index.count(source) != 1:
                    raise AssertionError("Unexpected homepage asset reference")
                index = index.replace(source, "./homepage-shell/assets/" + asset)
            source = 'href="data/homepage.json"'
            if index.count(source) != 1:
                raise AssertionError("Unexpected homepage catalogue reference")
            expected["index.html"] = (index.replace(source, 'href="./homepage-shell/data/homepage.json"').rstrip() + "\\n").encode("utf-8")
        else:
            expected["homepage-shell/" + name] = data
    if sum(len(data) for data in expected.values()) >= 1000000:
        raise AssertionError("Homepage bundle over 1 MB")
    return pin["commit"], expected


def served_bytes():
    owner_commit, expected = expected_homepage()
    for path in RELEASE_PATHS:
        expected[path] = (ROOT / path).read_bytes()
    result = {}
    for path, source in expected.items():
        served = fetch(f"{SITE}/{path}")
        source_sha = hashlib.sha256(source).hexdigest()
        served_sha = hashlib.sha256(served).hexdigest()
        result[path] = {
            "expected_sha256": source_sha, "served_sha256": served_sha,
            "basis": "pinned-homepage-owner:" + owner_commit if path not in RELEASE_PATHS else "immutable-release-checkout",
            "size": len(served), "pass": source_sha == served_sha,
        }
    return result

def browser_checks():
    from playwright.sync_api import sync_playwright
    findings = {}
    with sync_playwright() as p:
        chrome = next((shutil.which(name) for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser") if shutil.which(name)), None)
        if not chrome:
            raise RuntimeError("Hosted runner has no installed Chrome/Chromium binary")
        browser = p.chromium.launch(headless=True, executable_path=chrome, args=["--no-sandbox"])
        for width in (1440, 390):
            page = browser.new_page(viewport={"width": width, "height": 900}, accept_downloads=True)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{SITE}/uk_renewables_pipeline/{CANDIDATE}/", wait_until="domcontentloaded", timeout=90000)
            page.wait_for_function("document.body && document.body.innerText.includes('7,775')", timeout=90000)
            assert page.locator("#exportInline").count() == 1, "CSV export control missing"
            assert page.locator("#mapAtlasNav").get_attribute("href") == GRID, "MAP receiver changed"
            page.wait_for_function("document.querySelector('#tbody')?.dataset.total === '7775'", timeout=90000)
            # Verify the actual generated CSV, not just the existence of a control.
            with page.expect_download(timeout=60000) as pending:
                page.locator("#exportInline").click(timeout=30000)
            csv_bytes = Path(pending.value.path()).read_bytes()
            csv_rows = list(csv.reader(io.StringIO(csv_bytes.decode("utf-8-sig"), newline="")))
            assert len(csv_rows) == 7776, f"CSV expected 7,775 data rows, got {len(csv_rows) - 1}"
            assert "REPD Ref" in csv_rows[0], "CSV identity header absent"
            ref_col = csv_rows[0].index("REPD Ref")
            refs = [r[ref_col] for r in csv_rows[1:]]
            assert len(set(refs)) == 7775 and all(refs), "CSV contains duplicate or blank REPD IDs"
            # Follow a real table MAP link and require the receiver to name the same Ref.
            first = page.locator("#tbody a.atlaslink").first
            href = first.get_attribute("href")
            assert href and href.startswith(GRID + "?"), "MAP link receiver changed"
            ref = parse_qs(urlparse(href).query).get("repd_ref", [None])[0]
            assert ref and page.locator(f"#repd-{ref}").count() == 1, "MAP/row identity mismatch"
            with page.expect_popup(timeout=60000) as opening:
                first.click(timeout=30000)
            arrival = opening.value
            arrival.wait_for_load_state("domcontentloaded", timeout=90000)
            arrival.wait_for_function("(r) => document.body && document.body.innerText.includes('REPD ' + r)", arg=ref, timeout=90000)
            assert urlparse(arrival.url).netloc == "ventusltd.github.io", "MAP opened unexpected origin"
            arrival.close()
            assert page.locator("a[href*='202609082224']").count() > 0, "Legacy release navigation missing"
            assert not errors, f"JavaScript errors at {width}: {errors[:5]}"
            findings[f"pipeline_{width}"] = {"url": page.url, "csv_download_rows": len(csv_rows) - 1, "unique_repd_refs": len(set(refs)), "live_map_ref": ref, "map_nav": GRID, "js_errors": 0}
            page.close()
        home = browser.new_page(viewport={"width": 390, "height": 844})
        home.goto(SITE + "/", wait_until="domcontentloaded", timeout=90000)
        assert home.locator(f'a[href="{SITE}/uk_renewables_pipeline/{Q3}/"]').count() > 0, "Q3 homepage link missing"
        findings["homepage_390"] = {"q3_link_present": True}
        home.close()
        atlas = browser.new_page(viewport={"width": 390, "height": 844})
        atlas.goto(GRID, wait_until="domcontentloaded", timeout=90000)
        atlas.wait_for_selector("canvas.maplibregl-canvas", timeout=90000)
        findings["gridatlas_390"] = {"map_canvas_present": True, "url": atlas.url}
        atlas.close()
        browser.close()
    return findings


def main():
    out = Path(os.environ.get("GITHUB_WORKSPACE", str(ROOT))) / "phase2-live-readonly-report.json"
    report = {"candidate": CANDIDATE, "q3_operative": Q3, "legacy": OLD, "scope": "read-only", "checks": {}}
    try:
        report["checks"]["served_bytes"] = served_bytes()
        try:
            report["checks"]["browser"] = browser_checks()
        except Exception as exc:
            report["checks"]["browser_error"] = f"{type(exc).__name__}: {exc}"
        mismatches = [p for p, item in report["checks"]["served_bytes"].items() if not item["pass"]]
        if mismatches or "browser_error" in report["checks"]:
            raise AssertionError(f"Live gate failed: byte mismatches={mismatches}; browser={report['checks'].get('browser_error', 'PASS')}")
        report["status"] = "PASS"
    except Exception as exc:
        report["status"] = "FAIL"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
        print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
