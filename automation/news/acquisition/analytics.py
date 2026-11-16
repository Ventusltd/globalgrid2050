"""Immutable analytical Parquet projection; SQLite remains the operational store.

Pinned upstream conventions and integration boundary are in ANALYTICS.md.
"""
from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import Path
import tempfile

import duckdb

from .evidence_store import EvidenceValidationError, validate_snapshot

SCHEMA = "globalgrid2050.solar-evidence.analytics.v1"
TABLES = {
    "projects": [
        ("project_id", "VARCHAR"), ("name", "VARCHAR"),
        ("latitude", "DOUBLE"), ("longitude", "DOUBLE"), ("status", "VARCHAR"),
        ("evidence_count", "BIGINT"), ("provisional_count", "BIGINT"),
        ("verified_count", "BIGINT"), ("last_event", "VARCHAR"),
        ("last_researched_at", "VARCHAR"),
    ],
    "evidence": [
        ("project_id", "VARCHAR"), ("id", "VARCHAR"), ("url", "VARCHAR"),
        ("title", "VARCHAR"), ("pub_date", "VARCHAR"), ("source_id", "VARCHAR"),
        ("publisher", "VARCHAR"), ("status", "VARCHAR"), ("match_method", "VARCHAR"),
        ("first_seen", "VARCHAR"), ("last_seen", "VARCHAR"),
    ],
}
ORDERS = {"projects": "project_id", "evidence": "project_id, url"}


def _require(condition, message):
    if not condition:
        raise EvidenceValidationError(message)


def _json(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False,
                       allow_nan=False, indent=2) + "\n").encode("utf-8")


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _rows(payload):
    # Independent Python reference for complete DuckDB readback comparison.
    projects = sorted(payload["projects"], key=lambda row: row["project_id"])
    evidence = sorted(
        ({**article, "project_id": project["project_id"]}
         for project in projects for article in project["evidence"]),
        key=lambda row: (row["project_id"], row["url"]),
    )
    return {name: [tuple(row[column] for column, _ in TABLES[name]) for row in rows]
            for name, rows in (("projects", projects), ("evidence", evidence))}


def _connect():
    connection = duckdb.connect(":memory:")
    connection.execute("SET threads=1")
    connection.execute("SET preserve_insertion_order=true")
    return connection


def _literal(path):
    # COPY's destination is SQL syntax; values elsewhere use bound parameters.
    return "'" + Path(path).as_posix().replace("'", "''") + "'"


def _receipt(directory, manifest):
    return {"schema": SCHEMA, "directory": directory.name,
            "manifest": directory.name + "/manifest.json",
            "sha256": _sha((directory / "manifest.json").read_bytes()),
            "project_count": manifest["project_count"],
            "evidence_count": manifest["evidence_count"], "review_required": True}


def validate_analytics(directory, payload, *, expected_project_ids):
    """Read-only verification of every artifact and every projected source row."""
    validate_snapshot(payload, expected_project_ids)
    directory = Path(directory)
    names = {"projects.parquet", "evidence.parquet", "manifest.json"}
    _require(directory.is_dir() and not directory.is_symlink(), "Missing analytical directory")
    _require({p.name for p in directory.iterdir()} == names
             and all((directory / n).is_file() and not (directory / n).is_symlink() for n in names),
             "Analytical artifact closure mismatch")
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    expected_rows = _rows(payload)
    expected_header = {
        "schema": SCHEMA, "source_snapshot_sha256": _sha(_json(payload)),
        "generated_at": payload["generated_at"], "seed_release": payload["seed_release"],
        "project_count": payload["project_count"], "evidence_count": payload["evidence_count"],
        "review_required": True, "sources": payload["sources"],
    }
    _require(set(manifest) == set(expected_header) | {"runtime", "artifacts"}
             and all(manifest[key] == value for key, value in expected_header.items()),
             "Analytical source identity mismatch")
    _require(manifest["runtime"] == {"duckdb": duckdb.__version__, "threads": 1},
             "Analytical runtime mismatch; immutable rebuild requires a new generation")
    _require(set(manifest["artifacts"]) == set(TABLES), "Analytical artifact manifest mismatch")
    with _connect() as connection:
        for table, columns in TABLES.items():
            path = directory / (table + ".parquet")
            data = path.read_bytes()
            expected = {"path": path.name, "sha256": _sha(data), "bytes": len(data),
                        "rows": len(expected_rows[table]), "columns": [list(c) for c in columns],
                        "compression": "ZSTD"}
            _require(manifest["artifacts"][table] == expected, "Analytical artifact hash/schema mismatch")
            relation = connection.read_parquet(str(path))
            _require(list(zip(relation.columns, map(str, relation.types))) == columns,
                     "Analytical Parquet schema mismatch")
            relation.create_view(table)
            actual = connection.execute(f"SELECT * FROM {table} ORDER BY {ORDERS[table]}").fetchall()
            _require(actual == expected_rows[table], "Analytical full-row comparison failed")
            codecs = connection.execute("SELECT DISTINCT compression FROM parquet_metadata(?)", [str(path)]).fetchall()
            _require(all(c[0] == "ZSTD" for c in codecs), "Unexpected analytical compression")
        invalid = connection.execute("""
            SELECT count(*) FROM projects p LEFT JOIN
              (SELECT project_id, count(*) AS n FROM evidence GROUP BY project_id) e
              USING(project_id)
            WHERE p.evidence_count <> coalesce(e.n, 0)
               OR p.provisional_count <> coalesce(e.n, 0) OR p.verified_count <> 0
        """).fetchone()[0]
        orphans = connection.execute("""
            SELECT count(*) FROM evidence e ANTI JOIN projects p USING(project_id)
        """).fetchone()[0]
        _require(invalid == 0 and orphans == 0, "Analytical project/evidence closure mismatch")
    return _receipt(directory, manifest)


def export_analytics(payload, out_dir, *, expected_project_ids):
    """Write validated immutable Parquet alongside snapshots; never move pointers."""
    expected_project_ids = list(expected_project_ids)
    validate_snapshot(payload, expected_project_ids)
    stamp = datetime.fromisoformat(payload["generated_at"].replace("Z", "+00:00")).strftime("%Y%m%dT%H%M%SZ")
    out_dir = Path(out_dir)
    target = out_dir / ("analytics_" + stamp)
    if target.exists():
        return validate_analytics(target, payload, expected_project_ids=expected_project_ids)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = _rows(payload)
    with tempfile.TemporaryDirectory(prefix=".analytics-build-", dir=out_dir) as temporary:
        staged = Path(temporary) / target.name
        staged.mkdir()
        artifacts = {}
        with _connect() as connection:
            for table, columns in TABLES.items():
                ddl = ", ".join(f"{name} {kind}" for name, kind in columns)
                connection.execute(f"CREATE TABLE {table} ({ddl})")
                if rows[table]:
                    placeholders = ",".join("?" for _ in columns)
                    connection.executemany(f"INSERT INTO {table} VALUES ({placeholders})", rows[table])
                path = staged / (table + ".parquet")
                connection.execute(f"COPY (SELECT * FROM {table} ORDER BY {ORDERS[table]}) "
                                   f"TO {_literal(path)} (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000)")
                data = path.read_bytes()
                artifacts[table] = {"path": path.name, "sha256": _sha(data), "bytes": len(data),
                                    "rows": len(rows[table]), "columns": [list(c) for c in columns],
                                    "compression": "ZSTD"}
        manifest = {"schema": SCHEMA, "source_snapshot_sha256": _sha(_json(payload)),
                    "generated_at": payload["generated_at"], "seed_release": payload["seed_release"],
                    "project_count": payload["project_count"], "evidence_count": payload["evidence_count"],
                    "review_required": True, "sources": payload["sources"],
                    "runtime": {"duckdb": duckdb.__version__, "threads": 1}, "artifacts": artifacts}
        (staged / "manifest.json").write_bytes(_json(manifest))
        receipt = validate_analytics(staged, payload, expected_project_ids=expected_project_ids)
        staged.rename(target)
    return receipt
