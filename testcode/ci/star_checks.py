#!/usr/bin/env python3
"""Read-only publication audit. Reports contain hashes/counts, never fetched bodies."""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

PUBLIC_BASE = "https://globalgrid2050.com/"
SUN_BASE = "https://ventusltd.github.io/star-solar-star/"
SUN_COMMIT = "8b930de59db7b7a6d332025da3eaf80ce8dcf9ab"
SUN_FILES = ("today.json", "history.json", "uk-solar.json", "voices.json", "press.json", "provenance.json")
SUN_CODE = ("scripts/build_sun.py", "scripts/validate_sun.py")
SHA256 = re.compile(r"[0-9a-f]{64}")
MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_TOTAL_BYTES = 160 * 1024 * 1024
SECTOR = "testcode/202609150125/"
PATTERNS = {
    "company_suffix": re.compile(r"\b(?:LIMITED|LTD|PLC|LLP)\b", re.I),
    "registration_number": re.compile(r"(?<!\d)\d{8}(?!\d)"),
    "full_postcode": re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b"),
    "email_marker": re.compile(r"@"),
}
IDENTIFIER_KEYS = {"company_name", "company_number", "registration_number", "registered_office_address",
                   "address_line_1", "full_postcode", "email", "telephone", "phone_number"}


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def strict_json(raw: bytes):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    def finite_only(value):
        raise ValueError("non-finite JSON number")
    return json.loads(raw, object_pairs_hook=unique, parse_constant=finite_only)


def git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.DEVNULL, timeout=30)


def committed(root: Path, commit: str, path: str) -> bytes:
    return git(root, "show", f"{commit}:{path}")


def safe_asset(manifest: str, name: str) -> str:
    if not isinstance(name, str) or not name or any(c in name for c in "\\%?#:"):
        raise ValueError("invalid asset path")
    parts = name.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("asset path must not escape its publication")
    parent = str(PurePosixPath(manifest).parent)
    path = name if name.startswith(parent + "/") else parent + "/" + name
    if name.startswith("testcode/") and not name.startswith(parent + "/"):
        raise ValueError("asset path refers to another publication")
    return path


def inventory(manifest: str, obj: dict) -> list[dict] | None:
    files = obj.get("files")
    if files is None:
        return None
    if isinstance(files, dict):
        rows = [{**value, "path": key} for key, value in files.items() if isinstance(value, dict)]
        if len(rows) != len(files):
            raise ValueError("unsupported file inventory")
    elif isinstance(files, list):
        rows = files
    else:
        raise ValueError("unsupported file inventory")
    out, seen = [], set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("invalid file record")
        path = safe_asset(manifest, row.get("path", row.get("file")))
        size, sha = row.get("bytes"), row.get("sha256")
        if type(size) is not int or not 0 <= size <= MAX_FILE_BYTES or not isinstance(sha, str) or not SHA256.fullmatch(sha):
            raise ValueError("invalid file size or SHA256")
        if path in seen:
            raise ValueError("duplicate inventory path")
        seen.add(path)
        out.append({"path": path, "bytes": size, "sha256": sha, "kind": "asset"})
    return out


def plan(root: Path, commit: str) -> tuple[list[dict], dict]:
    paths = git(root, "ls-tree", "-r", "--name-only", commit).decode().splitlines()
    manifests = sorted(path for path in paths if re.fullmatch(r"testcode/[^/]+/publication\.json", path))
    if not manifests:
        raise ValueError("no committed publication manifests")
    checks, manifest_only, unsupported = [], [], []
    for path in manifests:
        raw = committed(root, commit, path)
        if len(raw) > MAX_FILE_BYTES:
            raise ValueError("manifest exceeds size bound")
        checks.append({"path": path, "bytes": len(raw), "sha256": digest(raw), "kind": "manifest"})
        try:
            rows = inventory(path, strict_json(raw))
        except (ValueError, TypeError, AttributeError):
            unsupported.append(path)
            continue
        if rows is None:
            manifest_only.append(path)
        else:
            checks.extend(rows)
    if sum(check["bytes"] for check in checks) > MAX_TOTAL_BYTES:
        raise ValueError("publication sweep exceeds total size bound")
    return checks, {"manifests": len(manifests), "declared_assets": len(checks)-len(manifests),
                    "manifest_only": manifest_only, "unsupported_inventory": unsupported,
                    "all_manifests_have_asset_inventory": not manifest_only and not unsupported}


def origin(url: str) -> tuple:
    parsed = urllib.parse.urlsplit(url)
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URL credentials are not supported")
    return parsed.scheme, parsed.hostname, parsed.port or {"https": 443, "http": 80}.get(parsed.scheme)


def remaining_timeout(deadline: float, maximum: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("sweep deadline reached")
    return min(maximum, remaining)


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Validate before urllib opens the redirect target, including scheme and
        # port changes. A post-response check alone is too late to prevent a request.
        if origin(req.full_url) != origin(newurl):
            raise ValueError("cross-origin redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url: str, limit: int, deadline: float) -> bytes:
    timeout = remaining_timeout(deadline, 15)
    request = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050-Publication-Integrity/1.0", "Accept-Encoding": "identity"})
    opener = urllib.request.build_opener(SameOriginRedirect())
    with opener.open(request, timeout=timeout) as response:
        if origin(response.url) != origin(url):
            raise ValueError("cross-origin redirect")
        chunks, size = [], 0
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError("sweep deadline reached")
            chunk = response.read1(min(65536, limit + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
            if size > limit:
                raise ValueError("response exceeds declared size")
        raw = b"".join(chunks)
    if len(raw) > limit:
        raise ValueError("response exceeds declared size")
    return raw


def sector_patterns(raw: bytes) -> dict[str, int]:
    """Public JSON strings/keys only. No source-name corpus and no matched values returned."""
    counts = {key: 0 for key in PATTERNS}
    counts["identifier_keys"] = 0
    def walk(value):
        if isinstance(value, str):
            value = re.sub(r"\b[0-9a-f]{64}\b", "", value)
            for name, pattern in PATTERNS.items():
                counts[name] += len(pattern.findall(value))
        elif isinstance(value, dict):
            for key, child in value.items():
                counts["identifier_keys"] += int(key.lower() in IDENTIFIER_KEYS)
                walk(key)
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(strict_json(raw))
    return counts


def check_item(item: dict, base: str, deadline: float, reader=fetch) -> dict:
    result = {**item, "match": False}
    url = base + urllib.parse.quote(item["path"], safe="/")
    try:
        raw = reader(url, item["bytes"], deadline)
        result.update(actual_bytes=len(raw), actual_sha256=digest(raw))
        result["match"] = len(raw) == item["bytes"] and digest(raw) == item["sha256"]
        if item["path"].startswith(SECTOR + "data/") and item["path"].endswith(".json"):
            result["public_pattern_counts"] = sector_patterns(raw)
    except urllib.error.HTTPError as exc:
        result["match"] = False
        result["error"] = f"http_{exc.code}"
    except Exception as exc:
        result["match"] = False
        result["error"] = type(exc).__name__
    return result


def validate_sun_owner(owner: Path, deadline: float, reader=fetch) -> dict:
    if git(owner, "rev-parse", "HEAD").decode().strip() != SUN_COMMIT:
        raise ValueError("Sun owner checkout does not match pinned commit")
    result = {"repository": "Ventusltd/star-solar-star", "commit": SUN_COMMIT,
              "dependencies": [], "files": [], "validated": False}
    with tempfile.TemporaryDirectory(prefix="star-checks-") as temp:
        temp_root = Path(temp)
        # Execute only the reviewed pinned owner dependency closure. No publication
        # manifest controls code imports, and the historical Sector script is never run.
        for path in SUN_CODE:
            raw = committed(owner, SUN_COMMIT, path)
            result["dependencies"].append({"path": path, "sha256": digest(raw), "bytes": len(raw)})
            (temp_root / Path(path).name).write_bytes(raw)
        data = temp_root / "sun"
        data.mkdir()
        for name in SUN_FILES:
            path = "sun/" + name
            expected = committed(owner, SUN_COMMIT, path)
            item = {"path": path, "bytes": len(expected), "sha256": digest(expected), "kind": "sun"}
            raw = reader(SUN_BASE + path, len(expected), deadline)
            result["files"].append({**item, "actual_bytes": len(raw), "actual_sha256": digest(raw), "match": raw == expected})
            (data / name).write_bytes(raw)
        if not all(row["match"] for row in result["files"]):
            return result
        run = subprocess.run([sys.executable, str(temp_root / "validate_sun.py"), str(data)],
                             capture_output=True, timeout=remaining_timeout(deadline, 30), check=False)
        result["validated"] = run.returncode == 0
        result["validator_exit"] = run.returncode
        # Validator output is deliberately not included: report only execution status
        # and hashes/counts. Downloaded bodies are deleted with the temporary directory.
    return result


def window_open(until: str, now: dt.datetime | None = None) -> bool:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", until.strip()):
        raise ValueError("invalid night cutoff")
    return (now or dt.datetime.now(dt.timezone.utc)) < dt.datetime.fromisoformat(until.strip().replace("Z", "+00:00"))


EXPIRY_GRACE_DAYS = 7


def window_overdue_days(until: str, now: dt.datetime | None = None) -> float:
    """How long ago did the night window close? Negative while it is still open."""
    cutoff = dt.datetime.fromisoformat(until.strip().replace("Z", "+00:00"))
    return ((now or dt.datetime.now(dt.timezone.utc)) - cutoff).total_seconds() / 86400


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--sun-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    root = args.repo_root.resolve()
    commit = git(root, "rev-parse", "HEAD").decode().strip()
    until = committed(root, commit, "testcode/ci/NIGHT-UNTIL.txt").decode().strip()
    report = {"schema": "globalgrid2050.star-checks.v1", "commit": commit,
              "run_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "until_utc": until,
              "private_name_comparison": "unavailable; public patterns are not proof of absence of private names"}
    exit_code = 0
    try:
        if not window_open(until):
            # EXPIRED IS NOT A PASS.
            #
            # This used to set status "window_closed", and the workflow step that
            # reads this report says, in as many words, `if status ==
            # "window_closed": print(...)` and then does not assert anything. So
            # from 2026-09-15T07:00:00Z the two-hourly sweep has been green
            # without looking at a single published byte - and the run before it,
            # inside the window, found three mismatches. The colour got better
            # when the checking stopped.
            #
            # A closed window now says EXPIRED, carries pass=None rather than a
            # missing key, and exits 3. And a window nobody has renewed or
            # deleted for EXPIRY_GRACE_DAYS is not idle, it is abandoned: that is
            # a FAIL, because a gate asking nothing forever is a defect.
            overdue = window_overdue_days(until)
            report["overdue_days"] = round(overdue, 3)
            if overdue > EXPIRY_GRACE_DAYS:
                report["status"] = "abandoned"
                report["verdict"] = "FAIL"
                report["pass"] = False
                report["detail"] = (
                    f"the night window closed {overdue:.1f} days ago and nothing has renewed or "
                    f"deleted it; put a later time in testcode/ci/NIGHT-UNTIL.txt or remove the "
                    f"schedule from .github/workflows/star-checks.yml")
                exit_code = 1
            else:
                report["status"] = "expired"
                report["verdict"] = "EXPIRED"
                report["pass"] = None
                report["detail"] = f"night window closed {overdue:.1f} days ago; nothing was checked"
                exit_code = 3
        else:
            # Limit the sweep to 8 minutes and to the authorization cutoff, with at
            # most four concurrent requests and no response above its declared size.
            cutoff = dt.datetime.fromisoformat(until.replace("Z", "+00:00"))
            seconds_left = (cutoff-dt.datetime.now(dt.timezone.utc)).total_seconds()
            deadline = time.monotonic() + min(480, max(0, seconds_left))
            checks, coverage = plan(root, commit)
            report["coverage"] = coverage
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                rows = list(pool.map(lambda item: check_item(item, PUBLIC_BASE, deadline), checks))
            report["files"] = rows
            report["mismatches"] = sum(not row["match"] for row in rows)
            report["public_pattern_findings"] = sum(sum(row.get("public_pattern_counts", {}).values()) for row in rows)
            report["sun"] = validate_sun_owner(args.sun_root, deadline)
            report["checked_items_pass"] = not coverage["unsupported_inventory"] and report["mismatches"] == 0 and report["public_pattern_findings"] == 0 and report["sun"]["validated"]
            report["pass"] = report["checked_items_pass"]
            report["full_assurance"] = False  # Missing private-name comparison is an explicit open gate.
            report["status"] = "checked" if report["checked_items_pass"] else "findings"
            report["verdict"] = "PASS" if report["checked_items_pass"] else "FAIL"
            exit_code = 0 if report["checked_items_pass"] else 1
    except Exception as exc:
        report.update(status="error", verdict="FAIL", error=type(exc).__name__,
                      checked_items_pass=False, full_assurance=False)
        report["pass"] = False
        exit_code = 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True)+"\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in {"files", "sun", "coverage"}}, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
