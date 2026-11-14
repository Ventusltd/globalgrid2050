"""Download a REPD release (CSV + XLSX) described by a release descriptor.

Reuses scripts/repd_sources_v6.py:fetch_bytes (same User-Agent, three attempts,
exponential back-off, empty-body rejection) but records the redirect chain,
because GOV.UK serves a *replaced* attachment's old URL as a redirect to the new
file: in November 2026 the July (Q2) URLs returned the October (Q3) bytes.

Guards, all fail closed:
  * every response records requested URL, each (status, url) hop, final URL,
    bytes, sha256 and retrieval time;
  * a redirect whose final file name names a different quarter is refused;
  * bytes whose sha256 is pinned by ANOTHER release descriptor are refused;
  * a pinned expected sha256 / byte count must match;
  * CSV must not be HTML (old assets of removed quarters redirect to the page),
    XLSX must be a zip.
Raw bytes go to <out>/raw/<file name>; <out>/fetch_receipt.json records everything.
Existing files in <out> are never overwritten with different bytes.

The network is reached only through an injectable `fetcher(url) -> Response`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote, urlparse
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

try:
    from . import config
except ImportError:  # run as a plain script
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from automation.repd import config  # type: ignore

USER_AGENT = "GlobalGrid2050/6.0 (+https://globalgrid2050.com/)"  # as repd_sources_v6.fetch_bytes


class FetchRefused(RuntimeError):
    pass


@dataclass
class Response:
    requested_url: str
    final_url: str
    status_chain: list            # [[status, url], ...] first hop .. final 200
    body: bytes
    content_type: str = ""

    @property
    def redirected(self) -> bool:
        return self.final_url != self.requested_url or len(self.status_chain) > 1


Fetcher = Callable[[str], Response]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def file_name(url: str) -> str:
    return unquote(urlparse(url).path.rsplit("/", 1)[-1])


# ---------------------------------------------------------------- default fetcher
class _Recorder(HTTPRedirectHandler):
    def __init__(self):
        self.hops: list = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.hops.append([code, req.full_url])
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def urllib_fetcher(use_env_proxy: bool = True, attempts: int = 3, timeout: int = 75) -> Fetcher:
    """Live fetcher (not used in tests against gov.uk). Retry policy copied from fetch_bytes."""
    def fetch(url: str) -> Response:
        last = None
        for attempt in range(attempts):
            rec = _Recorder()
            handlers = [rec] if use_env_proxy else [rec, ProxyHandler({})]
            opener = build_opener(*handlers)
            try:
                with opener.open(Request(url, headers={"User-Agent": USER_AGENT}), timeout=timeout) as r:
                    body = r.read()
                    if not body:
                        raise RuntimeError("empty response")
                    final = r.geturl()
                    return Response(url, final, rec.hops + [[r.status, final]], body,
                                    r.headers.get("Content-Type", ""))
            except Exception as exc:  # noqa: BLE001 - mirror fetch_bytes
                last = exc
                if attempt < attempts - 1:
                    time.sleep(2 ** attempt)
        raise RuntimeError(f"Unable to retrieve official source after {attempts} attempts: {url}: {last}")
    return fetch


def local_fetcher(directory, redirects: Optional[dict] = None) -> Fetcher:
    """Offline fetcher: serves <directory>/<url file name>. `redirects` maps a URL to
    the URL it should 301 to (used to replay the replaced-attachment trap)."""
    directory = Path(directory)
    redirects = redirects or {}

    def fetch(url: str) -> Response:
        chain, cur, seen = [], url, set()
        while cur in redirects:
            if cur in seen:
                raise RuntimeError(f"redirect loop at {cur}")
            seen.add(cur)
            chain.append([301, cur])
            cur = redirects[cur]
        path = directory / file_name(cur)
        if not path.is_file():
            raise RuntimeError(f"local fetcher: no file {path} for {cur}")
        chain.append([200, cur])
        return Response(url, cur, chain, path.read_bytes(), "")
    return fetch


# ---------------------------------------------------------------- guards
def check_response(resp: Response, role: str, desc: config.ReleaseDescriptor, registry: dict) -> dict:
    """Return the receipt entry, or raise FetchRefused. `registry` = config.known_hashes()."""
    digest = sha256(resp.body)
    entry = {
        "role": role,
        "requested_url": resp.requested_url,
        "final_url": resp.final_url,
        "status_chain": resp.status_chain,
        "redirected": resp.redirected,
        "content_type": resp.content_type,
        "bytes": len(resp.body),
        "sha256": digest,
        "retrieved_at": utc_now(),
        "expected_sha256": getattr(desc.expected, f"{role}_sha256"),
        "expected_bytes": getattr(desc.expected, f"{role}_bytes"),
    }
    where = f"{desc.release_id} {role.upper()} ({resp.requested_url} -> {resp.final_url}, sha256 {digest})"
    if not resp.status_chain or resp.status_chain[-1][0] != 200:
        raise FetchRefused(f"{where}: final status is not 200: {resp.status_chain}")
    head = resp.body[:512].lstrip().lower()
    if head.startswith((b"<!doctype", b"<html")):
        raise FetchRefused(f"{where}: received an HTML page, not a data file "
                           "(old assets of removed quarters redirect to the publication page)")
    if role == "xlsx" and not resp.body.startswith(b"PK\x03\x04"):
        raise FetchRefused(f"{where}: XLSX body is not a zip container")
    want_yq = config.quarter_from_label(desc.label)
    final_yq = config.quarter_from_filename(resp.final_url)
    if resp.redirected and final_yq is not None and final_yq != want_yq:
        raise FetchRefused(
            f"{where}: redirected to a file for {config.quarter_text(*final_yq)}; refusing to label it "
            f"{desc.quarter}. GOV.UK redirects a replaced attachment's old URL to its replacement, so the "
            f"{desc.label} bytes are no longer served at this URL.")
    owner = registry.get(digest)
    if owner and owner[0] != desc.release_id:
        raise FetchRefused(f"{where}: these bytes are pinned by release {owner[0]} ({owner[1]}); "
                           f"refusing to label them {desc.release_id}")
    if entry["expected_sha256"] and entry["expected_sha256"] != digest:
        raise FetchRefused(f"{where}: sha256 differs from pinned {entry['expected_sha256']}")
    if entry["expected_bytes"] is not None and entry["expected_bytes"] != len(resp.body):
        raise FetchRefused(f"{where}: {len(resp.body)} bytes, pinned {entry['expected_bytes']}")
    entry["sha256_verified"] = bool(entry["expected_sha256"])
    entry["warnings"] = []
    if not entry["expected_sha256"]:
        entry["warnings"].append("no pinned sha256: bytes accepted on URL/quarter evidence only; pin after review")
    if resp.redirected:
        entry["warnings"].append("redirected: final URL recorded; same quarter so accepted")
    return entry


# ---------------------------------------------------------------- hash guard
def hash_tree(paths, exclude=None) -> dict[str, str]:
    """sha256 of every file under the given files/dirs (excluding `exclude` subtree)."""
    exclude = Path(exclude).resolve() if exclude else None
    out = {}
    for p in map(Path, paths):
        files = [p] if p.is_file() else sorted(x for x in p.rglob("*") if x.is_file())
        for f in files:
            r = f.resolve()
            if exclude and (r == exclude or exclude in r.parents) or ".git" in r.parts:
                continue
            out[str(r)] = sha256(r.read_bytes())
    return out


def compare_hashes(before: dict, after: dict) -> list[str]:
    diffs = [f"changed: {k}" for k in before if k in after and before[k] != after[k]]
    diffs += [f"removed: {k}" for k in before if k not in after]
    diffs += [f"added: {k}" for k in after if k not in before]
    return diffs


# ---------------------------------------------------------------- main entry
def _write_once(path: Path, data: bytes) -> None:
    if path.exists():
        if sha256(path.read_bytes()) != sha256(data):
            raise FetchRefused(f"{path} exists with different bytes; refusing to overwrite (use a new --out)")
        return
    tmp = path.with_name(path.name + ".part")
    tmp.write_bytes(data)
    tmp.replace(path)


def fetch_release(desc: config.ReleaseDescriptor, out_dir, fetcher: Fetcher,
                  registry: Optional[dict] = None) -> dict:
    """Fetch CSV + XLSX, check both, then write raw bytes and fetch_receipt.json.
    Nothing is written unless BOTH files pass."""
    desc.validate()
    registry = config.known_hashes(config.load_all()) if registry is None else registry
    out = Path(out_dir)
    entries = []
    for role in ("csv", "xlsx"):
        url = getattr(desc, f"{role}_url")
        resp = fetcher(url)
        entries.append((check_response(resp, role, desc, registry), resp.body))
    raw = out / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    files = []
    for entry, body in entries:
        target = raw / file_name(entry["final_url"])
        _write_once(target, body)
        entry["path"] = str(target.relative_to(out))
        files.append(entry)
    receipt = {
        "schema": "globalgrid2050.repd-fetch-receipt.v1",
        "release_id": desc.release_id,
        "label": desc.label,
        "quarter": desc.quarter,
        "fetched_at": utc_now(),
        "descriptor": desc.to_dict(),
        "files": files,
        "status": "FETCHED_VERIFIED" if all(f["sha256_verified"] for f in files) else "FETCHED_UNPINNED",
    }
    rp = out / "fetch_receipt.json"
    rp.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--descriptor", required=True, help="release descriptor JSON")
    ap.add_argument("--out", required=True, help="staging directory (raw/ + fetch_receipt.json)")
    ap.add_argument("--from-dir", help="offline: serve files by URL file name from this directory")
    ap.add_argument("--redirect", action="append", default=[], metavar="OLD_URL=NEW_URL",
                    help="offline only: replay a 301 from OLD_URL to NEW_URL (repeatable)")
    ap.add_argument("--releases-dir", default=str(config.RELEASES_DIR),
                    help="descriptors whose pinned hashes form the known-release registry")
    ap.add_argument("--guard", action="append", default=[],
                    help="file/dir that must be byte-identical before and after (repeatable)")
    a = ap.parse_args(argv)
    desc = config.load(a.descriptor)
    if a.redirect and not a.from_dir:
        ap.error("--redirect needs --from-dir")
    redirects = dict(r.split("=", 1) for r in a.redirect)
    fetcher = local_fetcher(a.from_dir, redirects) if a.from_dir else urllib_fetcher()
    descs = config.load_all(a.releases_dir)
    descs[desc.release_id] = desc
    before = hash_tree(a.guard, exclude=a.out) if a.guard else {}
    try:
        receipt = fetch_release(desc, a.out, fetcher, config.known_hashes(descs))
    except FetchRefused as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 3
    if a.guard:
        diffs = compare_hashes(before, hash_tree(a.guard, exclude=a.out))
        if diffs:
            print("HASH GUARD FAILED (previous work changed):\n  " + "\n  ".join(diffs), file=sys.stderr)
            return 4
        print(f"hash guard: {len(before)} protected files unchanged")
    for f in receipt["files"]:
        print(f"{f['role']}: {f['bytes']} bytes sha256 {f['sha256']} <- {f['final_url']}")
    print(receipt["status"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
