#!/usr/bin/env python3
"""GridBot app repository bootstrap.

Audit mode reports the app repositories that would be created.
Apply mode uses GRIDBOT_PAT to create lightweight scaffold repositories and seed
repo-local governance files. It does not migrate app code or data; migration is a
separate audited step per app.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
STEM = "APP_REPO_BOOTSTRAP"
API = "https://api.github.com"
OWNER_DEFAULT = "Ventusltd"

APPS: dict[str, dict[str, str]] = {
    "generation_history": {
        "repo": "globalgrid2050-generation-history",
        "title": "GlobalGrid2050 Generation History",
        "description": "UK generation history app. Compact confirmed facts only; raw telemetry stays outside the app repo.",
        "sourcePath": "uk_energy_tracking_v6/generation_history",
    },
    "uk_energy_tracking": {
        "repo": "globalgrid2050-uk-energy-tracking",
        "title": "GlobalGrid2050 UK Energy Tracking",
        "description": "UK energy tracking dashboard shell and app modules. Small public JSON facts only.",
        "sourcePath": "uk_energy_tracking_v6",
    },
    "renewables_pipeline": {
        "repo": "globalgrid2050-uk-renewables-pipeline",
        "title": "GlobalGrid2050 UK Renewables Pipeline",
        "description": "UK renewables project pipeline app. Clean project facts only; raw GIS bulk stays outside normal repo history.",
        "sourcePath": "uk_renewables_pipeline",
    },
    "estimators": {
        "repo": "globalgrid2050-estimators",
        "title": "GlobalGrid2050 Estimators",
        "description": "Engineering and procurement estimator apps with small reference tables only.",
        "sourcePath": "estimators",
    },
    "data_archive": {
        "repo": "globalgrid2050-data-archive",
        "title": "GlobalGrid2050 Data Archive Index",
        "description": "Index and manifests for cold archives. Do not use as a raw data dumping ground.",
        "sourcePath": "external cold archive",
    },
}

SETS = {
    "generation_history": ["generation_history"],
    "core_apps": ["generation_history", "uk_energy_tracking", "renewables_pipeline", "estimators"],
    "all": ["generation_history", "uk_energy_tracking", "renewables_pipeline", "estimators", "data_archive"],
}

SIZE_GUARD_PY = """#!/usr/bin/env python3
from __future__ import annotations
import os, sys
from pathlib import Path
WARN_MB=float(os.getenv('REPO_GUARD_WARN_MB','5'))
FAIL_MB=float(os.getenv('REPO_GUARD_FAIL_MB','25'))
BLOCK=('data/raw/','data/transient/','data/tmp/','cold_storage/','external_archives/')
root=Path(__file__).resolve().parent.parent
failed=[]; warned=[]
for p in root.rglob('*'):
    if not p.is_file() or '.git' in p.parts: continue
    r=p.relative_to(root).as_posix(); mb=p.stat().st_size/1024/1024
    if any(r.startswith(x) for x in BLOCK): failed.append((r,mb,'blocked raw/cold path'))
    elif mb>=FAIL_MB: failed.append((r,mb,'file exceeds hard budget'))
    elif mb>=WARN_MB: warned.append((r,mb,'file exceeds warning budget'))
for r,mb,msg in warned: print(f'WARN {mb:.2f} MB {r}: {msg}')
for r,mb,msg in failed: print(f'FAIL {mb:.2f} MB {r}: {msg}', file=sys.stderr)
sys.exit(1 if failed else 0)
"""

SIZE_GUARD_YML = """name: Repo Size Guard

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  repo-size-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Check repository size budget
        run: python scripts/repo_size_guard.py
"""

GITIGNORE = """# Python
__pycache__/
*.pyc
.venv/
venv/

# Static site build outputs
_site/
.jekyll-cache/
node_modules/

# Secrets and local env
.env
.env.*
!.env.example

# Raw/transient data must not enter app repos
data/raw/
data/transient/
data/tmp/
data/temp/
tmp/
temp/
cold_storage/
external_archives/
*_raw.json
*_raw.csv
*_raw.parquet
*_dump.json
*_dump.csv
*raw_api*
*raw_elexon*
*raw_pvlive*
*fuelinst_raw*
*fuelhh_raw*
*master_halfhourly*
"""


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def req(method: str, path: str, token: str, payload: dict[str, Any] | None = None) -> tuple[int, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "GlobalGrid2050-GridBot",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode("utf-8")
            return response.status, json.loads(text) if text else {}
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(text) if text else {}
        except Exception:
            data = {"message": text}
        return exc.code, data


def get_login(token: str) -> str:
    status, data = req("GET", "/user", token)
    if status >= 400:
        raise RuntimeError(f"Could not read authenticated user: {data}")
    return str(data.get("login") or "")


def repo_exists(owner: str, repo: str, token: str) -> bool:
    status, _ = req("GET", f"/repos/{owner}/{repo}", token)
    return status == 200


def create_repo(owner: str, app: dict[str, str], private: bool, token: str, login: str) -> dict[str, Any]:
    endpoint = "/user/repos" if owner == login else f"/orgs/{owner}/repos"
    payload = {
        "name": app["repo"],
        "description": app["description"],
        "private": private,
        "auto_init": True,
        "has_issues": True,
        "has_projects": False,
        "has_wiki": False,
    }
    status, data = req("POST", endpoint, token, payload)
    return {"status": status, "ok": status in (200, 201), "response": data}


def get_content_sha(owner: str, repo: str, path: str, token: str) -> str | None:
    status, data = req("GET", f"/repos/{owner}/{repo}/contents/{path}", token)
    if status == 200 and isinstance(data, dict):
        return data.get("sha")
    return None


def put_file(owner: str, repo: str, path: str, content: str, token: str, overwrite: bool = False) -> dict[str, Any]:
    sha = get_content_sha(owner, repo, path, token)
    if sha and not overwrite:
        return {"path": path, "status": "exists_skipped"}
    payload: dict[str, Any] = {
        "message": f"gridbot: bootstrap {path}",
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
    }
    if sha:
        payload["sha"] = sha
    status, data = req("PUT", f"/repos/{owner}/{repo}/contents/{path}", token, payload)
    return {"path": path, "status": status, "ok": status in (200, 201), "response": data}


def readme(app: dict[str, str]) -> str:
    return f"""# {app['title']}

{app['description']}

This repository is part of the GlobalGrid2050 app-repo split.

## Contract

- App code lives here.
- Raw telemetry does not live here.
- Browser-facing data must be compact confirmed facts or tiny recent slices.
- Heavy source inputs are fetched temporarily by GitHub Actions and discarded after compilation.
- Data provenance, schema and audit reports are part of the app contract.

## Source path in original monorepo

```text
{app['sourcePath']}
```

## Migration status

Scaffold only. App files are migrated by a separate audited workflow after inventory review.
"""


def architecture_doc(app: dict[str, str]) -> str:
    return f"""# App repository architecture

App: {app['title']}

## Data tier rule

```text
Live -> fetched on demand or tiny cache
Recent -> small rolling slice
Confirmed facts -> compact JSON committed here
Cold archive -> outside normal Git history
```

## Forbidden by default

- raw API dumps
- raw half-hourly or five-minute decade history
- generated bulk archives
- large GIS basemap blobs
- files above 25 MB without explicit approval

## Migration method

This repo should receive a clean-copy migration from the monorepo. Do not import old bloated Git history unless a later maintenance plan explicitly requires it.
"""


def data_contract(app: dict[str, str]) -> str:
    return f"""# Data contract

App: {app['title']}

Python may fetch raw data inside GitHub Actions. Raw data is a temporary build input. The committed output should be a compact, source-stamped, schema-versioned artifact.

Minimum fields for public facts:

```text
schemaVersion
generatedUTC
source
sourceStatus
unit
grain
rows
```

MWh is additive. Peaks, lows and extremes are not additive and must remain at their fixed grain.
"""


def files_for(app: dict[str, str]) -> dict[str, str]:
    return {
        "README.md": readme(app),
        "docs/ARCHITECTURE.md": architecture_doc(app),
        "docs/DATA_CONTRACT.md": data_contract(app),
        ".gitignore": GITIGNORE,
        "scripts/repo_size_guard.py": SIZE_GUARD_PY,
        ".github/workflows/repo_size_guard.yml": SIZE_GUARD_YML,
    }


def selected_apps(repo_set: str) -> list[dict[str, str]]:
    return [APPS[key] for key in SETS[repo_set]]


def write_reports(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    lines = [
        "# App Repo Bootstrap",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Owner: `{payload['owner']}`",
        f"Repo set: `{payload['repoSet']}`",
        f"Visibility: `{payload['visibility']}`",
        f"Applied: `{payload['applied']}`",
        f"Pass: `{payload['pass']}`",
        "",
        "## Repositories",
        "",
        "| Repo | Action | Existing before | Result |",
        "|---|---|---|---|",
    ]
    for item in payload["repositories"]:
        lines.append(f"| `{item['repo']}` | {item['action']} | {item['existsBefore']} | {item['result']} |")
    lines.extend(["", "## Human next action", "", payload["nextAction"], ""])
    text = "\n".join(lines)
    for p in (REPORT_DIR / f"{STEM}_{s}.md", REPORT_DIR / f"{STEM}_LATEST.md"):
        p.write_text(text, encoding="utf-8")
    js = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for p in (REPORT_JSON_DIR / f"{STEM}_{s}.json", REPORT_JSON_DIR / f"{STEM}_LATEST.json"):
        p.write_text(js, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["audit", "apply"], default="audit")
    ap.add_argument("--repo-set", choices=sorted(SETS), default="generation_history")
    ap.add_argument("--owner", default=os.getenv("TARGET_OWNER", OWNER_DEFAULT))
    ap.add_argument("--visibility", choices=["public", "private"], default="public")
    args = ap.parse_args()

    token = os.getenv("GRIDBOT_PAT") or os.getenv("GITHUB_TOKEN") or ""
    repos = []
    ok = True
    login = ""
    if token:
        try:
            login = get_login(token)
        except Exception as exc:
            ok = False
            login = f"unavailable: {exc}"
    elif args.mode == "apply":
        ok = False

    for app in selected_apps(args.repo_set):
        exists = repo_exists(args.owner, app["repo"], token) if token else False
        item = {"repo": app["repo"], "title": app["title"], "existsBefore": exists, "action": "audit_only", "result": "would_create_or_scaffold"}
        if args.mode == "apply":
            if not token:
                item.update({"action": "failed", "result": "GRIDBOT_PAT missing"})
                ok = False
            else:
                if not exists:
                    created = create_repo(args.owner, app, args.visibility == "private", token, login)
                    if not created["ok"]:
                        item.update({"action": "failed_create", "result": str(created["response"])[:300]})
                        ok = False
                        repos.append(item)
                        continue
                    item.update({"action": "created", "result": "repository created"})
                else:
                    item.update({"action": "scaffold_existing", "result": "repository already existed; missing scaffold files only"})
                file_results = []
                for path, content in files_for(app).items():
                    file_results.append(put_file(args.owner, app["repo"], path, content, token, overwrite=False))
                item["fileResults"] = file_results
                if any(fr.get("ok") is False for fr in file_results):
                    ok = False
                    item["result"] = "one or more scaffold file writes failed"
        repos.append(item)

    payload = {
        "reportTitle": "App Repo Bootstrap",
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "mode": args.mode,
        "owner": args.owner,
        "authenticatedLogin": login,
        "repoSet": args.repo_set,
        "visibility": args.visibility,
        "repositories": repos,
        "applied": args.mode == "apply",
        "pass": ok,
        "nextAction": "Review audit report, then run apply only for the repo set you want created. After repos exist, migrate one app at a time with a separate audited clean-copy workflow.",
    }
    write_reports(payload)
    print(json.dumps({"pass": payload["pass"], "mode": args.mode, "repos": [r["repo"] for r in repos]}, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
