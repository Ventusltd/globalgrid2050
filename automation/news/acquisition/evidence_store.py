"""Durable, provisional-only research results and immutable weekly exports.

This is a research snapshot contract, not evidence_ledger's reviewed publication
contract. No event date or VERIFIED decision is inferred from an RSS headline.
Article bodies/snippets are deliberately never stored. Publish the snapshot and
latest.json together in one Git commit/push; this module only builds files.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import math
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "globalgrid2050.solar-evidence.provisional.v1"
COUNT = 1000
PROVISIONAL = "PROVISIONAL"
NO_EVIDENCE = "RESEARCH_ATTEMPTED_NO_EVIDENCE"
METHODS = {"exact_name", "repd_id"}


class EvidenceValidationError(ValueError):
    """A failed gate: keep the previous publication and require manual review."""


def _require(condition, message):
    if not condition:
        raise EvidenceValidationError(message)


def _moment(value):
    _require(isinstance(value, str) and bool(re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value)), "UTC second timestamp required")
    try:
        return dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    except ValueError as exc:
        raise EvidenceValidationError("Invalid UTC timestamp") from exc


def _url(value):
    try:
        p = urlsplit(value)
        valid = (p.scheme == "https" and p.hostname and not p.username
                 and not p.password and p.port in (None, 443))
    except (ValueError, TypeError):
        valid = False
    _require(valid, "Safe HTTPS URL required")


def _ids(values):
    result = list(values)
    _require(len(result) == COUNT and len(set(result)) == COUNT,
             "Exactly 1000 unique Solar-1000 project IDs required")
    _require(all(isinstance(x, str) and re.fullmatch(r"[1-9][0-9]*", x) for x in result),
             "Project IDs must be numeric REPD strings")
    return result


def _coordinates(latitude, longitude):
    if latitude is None and longitude is None:
        return
    _require(all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)
                 for x in (latitude, longitude)), "Coordinates must be finite numbers or both null")
    _require(-90 <= latitude <= 90 and -180 <= longitude <= 180, "Invalid coordinates")


def _sources(sources):
    _require(isinstance(sources, list) and bool(sources), "Successful source receipts required")
    ids = []
    for source in sources:
        _require(isinstance(source, dict) and source.get("status") == "ok",
                 "Critical source failure: manual review required")
        _require(source.get("eligible_for_publication") is True and source.get("probe_only") is False
                 and source.get("rights_status") == "accepted",
                 "Source rights unknown or probe-only: manual review required")
        _url(source.get("rights_review_url"))
        _require(isinstance(source.get("id"), str) and source["id"], "Source ID required")
        ids.append(source["id"])
        _url(source.get("url"))
        _moment(source.get("fetched_at"))
        _require(source.get("http_status") in (200, 304), "Successful HTTP receipt required")
        _require(isinstance(source.get("response_sha256"), str)
                 and re.fullmatch(r"[a-f0-9]{64}", source["response_sha256"]),
                 "Source response SHA256 required")
    _require(len(ids) == len(set(ids)), "Duplicate source IDs")
    return set(ids)


def _article(article):
    _require(isinstance(article, dict), "Article object required")
    for key in ("id", "url", "title", "pub_date", "source_id", "publisher"):
        _require(isinstance(article.get(key), str) and bool(article[key].strip()),
                 "Article field required: " + key)
    _url(article["url"])
    # A publication date is not an actual project event date.
    try:
        dt.datetime.fromisoformat(article["pub_date"].replace("Z", "+00:00"))
    except ValueError as exc:
        raise EvidenceValidationError("Invalid publication date") from exc


def _json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


class EvidenceStore:
    """SQLite storage; writes are transactional, repeated matches are idempotent."""

    def __init__(self, path=":memory:"):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(path))
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys=ON")
        version = self.connection.execute("PRAGMA user_version").fetchone()[0]
        _require(version in (0, 1), "Unsupported evidence database schema")
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY, name TEXT NOT NULL,
                latitude REAL, longitude REAL, researched_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS articles (
                url TEXT PRIMARY KEY, id TEXT NOT NULL, title TEXT NOT NULL,
                pub_date TEXT NOT NULL, source_id TEXT NOT NULL, publisher TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS evidence (
                project_id TEXT NOT NULL REFERENCES projects(id),
                article_url TEXT REFERENCES articles(url), status TEXT NOT NULL,
                match_method TEXT, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
                CHECK ((status='PROVISIONAL' AND article_url IS NOT NULL AND match_method IS NOT NULL
                        AND match_method IN ('exact_name','repd_id')) OR
                       (status='RESEARCH_ATTEMPTED_NO_EVIDENCE' AND article_url IS NULL
                        AND match_method IS NULL)),
                UNIQUE(project_id, article_url)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS one_no_evidence_per_project
                ON evidence(project_id) WHERE article_url IS NULL;
            CREATE TABLE IF NOT EXISTS runs (
                fetched_at TEXT PRIMARY KEY, sources_json TEXT NOT NULL
            );
            PRAGMA user_version=1;
        """)
        expected = {
            "projects": {"id", "name", "latitude", "longitude", "researched_at"},
            "articles": {"url", "id", "title", "pub_date", "source_id", "publisher"},
            "evidence": {"project_id", "article_url", "status", "match_method", "first_seen", "last_seen"},
            "runs": {"fetched_at", "sources_json"},
        }
        for table, columns in expected.items():
            actual = {r[1] for r in self.connection.execute(f"PRAGMA table_info({table})")}
            _require(actual == columns, "Unexpected database schema: " + table)

    def close(self):
        self.connection.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def record_run(self, projects, articles, matches, fetched_at, sources):
        """Record a complete successful scan; failed scans must never call this."""
        _moment(fetched_at)
        source_ids = _sources(sources)
        last_run = self.connection.execute("SELECT MAX(fetched_at) FROM runs").fetchone()[0]
        _require(last_run is None or fetched_at >= last_run, "Acquisition timestamp would move backwards")
        projects, articles, matches = list(projects), list(articles), list(matches)
        project_ids = _ids(p["id"] for p in projects)
        existing = self.connection.execute("SELECT id,name,latitude,longitude FROM projects").fetchall()
        supplied = {p["id"]: p for p in projects}
        _require(not existing or {r["id"] for r in existing} == set(project_ids),
                 "Stored seed membership differs: manual review required")
        for project in projects:
            _require(isinstance(project.get("name"), str) and project["name"].strip(), "Project name required")
            _coordinates(project.get("latitude"), project.get("longitude"))
        for row in existing:
            project = supplied[row["id"]]
            _require((row["name"], row["latitude"], row["longitude"]) ==
                     (project["name"], project.get("latitude"), project.get("longitude")),
                     "Immutable seed project metadata changed")
        article_by_url = {}
        for article in articles:
            _article(article)
            _require(article["source_id"] in source_ids, "Article has no successful source receipt")
            _require(article["url"] not in article_by_url, "Duplicate article URLs in run")
            previous = self.connection.execute(
                "SELECT id,title,pub_date,source_id,publisher FROM articles WHERE url=?",
                (article["url"],)).fetchone()
            # Historical bindings refer to the metadata first observed at this
            # URL. Without versioned article identities, replacing it would
            # silently rewrite the evidence for every earlier project match.
            _require(previous is None or all(previous[key] == article[key] for key in previous.keys()),
                     "Stored article metadata changed; manual review required")
            article_by_url[article["url"]] = article
        for match in matches:
            _require(match.get("status") == PROVISIONAL, "Machine matches must remain PROVISIONAL")
            _require(match.get("project_id") in supplied, "Match outside Solar-1000")
            _require(match.get("article_url") in article_by_url, "Match article not fetched in this run")
            _require(match.get("match_method") in METHODS, "Unknown strict matching method")
        with self.connection:
            self.connection.executemany(
                "INSERT INTO projects VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET researched_at=excluded.researched_at",
                [(p["id"], p["name"], p.get("latitude"), p.get("longitude"), fetched_at) for p in projects])
            self.connection.executemany(
                "INSERT INTO articles VALUES (?,?,?,?,?,?) ON CONFLICT(url) DO NOTHING",
                [(a["url"], a["id"], a["title"], a["pub_date"], a["source_id"], a["publisher"]) for a in articles])
            for match in matches:
                self.connection.execute("DELETE FROM evidence WHERE project_id=? AND article_url IS NULL", (match["project_id"],))
                self.connection.execute(
                    "INSERT INTO evidence VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,article_url) DO UPDATE SET last_seen=excluded.last_seen",
                    (match["project_id"], match["article_url"], PROVISIONAL, match["match_method"], fetched_at, fetched_at))
            for project in projects:
                if not self.connection.execute("SELECT 1 FROM evidence WHERE project_id=? AND article_url IS NOT NULL", (project["id"],)).fetchone():
                    self.connection.execute("DELETE FROM evidence WHERE project_id=?", (project["id"],))
                    self.connection.execute("INSERT INTO evidence VALUES (?,NULL,?,NULL,?,?)", (project["id"], NO_EVIDENCE, fetched_at, fetched_at))
            self.connection.execute("INSERT INTO runs VALUES (?,?) ON CONFLICT(fetched_at) DO UPDATE SET sources_json=excluded.sources_json",
                                    (fetched_at, json.dumps(sources, sort_keys=True)))

    def snapshot(self, timestamp=None):
        _require(not self.connection.execute("PRAGMA foreign_key_check").fetchall(),
                 "Broken database relationships: manual review required")
        run = self.connection.execute("SELECT * FROM runs ORDER BY fetched_at DESC LIMIT 1").fetchone()
        _require(run is not None, "No successful acquisition run")
        timestamp = timestamp or run["fetched_at"]
        _moment(timestamp)
        _require(timestamp >= run["fetched_at"], "Snapshot cannot predate its acquisition run")
        rows = []
        for project in self.connection.execute("SELECT * FROM projects ORDER BY CAST(id AS INTEGER)"):
            evidence = [dict(row) for row in self.connection.execute(
                "SELECT a.*,e.status,e.match_method,e.first_seen,e.last_seen FROM evidence e "
                "JOIN articles a ON a.url=e.article_url WHERE e.project_id=? ORDER BY a.pub_date DESC,a.url",
                (project["id"],))]
            rows.append({
                "project_id": project["id"], "name": project["name"],
                "latitude": project["latitude"], "longitude": project["longitude"],
                "status": PROVISIONAL if evidence else NO_EVIDENCE,
                "evidence_count": len(evidence), "provisional_count": len(evidence), "verified_count": 0,
                "last_event": None, "last_researched_at": project["researched_at"], "evidence": evidence,
            })
        return {
            "schema": SCHEMA, "generated_at": timestamp, "source_run_at": run["fetched_at"],
            "seed_release": "202611161244", "project_count": len(rows),
            "evidence_count": sum(r["evidence_count"] for r in rows), "verified_count": 0,
            "review_required": True, "sources": json.loads(run["sources_json"]),
            "research_scope": "Completed bounded feed scan using strict name/REPD-ID matching; not independent project-first research. No match is not proof no evidence exists.",
            "projects": rows,
        }


def validate_snapshot(payload, expected_project_ids):
    """Validate types, statuses, membership and counts before any pointer update."""
    expected = set(_ids(expected_project_ids))
    _require(isinstance(payload, dict) and payload.get("schema") == SCHEMA, "Unexpected snapshot schema")
    _require(payload.get("seed_release") == "202611161244", "Wrong baseline release")
    _require(set(payload) == {"schema", "generated_at", "source_run_at", "seed_release", "project_count",
                             "evidence_count", "verified_count", "review_required", "sources", "research_scope", "projects"},
             "Unexpected snapshot fields")
    _require(isinstance(payload.get("research_scope"), str) and payload["research_scope"], "Research scope required")
    _moment(payload.get("generated_at"))
    _moment(payload.get("source_run_at"))
    source_ids = _sources(payload.get("sources"))
    _require(payload.get("review_required") is True and type(payload.get("verified_count")) is int
             and payload["verified_count"] == 0, "Provisional snapshot cannot assert verification")
    rows = payload.get("projects")
    _require(isinstance(rows, list) and type(payload.get("project_count")) is int
             and payload["project_count"] == COUNT and len(rows) == COUNT, "Snapshot must contain 1000 projects")
    ids = _ids(r.get("project_id") for r in rows)
    _require(set(ids) == expected, "Snapshot Solar-1000 membership differs")
    total = 0
    for row in rows:
        _require(set(row) == {"project_id", "name", "latitude", "longitude", "status", "evidence_count",
                             "provisional_count", "verified_count", "last_event", "last_researched_at", "evidence"},
                 "Unexpected project snapshot fields")
        _require(isinstance(row.get("name"), str) and row["name"].strip(), "Project name required")
        _coordinates(row.get("latitude"), row.get("longitude"))
        _moment(row.get("last_researched_at"))
        evidence = row.get("evidence")
        _require(isinstance(evidence, list), "Evidence must be a list")
        for field in ("evidence_count", "provisional_count", "verified_count"):
            _require(type(row.get(field)) is int, "Evidence counts must be integers")
        _require(row["evidence_count"] == row["provisional_count"] == len(evidence)
                 and row["verified_count"] == 0, "Evidence counts inconsistent")
        _require("last_event" in row and row["last_event"] is None, "RSS match cannot assert a project event")
        _require(row.get("status") == (PROVISIONAL if evidence else NO_EVIDENCE), "Invalid research status")
        urls = []
        for article in evidence:
            _require(set(article) == {"id", "url", "title", "pub_date", "source_id", "publisher", "status",
                                     "match_method", "first_seen", "last_seen"}, "Unexpected evidence fields")
            _article(article)
            _require(article["source_id"] in source_ids, "Article has no successful source receipt")
            _require(article.get("status") == PROVISIONAL and article.get("match_method") in METHODS,
                     "Evidence must be a strict provisional match")
            _require(not any(k in article for k in ("content", "body", "summary", "description")),
                     "Article bodies must not be exported")
            _moment(article.get("first_seen"))
            _moment(article.get("last_seen"))
            urls.append(article["url"])
        _require(len(urls) == len(set(urls)), "Duplicate project/article association")
        total += len(evidence)
    _require(type(payload.get("evidence_count")) is int and payload["evidence_count"] == total,
             "Snapshot evidence total inconsistent")
    return payload


def _csv_cell(value):
    # Prevent untrusted publisher/project titles becoming spreadsheet formulas.
    return "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value


def export_snapshot(store, out_dir, timestamp=None, *, expected_project_ids):
    """Build immutable exports and then latest.json; no publication occurs here."""
    payload = validate_snapshot(store.snapshot(timestamp), expected_project_ids)
    stamp = _moment(payload["generated_at"]).strftime("%Y%m%dT%H%M%SZ")
    folder = "snapshot_" + stamp
    out_dir = Path(out_dir)
    target = out_dir / folder
    stream = io.StringIO(newline="")
    fields = ["project_id", "name", "status", "evidence_count", "provisional_count", "verified_count", "last_event", "last_researched_at"]
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows({key: _csv_cell(row[key]) for key in fields} for row in payload["projects"])
    geojson = {
        "type": "FeatureCollection", "schema": SCHEMA, "generated_at": payload["generated_at"],
        "features": [{"type": "Feature", "id": row["project_id"],
                      "geometry": None if row["latitude"] is None else {
                          "type": "Point", "coordinates": [row["longitude"], row["latitude"]]},
                      "properties": {key: row[key] for key in fields}}
                     for row in payload["projects"]],
    }
    files = {"evidence.json": _json(payload), "evidence.csv": stream.getvalue().encode("utf-8"),
             "evidence.geojson": _json(geojson)}
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
    files["checksums.json"] = _json(hashes)
    if target.exists():
        _require(target.is_dir() and {p.name for p in target.iterdir()} == set(files)
                 and all((target / name).read_bytes() == data for name, data in files.items()),
                 "Immutable snapshot already exists with different bytes; manual review required")
    else:
        target.mkdir(parents=True, exist_ok=False)
        for name, data in files.items():
            with (target / name).open("xb") as handle:
                handle.write(data)
    # Verify disk bytes before writing a pointer. A partial directory is never reused.
    for name, data in files.items():
        _require((target / name).read_bytes() == data, "Snapshot readback mismatch")
    pointer = {"schema": SCHEMA, "generated_at": payload["generated_at"], "snapshot": folder,
               "json": folder + "/evidence.json", "csv": folder + "/evidence.csv",
               "geojson": folder + "/evidence.geojson", "sha256": hashes,
               "project_count": COUNT, "evidence_count": payload["evidence_count"], "review_required": True}
    (out_dir / "latest.json").write_bytes(_json(pointer))
    return pointer
