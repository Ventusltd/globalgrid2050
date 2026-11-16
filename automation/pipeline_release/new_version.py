#!/usr/bin/env python3
"""Start and finish a Pipeline News version by the existing pattern.

  new_version.py create <new id> <V9.NN> "<short title>" ["RELEASE CANDIDATE"] [--dry-run]
      copies the newest registered version to uk_renewables_pipeline/<new id>/, relabels
      index.html, README.md and the check script, and writes tests/run_v9_NN.sh pinned
      to the parent's tree hash. Then edit the new folder.
  new_version.py finalize <new id> "<what it added>" [--fault "<known fault>"]... [--feature id:file:marker]... [--migrate-feature <audited-contract>]... [--state release_candidate_publication_blocked]
      lists every changed, new and removed file in the runner, and records the version
      (tree hash, features, faults) in registry.json. Only an unpublished candidate
      at the registry tail may be re-finalized; published records are immutable.
      Audited contracts: solar1000-inline-v1, news-priority-internal-v1,
      research-priority-internal-v1 and global-dc-ui-v928-v1. Each flag occurs
      once; research expands to both exact inherited V9.27 feature identities.

Published folders are never edited: create only ever writes a new folder.
"""
import re
import shutil
import sys
from datetime import datetime, timezone

from common import PIPELINE, HERE, load_registry, save_registry, tree_hash, walk
from feature_contracts import KNOWN_MIGRATIONS, MIGRATION_FLAGS

RUNNER_TEMPLATE = (HERE / "runner_template.sh").read_text(encoding="utf-8")


def write_text(path, text):
    path.write_text(text, encoding="utf-8", newline="\n")


def num(version):  # "V9.14" -> "9_14"
    return version.lstrip("V").replace(".", "_")


def migration_records(flags):
    """Expand explicit audited flags; reject unknown/repeated features."""
    records = []
    for flag in flags:
        if flag not in MIGRATION_FLAGS:
            raise ValueError("Unknown or duplicate feature migration")
        incoming = MIGRATION_FLAGS[flag]
        if any(m["id"] in {old["id"] for old in records} for m in incoming):
            raise ValueError("Unknown or duplicate feature migration")
        records.extend(dict(m) for m in incoming)
    return records


def create(new_id, version, title, state="BUILD", dry_run=False):
    reg = load_registry()
    parent = reg["versions"][-1]
    src, dst = PIPELINE / parent["id"], PIPELINE / new_id
    assert re.fullmatch(r"\d{12}", new_id) and not dst.exists(), "new id must be an unused 12-digit UTC stamp"
    print(f"parent: {parent['id']} ({parent['version']})")
    if dry_run:
        print(f"dry-run: would create {dst} as {version}; no files written")
        return
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "node_modules", "*.pyc"))
    pv, nv = parent["version"], version
    (dst / parent["runner"]).unlink()
    old_check = dst / f"tests/check_v{num(pv)}.mjs"
    check_template = HERE / "check_template.mjs"
    old_check.unlink()
    check = check_template.read_text(encoding="utf-8").replace("@VERSION@", nv.lstrip("V")).replace("@PARENT_ID@", parent["id"]).replace("@FIXTURE_OWNER@", reg["fixture_owner"]).replace("@NUM@", num(nv)).replace("@STATE@", state)
    write_text(dst / f"tests/check_v{num(nv)}.mjs", check)
    runner = (RUNNER_TEMPLATE.replace("@NUM@", num(nv)).replace("@VERSION@", nv).replace("@PARENT_ID@", parent["id"])
              .replace("@PARENT_TREE@", tree_hash(parent["id"])).replace("@FIXTURE_OWNER@", reg["fixture_owner"]))
    path = dst / f"tests/run_v{num(nv)}.sh"
    write_text(path, runner)
    path.chmod(0o755)

    day = datetime.now(timezone.utc).strftime("%d %B %Y").lstrip("0")
    html = (dst / "index.html").read_text(encoding="utf-8")
    html = html.replace(f"UK Renewables Pipeline {parent['id']}</title>", f"UK Renewables Pipeline {new_id}</title>")
    html = html.replace(f"<small>UK RENEWABLES PIPELINE · {pv}</small>", f"<small>UK RENEWABLES PIPELINE · {nv}</small>")
    html, n = re.subn(r'<a class="active" href="#">[^<]*</a>\n(\s*)(<a href="\.\./versions\.html">[^<]*</a>\n\s*)?',
                      lambda m: f'<a class="active" href="#">{nv} {state} · REPD Q3 2026</a>\n{m.group(1)}<a href="../versions.html">ALL VERSIONS · CI VERDICTS</a>\n{m.group(1)}<a href="../{parent["id"]}/">{pv} {parent["id"]} · REPD Q3 2026</a>\n{m.group(1)}', html, count=1)
    assert n == 1, "nav active link not found"
    html = html.replace(f"<h1>UK RENEWABLES PIPELINE {parent['id']}</h1>", f"<h1>UK RENEWABLES PIPELINE {new_id}</h1>")
    html, n = re.subn(r"<strong>V9\.\d+ · [^<]*</strong>", f"<strong>{nv} · REPD OCTOBER 2026 (Q3) · {title.upper()} · {state} · {day}</strong>", html, count=1)
    assert n == 1, "meta line not found"
    write_text(dst / "index.html", html)
    write_text(dst / "README.md",
        f"# GlobalGrid2050 UK Renewables Pipeline {new_id} ({nv})\n\n"
        f"{state.capitalize()} dated {day}. Parent: `{parent['id']}` ({pv}). The register is the REPD October 2026 (Q3 2026) release, unchanged: "
        f"7,775 solar, battery and wind records at 1 MW and above, keyed by REPD Ref ID.\n\n"
        f"This build: {title}. See `CHANGES.md` for what changed and any known fault.\n\n"
        f"Validate offline from a checkout of the repository:\n\n    bash tests/run_v{num(nv)}.sh\n\n"
        f"All versions, with their automated verdicts: `../versions.html`.\n")
    write_text(dst / "CHANGES.md", f"# {new_id} ({nv})\n\nParent: `{parent['id']}` ({pv}), tree `{tree_hash(parent['id'])}`.\n\nCandidate initialized; see final change report before publication.\n")
    print(f"created {dst} from {parent['id']}")


def finalize(new_id, added, faults, features, state="published", feature_migrations=None):
    reg = load_registry()
    parent = reg["versions"][-1]
    registered = [entry for entry in reg["versions"] if entry["id"] == new_id]
    assert not registered or (len(registered) == 1 and parent["id"] == new_id), "already registered; historical records cannot be rewritten"
    if feature_migrations is None:
        feature_migrations = parent.get("feature_migrations", []) if parent["id"] == new_id else []
    assert isinstance(feature_migrations, list) and all(
        migration in KNOWN_MIGRATIONS for migration in feature_migrations), "unknown feature migration"
    assert len({migration["id"] for migration in feature_migrations}) == len(feature_migrations), "duplicate feature migration"
    if parent["id"] == new_id:
        assert parent.get("state", "").startswith("release_candidate_") and state.startswith("release_candidate_"), "already registered; published records cannot be rewritten"
        reg["versions"].pop()
        parent = reg["versions"][-1]
    src, dst = PIPELINE / parent["id"], PIPELINE / new_id
    old, new = set(walk(src)), set(walk(dst))
    changed = sorted(p for p in new if p not in old or (src / p).read_bytes() != (dst / p).read_bytes())
    removed = sorted(old - new)
    runner = next(p for p in changed if re.fullmatch(r"tests/run_v9_\d+\.sh", p))
    text = (dst / runner).read_text(encoding="utf-8")
    block = lambda name, items: f"{name}=(\n" + "".join(f"  {i}\n" for i in items) + ")"
    text = re.sub(r"CHANGED_FROM_PARENT=\(\n.*?\n?\)", block("CHANGED_FROM_PARENT", changed), text, count=1, flags=re.S)
    text = re.sub(r"REMOVED_FROM_PARENT=\(\n.*?\n?\)", block("REMOVED_FROM_PARENT", removed), text, count=1, flags=re.S)
    write_text(dst / runner, text)
    version = "V" + re.search(r"run_v(9_\d+)\.sh", runner).group(1).replace("_", ".")
    reg["versions"].append({
        "id": new_id, "version": version, "parent": parent["id"],
        "date": datetime.strptime(new_id, "%Y%m%d%H%M").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "added": added, "data_changed": False, "runner": runner, "trees": [tree_hash(new_id)],
        "features": [dict(zip(("id", "file", "contains"), f.split(":", 2))) for f in features],
        "known_faults": faults, "ci": None, "merge_commit": None, "state": state,
        **({"feature_migrations": feature_migrations} if feature_migrations else {}),
    })
    save_registry(reg)
    print(f"finalized {new_id}: {len(changed)} changed or new, {len(removed)} removed, tree {reg['versions'][-1]['trees'][0]}")


if __name__ == "__main__":
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    if dry_run:
        args.remove("--dry-run")
    if args[:1] == ["create"] and len(args) in (4, 5):
        create(*args[1:], dry_run=dry_run)
    elif args[:1] == ["finalize"] and len(args) >= 3 and not dry_run:
        rest, faults, features = args[3:], [], []
        state, migrations, migration_flags = "published", None, []
        while rest:
            if len(rest) < 2 or rest[0] not in {"--fault", "--feature", "--state", "--migrate-feature"}:
                sys.exit("Expected --fault, --feature, --state or --migrate-feature and value")
            flag, value, rest = rest[0], rest[1], rest[2:]
            if flag == "--state":
                state = value
            elif flag == "--migrate-feature":
                migration_flags.append(value)
                try:
                    migrations = migration_records(migration_flags)
                except ValueError as exc:
                    sys.exit(str(exc))
            else:
                (faults if flag == "--fault" else features).append(value)
        finalize(args[1], args[2], faults, features, state=state, feature_migrations=migrations)
    else:
        sys.exit(__doc__)
