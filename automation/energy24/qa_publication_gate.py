"""Read-only, fail-closed Energy24 publication acceptance (not a feed writer).

A producer timestamp, source-health flag or headline is not independent proof
that an individual URL was fetched or its publisher rights were cleared.
This QA-only contract holds the v1 feed pending separate reviewed receipts.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import re

MARKETS = {"London", "New York", "San Francisco", "Hong Kong", "Tokyo", "Sydney"}
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
    if set(audit.get("markets", {})) != MARKETS:
        errors.append("market_clocks_incomplete")
    articles = news.get("articles")
    if not isinstance(articles, list) or not articles:
        return errors + ["no_qualifying_articles"]
    sources = {s.get("id"): s for s in audit.get("sources", []) if isinstance(s, dict) and s.get("id")}
    receipt_index = {(r.get("source_id"), r.get("url")): r for r in receipts if isinstance(r, dict)}
    publisher_ids, urls, titles = set(), set(), set()
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
        if url in urls or (isinstance(title, str) and title.casefold() in titles):
            errors.append(f"{tag}:duplicate")
        urls.add(url)
        titles.add(title.casefold() if isinstance(title, str) else "")
        if not sid or sid not in sources or sources[sid].get("status") != "OK":
            errors.append(f"{tag}:source_not_successful")
        else:
            publisher_ids.add(sid)
        receipt = receipt_index.get((sid, url))
        fetched_at = instant(receipt.get("fetched_at")) if receipt else None
        if (not receipt or receipt.get("status") != "fetched" or
                not SHA256.fullmatch(str(receipt.get("content_sha256", ""))) or
                not fetched_at or not scan_at or abs((scan_at - fetched_at).total_seconds()) > 3600):
            errors.append(f"{tag}:no_independent_exact_url_receipt")
        right = rights.get(sid, {})
        if (right.get("status") != "verified" or not SHA256.fullmatch(str(right.get("terms_sha256", "")))
                or not right.get("terms_url") or not right.get("reviewer") or not right.get("attribution")
                or not right.get("publisher_host") or not valid_url
                or parsed.hostname != right.get("publisher_host")):
            errors.append(f"{tag}:publisher_rights_unverified")
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
    if len(publisher_ids) < 2:
        errors.append("insufficient_independent_publishers")
    return errors
