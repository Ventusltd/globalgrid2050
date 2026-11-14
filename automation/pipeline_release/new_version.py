#!/usr/bin/env python3
"""Start and finish a Pipeline News version by the existing pattern.

  new_version.py create <new id> <V9.NN> "<short title>" ["RELEASE CANDIDATE"]
      copies the newest registered version to uk_renewables_pipeline/<new id>/, relabels
      index.html, README.md and the check script, and writes tests/run_v9_NN.sh pinned
      to the parent's tree hash. Then edit the new folder.
  new_version.py finalize <new id> "<what it added>" [--fault "<known fault>"]... [--feature id:file:marker]...
      lists every changed, new and removed file in the runner, and records the version
      (tree hash, features, faults) in registry.json.

Published folders are never edited: create only ever writes a new folder.
"""
import re
import shutil
import sys
from datetime import datetime, timezone

from common import PIPELINE, HERE, load_registry, save_registry, tree_hash, walk

RUNNER_TEMPLATE = (HERE / "runner_template.sh").read_text()


def num(version):  # "V9.14" -> "9_14"
    return version.lstrip("V").replace(".", "_")


def create(new_id, version, title, state="BUILD"):
    reg = load_registry()
    parent = reg["versions"][-1]
    src, dst = PIPELINE / parent["id"], PIPELINE / new_id
    assert re.fullmatch(r"\d{12}", new_id) and not dst.exists(), "new id must be an unused 12-digit UTC stamp"
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "node_modules", "*.pyc"))
    pv, nv = parent["version"], version
    (dst / parent["runner"]).unlink()
    old_check = dst / f"tests/check_v{num(pv)}.mjs"
    check_template = HERE / "check_template.mjs"
    old_check.unlink()
    check = check_template.read_text().replace("@VERSION@", nv.lstrip("V")).replace("@PARENT_ID@", parent["id"]).replace("@FIXTURE_OWNER@", reg["fixture_owner"]).replace("@NUM@", num(nv)).replace("@STATE@", state)
    (dst / f"tests/check_v{num(nv)}.mjs").write_text(check)
    runner = (RUNNER_TEMPLATE.replace("@NUM@", num(nv)).replace("@VERSION@", nv).replace("@PARENT_ID@", parent["id"])
              .replace("@PARENT_TREE@", tree_hash(parent["id"])).replace("@FIXTURE_OWNER@", reg["fixture_owner"]))
    path = dst / f"tests/run_v{num(nv)}.sh"
    path.write_text(runner)
    path.chmod(0o755)

    day = datetime.now(timezone.utc).strftime("%-d %B %Y")
    html = (dst / "index.html").read_text()
    html = html.replace(f"UK Renewables Pipeline {parent['id']}</title>", f"UK Renewables Pipeline {new_id}</title>")
    html = html.replace(f"<small>UK RENEWABLES PIPELINE · {pv}</small>", f"<small>UK RENEWABLES PIPELINE · {nv}</small>")
    html, n = re.subn(r'<a class="active" href="#">[^<]*</a>\n(\s*)(<a href="\.\./versions\.html">[^<]*</a>\n\s*)?',
                      lambda m: f'<a class="active" href="#">{nv} {state} · REPD Q3 2026</a>\n{m.group(1)}<a href="../versions.html">ALL VERSIONS · CI VERDICTS</a>\n{m.group(1)}<a href="../{parent["id"]}/">{pv} {parent["id"]} · REPD Q3 2026</a>\n{m.group(1)}', html, count=1)
    assert n == 1, "nav active link not found"
    html = html.replace(f"<h1>UK RENEWABLES PIPELINE {parent['id']}</h1>", f"<h1>UK RENEWABLES PIPELINE {new_id}</h1>")
    html, n = re.subn(r"<strong>V9\.\d+ · [^<]*</strong>", f"<strong>{nv} · REPD OCTOBER 2026 (Q3) · {title.upper()} · {state} · {day}</strong>", html, count=1)
    assert n == 1, "meta line not found"
    (dst / "index.html").write_text(html)
    (dst / "README.md").write_text(
        f"# GlobalGrid2050 UK Renewables Pipeline {new_id} ({nv})\n\n"
        f"{state.capitalize()} dated {day}. Parent: `{parent['id']}` ({pv}). The register is the REPD October 2026 (Q3 2026) release, unchanged: "
        f"7,775 solar, battery and wind records at 1 MW and above, keyed by REPD Ref ID.\n\n"
        f"This build: {title}. See `CHANGES.md` for what changed and any known fault.\n\n"
        f"Validate offline from a checkout of the repository:\n\n    bash tests/run_v{num(nv)}.sh\n\n"
        f"All versions, with their automated verdicts: `../versions.html`.\n")
    (dst / "CHANGES.md").write_text(f"# {new_id} ({nv})\n\nParent: `{parent['id']}` ({pv}), tree `{tree_hash(parent['id'])}`.\n\nTO BE WRITTEN\n")
    print(f"created {dst} from {parent['id']}")


def finalize(new_id, added, faults, features):
    reg = load_registry()
    parent = reg["versions"][-1]
    assert parent["id"] != new_id, "already registered"
    src, dst = PIPELINE / parent["id"], PIPELINE / new_id
    old, new = set(walk(src)), set(walk(dst))
    changed = sorted(p for p in new if p not in old or (src / p).read_bytes() != (dst / p).read_bytes())
    removed = sorted(old - new)
    runner = next(p for p in changed if re.fullmatch(r"tests/run_v9_\d+\.sh", p))
    text = (dst / runner).read_text()
    block = lambda name, items: f"{name}=(\n" + "".join(f"  {i}\n" for i in items) + ")"
    text = re.sub(r"CHANGED_FROM_PARENT=\(\n.*?\n?\)", block("CHANGED_FROM_PARENT", changed), text, count=1, flags=re.S)
    text = re.sub(r"REMOVED_FROM_PARENT=\(\n.*?\n?\)", block("REMOVED_FROM_PARENT", removed), text, count=1, flags=re.S)
    (dst / runner).write_text(text)
    version = "V" + re.search(r"run_v(9_\d+)\.sh", runner).group(1).replace("_", ".")
    reg["versions"].append({
        "id": new_id, "version": version, "parent": parent["id"],
        "date": datetime.strptime(new_id, "%Y%m%d%H%M").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "added": added, "data_changed": False, "runner": runner, "trees": [tree_hash(new_id)],
        "features": [dict(zip(("id", "file", "contains"), f.split(":", 2))) for f in features],
        "known_faults": faults, "ci": None, "merge_commit": None, "state": "published",
    })
    save_registry(reg)
    print(f"finalized {new_id}: {len(changed)} changed or new, {len(removed)} removed, tree {reg['versions'][-1]['trees'][0]}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["create"] and len(args) in (4, 5):
        create(*args[1:])
    elif args[:1] == ["finalize"] and len(args) >= 3:
        rest, faults, features = args[3:], [], []
        while rest:
            flag, value, rest = rest[0], rest[1], rest[2:]
            (faults if flag == "--fault" else features).append(value)
        finalize(args[1], args[2], faults, features)
    else:
        sys.exit(__doc__)
