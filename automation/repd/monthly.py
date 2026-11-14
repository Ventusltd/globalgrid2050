#!/usr/bin/env python3
"""Monthly REPD check: has GOV.UK published new REPD bytes? If so, prepare the release.

Used by .github/workflows/repd-monthly.yml (3rd of each month). One decision, by hash:

  * download the CSV and XLSX the publication currently links to (GOV.UK redirects a
    replaced attachment's old URL to the new file, so URLs prove nothing: hashes do);
  * if BOTH sha256 values are already pinned by a descriptor in automation/repd/releases/,
    status = "unchanged" (the usual month: REPD is published about quarterly), exit 0;
  * otherwise status = "new": derive the release id (2027q1 from the file name or
    attachment title; failing that, from the publication date: the last quarter that had
    ended by then), write releases/<id>.json and releases_v6/v6_<id>.json with the hashes
    and counts of the downloaded files, add the three over-5-MB outputs of the release to
    .github/large-files-allowlist.txt, exit 0;
  * if the bytes are new but the derived id already has a descriptor (a same-quarter
    correction) or is older than the newest one, status = "needs_person", exit 1:
    a person decides, nothing is written.

The downloaded files are kept in <out>/raw/ so the workflow feeds the same bytes to
run.py (--offline --csv --xlsx). <out>/result.json and <out>/summary.md record the
decision; with GITHUB_OUTPUT set, status/release_id/release_folder/csv/xlsx are exported.

Offline (tests, dry runs): --api-file <saved content API JSON> --files-dir <dir holding
files named as the attachment URLs>.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from automation.repd import config, detect  # noqa: E402
from automation.repd.fetch import file_name, local_fetcher, urllib_fetcher, utc_now  # noqa: E402

HERE = Path(__file__).resolve().parent
QUARTER_MONTH = {1: "April", 2: "July", 3: "October", 4: "January"}


class NeedsPerson(RuntimeError):
    pass


def quarter_from_date(day: str) -> tuple[int, int]:
    """Last calendar quarter that had ended on `day` (YYYY-MM-DD): 2026-11-13 -> (2026, 3)."""
    d = dt.date.fromisoformat(day[:10])
    q = (d.month - 1) // 3          # quarters fully ended this year
    return (d.year - 1, 4) if q == 0 else (d.year, q)


def release_name(yq: tuple[int, int]) -> str:
    year, q = yq
    return f"{QUARTER_MONTH[q]} {year + 1 if q == 4 else year}"


def find_published(fetcher, api_file: str | None = None) -> dict:
    """Newest REPD CSV + XLSX attachment pair on the publication, with release id."""
    errors = []
    sources = [("content_api", None)] if api_file else [("content_api", config.CONTENT_API),
                                                       ("publication_html", config.SOURCE_PAGE)]
    for kind, url in sources:
        try:
            if api_file:
                body = Path(api_file).read_text(encoding="utf-8")
            else:
                resp = fetcher(url)
                if resp.status_chain[-1][0] != 200:
                    raise RuntimeError(f"status {resp.status_chain}")
                body = resp.body.decode("utf-8")
            parsed = (detect.parse_content_api(body) if kind == "content_api"
                      else detect.parse_publication_html(body))
            if parsed["attachments"]:
                break
            errors.append(f"{kind}: no REPD attachments")
        except Exception as exc:  # noqa: BLE001 - try the next source
            errors.append(f"{kind}: {exc}")
    else:
        raise RuntimeError("cannot read the publication: " + "; ".join(errors))
    when = parsed.get("page_last_updated") or utc_now()[:10]
    try:
        desc = detect.build_descriptor(parsed)
        return {"release_id": desc.release_id, "label": desc.label, "csv_url": desc.csv_url,
                "xlsx_url": desc.xlsx_url, "title": desc.dataset_title, "page_last_updated": when,
                "govuk_public_updated_at": parsed.get("govuk_public_updated_at"),
                "id_from": "file name / attachment title", "source": parsed["source"]}
    except detect.DetectError as exc:
        # Quarter not readable from names: one CSV + one XLSX, labelled by publication date.
        pick = {}
        for role in ("csv", "xlsx"):
            cands = [a for a in parsed["attachments"] if a["role"] == role]
            if len(cands) != 1:
                raise NeedsPerson(f"{exc}; and {len(cands)} .{role} attachments, so no date fallback") from exc
            pick[role] = cands[0]
        yq = quarter_from_date(when)
        return {"release_id": config.release_id_for(*yq), "label": release_name(yq),
                "csv_url": pick["csv"]["url"], "xlsx_url": pick["xlsx"]["url"],
                "title": pick["csv"]["title"] or None, "page_last_updated": when,
                "govuk_public_updated_at": parsed.get("govuk_public_updated_at"),
                "id_from": f"publication date {when} ({exc})", "source": parsed["source"]}


def download(fetcher, url: str, role: str, raw_dir: Path) -> dict:
    resp = fetcher(url)
    if not resp.status_chain or resp.status_chain[-1][0] != 200:
        raise RuntimeError(f"{url}: final status {resp.status_chain}")
    body = resp.body
    if body[:512].lstrip().lower().startswith((b"<!doctype", b"<html")):
        raise RuntimeError(f"{url}: got an HTML page, not a data file")
    if role == "xlsx" and not body.startswith(b"PK\x03\x04"):
        raise RuntimeError(f"{url}: XLSX is not a zip container")
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / file_name(url)        # saved under the descriptor URL's name (run.py offline)
    path.write_bytes(body)
    return {"url": url, "final_url": resp.final_url, "redirected": resp.redirected, "path": str(path),
            "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}


def counts(csv_path: Path, xlsx_path: Path, repo_root: Path) -> dict:
    """Rows, refs and threshold counts exactly as scripts/repd_sources_v6.py computes them."""
    sys.path.insert(0, str(repo_root / "scripts"))
    try:
        import repd_sources_v6 as v6  # noqa: PLC0415 - July defaults; no descriptor env needed
    finally:
        sys.path.pop(0)
    frame = v6.read_csv(csv_path.read_bytes())
    refs = [v6.clean_ref(x) for x in frame["Ref ID"].tolist()]
    dups = sorted(r for r, k in Counter(refs).items() if k > 1)
    xlsx, _ = v6.read_xlsx(xlsx_path.read_bytes())
    xlsx, _ = v6.drop_identical_duplicates(xlsx, "XLSX")
    solar, bess = v6.threshold_counts(xlsx)
    return {"csv_rows": len(frame), "unique_refs": len(set(refs)), "duplicate_refs": dups,
            "solar_gt_1mw": solar, "bess_gt_100mw": bess}


def first_existing(repo_root: Path, *rels: str) -> str | None:
    return next((r for r in rels if r and (repo_root / r).is_file()), None)


def write_descriptors(pub: dict, files: dict, n: dict, prev: str | None, auto_dir: Path,
                      repo_root: Path) -> list[str]:
    rid = pub["release_id"]
    year, q = int(rid[:4]), int(rid[-1])
    title = f"Renewable Energy Planning Database (REPD): {pub['label']} (Q{q} {year})"  # as releases_v6/v6_2026q3.json
    desc = config.ReleaseDescriptor(
        release_id=rid, label=pub["label"], quarter=config.quarter_text(year, q),
        csv_url=pub["csv_url"], xlsx_url=pub["xlsx_url"], page_last_updated=pub["page_last_updated"],
        govuk_public_updated_at=pub["govuk_public_updated_at"], dataset_title=title,
        previous_release_id=prev,
        baseline_path=first_existing(repo_root, f"repd-{prev}.csv" if prev else "", "repd.csv"),
        expected=config.Expected(csv_sha256=files["csv"]["sha256"], xlsx_sha256=files["xlsx"]["sha256"],
                                 csv_bytes=files["csv"]["bytes"], xlsx_bytes=files["xlsx"]["bytes"], **n),
        provenance=[f"written by automation/repd/monthly.py at {utc_now()} from {pub['source']}; "
                    f"release id from {pub['id_from']}; hashes and counts are of the downloaded files"],
    )
    path = auto_dir / "releases" / f"{rid}.json"
    config.dump(desc, path)
    prev_v6 = auto_dir / "releases_v6" / f"v6_{prev}.json"
    v6 = json.loads(prev_v6.read_text(encoding="utf-8")) if prev and prev_v6.is_file() else {}
    v6.update({
        "schema": "globalgrid2050.repd-release-descriptor.v6", "release_id": rid, "quarter_label": f"Q{q}",
        "output_suffix": rid, "csv_url": pub["csv_url"], "xlsx_url": pub["xlsx_url"],
        "publication_date": pub["page_last_updated"],
        "dataset_title": title,
        "expected_rows": n["csv_rows"], "expected_unique_refs": n["unique_refs"],
        "expected_solar_gt1": n["solar_gt_1mw"], "expected_bess_gt100": n["bess_gt_100mw"],
        "expected_csv_sha256": files["csv"]["sha256"], "expected_xlsx_sha256": files["xlsx"]["sha256"],
        "baseline_identity": first_existing(repo_root, f"dist/project_identity_{prev}.json",
                                            "dist/project_identity_v6.json") or "dist/project_identity_v6.json",
        "baseline_projects": first_existing(repo_root, f"dist/major_projects_{prev}.json",
                                            "dist/major_projects_v6.json") or "dist/major_projects_v6.json",
        "notes": f"Written by automation/repd/monthly.py at {utc_now()}; counts computed from the downloaded files.",
    })
    v6.setdefault("duplicate_row_policy", "drop_identical")
    v6.setdefault("date_rule", "xlsx_typed_wins")
    v6_path = auto_dir / "releases_v6" / f"v6_{rid}.json"
    v6_path.parent.mkdir(parents=True, exist_ok=True)
    v6_path.write_text(json.dumps(v6, indent=2) + "\n", encoding="utf-8")
    written = [str(path), str(v6_path)]
    # Reviewed acceptance waivers (cells the CSV cannot carry, e.g. a character outside cp1252)
    # are carried forward from the previous release; acceptance.py lists every waived cell.
    prev_known = auto_dir / "baselines" / f"{prev}_known_anomalies.json"
    waive = (json.loads(prev_known.read_text(encoding="utf-8")).get("acceptance_waive_cells") or []
             if prev and prev_known.is_file() else [])
    new_known = auto_dir / "baselines" / f"{rid}_known_anomalies.json"
    if waive and not new_known.exists():
        new_known.write_text(json.dumps({
            "schema": "globalgrid2050.repd-validate-known-anomalies.v1", "release_id": rid,
            "note": f"Written by automation/repd/monthly.py: acceptance waivers carried forward from {prev}; "
                    "no validation anomalies are pre-approved.",
            "known": {}, "acceptance_waive_cells": waive}, indent=2) + "\n", encoding="utf-8")
        written.append(str(new_known))
    return written


def allowlist_lines(rid: str, folder: str) -> list[str]:
    return [f"dist/project_identity_{rid}.json", f"dist/repd_master_{rid}.json",
            f"uk_renewables_pipeline/{folder}/fixtures/{rid}/project_identity_{rid}.json"]


def add_allowlist(repo_root: Path, rid: str, folder: str) -> list[str]:
    path = repo_root / ".github" / "large-files-allowlist.txt"
    text = path.read_text(encoding="utf-8") if path.is_file() else ""
    have = {ln.split("#", 1)[0].strip() for ln in text.splitlines()}
    new = [ln for ln in allowlist_lines(rid, folder) if ln not in have]
    if new:
        sep = "" if not text or text.endswith("\n") else "\n"
        path.write_text(text + sep + f"# REPD {rid} (automation/repd/monthly.py): identity registry and master GeoJSON.\n"
                        + "".join(f"{ln}\n" for ln in new), encoding="utf-8")
    return new


def run(args, res: dict) -> dict:
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    repo_root = Path(args.repo_root).resolve()
    auto_dir = Path(args.automation_dir).resolve() if args.automation_dir else repo_root / "automation" / "repd"
    fetcher = local_fetcher(args.files_dir) if args.files_dir else urllib_fetcher()
    known = config.load_all(auto_dir / "releases")
    newest = max(known) if known else None
    res.update(newest_known=newest, known_releases=sorted(known))
    pub = find_published(fetcher, args.api_file)
    res["published"] = pub
    files = {role: download(fetcher, pub[f"{role}_url"], role, out / "raw") for role in ("csv", "xlsx")}
    res["files"] = files
    registry = config.known_hashes(known)
    owners = {role: registry.get(files[role]["sha256"]) for role in files}
    if owners["csv"] and owners["xlsx"]:
        res.update(status="unchanged", release_id=owners["csv"][0],
                   reason=f"published CSV and XLSX sha256 equal the pinned hashes of {owners['csv'][0]}")
        return res
    rid = pub["release_id"]
    if rid in known or (newest and rid < newest):
        raise NeedsPerson(f"new bytes on GOV.UK but they name {rid}, and the newest known release is {newest}: "
                          "a same-quarter correction or an older file. Review by hand, then update or add "
                          f"automation/repd/releases/{rid}.json (CSV pinned by {owners['csv']}, XLSX by {owners['xlsx']}).")
    folder = args.release_folder or dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M")
    n = counts(Path(files["csv"]["path"]), Path(files["xlsx"]["path"]), repo_root)
    written = write_descriptors(pub, files, n, newest, auto_dir, repo_root)
    allow = add_allowlist(repo_root, rid, folder) if not args.no_allowlist else []
    res.update(status="new", release_id=rid, release_folder=folder, counts=n, descriptors=written,
               allowlist_added=allow,
               reason=f"published sha256 not pinned by any known release; derived {rid} from {pub['id_from']}")
    return res


def summary(res: dict) -> str:
    st = res.get("status")
    head = {"unchanged": "No new REPD release", "new": f"New REPD release {res.get('release_id')}",
            "needs_person": "REPD changed: needs a person", "error": "REPD monthly check failed"}.get(st, st)
    lines = [f"## {head}", "", f"- Checked at {res.get('checked_at')}; newest known release: "
             f"`{res.get('newest_known')}`", f"- Reason: {res.get('reason')}"]
    for role, f in (res.get("files") or {}).items():
        lines.append(f"- {role.upper()}: {f['url']} ({f['bytes']} bytes, sha256 `{f['sha256']}`"
                     + (f", redirected to {f['final_url']}" if f.get("redirected") else "") + ")")
    if st == "new":
        lines.append(f"- Counts: {json.dumps(res.get('counts'))}")
        lines.append(f"- Release folder: `uk_renewables_pipeline/{res.get('release_folder')}/`")
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True, help="work directory (outside the repo)")
    ap.add_argument("--repo-root", default=str(HERE.parents[1]))
    ap.add_argument("--automation-dir", help="where releases/ and releases_v6/ live (default <repo>/automation/repd)")
    ap.add_argument("--api-file", help="offline: saved GOV.UK content API JSON")
    ap.add_argument("--files-dir", help="offline: directory with the attachment files by name")
    ap.add_argument("--release-folder", help="12-digit stamp for uk_renewables_pipeline/<stamp>/ (default now)")
    ap.add_argument("--no-allowlist", action="store_true", help="do not edit .github/large-files-allowlist.txt")
    a = ap.parse_args(argv)
    res = {"schema": "globalgrid2050.repd-monthly-check.v1", "checked_at": utc_now()}
    try:
        run(a, res)
        code = 0
    except NeedsPerson as exc:
        res.update(status="needs_person", reason=str(exc))
        code = 1
    except Exception as exc:  # noqa: BLE001 - any failure is reported, never green
        res.update(status="error", reason=f"{type(exc).__name__}: {exc}")
        code = 2
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "result.json").write_text(json.dumps(res, indent=2, default=str) + "\n", encoding="utf-8")
    (out / "summary.md").write_text(summary(res), encoding="utf-8")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
            for key in ("status", "release_id", "release_folder"):
                fh.write(f"{key}={res.get(key) or ''}\n")
            for role in ("csv", "xlsx"):
                fh.write(f"{role}={(res.get('files') or {}).get(role, {}).get('path', '')}\n")
    print(summary(res))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
