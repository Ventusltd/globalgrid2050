#!/usr/bin/env python3
"""Standalone QA-only project-to-article binding contract.

One fetched URL has one immutable response receipt, but can support multiple
REPD projects only through distinct independently reviewed (Ref, URL) bindings.
This validates manifest structure, NOT real publisher bytes, identities, rights
or permission to publish. Never invoke as a release authoriser.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

PIN_TOP = "3a23c8495f00e613a8f0f81b2db5374a19ba89d832e913c6f821823def6b49a5"
PIN_DATA = "15586a71613df59fc7bbdbdce852ebb71b19f663f0e269ca4d9fedb7225afe03"
HEX64 = re.compile(r"^[a-f0-9]{64}$")
BASIS = {"official_repd_ref", "official_planning_ref", "exact_repd_site_name"}


def instant(value):
    if not isinstance(value, str):
        return None
    try:
        value = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value.astimezone(dt.timezone.utc) if value.tzinfo else None
    except (ValueError, OverflowError):
        return None


def secure_url(value):
    if not isinstance(value, str):
        return False
    try:
        parsed = urlsplit(value)
        return (parsed.scheme == "https" and bool(parsed.hostname)
                and not parsed.username and not parsed.password
                and not parsed.fragment and not any(c.isspace() for c in value))
    except (ValueError, TypeError):
        return False


def digest(value):
    return isinstance(value, str) and HEX64.fullmatch(value) is not None


def recent(value, now, hours):
    parsed = instant(value)
    return parsed is not None and dt.timedelta(0) <= now - parsed <= dt.timedelta(hours=hours)


def audit(project_urls, receipt_rows, binding_rows, now):
    """All input is untrusted. Return a structural verdict, always release HOLD."""
    errors = set()
    missing = 0
    if not isinstance(project_urls, dict):
        project_urls = {}
        errors.add("PROJECT_MAP_INVALID")
    if not isinstance(receipt_rows, list):
        receipt_rows = []
        errors.add("RECEIPT_ROWS_INVALID")
    if not isinstance(binding_rows, list):
        binding_rows = []
        errors.add("BINDING_ROWS_INVALID")
    expected = set()
    for ref, urls in project_urls.items():
        if not isinstance(ref, str) or not ref.isdecimal() or not isinstance(urls, list):
            errors.add("PROJECT_ID_OR_URLS_INVALID")
            continue
        for url in urls:
            if not secure_url(url):
                errors.add("ARTICLE_URL_INVALID")
                continue
            expected.add((ref, url))

    receipts = {}
    for r in receipt_rows:
        if not isinstance(r, dict):
            errors.add("RECEIPT_MALFORMED")
            continue
        url = r.get("url")
        if not secure_url(url):
            errors.add("RECEIPT_URL_INVALID")
            continue
        if url in receipts:
            errors.add("DUPLICATE_URL_RECEIPT")
            receipts[url] = None  # poisoned; cannot be overwritten by a good receipt
            continue
        if (r.get("http_status") != 200 or not digest(r.get("response_sha256"))
                or r.get("independent_fetch") is not True
                or not recent(r.get("fetched_at"), now, 24)):
            errors.add("URL_RECEIPT_NOT_INDEPENDENT_CURRENT")
            receipts[url] = None
        else:
            receipts[url] = r

    bindings = {}
    for b in binding_rows:
        if not isinstance(b, dict):
            errors.add("BINDING_MALFORMED")
            continue
        ref, url = b.get("project_ref"), b.get("url")
        if not isinstance(ref, str) or not secure_url(url):
            errors.add("BINDING_ID_OR_URL_INVALID")
            continue
        key = (ref, url)
        if key in bindings:
            errors.add("DUPLICATE_PROJECT_URL_BINDING")
            bindings[key] = None  # poison duplicates, even identical ones
            continue
        if key not in expected:
            errors.add("UNRELATED_PROJECT_URL_BINDING")
            bindings[key] = None
            continue
        receipt = receipts.get(url)
        basis = b.get("identity_basis")
        basis_value = b.get("identity_value")
        valid = (receipt is not None
                 and b.get("evidence_project_ref") == ref
                 and b.get("source_response_sha256") == receipt.get("response_sha256")
                 and b.get("reviewer_role") == "independent_identity_reviewer"
                 and b.get("independent_identity_verified") is True
                 and secure_url(b.get("identity_evidence_url"))
                 and digest(b.get("identity_evidence_sha256"))
                 and recent(b.get("reviewed_at"), now, 24 * 30)
                 and basis in BASIS
                 and isinstance(basis_value, str) and bool(basis_value.strip()))
        if basis == "official_repd_ref" and basis_value != ref:
            valid = False
        if not valid:
            errors.add("PROJECT_BINDING_EVIDENCE_INVALID")
            bindings[key] = None
        else:
            bindings[key] = b

    for key in expected:
        if receipts.get(key[1]) is None:
            errors.add("MISSING_VALID_URL_RECEIPT")
        if bindings.get(key) is None:
            errors.add("MISSING_VALID_PROJECT_URL_BINDING")
            missing += 1
    for url in receipts:
        if not any(u == url for _, u in expected):
            errors.add("ORPHAN_URL_RECEIPT")
    ok = not errors
    return {
        "status": "QA_CONTRACT_VALID_RELEASE_HOLD" if ok else "QA_CONTRACT_INVALID_RELEASE_HOLD",
        "contract_ok": ok,
        "release_authorised": False,
        "errors": sorted(errors),
        "release_vetoes": [
            "EXTERNAL_URL_BYTES_AND_IDENTITY_NOT_INDEPENDENTLY_PROVED",
            "PUBLISHER_RIGHTS_NOT_VERIFIED",
            "INTEGRATED_ACID_BROWSER_CSV_MAP_SERVED_SHA_ROLLBACK_UNVERIFIED",
            "QA_ONLY_NO_PUBLICATION_AUTHORITY",
        ],
        "facts": {
            "project_url_edges": len(expected),
            "unique_urls": len({url for _, url in expected}),
            "valid_bindings": len(expected) - missing,
            "missing_bindings": missing,
        },
    }


def real_snapshot(top_bytes, snapshot_bytes):
    """Require exact historical source bytes and REPD IDs before QA auditing."""
    if hashlib.sha256(top_bytes).hexdigest() != PIN_TOP:
        raise ValueError("TOP200_SOURCE_SHA_MISMATCH")
    if hashlib.sha256(snapshot_bytes).hexdigest() != PIN_DATA:
        raise ValueError("DATA_SNAPSHOT_SHA_MISMATCH")
    top = json.loads(top_bytes)
    data = json.loads(snapshot_bytes)
    refs = [str(p["repd_ref"]) for p in top]
    projects = data["projects"]
    if len(refs) != 200 or len(set(refs)) != 200 or set(refs) != set(projects):
        raise ValueError("EXACT_200_REPD_IDENTITIES_MISMATCH")
    result = {}
    for ref, project in projects.items():
        if str(project.get("repd_ref")) != ref:
            raise ValueError("PROJECT_REF_MISMATCH")
        signals = project.get("signals", [])
        if not isinstance(signals, list):
            raise ValueError("SIGNALS_NOT_LIST")
        for signal in signals:
            if str(signal.get("repd_ref")) != ref:
                raise ValueError("ARTICLE_REF_MISMATCH")
        result[ref] = [signal.get("link") for signal in signals]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top200", required=True)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    try:
        project_urls = real_snapshot(Path(args.top200).read_bytes(), Path(args.snapshot).read_bytes())
        result = audit(project_urls, [], [], dt.datetime.now(dt.timezone.utc))
        if result["facts"]["project_url_edges"] != 416:
            raise ValueError("PINNED_ARTICLE_COUNT_CHANGED")
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        result = {"status": "HOLD", "release_authorised": False, "errors": [str(exc)]}
    Path(args.report).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, sort_keys=True))
    raise SystemExit(2)  # always HOLD; CI must assert this expected status explicitly


if __name__ == "__main__":
    main()
