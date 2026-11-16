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

HERE = Path(__file__).resolve().parent
SCHEMA = "globalgrid2050.global-datacentres.projects.v1"
DUCKDB_VERSION = "1.3.2"
PARQUET = "data/facilities/generation=202611161630/source=WIKIDATA/global-data-centre-records-v1.parquet"
COLUMNS = [
    ("source_record_id", "VARCHAR"), ("name", "VARCHAR"), ("country_id", "VARCHAR"),
    ("country_name", "VARCHAR"), ("country_code", "VARCHAR"), ("operator_name", "VARCHAR"),
    ("latitude", "DOUBLE"), ("longitude", "DOUBLE"), ("precision_degrees", "DOUBLE"),
    ("it_load_mw", "DOUBLE"), ("site_demand_mw", "DOUBLE"), ("grid_connection_mw", "DOUBLE"),
    ("retrieved_at", "VARCHAR"), ("entity_revision", "BIGINT"), ("entity_url", "VARCHAR"),
    ("revision_url", "VARCHAR"), ("country_revision_url", "VARCHAR"), ("operator_revision_url", "VARCHAR"),
    ("source_licence", "VARCHAR"), ("licence_url", "VARCHAR"), ("source_facts_sha256", "VARCHAR"),
]


def values(entity, prop):
    claims = [c for c in entity["claims"].get(prop, []) if c["rank"] != "deprecated"]
    preferred = [c for c in claims if c["rank"] == "preferred"]
    return [c["value"] for c in preferred or claims]


def revision_url(entity):
    return f"https://www.wikidata.org/w/index.php?title={entity['id']}&oldid={entity['revision']}"


def project(path=HERE / "source-facts.json"):
    raw = path.read_bytes()
    facts = json.loads(raw)
    if facts["licence"] != "CC0-1.0":
        raise ValueError("Source rights not accepted; quarantine required")
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
    records.sort(key=lambda p: (p["country"]["name"], p["name"]))
    return {"schema": SCHEMA, "generated_from_retrieval": facts["retrieved_at"],
            "coverage": "Curated global sample; not a comprehensive worldwide register. Countries and facilities without selected records are not implied absent.",
            "scope": "global", "record_count": len(records),
            "country_count": len({p["country"]["wikidata_id"] for p in records}),
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
        audit = {"schema": "globalgrid2050.global-datacentres.furnace-audit.v1", "source_facts_sha256": candidate["source_facts_sha256"],
                 "duckdb_version": DUCKDB_VERSION, "source_grain": "one Wikidata entity; not adjudicated facility identity",
                 "row_count": len(rows), "distinct_source_ids": len({r[0] for r in rows}), "quarantined_rows": 0,
                 "source_rights": "CC0-1.0 structured data", "parquet": PARQUET, "parquet_sha256": hashes[0],
                 "compression": "ZSTD", "double_compile": "BYTE_IDENTICAL", "readback": "EXACT_VALUES_AND_NULLS",
                 "browser_export_source": "DUCKDB_PARQUET_READBACK", "verified_rows": 0,
                 "stages": ["pinned_cc0_facts", "validate_or_quarantine", "typed_normalization", "parquet_double_compile", "duckdb_readback", "browser_projection"]}
        if output_dir is not None:
            out = Path(output_dir)
            target = out / PARQUET
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(folder / "pass1.parquet", target)
            (out / "pipeline-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8", newline="\n")
        return candidate


if __name__ == "__main__":
    result = build(output_dir=HERE)
    (HERE / "projects.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Global source-indexed sample: {result['record_count']} sites, {result['country_count']} countries")
