"""Opt-in real Chromium/Playwright acceptance: python automation/news/datacentre-ui/tests/browser_smoke.py
Requires: python -m pip install playwright ; Chromium provisioned with python -m playwright install chromium.
Never publishes/merges or contacts external websites; localhost static server only.
"""
from __future__ import annotations
import functools
import hashlib
import http.server
import json
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "uk_renewables_pipeline" / "202611161757" / "global-datacentres"
BASELINE = ROOT / "uk_renewables_pipeline" / "202611161747" / "global-datacentres" / "projects.json"
PREFIX = "/uk_renewables_pipeline/202611161757/global-datacentres/"
PATHS = {
    "projects": PREFIX + "projects.json",
    "official": PREFIX + "official-projects.json",
    "groups": PREFIX + "project-groups.json",
    "audit": PREFIX + "selection-audit.json",
    "baseline": "/uk_renewables_pipeline/202611161747/global-datacentres/projects.json",
}
def source_path(url: str) -> Path:
    resolved = (ROOT / url.lstrip("/")).resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError("Unsafe fixture")
    return resolved

class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def main() -> None:
    handler = functools.partial(SilentHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    pins = {
        "urls": {name: base + url for name, url in PATHS.items()},
        "sha256": {name: hashlib.sha256(source_path(url).read_bytes()).hexdigest()
                   for name, url in PATHS.items()},
    }
    checks = 0
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for width in (375, 768, 1440):
                    page = browser.new_page(viewport={"width": width, "height": 850},
                                            accept_downloads=True)
                    page.goto(base + "/automation/news/datacentre-ui/tests/harness.html")
                    page.add_style_tag(url=base + "/automation/news/datacentre-ui/styles.css")
                    page.add_script_tag(url=base + "/automation/news/datacentre-ui/model.js")
                    page.add_script_tag(url=base + "/automation/news/datacentre-ui/view.js")
                    loaded = page.evaluate("""async pins => {
                        const result = await window.GGDataCentreUI.mount(
                            document.getElementById('dc'), pins);
                        return result.error || result.counts;
                    }""", pins)
                    assert not isinstance(loaded, str), f"{width}: failed to load: {loaded}"
                    assert loaded["leads"] == 100 and loaded["uk_leads"] == 54
                    assert page.locator(".ggdc-table tbody tr").count() == 54
                    assert page.get_by_role("button", name="UK leads (54)").get_attribute("aria-pressed") == "true"
                    checks += 3

                    # Page must not overflow viewport; table remains horizontally scrollable at mobile widths.
                    widths = page.evaluate("""() => ({
                        body: document.documentElement.scrollWidth,
                        viewport: window.innerWidth,
                        table: document.querySelector('.ggdc-scroll').scrollWidth,
                        frame: document.querySelector('.ggdc-scroll').clientWidth
                    })""")
                    assert widths["body"] <= widths["viewport"] + 2, f"{width}: page overflows: {widths}"
                    if width < 790:
                        assert widths["table"] > widths["frame"], f"{width}: table not scrollable"
                    checks += 2 if width < 790 else 1

                    page.get_by_role("button", name="Global leads (100)").click()
                    assert page.locator(".ggdc-table tbody tr").count() == 100
                    page.get_by_role("button", name="Official source records (3)").click()
                    assert page.locator(".ggdc-table tbody tr").count() == 3
                    assert "UNKNOWN" in page.locator(".ggdc-table").inner_text()
                    page.get_by_role("button", name="Group associations (6)").click()
                    assert page.locator(".ggdc-table tbody tr").count() == 6
                    assert "PROVISIONAL" in page.locator(".ggdc-table").inner_text()
                    page.get_by_role("button", name="Quarantined candidates (38)").click()
                    assert page.locator(".ggdc-table tbody tr").count() == 38
                    assert "reason" in page.locator(".ggdc-table").inner_text().lower()
                    checks += 6

                    page.get_by_role("button", name="UK leads (54)").click()
                    page.get_by_role("searchbox", name="Search Data Centre records").fill("CyrusOne")
                    shown = page.locator(".ggdc-table tbody tr").count()
                    assert 0 < shown < 54, f"{width}: UK search failed"
                    checks += 1

                    page.get_by_role("searchbox", name="Search Data Centre records").fill("")
                    with page.expect_download() as got:
                        page.get_by_role("button", name="Export displayed leads (CSV)").click()
                    data = got.value.path().read_text("utf-8-sig")
                    assert len(data.strip().splitlines()) == 55
                    assert "Current operation" in data and "Not assessed" in data
                    checks += 2

                    # Mutated hash must clear previously visible records; no stale successes.
                    bad = json.loads(json.dumps(pins))
                    bad["sha256"]["projects"] = "0" * 64
                    failed = page.evaluate("""async pins => {
                        const result = await window.GGDataCentreUI.mount(
                            document.getElementById('dc'), pins);
                        return {error: result.error || null, text: document.getElementById('dc').innerText};
                    }""", bad)
                    assert "hash differs" in failed["error"]
                    assert "unavailable" in failed["text"]
                    assert page.locator(".ggdc-table tbody tr").count() == 0
                    checks += 3
                    page.close()
                print(f"PASS: {checks} real Chromium checks across 375 / 768 / 1440; "
                      "UK-first, four distinct evidence categories, search, CSV, no body overflow, "
                      "horizontal scroll, hash-negative stale-clearing.")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()

if __name__ == "__main__":
    main()
