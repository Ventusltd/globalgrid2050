"""Bounded offline composition of existing Covenant, Grid and Solar contracts.

No collection, project matching, allocation, quantity conversion or publication.
The producer validators remain authoritative; native records are retained intact.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile

from automation.news.dc_context import grid, solar
from automation.news.filings.contracts import validate_claim
from automation.news.policy_commitments import ledger as policy

SCHEMA = "globalgrid2050.transition-context.v1"
MAX_INPUT_BYTES = 4 * 1024 * 1024
MAX_OUTPUT_BYTES = 16 * 1024 * 1024
COLUMNS = ("id", "family", "title", "scope", "source_state", "evaluation_state",
           "applicability_state", "source_links", "numeric_claims", "native_schema", "native_record")


def dumps(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"


def _bounded(value, limit):
    raw = dumps(value).encode("utf-8")
    if len(raw) > limit:
        raise ValueError("Context exceeds bounded size")
    return raw


def _scope(native_scope, entity_id, *, family, relationship=None):
    # These are presentation categories only, never an identity crosswalk.
    if relationship == "portfolio_storage_access" or native_scope == "consolidated_group":
        kind = "portfolio"
    elif native_scope == "issuer":
        kind = "issuer"
    elif native_scope in {"project", "site", "campus", "phase"}:
        kind = "project"
    elif family == "policy":
        kind = "policy"
    else:
        kind = "UNKNOWN"
    return {"kind": kind, "native_scope": native_scope, "entity_id": entity_id,
            "canonical_project_id": None, "binding": "UNLINKED"}


def _link(document, *, section=None, page=None, text=None, covenant=False):
    return {"document_id": document["id"] if covenant else document["document_id"],
            "url": document["url"],
            "publisher": document["issuer"] if covenant else document["publisher"],
            "published_date": document["published_on"] if covenant else document["published_date"],
            "reviewed_at": document["reviewed_at"] if covenant else None,
            "retrieved_at": document["retrieved_at"],
            "sha256": document["content_sha256"] if covenant else document["sha256"],
            "locator": {"section": section, "page": page, "text": text},
            "receipt": deepcopy(document)}


def _figure(claim, role, qualifier=None):
    # Exact FIGURES validation/copy; no float coercion or parallel quantity model.
    return {"role": role, "qualifier": qualifier, "claim": validate_claim(claim)}


def _policy_row(row, documents):
    claims = []
    references = [row["source"], *row["applicability"]["evidence"],
                  *(update["source"] for update in row["updates"])]
    for role, claim in (("TARGET", row["target"]), ("BASELINE", row["baseline"]),
                        *(("UPDATE", update["claim"]) for update in row["updates"])):
        if claim is not None:
            claims.append(_figure(claim, role))
            provenance = claim["provenance"]
            references.append({"document_id": provenance["document_id"],
                               "locator": provenance["section"] or "page " + provenance["page"]})
    links = {(ref["document_id"], ref["locator"]): _link(documents[ref["document_id"]],
             text=ref["locator"], covenant=True) for ref in references}
    return {"id": "policy:" + row["commitment_id"], "family": "policy", "title": row["statement"],
            "scope": _scope(row["scope"]["figure_entity_scope"], row["scope"]["entity_id"], family="policy"),
            "source_state": row["document_state"], "evaluation_state": row["state"],
            "applicability_state": row["applicability"]["state"],
            "source_links": [links[key] for key in sorted(links)], "numeric_claims": claims,
            "native_schema": policy.REPORT_SCHEMA, "native_record": deepcopy(row)}


def _context_row(row, family):
    is_solar = family == "solar"
    native_scope = row["entity"]["scope"] if is_solar else row["entity_scope"]
    entity_id = row["entity"]["id"] if is_solar else row["id"]
    figures = [_figure(item["claim"], "CONTEXT", item["qualifier"]) if is_solar
               else _figure(item, "CONTEXT") for item in row["numeric_claims"]]
    return {"id": family + ":" + row["id"], "family": family, "title": row["name"],
            "scope": _scope(native_scope, entity_id, family=family, relationship=row.get("relationship")),
            "source_state": row["source_state"], "evaluation_state": "UNKNOWN", "applicability_state": "UNKNOWN",
            "source_links": [_link(row["source"], section=row["section"], page=row["page"])],
            "numeric_claims": figures, "native_schema": solar.SCHEMA if is_solar else grid.SCHEMA,
            "native_record": deepcopy(row)}


def build(policy_input, grid_input, solar_input, *, as_of):
    """Validate all three inputs before returning a complete, unlinked bundle.

    Every family is mandatory and nonempty. Input digests cover the entire
    supplied JSON value in canonical serialization, not original document bytes.
    """
    inputs = {"policy": policy_input, "grid": grid_input, "solar": solar_input}
    digests = {family: hashlib.sha256(_bounded(value, MAX_INPUT_BYTES)).hexdigest()
               for family, value in inputs.items()}
    evaluated = policy.evaluate(policy_input, as_of=as_of)
    grid_result = grid.build(grid_input, as_of=as_of)
    solar_result = solar.build(solar_input, as_of=as_of)
    documents = {document["id"]: document for document in evaluated["documents"]}
    records = [_policy_row(row, documents) for row in evaluated["results"]]
    records.extend(_context_row(row, "grid") for row in grid_result["records"])
    records.extend(_context_row(row, "solar") for row in solar_result["records"])
    records.sort(key=lambda row: row["id"])
    if not records or len(records) > 3000 or len({row["id"] for row in records}) != len(records):
        raise ValueError("Nonempty bounded unique context coverage required")
    claim_ids = [figure["claim"]["claim_id"] for row in records for figure in row["numeric_claims"]]
    if len(claim_ids) != len(set(claim_ids)):
        raise ValueError("Repeated FIGURES identity across context families")
    counts = {family: sum(row["family"] == family for row in records) for family in inputs}
    if not all(counts.values()):
        raise ValueError("All context families require coverage")
    receipts = []
    for family, result in (("policy", evaluated), ("grid", grid_result), ("solar", solar_result)):
        receipts.append({"family": family, "input_schema": inputs[family]["schema"],
                         "input_sha256": digests[family], "output_schema": result["schema"],
                         "record_count": counts[family],
                         "source_count": len(inputs[family]["documents" if family == "policy" else "sources"]),
                         "source_byte_validation": "RECEIPTS_ONLY",
                         "native_metadata": {key: deepcopy(value) for key, value in result.items()
                                             if key not in {"records", "results"}}})
    report = {"schema": SCHEMA, "as_of": as_of, "status": "PROVISIONAL",
              "coverage": {"records": len(records), "families": counts, "numeric_claims": len(claim_ids),
                           "linked_projects": 0, "scope": "BOUNDED_SUPPLIED_CONTEXT"},
              "input_receipts": receipts, "records": records,
              "limitations": ["Dated source context; no current project delivery, legal compliance or source truth certified.",
                              "No identity crosswalk, site allocation, numerical aggregation, conversion or ranking.",
                              "Receipt hashes are supplied metadata; original source bytes were not reverified.",
                              "Publication, review, retrieval and figure dates remain distinct; composition time is not source freshness.",
                              "Historical inventory is separate; no exhaustive treaty history or final COP31 outcome inferred."]}
    _bounded(report, MAX_OUTPUT_BYTES)
    return report


def csv_report(report):
    """One context per row; nested records/claims retain exact JSON values."""
    class BoundedOutput(io.StringIO):
        size = 0

        def write(self, value):
            self.size += len(value.encode("utf-8"))
            if self.size > MAX_OUTPUT_BYTES:
                raise ValueError("CSV export exceeds bounded size")
            return super().write(value)

    output = BoundedOutput(newline="")
    writer = csv.DictWriter(output, fieldnames=("bundle", *COLUMNS), lineterminator="\n")
    writer.writeheader()
    metadata = {key: value for key, value in report.items() if key != "records"}
    for row in report["records"]:
        cells = {}
        for name in ("bundle", *COLUMNS):
            value = metadata if name == "bundle" else row[name]
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
            value = "" if value is None else str(value)
            cells[name] = "'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r")) else value
        writer.writerow(cells)
    return output.getvalue()


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _read(path):
    with path.open("rb") as handle:
        raw = handle.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ValueError("Input exceeds bounded size")
    return json.loads(raw, object_pairs_hook=_unique_object)


def _publish_new(path, raw):
    """Publish fully flushed bytes by an atomic, exclusive same-filesystem link.

    Unsupported hard links fail closed; never fall back to overwriting/renaming.
    Only the uniquely created staging file is removed, never the destination.
    """
    descriptor, name = tempfile.mkstemp(prefix=".transition-context-", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.link(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--grid", type=Path, required=True)
    parser.add_argument("--solar", type=Path, required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--format", choices=("json", "csv"), default="json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    try:
        report = build(_read(args.policy), _read(args.grid), _read(args.solar), as_of=args.as_of)
        result = csv_report(report) if args.format == "csv" else dumps(report)
        if len(result.encode("utf-8")) > MAX_OUTPUT_BYTES:
            raise ValueError("Export exceeds bounded size")
        if args.output:
            _publish_new(args.output, result.encode("utf-8"))
        else:
            if hasattr(sys.stdout, "buffer"):
                sys.stdout.buffer.write(result.encode("utf-8"))
            else:
                sys.stdout.write(result)
    except (ValueError, TypeError, KeyError, OSError, OverflowError, RecursionError):
        parser.exit(2, "Transition context validation/export failed; no replacement or partial report published.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
