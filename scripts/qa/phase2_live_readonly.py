#!/usr/bin/env python3
"""Read-only public Pages smoke/served-byte gate for a dated Pipeline News candidate.

This tool NEVER writes to a repository, Pages, or an external service. It fails
closed if the public site is inaccessible or if bytes differ from checkout.
"""
import hashlib
import json
import os
import shutil
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://globalgrid2050.com"
GRID = "https://ventusltd.github.io/gridatlas/atlas/"
CANDIDATE = "202611140306"
Q3 = "202611132345"
OLD = "202609082224"
PATHS = (
    "index.html",
    "homepage-shell/data/homepage.json",
    f"uk_renewables_pipeline/{CANDIDATE}/index.html",
    f"uk_renewables_pipeline/{Q3}/index.html",
    f"uk_renewables_pipeline/{OLD}/index.html",
)


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


def served_bytes():
    result = {}
    for path in PATHS:
        source = (ROOT / path).read_bytes()
        served = fetch(f"{SITE}/{path}")
        source_sha = hashlib.sha256(source).hexdigest()
        served_sha = hashlib.sha256(served).hexdigest()
        result[path] = {"source_sha256": source_sha, "served_sha256": served_sha, "size": len(served), "pass": source_sha == served_sha}
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
            assert page.locator("a[href*='202609082224']").count() > 0, "Legacy release navigation missing"
            assert not errors, f"JavaScript errors at {width}: {errors[:5]}"
            findings[f"pipeline_{width}"] = {"url": page.url, "csv_control": True, "map_nav": GRID, "js_errors": 0}
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
