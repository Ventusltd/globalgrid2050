#!/usr/bin/env python3
"""Read-only October 2026 REPD publication/archive and live-UI baseline probe.

Writes only to an ignored/temporary report directory; NEVER updates site data,
release pointers, repository files, source records, or production applications.
A completed diagnostic job is NOT browser/MAP acceptance.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

OUT = Path(os.environ.get("REPD_PROBE_OUT", ".repd-probe/2026-11-13"))
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://assets.publishing.service.gov.uk/media/"
OLD = {
    "csv": BASE + "6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv",
    "xlsx": BASE + "6a6cbdd2862aaf18d9c62b02/REPD_Publication_Q2_2026.xlsx",
}
EXPECTED = {
    "csv": "84c1b5f958a934d8b4b86ec88f50bdcf43830ded7ff2efc27bffca0c98695035",
    "xlsx": "624a0a9712c58a7a93716e51f2bf054eec8b1af7170f6f9516cc10cd248e2657",
}
ARCHIVE_PAGE = (
    "https://tnaqa.mirrorweb.com/ukgwa/20261102130314oe_/"
    "https%3A/www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
)
PUBLICATION = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
PAGES = {
    "homepage": "https://globalgrid2050.com/",
    "pipeline": "https://globalgrid2050.com/uk_renewables_pipeline/202609082224/",
    "atlas": "https://ventusltd.github.io/gridatlas/atlas/",
}
REPORT = {
    "purpose": "NONPRODUCTION_DIAGNOSTIC_ONLY_NOT_RELEASE_QA",
    "checked_utc": datetime.now(timezone.utc).isoformat(),
    "publication": {},
    "old_q2": {},
    "archives": {},
    "browser": {},
    "limitations": [
        "Browser screenshots and page counters are observations, not application acceptance.",
        "No downstream October REPD candidate was deployed or tested by this script.",
        "No raw July Q2 comparison is valid unless BOTH expected original SHA256 values match.",
    ],
}


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def fetch(url: str, timeout: int = 55) -> tuple[bytes, str]:
    with urlopen(Request(url, headers={"User-Agent": "GlobalGrid2050-REPD-source-audit/1.0"}), timeout=timeout) as response:
        return response.read(), response.geturl()


def head(url: str) -> dict:
    # curl without -L: do not follow redirects, preserve original response headers.
    result = subprocess.run(
        ["curl", "-sSI", "--max-time", "30", "--connect-timeout", "12", url],
        text=True, capture_output=True, timeout=38, check=False,
    )
    return {"url": url, "curl_exit": result.returncode,
            "headers": result.stdout[:10000], "stderr": result.stderr[:1000]}


for kind, url in OLD.items():
    entry = {"head_without_redirect": head(url), "expected_sha256": EXPECTED[kind]}
    try:
        data, final_url = fetch(url, 95)
        entry.update({"get_final_url": final_url, "get_bytes": len(data),
                      "get_sha256": sha(data), "original_q2_verified": sha(data) == EXPECTED[kind]})
        if entry["original_q2_verified"]:
            (OUT / ("verified-original-Q2." + kind)).write_bytes(data)
    except Exception as exc:
        entry["get_error"] = str(exc)[:350]
        entry["original_q2_verified"] = False
    REPORT["old_q2"][kind] = entry

try:
    raw, final = fetch(PUBLICATION)
    html = raw.decode("utf-8", "replace")
    REPORT["publication"] = {
        "url": final, "bytes": len(raw), "sha256": sha(raw),
        "october_2026_mentioned": bool(re.search("October\\s+2026", html, re.I)),
        "updated_13_nov_2026_mentioned": bool(re.search("13\\s+November\\s+2026", html, re.I)),
    }
except Exception as exc:
    REPORT["publication"] = {"error": str(exc)[:350]}

for name, url in {
    "ukgwa_2026_11_02_page": ARCHIVE_PAGE,
    "wayback_cdx_csv": "https://web.archive.org/cdx/search/cdx?url=" + OLD["csv"] + "&output=json&filter=statuscode:200",
    "wayback_cdx_xlsx": "https://web.archive.org/cdx/search/cdx?url=" + OLD["xlsx"] + "&output=json&filter=statuscode:200",
    "ukgwa_asset_csv": "https://tnaqa.mirrorweb.com/ukgwa/20261102130314oe_/https%3A/assets.publishing.service.gov.uk/media/6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv",
    "ukgwa_asset_xlsx": "https://tnaqa.mirrorweb.com/ukgwa/20261102130314oe_/https%3A/assets.publishing.service.gov.uk/media/6a6cbdd2862aaf18d9c62b02/REPD_Publication_Q2_2026.xlsx",
}.items():
    entry = head(url)
    # Archived HTML/CDX is evidence of listing, NOT the original attachment bytes.
    if name.endswith("page") or "cdx" in name:
        try:
            raw, final = fetch(url, 30)
            entry.update({"get_final_url": final, "get_bytes": len(raw),
                          "get_sha256": sha(raw),
                          "excerpt": raw[:1200].decode("utf-8", "replace")})
        except Exception as exc:
            entry["get_error"] = str(exc)[:350]
    REPORT["archives"][name] = entry


async def browse() -> None:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        REPORT["browser"]["error"] = "playwright unavailable: " + str(exc)
        return
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        try:
            for size, viewport, mobile in [
                ("desktop", {"width": 1440, "height": 900}, False),
                ("mobile", {"width": 390, "height": 844}, True),
            ]:
                context = await browser.new_context(viewport=viewport, is_mobile=mobile,
                                                    has_touch=mobile, device_scale_factor=1)
                try:
                    for name, url in PAGES.items():
                        key = name + "_" + size
                        page = await context.new_page()
                        errors = []
                        page.on("pageerror", lambda exc: errors.append(str(exc)[:300]))
                        entry = {"requested_url": url, "viewport": viewport}
                        try:
                            response = await page.goto(url, wait_until="domcontentloaded", timeout=50000)
                            await page.wait_for_timeout(9000 if name == "atlas" else 6500)
                            entry.update({
                                "http_status": response.status if response else None,
                                "final_url": page.url,
                                "title": await page.title(),
                                "visible_text_excerpt": (await page.locator("body").inner_text(timeout=15000))[:2800],
                                "table_body_rows": await page.locator("table tbody tr").count(),
                                "canvas_count": await page.locator("canvas").count(),
                                "page_errors": errors[:15],
                            })
                            screenshot = OUT / (key + ".png")
                            await page.screenshot(path=str(screenshot), full_page=False, timeout=18000)
                            entry["screenshot"] = screenshot.name
                        except Exception as exc:
                            entry["error"] = str(exc)[:450]
                            entry["page_errors"] = errors[:15]
                        REPORT["browser"][key] = entry
                        await page.close()
                finally:
                    await context.close()
        finally:
            await browser.close()


try:
    asyncio.run(browse())
except Exception as exc:
    REPORT["browser"]["fatal_error"] = str(exc)[:500]
(OUT / "REPORT.json").write_text(json.dumps(REPORT, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({
    "status": "DIAGNOSTIC_ONLY",
    "publication": REPORT["publication"],
    "old_q2": {k: {"get_sha256": v.get("get_sha256"), "original_q2_verified": v["original_q2_verified"],
                    "head_first_line": v["head_without_redirect"]["headers"].split("\n")[0]}
               for k, v in REPORT["old_q2"].items()},
    "browser_observations": len(REPORT["browser"]),
}, indent=2))
