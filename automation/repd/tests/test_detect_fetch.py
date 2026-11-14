"""Tests for config.py, detect.py and fetch.py. No network: fixtures are constructed
files and synthetic bytes; one test uses a loopback HTTP server to exercise the real
urllib redirect recorder. Real October files are used only if present (skipped otherwise)."""
import copy
import http.server
import json
import sys
import threading
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from automation.repd import config, detect, fetch  # noqa: E402
from automation.repd.fetch import FetchRefused, Response  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures" / "detect_fetch"
Q2 = config.load(config.RELEASES_DIR / "2026q2.json")
Q3 = config.load(config.RELEASES_DIR / "2026q3.json")
REAL = Path("/home/claude/repd-report/q3")

CSV_BYTES = b"Old Ref ID,Ref ID\r\n1,7679\r\n"
XLSX_BYTES = b"PK\x03\x04" + b"\x00" * 64


def static(mapping, redirects=None, status=200):
    """fetcher over an in-memory {url: bytes} map with optional {url: target} 301s."""
    redirects = redirects or {}

    def f(url):
        chain, cur = [], url
        while cur in redirects:
            chain.append([301, cur])
            cur = redirects[cur]
        chain.append([status, cur])
        return Response(url, cur, chain, mapping[cur])
    return f


def synthetic_desc(**exp):
    d = copy.deepcopy(Q3)
    d.expected = config.Expected(**exp)
    return d


# ---------------------------------------------------------------- config
def test_descriptors_load_and_registry():
    allr = config.load_all()
    assert set(allr) >= {"2026q2", "2026q3"}
    reg = config.known_hashes(allr)
    assert reg[Q3.expected.csv_sha256] == ("2026q3", "csv")
    assert reg[Q2.expected.xlsx_sha256] == ("2026q2", "xlsx")
    assert Q3.expected.csv_rows == 14968 and Q3.expected.duplicate_refs == ["7679"]


def test_quarter_parsing():
    assert config.quarter_from_filename("REPD_Publication_Q3_2026.csv") == (2026, 3)
    assert config.quarter_from_filename("repd-q2-jul-2025.csv") == (2025, 2)
    assert config.quarter_from_filename("repd-october-2023.csv") is None
    assert config.quarter_from_label("REPD: October 2026 (CSV)") == (2026, 3)
    assert config.quarter_from_label("January 2026") == (2025, 4)


def test_descriptor_rejects_mislabel():
    d = Q3.to_dict()
    d["label"] = "July 2026"
    with pytest.raises(config.DescriptorError, match="label"):
        config.ReleaseDescriptor.from_dict(d)
    d = Q2.to_dict()
    d["csv_url"] = Q3.csv_url  # Q3 file under a Q2 descriptor
    with pytest.raises(config.DescriptorError, match="names Q3 2026"):
        config.ReleaseDescriptor.from_dict(d)
    d = Q3.to_dict()
    d["surprise"] = 1
    with pytest.raises(config.DescriptorError, match="unknown"):
        config.ReleaseDescriptor.from_dict(d)


def test_registry_refuses_hash_pinned_twice():
    a, b = copy.deepcopy(Q2), copy.deepcopy(Q3)
    b.expected.csv_sha256 = a.expected.csv_sha256
    with pytest.raises(config.DescriptorError, match="pinned to both"):
        config.known_hashes([a, b])


def test_roundtrip(tmp_path):
    config.dump(Q3, tmp_path / "x.json")
    assert config.load(tmp_path / "x.json") == Q3


# ---------------------------------------------------------------- detect
def test_detect_content_api_fixture():
    raw = (FIX / "content_api_2026q3.json").read_bytes()
    rep = detect.detect(static({config.CONTENT_API: raw}), "api", baseline=Q2)
    d = rep["descriptor"]
    assert rep["status"] == "NEW_RELEASE"
    assert (d["release_id"], d["label"], d["quarter"]) == ("2026q3", "October 2026", "Q3 2026")
    assert d["csv_url"] == Q3.csv_url and d["xlsx_url"] == Q3.xlsx_url
    assert d["page_last_updated"] == "2026-11-13"
    assert d["expected"]["csv_sha256"] is None  # detection never pins hashes


def test_detect_html_fixture_ignores_preview_script_and_foreign_links():
    raw = (FIX / "publication_2026q3.html").read_bytes()
    rep = detect.detect(static({config.SOURCE_PAGE: raw}), "html", baseline=Q3)
    d = rep["descriptor"]
    assert rep["status"] == "UNCHANGED"
    assert d["csv_url"] == Q3.csv_url and "/csv-preview/" not in d["csv_url"]
    assert d["page_last_updated"] == "2026-11-13"   # not the 2099 date inside <script>


def test_detect_html_q2_fixture_vs_q3_baseline_is_older():
    raw = (FIX / "publication_2026q2.html").read_bytes()
    parsed = detect.parse_publication_html(raw.decode())
    d = detect.build_descriptor(parsed)
    assert (d.release_id, d.page_last_updated, d.csv_url) == ("2026q2", "2026-08-03", Q2.csv_url)
    with pytest.raises(detect.DetectError, match="older"):
        detect.compare(d, Q3)


def test_detect_same_quarter_new_urls_is_replacement():
    meta = json.loads((FIX / "content_api_2026q3.json").read_text())
    meta["details"]["attachments"][0]["url"] = meta["details"]["attachments"][0]["url"].replace("6af42ff0", "7bbbbbbb")
    d = detect.build_descriptor(detect.parse_content_api(meta))
    assert detect.compare(d, Q3) == "REPLACED_SAME_QUARTER"


def test_detect_fails_closed_on_title_file_disagreement_and_missing():
    meta = json.loads((FIX / "content_api_2026q3.json").read_text())
    meta["details"]["attachments"][1]["title"] = "REPD: July 2026 (Excel)"
    with pytest.raises(detect.DetectError, match="names Q2 2026"):
        detect.build_descriptor(detect.parse_content_api(meta))
    meta["details"]["attachments"] = meta["details"]["attachments"][:1]
    with pytest.raises(detect.DetectError, match="no REPD .xlsx"):
        detect.build_descriptor(detect.parse_content_api(meta))


def test_detect_cli_offline(tmp_path):
    rc = detect.main(["--kind", "api", "--from-file", str(FIX / "content_api_2026q3.json"),
                      "--baseline", str(config.RELEASES_DIR / "2026q2.json"), "--out", str(tmp_path)])
    assert rc == 0
    assert json.loads((tmp_path / "detect_report.json").read_text())["status"] == "NEW_RELEASE"
    config.load(tmp_path / "detected_2026q3.json")


# ---------------------------------------------------------------- fetch
def test_fetch_writes_raw_and_receipt(tmp_path):
    from automation.repd.fetch import sha256
    desc = synthetic_desc(csv_sha256=sha256(CSV_BYTES), xlsx_sha256=sha256(XLSX_BYTES))
    f = static({desc.csv_url: CSV_BYTES, desc.xlsx_url: XLSX_BYTES})
    rec = fetch.fetch_release(desc, tmp_path, f, registry={})
    assert rec["status"] == "FETCHED_VERIFIED"
    assert (tmp_path / "raw" / "REPD_Publication_Q3_2026.csv").read_bytes() == CSV_BYTES
    on_disk = json.loads((tmp_path / "fetch_receipt.json").read_text())
    c = on_disk["files"][0]
    assert c["bytes"] == len(CSV_BYTES) and c["sha256"] == sha256(CSV_BYTES)
    assert c["status_chain"] == [[200, desc.csv_url]] and c["retrieved_at"].endswith("Z")
    # second run with identical bytes is idempotent; different bytes refused
    fetch.fetch_release(desc, tmp_path, f, registry={})
    desc2 = synthetic_desc()
    with pytest.raises(FetchRefused, match="refusing to overwrite"):
        fetch.fetch_release(desc2, tmp_path, static({desc.csv_url: CSV_BYTES + b"x", desc.xlsx_url: XLSX_BYTES}), registry={})


def test_unpinned_fetch_is_marked(tmp_path):
    desc = synthetic_desc()
    rec = fetch.fetch_release(desc, tmp_path, static({desc.csv_url: CSV_BYTES, desc.xlsx_url: XLSX_BYTES}), registry={})
    assert rec["status"] == "FETCHED_UNPINNED" and rec["files"][0]["warnings"]


def test_trap_redirect_to_newer_quarter_refused_and_nothing_written(tmp_path):
    """July URL 301 -> October file: must not be labelled July."""
    f = static({Q3.csv_url: CSV_BYTES, Q3.xlsx_url: XLSX_BYTES},
               redirects={Q2.csv_url: Q3.csv_url, Q2.xlsx_url: Q3.xlsx_url})
    with pytest.raises(FetchRefused, match="redirected to a file for Q3 2026; refusing to label it Q2 2026"):
        fetch.fetch_release(Q2, tmp_path, f, registry={})
    assert not (tmp_path / "raw").exists() and not (tmp_path / "fetch_receipt.json").exists()


def test_trap_silent_substitution_caught_by_hash_registry(tmp_path):
    """Same URL, no visible redirect (CDN/proxy flattening), but bytes are October's pinned hash."""
    reg = {fetch.sha256(CSV_BYTES): ("2026q3", "csv")}
    f = static({Q2.csv_url: CSV_BYTES, Q2.xlsx_url: XLSX_BYTES})
    with pytest.raises(FetchRefused, match="pinned by release 2026q3"):
        fetch.fetch_release(Q2, tmp_path, f, registry=reg)


def test_expected_sha_mismatch_and_html_and_bad_xlsx_refused(tmp_path):
    desc = synthetic_desc(csv_sha256="0" * 64)
    with pytest.raises(FetchRefused, match="differs from pinned"):
        fetch.fetch_release(desc, tmp_path, static({desc.csv_url: CSV_BYTES, desc.xlsx_url: XLSX_BYTES}), registry={})
    desc = synthetic_desc()
    page = b"<!DOCTYPE html><html>publication page</html>"
    with pytest.raises(FetchRefused, match="HTML page"):
        fetch.fetch_release(desc, tmp_path, static({config.SOURCE_PAGE: page, desc.xlsx_url: XLSX_BYTES},
                                                   redirects={desc.csv_url: config.SOURCE_PAGE}), registry={})
    with pytest.raises(FetchRefused, match="not a zip"):
        fetch.fetch_release(desc, tmp_path, static({desc.csv_url: CSV_BYTES, desc.xlsx_url: CSV_BYTES}), registry={})
    with pytest.raises(FetchRefused, match="not 200"):
        fetch.fetch_release(desc, tmp_path, static({desc.csv_url: CSV_BYTES, desc.xlsx_url: XLSX_BYTES}, status=206), registry={})


def test_same_quarter_redirect_accepted_with_warning(tmp_path):
    new = Q3.csv_url.replace("6af42ff0", "7ccccccc")
    desc = synthetic_desc()
    f = static({new: CSV_BYTES, desc.xlsx_url: XLSX_BYTES}, redirects={desc.csv_url: new})
    rec = fetch.fetch_release(desc, tmp_path, f, registry={})
    c = rec["files"][0]
    assert c["redirected"] and c["final_url"] == new and c["status_chain"][0] == [301, desc.csv_url]


def test_urllib_fetcher_records_real_redirect_chain(tmp_path):
    """Loopback only: a real HTTP 301 -> 302 -> 200 chain is captured hop by hop."""
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            hops = {"/media/old/REPD_Publication_Q2_2026.csv": "/media/mid/x",
                    "/media/mid/x": "/media/new/REPD_Publication_Q3_2026.csv"}
            if self.path in hops:
                self.send_response(301 if "old" in self.path else 302)
                self.send_header("Location", hops[self.path])
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/csv")
            self.end_headers()
            self.wfile.write(CSV_BYTES)

        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        base = f"http://127.0.0.1:{srv.server_address[1]}"
        r = fetch.urllib_fetcher(use_env_proxy=False, attempts=1, timeout=5)(base + "/media/old/REPD_Publication_Q2_2026.csv")
    finally:
        srv.shutdown()
    assert [s for s, _ in r.status_chain] == [301, 302, 200]
    assert r.final_url.endswith("/media/new/REPD_Publication_Q3_2026.csv") and r.body == CSV_BYTES
    with pytest.raises(FetchRefused, match="Q3 2026"):
        fetch.check_response(r, "csv", Q2, {})


def test_hash_guard_detects_change(tmp_path):
    prot = tmp_path / "prot"
    prot.mkdir()
    (prot / "repd.csv").write_bytes(b"a")
    before = fetch.hash_tree([prot])
    assert fetch.compare_hashes(before, fetch.hash_tree([prot])) == []
    (prot / "repd.csv").write_bytes(b"b")
    assert fetch.compare_hashes(before, fetch.hash_tree([prot]))[0].startswith("changed:")


# ---------------------------------------------------------------- real files (optional)
@pytest.mark.skipif(not (REAL / "REPD_Publication_Q3_2026.csv").exists(), reason="real October files not present")
def test_real_october_files(tmp_path):
    reg = config.known_hashes(config.load_all())
    rec = fetch.fetch_release(Q3, tmp_path / "q3", fetch.local_fetcher(REAL), registry=reg)
    assert rec["status"] == "FETCHED_VERIFIED"
    assert [f["bytes"] for f in rec["files"]] == [5219160, 5378656]
    trap = fetch.local_fetcher(REAL, redirects={Q2.csv_url: Q3.csv_url, Q2.xlsx_url: Q3.xlsx_url})
    with pytest.raises(FetchRefused):
        fetch.fetch_release(Q2, tmp_path / "q2", trap, registry=reg)
