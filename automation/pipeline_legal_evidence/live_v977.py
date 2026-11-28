"""Open the production REPD edition, its public legal reader and the reader's original data source."""
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit

from playwright.sync_api import expect, sync_playwright


def run(output):
    homepage = "https://globalgrid2050.com/"
    edition = urljoin(homepage, "uk_renewables_pipeline/202611280048/")
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as driver, driver.chromium.launch(executable_path=os.getenv("CHROME_BIN")) as browser:
        page = browser.new_page(viewport={"width": 1280, "height": 850})
        page.goto(homepage, wait_until="domcontentloaded")
        expect(page.locator("a.launch", has_text="Open Pipeline News").first).to_have_attribute("href", edition)
        page.goto(edition + "?technology=all&q=9873", wait_until="domcontentloaded", timeout=120000)
        row = page.locator("#repd-9873")
        expect(row).to_be_visible(timeout=120000)
        project = row.locator(".compact-project-name").text_content().strip()
        for width in (1280, 390):
            page.set_viewport_size({"width": width, "height": 850})
            detail = row.locator("details.project-record")
            if detail.get_attribute("open") is None:
                detail.locator("summary").click()
            action = detail.get_by_role("link", name="Legal evidence")
            expect(action).to_be_visible()
            action.scroll_into_view_if_needed()
            page.screenshot(path=output / f"pipeline-{width}.png")
        action.click(timeout=60000)
        expect(page.locator("#context")).to_contain_text(project, timeout=60000)
        expect(page.locator("#context")).to_contain_text("202611280048")
        parsed = urlsplit(page.url)
        assert (parsed.scheme, parsed.netloc, parsed.path) == ("https", "ventusltd.github.io", "/legislation/legal-evidence/")
        assert parse_qs(parsed.query)["repd_ref"] == ["9873"]
        expect(page.locator("#pipeline")).to_have_attribute("href", edition + "?technology=all&q=9873", timeout=60000)
        expect(page.locator("#source-edition")).to_have_attribute("href", edition + "?technology=all&q=9873", timeout=60000)
        return_url = page.locator("#pipeline").get_attribute("href")
        assert urlsplit(return_url).netloc == "globalgrid2050.com"
        assert parse_qs(urlsplit(return_url).query) == {"technology":["all"], "q":["9873"]}
        page.screenshot(path=output / "reader.png")
        page.locator("#pipeline").click(timeout=60000)
        expect(page.locator("#repd-9873")).to_be_visible(timeout=120000)
        (output / "receipt.json").write_text(json.dumps({"edition": edition, "repd_ref":"9873", "project":project,"viewports":[1280,390],"return_url":return_url}, indent=2)+"\n")


if __name__ == "__main__":
    run(Path("acceptance"))
