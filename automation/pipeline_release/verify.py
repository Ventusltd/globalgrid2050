#!/usr/bin/env python3
"""Verify every Pipeline News version from 202611132345 onward and compare each with its parent.

  verify.py                 offline checks, print the verdicts
  verify.py --browser       also load every page in headless Chrome (desktop and phone)
  verify.py --write         write uk_renewables_pipeline/versions.json and versions.html
  verify.py --check         exit 1 if any version fails
  verify.py --gridatlas-refs <file>   also resolve every MAP link's REPD reference against a
                            GridAtlas register file (see gridatlas_resolve.py)

Per version: (1) the folder's git tree hash is one pinned in registry.json (a published folder
is never edited); (2) its own runner passes; (3) MAP contract and Grid Engine deep-link contract
for every row; (4) against its parent: every row's MAP href identical, data hashes identical
unless the version declares a data change, every feature of every ancestor still present;
(5) in the browser: the page completes with the expected record count, no uncaught errors, no
failed same-origin requests, no sideways overflow on a phone.
"""
import html
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from common import HERE, PIPELINE, ROOT, data_digest, load_registry, tree_hash

ARGS = sys.argv[1:]
BROWSER, WRITE, CHECK = "--browser" in ARGS, "--write" in ARGS, "--check" in ARGS
GRIDATLAS = ARGS[ARGS.index("--gridatlas-refs") + 1] if "--gridatlas-refs" in ARGS else None


def run(cmd, **kw):
    p = subprocess.run(cmd, capture_output=True, text=True, **kw)
    tail = (p.stdout.strip().splitlines() or [""])[-1] if p.returncode == 0 else (p.stderr.strip().splitlines() or p.stdout.strip().splitlines() or [""])[-1]
    return p.returncode == 0, tail[:400], p.stdout


def main():
    reg = load_registry()
    versions = reg["versions"]
    by_id = {v["id"]: v for v in versions}
    scratch = Path(tempfile.mkdtemp(prefix="pn-verify-"))
    hrefs, digests, results = {}, {}, {}

    for v in versions:
        vid, folder = v["id"], PIPELINE / v["id"]
        checks = {}
        actual = tree_hash(vid)
        checks["tree_unchanged"] = {"pass": actual in v["trees"], "tree": actual}
        ok, tail, _ = run(["bash", str(folder / v["runner"])])
        checks["runner"] = {"pass": ok, "runner": v["runner"], "last_line": tail.replace(str(ROOT), "<repository>")}
        href_file = scratch / f"{vid}.hrefs.json"
        ok, tail, out = run(["node", str(HERE / "check_deeplinks.mjs"), str(folder), str(href_file)])
        try:
            link = json.loads(out.strip().splitlines()[-1])
        except Exception:
            link = {"pass": False, "error": tail}
        checks["map_contract"] = {"pass": link.get("map", {}).get("failed") == 0 and link.get("rows") == reg["expected_record_count"],
                                  "rows": link.get("rows"), "ok": link.get("map", {}).get("ok"), "with_point": link.get("with_point"), "without_point": link.get("without_point")}
        checks["grid_engine_contract"] = {"pass": link.get("grid_engine", {}).get("failed") == 0 and link.get("rows") == reg["expected_record_count"],
                                          "ok": link.get("grid_engine", {}).get("ok"), "examples": link.get("examples", [])}
        hrefs[vid] = json.loads(href_file.read_text()) if href_file.exists() else {}
        digests[vid] = data_digest(folder)

        parent = by_id.get(v["parent"])
        if parent:
            same = sum(1 for ref, href in hrefs[vid].items() if hrefs[parent["id"]].get(ref) == href)
            checks["map_links_identical_to_parent"] = {"pass": same == len(hrefs[vid]) == len(hrefs[parent["id"]]) == reg["expected_record_count"],
                                                       "identical": same, "rows": len(hrefs[vid]), "parent": parent["id"]}
            checks["data_unchanged_from_parent"] = {"pass": bool(v.get("data_changed")) or digests[vid] == digests[parent["id"]],
                                                    "data_digest": digests[vid], "declared_change": bool(v.get("data_changed"))}
        else:
            checks["data_unchanged_from_parent"] = {"pass": True, "data_digest": digests[vid], "declared_change": True, "note": "parent is outside the checked range"}
        inherited, node = [], v
        while node:
            inherited = node["features"] + inherited
            node = by_id.get(node["parent"])
        missing = [f["id"] for f in inherited if not (folder / f["file"]).exists() or f["contains"] not in (folder / f["file"]).read_text(errors="replace")]
        checks["features_kept"] = {"pass": not missing, "features": [f["id"] for f in inherited], "missing": missing}
        results[vid] = checks

    if GRIDATLAS:
        for v in versions:
            ok, tail, out = run([sys.executable, str(HERE / "gridatlas_resolve.py"), str(PIPELINE / v["id"]), GRIDATLAS, "--summary"])
            try:
                results[v["id"]]["gridatlas_resolves"] = json.loads(out)
            except Exception:
                results[v["id"]]["gridatlas_resolves"] = {"pass": False, "error": tail}

    if BROWSER:
        port = os.environ.get("VERIFY_PORT", "8765")
        server = subprocess.Popen([sys.executable, "-m", "http.server", port, "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            out_file = scratch / "browser.json"
            p = subprocess.run(["node", str(HERE / "browser_check.mjs"), f"http://127.0.0.1:{port}/uk_renewables_pipeline/", str(out_file)] + [v["id"] for v in versions], text=True)
            pages = json.loads(out_file.read_text()) if out_file.exists() else {}
        finally:
            server.terminate()
        for v in versions:
            views = pages.get(v["id"], [])
            summary, good = [], len(views) == 2
            for r in views:
                same_origin = [f for f in r.get("failed_same_origin", []) if not f.endswith("/favicon.ico")]
                okv = bool(r.get("complete")) and r.get("record_count") == reg["expected_record_count"] and not r.get("page_errors") and not same_origin and not (r.get("viewport") == "phone" and r.get("overflow"))
                good = good and okv
                summary.append({"viewport": r.get("viewport"), "pass": okv, "record_count": r.get("record_count"), "rows_drawn": r.get("rows_drawn"),
                                "page_errors": r.get("page_errors", [r.get("error")]), "console_errors": r.get("console_errors", []),
                                "failed_same_origin": same_origin, "failed_external": r.get("failed_external", []), "overflow": r.get("overflow"),
                                "map_links_drawn": r.get("map_links"), "first_map_link": r.get("first_map_link"), "features_seen": r.get("features")})
            results[v["id"]]["browser"] = {"pass": good, "views": summary}

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {"schema": "globalgrid2050.pipeline-news.versions.v1", "generated_at": now,
           "generated_by": "automation/pipeline_release/verify.py" + (" --browser" if BROWSER else ""),
           "where_run": "GitHub Actions" if os.environ.get("GITHUB_ACTIONS") else "release train workspace before publication",
           "note": "Every Pipeline News version from 202611132345 onward, newest first. Old versions stay published. "
                   "'verdict' is this tool's result when the file was written; 'ci' is the result of the Verify Pipeline News versions workflow on the pull request that published the version, recorded in the following version.",
           "release_candidate": reg.get("release_candidate"), "map_link_state": reg.get("map_link_state"), "versions": []}
    failed = []
    for v in reversed(versions):
        checks = results[v["id"]]
        verdict = "PASS" if all(c.get("pass") for c in checks.values()) else "FAIL"
        if verdict == "FAIL":
            failed.append(v["id"])
        doc["versions"].append({"id": v["id"], "version": v["version"], "parent": v["parent"], "date": v["date"], "state": v.get("state", "published"),
                                "added": v["added"], "data_changed": v["data_changed"], "url": f"{v['id']}/", "tree": v["trees"],
                                "verdict": verdict, "browser_checked": BROWSER, "checks": checks, "ci": v.get("ci"),
                                "merge_commit": v.get("merge_commit"), "known_faults": v.get("known_faults", [])})
        print(f"{v['id']} {v['version']}: {verdict} " + " ".join(f"{k}={'ok' if c.get('pass') else 'FAIL'}" for k, c in checks.items()))
        for k, c in checks.items():
            if not c.get("pass"):
                print(f"  {k}: {json.dumps(c, ensure_ascii=False)[:1500]}")
    if WRITE:
        (PIPELINE / "versions.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
        (PIPELINE / "versions.html").write_text(render(doc))
    else:
        (scratch / "versions.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
        print(f"verdicts written to {scratch / 'versions.json'}")
    if os.environ.get("VERIFY_OUT"):
        Path(os.environ["VERIFY_OUT"]).write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    if CHECK and failed:
        sys.exit(f"FAILED: {', '.join(failed)}")


def render(doc):
    e = html.escape
    rows = []
    for v in doc["versions"]:
        ci = v.get("ci") or {}
        ci_cell = f'<a href="{e(ci["url"])}">{e(ci.get("conclusion", "").upper())}</a>' if ci.get("url") else "not yet recorded"
        checks = " · ".join(f'{e(k.replace("_", " "))}: {"ok" if c.get("pass") else "FAIL"}' for k, c in v["checks"].items())
        faults = "".join(f"<li>{e(f)}</li>" for f in v["known_faults"]) or "<li>None recorded.</li>"
        state = v["state"].upper()
        rows.append(f'<tr class="{e(v["verdict"].lower())}"><td><a href="{e(v["url"])}"><b>{e(v["id"])}</b></a><br>{e(v["version"])}<br><span class="state">{e(state)}</span></td>'
                    f'<td>{e(v["date"].replace("T", " ").replace("Z", " UTC"))}</td><td>{e(v["added"])}<ul>{faults}</ul></td>'
                    f'<td><b class="verdict">{e(v["verdict"])}</b>{"" if v["browser_checked"] else " (offline checks only)"}<br><small>{checks}</small></td>'
                    f'<td>{ci_cell}</td><td>parent {e(v["parent"])}<br><a href="{e(v["url"])}CHANGES.md">changes</a></td></tr>')
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GlobalGrid2050 | Pipeline News versions</title>
<style>
body{{font-family:system-ui,Arial,sans-serif;margin:0;padding:20px;background:#07090c;color:#e6e9ee;line-height:1.45}}
a{{color:#6cf}}h1{{font-size:20px;margin:0 0 6px}}p{{max-width:900px;color:#a6adbb;font-size:14px}}
table{{border-collapse:collapse;width:100%;font-size:13px}}th,td{{border:1px solid #252a31;padding:8px;vertical-align:top;text-align:left}}
th{{background:#10141a;font-size:11px;letter-spacing:1px}}tr.pass .verdict{{color:#3d9}}tr.fail .verdict{{color:#f66}}
.state{{font-size:10px;letter-spacing:1px;color:#fc6}}ul{{margin:6px 0 0 16px;padding:0;color:#a6adbb}}small{{color:#7f8996}}
@media(max-width:700px){{table,tbody,tr,td{{display:block}}thead{{display:none}}tr{{margin-bottom:14px}}td{{border-bottom:0}}tr td:last-child{{border-bottom:1px solid #252a31}}}}
</style></head><body>
<h1>Pipeline News versions</h1>
<p>Every published version of the UK renewables pipeline page since the REPD October 2026 register, newest first. Each version is a
separate folder that is never edited after publication; earlier versions stay available. The verdict is the result of the automated
checks (the version's own test suite, the MAP link of every one of {doc['versions'][0]['checks']['map_contract'].get('rows') or '7,775'} rows, comparison with the parent version and a headless
browser load at desktop and phone widths). A verdict is a test result, not an engineering acceptance. Machine-readable copy:
<a href="versions.json">versions.json</a>. Generated {e(doc['generated_at'])}.</p>
<p>{e((doc.get('release_candidate') or {}).get('note', 'No release candidate has been named yet.'))}</p>
<table><thead><tr><th>VERSION</th><th>DATE</th><th>WHAT IT ADDED · KNOWN FAULTS</th><th>AUTOMATED VERDICT</th><th>CI ON PUBLICATION</th><th>LINKS</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table>
</body></html>
"""


if __name__ == "__main__":
    main()
