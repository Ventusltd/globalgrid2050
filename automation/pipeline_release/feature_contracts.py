"""Inherited features, including explicit, executable presentation migrations.

Migration contracts are code-reviewed validators, not aliases for missing strings.
An unknown contract fails. The original release's marker remains independently
checked; only descendants declaring this migration use its stronger contract.
"""
import json

from common import data_digest


SOLAR_MIGRATION = {"id": "solar1000-pilot", "from": "202611161244", "contract": "solar1000-inline-v1"}


def _solar_inline(folder, source):
    failures, probes = [], []
    for relative in ("solar1000/manifest.json", "solar1000/candidates.json"):
        if (folder / relative).read_bytes() != (source / relative).read_bytes():
            failures.append(f"changed frozen {relative}")
    manifest = json.loads((folder / "solar1000/manifest.json").read_text(encoding="utf-8"))
    ids = manifest.get("ids", [])
    if (len(ids) != 1000 or any(not isinstance(i, str) or not i.isascii() or not i.isdecimal() for i in ids)
            or len(set(ids)) != 1000 or sorted(ids, key=int) != ids
            or manifest.get("selection") != "numeric-repd-ref-ascending"
            or manifest.get("selection_count") != 1000 or manifest.get("record_count") != 7775
            or manifest.get("independently_verified") != 0):
        failures.append("invalid frozen Solar-1000 membership/order/counts")
    candidates = json.loads((folder / "solar1000/candidates.json").read_text(encoding="utf-8"))
    if len(candidates) != 2 or any(c.get("repd_ref") not in ids for c in candidates):
        failures.append("invalid inherited source candidates")
    if data_digest(folder) != data_digest(source):
        failures.append("official data changed from migration source")
    html = (folder / "index.html").read_text(encoding="utf-8")
    plugin = (folder / "scripts/plugins/solar1000-v924.js").read_text(encoding="utf-8")
    for marker in ('id="evidenceCoverage"', 'data-evidence-selection', 'data-evidence-status',
                   'src="scripts/plugins/solar1000-v924.js'):
        if marker not in html:
            failures.append(f"missing inline wiring: {marker}")
    for marker in ("solar1000/manifest.json", "solar1000/candidates.json", "pipeline-projects-rendered",
                   ".project-record", "integratedEvidence", "renderEvidence"):
        if marker not in plugin:
            failures.append(f"missing inline implementation: {marker}")
    # Runtime probes prove the retained sources are reachable inside the existing
    # project records; static marker checks alone cannot establish this migration.
    probes.append({"name": "Solar-1000 migration: unchanged selection in consolidated register", "selector": "body",
                   "js": "document.querySelector('#evidenceCoverage')?.dataset.selectionCount==='1000' && !document.querySelector('#solar1000Pilot') && document.querySelector('#tbody')?.dataset.complete==='true'"})
    for candidate in candidates:
        ref, url = candidate["repd_ref"], candidate["source_url"]
        probes.append({"name": f"Solar-1000 migration: inherited source inside project {ref}", "search": ref,
                       "row": f"repd-{ref}", "selector": ".project-record",
                       "js": "(() => {const d=document.querySelector(" + json.dumps(f"#repd-{ref} .project-record") + ");"
                             "if(!d)return false;d.open=true;const h=d.querySelector('[data-integrated-evidence]');"
                             "const e=h?.querySelector('[data-evidence-project]');const a=h?.querySelector('.v925-inherited-source a');"
                             "return !!h&&!!e&&h.dataset.integratedEvidence===" + json.dumps(ref) +
                             "&&e.dataset.evidenceProject===" + json.dumps(ref) + "&&a?.href===" + json.dumps(url) +
                             "&&a.getBoundingClientRect().width>0&&h.textContent.includes('unverified')&&d.open;})()"})
    return failures, probes


def check_features(version, by_id, pipeline):
    """Return the offline verdict and mandatory browser probes for migrations."""
    inherited, dropped, migrations, errors = [], set(), {}, []
    node, visited = version, set()
    while node:
        if node["id"] in visited:
            errors.append("cyclic feature ancestry")
            break
        visited.add(node["id"])
        dropped |= set(node.get("removed_features", []))
        inherited = [(f, node["id"]) for f in node["features"] if f["id"] not in dropped] + inherited
        for migration in node.get("feature_migrations", []):
            if not isinstance(migration, dict) or migration != SOLAR_MIGRATION:
                errors.append("unknown feature migration contract")
                continue
            if migration["id"] in migrations:
                errors.append("duplicate feature migration")
            migrations[migration["id"]] = migration
        node = by_id.get(node["parent"])
    folder = pipeline / version["id"]
    missing, receipts, probes = [], [], []
    for feature_id, migration in migrations.items():
        origins = [origin for feature, origin in inherited if feature["id"] == feature_id]
        faults = []
        if origins != [migration["from"]] or feature_id in dropped:
            faults.append("migration must preserve its exact inherited feature and source")
        else:
            try:
                faults, runtime = _solar_inline(folder, pipeline / migration["from"])
                probes.extend(runtime)
            except (OSError, ValueError, KeyError, TypeError) as exc:
                # Paths may be private locally; public verdicts contain no exception path.
                faults = [f"invalid or unavailable migration input ({type(exc).__name__})"]
        receipts.append(dict(migration, **{"pass": not faults, "failures": faults}))
        if faults:
            missing.append(feature_id)
    for feature, _ in inherited:
        if feature["id"] in migrations:
            continue
        path = folder / feature["file"]
        if not path.is_file() or feature["contains"] not in path.read_text(encoding="utf-8", errors="replace"):
            missing.append(feature["id"])
    return {"pass": not missing and not errors, "features": [f["id"] for f, _ in inherited],
            "missing": missing, "withdrawn_on_purpose": sorted(dropped),
            "migrations": receipts, "errors": errors}, probes
