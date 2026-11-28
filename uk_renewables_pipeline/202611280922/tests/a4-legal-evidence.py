"""Check the legal action through the register, A4 sheet and both PDF outputs."""
import argparse
import io
import os
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright
from pypdf import PdfReader

EDITION_DIR = Path(__file__).resolve().parents[1]
EDITION = EDITION_DIR.name
READER = "/legislation/legal-evidence/"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextmanager
def address(public):
    if public:
        yield public.rstrip("/")
        return
    handler = partial(QuietHandler, directory=str(EDITION_DIR.parents[1]))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            yield f"http://127.0.0.1:{server.server_port}"
        finally:
            server.shutdown()


def check_pdf(source, expected, landscape):
    document = PdfReader(source)
    assert len(document.pages) == 1
    sheet = document.pages[0]
    assert (sheet.mediabox.width > sheet.mediabox.height) == landscape
    assert "Legal evidence" in " ".join(sheet.extract_text().split())
    uris = {str(link.get_object()["/A"]["/URI"]) for link in sheet.get("/Annots", [])}
    assert uris == expected, (uris, expected)


def check_project(browser, base, ref, width, expanded, open_reader):
    with browser.new_context(viewport={"width": width, "height": 850}, is_mobile=width < 600,
                             has_touch=width < 600, accept_downloads=True) as context:
        page = context.new_page()
        page.goto(f"{base}/uk_renewables_pipeline/{EDITION}/?technology=all&q={ref}",
                  wait_until="domcontentloaded", timeout=90000)
        row = page.locator(f"#repd-{ref}")
        expect(row).to_be_visible(timeout=90000)
        if expanded:
            page.locator("#pnLiquidLaunch").click()
            row = page.locator(f"#pnExpandedHost #repd-{ref}")
            expect(row).to_be_visible()
        details = row.locator("details.project-record")
        if details.get_attribute("open") is None:
            details.locator("summary").click()
        name = row.locator(".compact-project-name").inner_text().strip()
        assert page.locator(f'a[href*="{READER}"]').count() == 0
        native_map = row.locator("td:last-child .pn-journey-link.atlaslink[href]")
        map_url = native_map.first.get_attribute("href") if native_map.count() else None
        if details.get_attribute("open") is not None:
            details.locator("summary").click()
        row.locator("[data-pn-a4]").click()
        sheet = page.locator("#pnRepdReport")
        legal = sheet.get_by_role("link", name="Legal evidence", exact=True)
        expect(legal).to_be_visible()
        target = legal.get_attribute("href")
        parsed = urlsplit(target)
        assert (parsed.scheme, parsed.netloc, parsed.path) == ("https", "ventusltd.github.io", READER)
        params = parse_qs(parsed.query)
        assert params["source_app"] == ["pipelinenews"] and params["source_release"] == [EDITION]
        assert params["repd_ref"] == [ref] and params["project"] == [name]
        assert sheet.locator("#pnReportMap").get_attribute("href") == map_url
        links = {target, map_url} if map_url else {target}
        assert page.locator(f'a[href*="{READER}"]').count() == 1
        for landscape in (False, True):
            if landscape:
                sheet.locator('[data-report-action="rotate"]').click()
            with page.expect_download() as download:
                sheet.locator('[data-report-action="pdf"]').click()
            check_pdf(download.value.path(), links, landscape)
            check_pdf(io.BytesIO(page.pdf(prefer_css_page_size=True)), links, landscape)
        if open_reader:
            with page.expect_popup() as receiver:
                legal.click()
            expect(receiver.value.locator("#context")).to_contain_text(name, timeout=60000)
            expect(receiver.value.locator("#context")).to_contain_text(EDITION)
            receiver.value.close()
        sheet.locator('[data-report-action="close"]').click()
        expect(legal).to_be_hidden()
        assert page.locator(f'a[href*="{READER}"]:visible').count() == 0
        print(f"PASS REPD {ref}, {width}px, expanded={expanded}, A4 and PDF in both orientations", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", help="Test a served edition instead of the local checkout")
    parser.add_argument("--open-reader", action="store_true", help="Also follow the external link")
    args = parser.parse_args()
    with address(args.origin) as origin, sync_playwright() as driver:
        with driver.chromium.launch(executable_path=os.getenv("CHROME_BIN")) as chrome:
            check_project(chrome, origin, "9873", 1280, False, args.open_reader)
            check_project(chrome, origin, "12588", 390, True, args.open_reader)
