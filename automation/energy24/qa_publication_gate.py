"""Read-only, fail-closed Energy24 publication acceptance (not a feed writer).

A producer timestamp, source-health flag or headline is not independent proof
that an individual URL was fetched or its publisher rights were cleared.
This QA-only contract holds the v1 feed pending separate reviewed receipts.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, urlsplit, urlunsplit, parse_qsl, urlencode
import re

MARKETS = {"London": "Europe/London", "New York": "America/New_York",
           "San Francisco": "America/Los_Angeles", "Hong Kong": "Asia/Hong_Kong",
           "Tokyo": "Asia/Tokyo", "Sydney": "Australia/Sydney"}
CATEGORIES = {"uk-repd", "data-centres", "global-projects", "ai-investment", "cybersecurity", "ethics"}
STRATEGIC = {"cybersecurity", "ethics"}
PROFANITY = re.compile(r"\b(fuck(?:ing)?|shit|cunt|motherfucker|bullshit)\b", re.I)
SHA256 = re.compile(r"[a-f0-9]{64}\Z")


def instant(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.astimezone(timezone.utc) if dt.tzinfo else None


def article_identity_url(url):
    """Conservative dedup key only; do NOT alter exact-URL fetch receipts.

    Ignore fragments and known marketing query parameters, while retaining
    meaningful query keys and case-sensitive paths. This is not source proof.
    """
    if not isinstance(url, str):
        return url
    try:
        parts = urlsplit(url)
        if parts.scheme.lower() != "https" or not parts.hostname:
            return url
        query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
                 if not (key.lower().startswith("utm_") or key.lower() in
                         {"fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid"})]
        return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path,
                           urlencode(query), ""))
    except (TypeError, ValueError):
        return url


def audit_candidate(news, audit, receipts, rights, repd_mw, verified_dc_ids, now):
    """Return HOLD reasons; [] is structural QA only, NOT legal clearance.

    receipts: independently reviewed exact-URL fetch records, not feed claims.
    rights: independently reviewed source_id -> terms and attribution ledger.
    repd_mw: pinned official REPD Ref ID -> MW mapping.
    verified_dc_ids: pinned rights-cleared dcuk- site identities.
    """
    errors = []
    now = now.astimezone(timezone.utc)
    if news.get("schema") != "globalgrid2050.energy24.news.v1" or audit.get("schema") != "globalgrid2050.energy24.news-audit.v1":
        errors.append("schema_mismatch")
    if news.get("release") != audit.get("release") or news.get("release") != "2026q3":
        errors.append("release_mismatch")
    scan_at = instant(news.get("generated_utc"))
    if not scan_at or scan_at > now + timedelta(minutes=5) or now - scan_at > timedelta(hours=3):
        errors.append("scan_stale_or_future")
    clock_values = audit.get("markets")
    if not isinstance(clock_values, dict) or set(clock_values) != set(MARKETS):
        errors.append("market_clocks_incomplete")
    elif scan_at:
        for city, iana_zone in MARKETS.items():
            raw = clock_values[city]
            try:
                local = datetime.fromisoformat(raw) if isinstance(raw, str) else None
                expected = scan_at.astimezone(ZoneInfo(iana_zone))
                # The scanner emits minute-precision offsets. UTC-only clocks
                # and plausible-looking values in the wrong IANA zone fail.
                if (local is None or local.tzinfo is None or
                        local.utcoffset() != expected.utcoffset() or
                        abs((local.astimezone(timezone.utc) - scan_at).total_seconds()) >= 60):
                    errors.append(f"market_clock_invalid:{city}")
            except (ValueError, TypeError, OverflowError):
                errors.append(f"market_clock_invalid:{city}")
    articles = news.get("articles")
    if not isinstance(articles, list) or not articles:
        return errors + ["no_qualifying_articles"]
    # Duplicate evidence keys are ambiguous: dict comprehensions previously
    # let the last record silently overwrite a failed or conflicting record.
    sources, receipt_index = {}, {}
    source_rows = audit.get("sources")
    if not isinstance(source_rows, list):
        errors.append("sources_not_list")
        source_rows = []
    for source in source_rows:
        sid = source.get("id") if isinstance(source, dict) else None
        if not isinstance(sid, str) or not sid:
            errors.append("invalid_source_record")
        elif sid in sources:
            errors.append(f"duplicate_source_id:{sid}")
        else:
            sources[sid] = source
    if not isinstance(receipts, list):
        errors.append("receipts_not_list")
        receipts = []
    for receipt in receipts:
        sid = receipt.get("source_id") if isinstance(receipt, dict) else None
        url = receipt.get("url") if isinstance(receipt, dict) else None
        if not isinstance(sid, str) or not sid or not isinstance(url, str) or not url:
            errors.append("invalid_receipt_record")
            continue
        key = (sid, url)
        if key in receipt_index:
            errors.append(f"duplicate_receipt_key:{sid}:{url}")
        else:
            receipt_index[key] = receipt
    publisher_owners, urls, titles = set(), set(), set()
    for idx, item in enumerate(articles):
        tag = f"article_{idx}"
        if not isinstance(item, dict):
            errors.append(f"{tag}:not_object")
            continue
        title, url, sid = item.get("headline", ""), item.get("url", ""), item.get("source_id")
        if not isinstance(title, str) or not title.strip() or PROFANITY.search(title):
            errors.append(f"{tag}:editorial_language")
        try:
            parsed = urlparse(url) if isinstance(url, str) else None
            valid_url = bool(parsed and parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password)
        except ValueError:
            valid_url, parsed = False, None
        if not valid_url:
            errors.append(f"{tag}:unsafe_url")
        # Marketing query aliases and fragments must not count as new stories.
        # Receipts are still checked against each original, exact URL below.
        url_key = article_identity_url(url) if isinstance(url, str) else f"invalid-url:{idx}"
        if url_key in urls or (isinstance(title, str) and title.casefold() in titles):
            errors.append(f"{tag}:duplicate")
        urls.add(url_key)
        titles.add(title.casefold() if isinstance(title, str) else "")
        if not sid or sid not in sources or sources[sid].get("status") != "OK":
            errors.append(f"{tag}:source_not_successful")
        receipt = receipt_index.get((sid, url))
        fetched_at = instant(receipt.get("fetched_at")) if receipt else None
        if (not receipt or receipt.get("status") != "fetched" or
                not SHA256.fullmatch(str(receipt.get("content_sha256", ""))) or
                not fetched_at or not scan_at or
                fetched_at > now + timedelta(minutes=5) or
                fetched_at > scan_at + timedelta(minutes=5) or
                scan_at - fetched_at > timedelta(hours=1)):
            errors.append(f"{tag}:no_independent_exact_url_receipt")
        right = rights.get(sid, {})
        if (right.get("status") != "verified" or not SHA256.fullmatch(str(right.get("terms_sha256", "")))
                or not right.get("terms_url") or not right.get("reviewer") or not right.get("attribution")
                or not right.get("publisher_host") or not right.get("publisher_owner_id")
                or not valid_url or parsed.hostname != right.get("publisher_host")):
            errors.append(f"{tag}:publisher_rights_unverified")
        else:
            # Distinct source IDs/mastheads are not independent when they
            # resolve to the same reviewed publisher owner.
            publisher_owners.add(str(right["publisher_owner_id"]).strip().casefold())
        event, published = instant(item.get("event_utc")), instant(item.get("published_utc"))
        if (not event or not published or event > now + timedelta(minutes=5) or
                published > now + timedelta(minutes=5) or
                now - event > timedelta(days=14) or now - published > timedelta(days=14)):
            errors.append(f"{tag}:event_or_publication_stale_unverified")
        cat = item.get("category")
        if cat not in CATEGORIES:
            errors.append(f"{tag}:unknown_category")
            continue
        ref, dc_id = item.get("repd_ref"), item.get("dc_id")
        if cat == "uk-repd":
            try:
                official_mw = float(repd_mw[ref]) if isinstance(ref, str) and ref in repd_mw else 0
            except (ValueError, TypeError):
                official_mw = 0
            if not isinstance(ref, str) or official_mw < 50 or item.get("materiality_basis") != "official_repd_mw":
                errors.append(f"{tag}:repd_identity_or_capacity_unverified")
            if dc_id:
                errors.append(f"{tag}:dc_id_misclassified_as_repd")
        else:
            if ref:
                errors.append(f"{tag}:foreign_or_dc_article_has_repd_ref")
            if cat == "data-centres" and (not isinstance(dc_id, str) or dc_id not in verified_dc_ids or (item.get("region") == "UK" and not dc_id.startswith("dcuk-"))):
                errors.append(f"{tag}:data_centre_id_unverified")
            if cat != "data-centres" and dc_id:
                errors.append(f"{tag}:data_centre_id_wrong_category")
            if cat not in STRATEGIC:
                basis, capex, mw = item.get("materiality_basis"), item.get("capex_usd"), item.get("capacity_mw")
                if basis == "project_capex_usd":
                    if type(capex) not in (int, float) or capex < 25_000_000 or item.get("financing_type") != "project_capex":
                        errors.append(f"{tag}:corporate_funding_not_project_capex")
                elif basis == "installed_or_it_load_mw":
                    if type(mw) not in (int, float) or mw < 50 or (cat == "data-centres" and item.get("capacity_basis") != "it_load_mw"):
                        errors.append(f"{tag}:capacity_basis_unverified")
                else:
                    errors.append(f"{tag}:materiality_basis_missing")
        if item.get("grid_connection_mw") is not None and not item.get("verified_grid_connection_source_url"):
            errors.append(f"{tag}:inferred_grid_connection")
    if len(publisher_owners - {""}) < 2:
        errors.append("insufficient_independent_publishers")
    return errors
