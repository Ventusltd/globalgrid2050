"""Exercise the full PipelineNews project panel and the public legal reader."""
import argparse
import json
import os
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright
from preview import EDITION, Preview, ThreadingHTTPServer


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer(("127.0.0.1", 0), Preview) as server, sync_playwright() as driver:
        Thread(target=server.serve_forever, daemon=True).start()
        with driver.chromium.launch(executable_path=os.getenv("CHROME_BIN")) as browser:
            page = browser.new_page(viewport={"width": 1280, "height": 850})
            base = f"http://127.0.0.1:{server.server_port}"
            page.goto(base + EDITION + "?technology=all&q=9873", wait_until="domcontentloaded", timeout=180000)
            row = page.locator("#repd-9873")
            expect(row).to_be_visible(timeout=240000)
            expected_name = row.locator(".compact-project-name").text_content().strip()
            report = {"reference": "9873", "edition": "202611232245", "viewports": []}
            for width in (1280, 390):
                page.set_viewport_size({"width": width, "height": 850})
                detail = row.locator("details.project-record")
                if detail.get_attribute("open") is None:
                    detail.locator("summary").click()
                action = detail.get_by_role("link", name="Legal evidence", exact=True)
                expect(action).to_be_visible()
                action.scroll_into_view_if_needed()
                page.screenshot(path=output / f"PipelineNews-{width}.png")
                report["viewports"].append(width)
            target = action.get_attribute("href")
            parsed = urlsplit(target)
            params = parse_qs(parsed.query)
            assert (parsed.scheme, parsed.netloc, parsed.path) == ("https", "ventusltd.github.io", "/legislation/legal-evidence/")
            assert params["repd_ref"] == ["9873"] and params["project"] == [expected_name]
            assert params["source_release"] == ["202611232245"]
            action.click(timeout=60000)
            expect(page.locator("#context")).to_contain_text(expected_name, timeout=60000)
            expect(page.locator("#context")).to_contain_text("202611232245")
            return_url = "https://globalgrid2050.com" + EDITION + "?technology=all&q=9873"
            expect(page.locator("#pipeline")).to_have_attribute("href", return_url)
            page.screenshot(path=output / "legal-reader.png")
            report.update(receiver=parsed.scheme + "://" + parsed.netloc + parsed.path, return_url=return_url)
            (output / "acceptance.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    run(parser.parse_args().output)
