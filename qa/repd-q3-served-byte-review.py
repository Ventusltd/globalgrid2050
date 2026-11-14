#!/usr/bin/env python3
"""Read-only proof that exact approved REPD Q3 Git bytes are served by Pages.
No production writes. Fails closed on HTTP status, mismatched bytes, stale assets,
or an unintended change to the operative homepage/legacy page.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("REPD_LIVE_ORIGIN", "https://globalgrid2050.com").rstrip("/")
OUT = Path(os.environ.get("REPD_LIVE_QA_OUT", "/tmp/repd-served-byte-qa"))
OUT.mkdir(parents=True, exist_ok=True)
EXPECTED_PUBLISHED = {
    "repd-2026q3.csv": "d937ae16ad07f43caaaa25b4cee56399e1e9b9bb2ae5ecb7bc88cf9bc092e4b9",
    "dist/repd_master_2026q3.json": "3ffe6c5c4abe184f97c6c1860253a6f367d1ccef95a640882403d2ba7678b111",
}
NEW = [
    "repd-2026q3.csv",
    "dist/repd_master_2026q3.json",
    "uk_renewables_pipeline/202611132345/index.html",
    "uk_renewables_pipeline/202611132345/data/v9.1/build_manifest.json",
]
LEGACY = [
    "index.html",
    "repd.csv",
    "dist/repd_master.json",
    "uk_renewables_pipeline/202609082224/index.html",
]
TIMEOUT_S = int(os.environ.get("REPD_WAIT_SECONDS", "600"))
SLEEP_S = 15

def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def read_remote(path: str):
    url = f"{BASE}/{path}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "GlobalGrid2050-REPD-Q3-served-byte-verifier/1.0",
        "Cache-Control": "no-cache"
    })
    with urllib.request.urlopen(req, timeout=45) as r:
        status = r.status
        body = r.read()
        final = r.geturl()
        ctype = r.headers.get("content-type", "")
    return status, body, final, ctype

report = {
    "origin": BASE,
    "source_git_sha": os.environ.get("GITHUB_SHA"),
    "expected_release": "202611132345",
    "checks": [],
    "status": "PENDING",
}
start = time.monotonic()
for attempt in range(1, 1 + max(1, TIMEOUT_S // SLEEP_S)):
    errors = []
    current = []
    for path in NEW:
        local = ROOT / path
        if not local.is_file():
            errors.append(f"missing checkout source: {path}")
            continue
        local_bytes = local.read_bytes()
        expected = sha(local_bytes)
        if path in EXPECTED_PUBLISHED and expected != EXPECTED_PUBLISHED[path]:
            raise SystemExit(f"FAIL: repository source hash unexpected for {path}: {expected}")
        try:
            status, remote, final, ctype = read_remote(path)
            observed = sha(remote)
            ok = status == 200 and observed == expected and final.startswith(BASE)
            current.append({
                "path": path, "status": status, "bytes": len(remote),
                "sha256": observed, "expected_sha256": expected,
                "url": final, "content_type": ctype, "pass": ok,
            })
            if not ok:
                errors.append(f"{path}: HTTP {status}, sha {observed}, expected {expected}")
        except Exception as e:
            errors.append(f"{path}: {type(e).__name__}: {e}")
    if not errors:
        report["checks"].extend(current)
        print(f"New Q3 assets match Git exactly after {attempt} attempts", flush=True)
        break
    if time.monotonic() - start >= TIMEOUT_S - SLEEP_S:
        report["checks"].extend(current)
        report["errors"] = errors
        report["status"] = "FAIL"
        (OUT / "served-byte-report.json").write_text(json.dumps(report, indent=2) + "\n")
        raise SystemExit("FAIL: candidate bytes not served: " + "; ".join(errors))
    print(f"Waiting for Pages, attempt {attempt}: " + "; ".join(errors), flush=True)
    time.sleep(SLEEP_S)

for path in LEGACY:
    local = ROOT / path
    if not local.is_file():
        raise SystemExit(f"FAIL: legacy source missing from checkout: {path}")
    expected = sha(local.read_bytes())
    try:
        status, remote, final, ctype = read_remote(path)
    except Exception as e:
        raise SystemExit(f"FAIL: legacy path unavailable {path}: {e}")
    observed = sha(remote)
    ok = status == 200 and observed == expected and final.startswith(BASE)
    report["checks"].append({
        "path": path, "status": status, "bytes": len(remote),
        "sha256": observed, "expected_sha256": expected,
        "url": final, "content_type": ctype, "pass": ok,
        "legacy": True
    })
    if not ok:
        report["status"] = "FAIL"
        (OUT / "served-byte-report.json").write_text(json.dumps(report, indent=2) + "\n")
        raise SystemExit(f"FAIL: legacy byte mismatch {path}: {observed} != {expected}")

# The manifest is an independent source of record count; verify it matches the
# committed October release and the UI expectation rather than only HTTP 200.
manifest = json.loads((ROOT / "uk_renewables_pipeline/202611132345/data/v9.1/build_manifest.json").read_text())
if manifest.get("project_count") != 7775:
    raise SystemExit(f"FAIL: candidate project count is {manifest.get('project_count')}, not 7775")
report["status"] = "PASS"
report["manifest_project_count"] = manifest["project_count"]
(OUT / "served-byte-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
