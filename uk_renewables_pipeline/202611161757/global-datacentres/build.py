"""Rebuild the bounded global sample offline from pinned CC0 structured facts.

This is not a collector and makes no network requests. Updates require reviewed
entity revisions in source-facts.json and a new release; historical data stays.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import math
import re

HERE = Path(__file__).resolve().parent
SCHEMA = "globalgrid2050.global-datacentres.projects.v1"
DUCKDB_VERSION = "1.3.2"
BASELINE_IDS = frozenset({"Q12857142", "Q520438", "Q1277574", "Q11236058", "Q19721053", "Q142068471",
                          "Q142068695", "Q142068699", "Q138426651", "Q140089116", "Q139609394", "Q24259253"})
PARQUET = f"data/facilities/generation={HERE.parent.name}/source=WIKIDATA/global-data-centre-records-v1.parquet"
COLUMNS = [
    ("source_record_id", "VARCHAR"), ("name", "VARCHAR"), ("country_id", "VARCHAR"),
    ("country_name", "VARCHAR"), ("country_code", "VARCHAR"), ("operator_name", "VARCHAR"),
    ("latitude", "DOUBLE"), ("longitude", "DOUBLE"), ("precision_degrees", "DOUBLE"),
    ("it_load_mw", "DOUBLE"), ("site_demand_mw", "DOUBLE"), ("grid_connection_mw", "DOUBLE"),
    ("retrieved_at", "VARCHAR"), ("entity_revision", "BIGINT"), ("entity_url", "VARCHAR"),
    ("revision_url", "VARCHAR"), ("country_revision_url", "VARCHAR"), ("operator_revision_url", "VARCHAR"),
    ("source_licence", "VARCHAR"), ("licence_url", "VARCHAR"), ("source_facts_sha256", "VARCHAR"),
]


def compact_json(value):
    """Deterministic served bytes without redundant indentation."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


def values(entity, prop):
    claims = [c for c in entity["claims"].get(prop, []) if c["rank"] != "deprecated"]
    preferred = [c for c in claims if c["rank"] == "preferred"]
    return [c["value"] for c in preferred or claims]


def revision_url(entity):
    return f"https://www.wikidata.org/w/index.php?title={entity['id']}&oldid={entity['revision']}"


def selection_audit(facts):
    """Conservative lead screening; source descriptions are not verification."""
    candidates = facts["candidate_ids"]
    if len(candidates) > 200 or len(candidates) != len(set(candidates)):
        raise ValueError("Candidate query exceeds bound or duplicates IDs; quarantine required")
    if set(facts["baseline_ids"]) != BASELINE_IDS or not BASELINE_IDS <= set(candidates):
        raise ValueError("Original twelve identities changed; quarantine required")
    selected, rejected = [], []
    for entity_id in candidates:
        entity = facts["entities"][entity_id]
        description = entity.get("description", "")
        reason = None
        if entity_id not in BASELINE_IDS:
            if re.search(r"company|organizational unit|former|library automation|seven subject-based|supercomputer in the", description, re.I):
                reason = "Ambiguous company, organisation, aggregate, former or computing-service identity"
            elif not re.search(r"\bdata[ -]?cent(?:er|re)\b", description, re.I):
                reason = "Insufficient English site/campus description for prospecting"
        if reason:
            rejected.append({"id": "DC-WD-" + entity_id, "name": entity["label"],
                             "source_revision_url": revision_url(entity), "reason": reason})
        else:
            selected.append(entity_id)
    if selected != facts["selected_ids"]:
        raise ValueError("Pinned selection differs from conservative screening; quarantine required")
    return {"schema": "globalgrid2050.global-datacentres.selection-audit.v1", "rule": "bounded-site-description-v1",
            "candidate_count": len(candidates), "selected_count": len(selected), "quarantined_count": len(rejected),
            "baseline_preserved": True, "independently_verified": False,
            "query": facts["coverage_query"], "quarantined": rejected}


def project(path=HERE / "source-facts.json"):
    raw = path.read_bytes()
    facts = json.loads(raw)
    if facts["licence"] != "CC0-1.0":
        raise ValueError("Source rights not accepted; quarantine required")
    selection = selection_audit(facts)
    entities = facts["entities"]
    records = []
    for entity_id in facts["selected_ids"]:
        entity = entities[entity_id]
        if not {v["id"] for v in values(entity, "P31")} >= {"Q671224"}:
            raise ValueError("Source not classified as a data centre; quarantine required")
        countries = values(entity, "P17")
        if len(countries) != 1:
            raise ValueError("Ambiguous country; quarantine required")
        country = entities[countries[0]["id"]]
        codes = values(country, "P297")
        code = codes[0] if len(codes) == 1 and len(codes[0]) == 2 else None
        coordinates = values(entity, "P625")
        # Ambiguous or non-Earth coordinates are not mapped.
        point = coordinates[0] if len(coordinates) == 1 and coordinates[0]["globe"].endswith("/Q2") else None
        if point and (not all(isinstance(point[k], (float, int)) and math.isfinite(point[k]) for k in ("latitude", "longitude", "precision"))
                      or not (-90 <= point["latitude"] <= 90 and -180 <= point["longitude"] <= 180 and point["precision"] > 0)):
            raise ValueError("Invalid coordinate; quarantine required")
        operators = values(entity, "P137")
        operator = entities[operators[0]["id"]] if len(operators) == 1 else None
        records.append({
            "id": "DC-WD-" + entity_id, "name": entity["label"], "record_type": "data_centre",
            "country": {"code": code, "name": country["label"], "wikidata_id": country["id"]},
            "operator": operator["label"] if operator else None,
            "operating_status": "not_assessed", "verification_status": "SOURCE_INDEXED",
            "location": None if point is None else {
                "latitude": point["latitude"], "longitude": point["longitude"],
                "precision_degrees": point["precision"], "basis": "Wikidata P625 source point; not surveyed accuracy",
            },
            "capacity": {"it_load_mw": None, "site_demand_mw": None, "grid_connection_mw": None},
            "capacity_sources": {"it_load_mw": None, "site_demand_mw": None, "grid_connection_mw": None},
            "source": {"publisher": "Wikidata", "url": "https://www.wikidata.org/wiki/" + entity_id,
                       "revision_url": revision_url(entity), "revision": entity["revision"],
                       "retrieved_at": facts["retrieved_at"], "licence": "CC0-1.0",
                       "licence_url": facts["licence_url"]},
            "field_sources": {
                "name": revision_url(entity), "country": revision_url(country),
                "location": revision_url(entity) + "#P625" if point else None,
                "operator": revision_url(operator) if operator else None,
            },
        })
    if len(records) != len({r["id"] for r in records}):
        raise ValueError("Duplicate source identity; quarantine required")
    for record in records:
        if record["id"].removeprefix("DC-WD-") in BASELINE_IDS:
            semantic = {k: record[k] for k in ("id", "name", "country", "operator", "location", "capacity")}
            digest = hashlib.sha256(json.dumps(semantic, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
            if facts["baseline_semantic_sha256"].get(record["id"]) != digest:
                raise ValueError("Original twelve semantic fields changed; quarantine required")
    records.sort(key=lambda p: (p["country"]["name"], p["name"]))
    return {"schema": SCHEMA, "generated_from_retrieval": facts["retrieved_at"],
            "coverage": "Bounded Wikidata prospecting sample; not a comprehensive worldwide register or verified-facility census. Ambiguous source identities are quarantined; countries and facilities without selected records are not implied absent.",
            "scope": "global", "record_count": len(records),
            "country_count": len({p["country"]["wikidata_id"] for p in records}),
            "candidate_count": selection["candidate_count"], "quarantined_count": selection["quarantined_count"],
            "source_facts_sha256": hashlib.sha256(raw).hexdigest(), "records": records}


def flatten(record, digest):
    p, s, f = record, record["source"], record["field_sources"]
    location = p["location"] or {}
    return (p["id"], p["name"], p["country"]["wikidata_id"], p["country"]["name"], p["country"]["code"], p["operator"],
            location.get("latitude"), location.get("longitude"), location.get("precision_degrees"),
            p["capacity"]["it_load_mw"], p["capacity"]["site_demand_mw"], p["capacity"]["grid_connection_mw"],
            s["retrieved_at"], s["revision"], s["url"], s["revision_url"], f["country"], f["operator"],
            s["licence"], s["licence_url"], digest)


def expand(row):
    r = dict(zip((name for name, _ in COLUMNS), row))
    return {
        "id": r["source_record_id"], "name": r["name"], "record_type": "data_centre",
        "country": {"code": r["country_code"], "name": r["country_name"], "wikidata_id": r["country_id"]},
        "operator": r["operator_name"], "operating_status": "not_assessed", "verification_status": "SOURCE_INDEXED",
        "location": None if r["latitude"] is None else {"latitude": r["latitude"], "longitude": r["longitude"],
                     "precision_degrees": r["precision_degrees"], "basis": "Wikidata P625 source point; not surveyed accuracy"},
        "capacity": {key: r[key] for key in ("it_load_mw", "site_demand_mw", "grid_connection_mw")},
        "capacity_sources": {"it_load_mw": None, "site_demand_mw": None, "grid_connection_mw": None},
        "source": {"publisher": "Wikidata", "url": r["entity_url"], "revision_url": r["revision_url"],
                   "revision": r["entity_revision"], "retrieved_at": r["retrieved_at"], "licence": r["source_licence"],
                   "licence_url": r["licence_url"]},
        "field_sources": {"name": r["revision_url"], "country": r["country_revision_url"],
                          "location": r["revision_url"] + "#P625" if r["latitude"] is not None else None,
                          "operator": r["operator_revision_url"]},
    }


def build(path=HERE / "source-facts.json", output_dir=None):
    """Furnace: validate -> typed Parquet -> exact readback -> browser export.

    Invalid source rows fail the entire build before any output is promoted.
    Unknown measurements remain null and are not erroneous/quarantined rows.
    """
    import duckdb
    if duckdb.__version__ != DUCKDB_VERSION:
        raise ValueError(f"DuckDB version drift: require {DUCKDB_VERSION}")
    candidate = project(path)
    rows = sorted(flatten(r, candidate["source_facts_sha256"]) for r in candidate["records"])
    with tempfile.TemporaryDirectory(prefix="global-dc-furnace-") as temporary:
        folder = Path(temporary)
        hashes = []
        for pass_number in (1, 2):
            parquet = folder / f"pass{pass_number}.parquet"
            with duckdb.connect(":memory:") as db:
                db.execute("SET threads=1")
                db.execute("CREATE TABLE records (" + ",".join(name + " " + kind for name, kind in COLUMNS) + ")")
                db.executemany("INSERT INTO records VALUES (" + ",".join("?" for _ in COLUMNS) + ")", rows)
                escaped = parquet.as_posix().replace("'", "''")
                db.execute(f"COPY (SELECT * FROM records ORDER BY source_record_id) TO '{escaped}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 2048)")
                readback = db.execute("SELECT * FROM read_parquet(?, hive_partitioning=false) ORDER BY source_record_id", [str(parquet)]).fetchall()
                if readback != rows:
                    raise ValueError("Parquet value/null readback failed; quarantine required")
                schema = db.execute("DESCRIBE SELECT * FROM read_parquet(?, hive_partitioning=false)", [str(parquet)]).fetchall()
                if [(r[0], r[1]) for r in schema] != COLUMNS:
                    raise ValueError("Parquet schema mismatch; quarantine required")
                codecs = db.execute("SELECT DISTINCT compression FROM parquet_metadata(?)", [str(parquet)]).fetchall()
                if codecs != [("ZSTD",)]:
                    raise ValueError("Parquet compression mismatch")
            hashes.append(hashlib.sha256(parquet.read_bytes()).hexdigest())
        if len(set(hashes)) != 1:
            raise ValueError("Deterministic double compile failed; quarantine required")
        candidate["records"] = sorted((expand(row) for row in readback), key=lambda p: (p["country"]["name"], p["name"]))
        selection = selection_audit(json.loads(path.read_bytes()))
        audit = {"schema": "globalgrid2050.global-datacentres.furnace-audit.v1", "source_facts_sha256": candidate["source_facts_sha256"],
                 "duckdb_version": DUCKDB_VERSION, "source_grain": "one Wikidata entity; not adjudicated facility identity",
                 "row_count": len(rows), "distinct_source_ids": len({r[0] for r in rows}), "quarantined_rows": selection["quarantined_count"],
                 "candidate_rows": selection["candidate_count"],
                 "source_rights": "CC0-1.0 structured data", "parquet": PARQUET, "parquet_sha256": hashes[0],
                 "compression": "ZSTD", "double_compile": "BYTE_IDENTICAL", "readback": "EXACT_VALUES_AND_NULLS",
                 "browser_export_source": "DUCKDB_PARQUET_READBACK", "verified_rows": 0,
                 "stages": ["pinned_cc0_facts", "validate_or_quarantine", "typed_normalization", "parquet_double_compile", "duckdb_readback", "browser_projection"]}
        if output_dir is not None:
            out = Path(output_dir)
            target = out / PARQUET
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(folder / "pass1.parquet", target)
            (out / "pipeline-audit.json").write_text(compact_json(audit), encoding="utf-8", newline="\n")
            (out / "selection-audit.json").write_text(compact_json(selection), encoding="utf-8", newline="\n")
        return candidate


if __name__ == "__main__":
    result = build(output_dir=HERE)
    (HERE / "projects.json").write_text(compact_json(result), encoding="utf-8", newline="\n")
    print(f"Global source-indexed sample: {result['record_count']} leads, {result['country_count']} countries")
