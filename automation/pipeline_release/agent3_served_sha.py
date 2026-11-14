#!/usr/bin/env python3
"""Read-only browser-independent served-byte verification for one immutable release.

Compare local accepted candidate files (including all delivered JS/CSS/JSON/CSV)
against bytes fetched from the *actual published or staged HTTPS release URL*.
Never pushes, changes a pointer, writes site files or authorises publication.
"""
import argparse
import hashlib
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

EXTENSIONS = {".html", ".js", ".css", ".json", ".geojson", ".csv", ".txt"}
MAX_FILE = 50_000_000

def sha(blob):
    return hashlib.sha256(blob).hexdigest()

def audit(folder, url, opener=urllib.request.urlopen):
    folder = folder.resolve()
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or not re.fullmatch(
            r"/uk_renewables_pipeline/20\d{10}/", parsed.path):
        raise ValueError("Expected exact immutable HTTPS release directory URL, ending in slash")
    if parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("Release URL cannot contain credentials, query or fragment")
    rows = []
    files = sorted(f for f in folder.rglob("*") if f.is_file() and f.suffix.lower() in EXTENSIONS)
    if not files or not (folder/"index.html").is_file():
        raise ValueError("Candidate release missing files or index.html")
    for f in files:
        relative=f.relative_to(folder).as_posix()
        result={"path":relative,"pass":False}
        try:
            if f.stat().st_size > MAX_FILE:
                raise ValueError("File too large for byte verification")
            local=f.read_bytes()
            result["expected_sha256"]=sha(local)
            exact=url+urllib.parse.quote(relative,safe="/")
            # This is a distinct fetch per file, with identity content-encoding;
            # the stable path is included in the receipt, no trust in ETags only.
            req=urllib.request.Request(
                exact + "?agent3_release_byte_check=" + result["expected_sha256"][:16],
                headers={"Accept-Encoding":"identity",
                         "User-Agent":"GlobalGrid2050-Agent3-P2-Release-Audit/1.0"})
            with opener(req,timeout=30) as response:
                result["http_status"]=getattr(response,"status",None)
                landed=urllib.parse.urlsplit(response.geturl())
                if (landed.scheme,landed.netloc,landed.path)!=(
                        parsed.scheme,parsed.netloc,parsed.path+urllib.parse.quote(relative,safe="/")):
                    raise ValueError("Unexpected redirect/alternate origin or served path")
                if result["http_status"]!=200:
                    raise ValueError("HTTP status not 200")
                result["served_sha256"]=sha(response.read(MAX_FILE+1))
            if result["served_sha256"]!=result["expected_sha256"]:
                raise ValueError("Public served bytes differ from accepted local source")
            result["pass"]=True
        except Exception as exc:
            result["error"]=str(exc)
        rows.append(result)
    return {
        "schema":"ventus.agent3.p2.served-bytes.v1",
        "release_url":url,"files_checked":len(rows),
        "all_served_bytes_match":all(r["pass"] for r in rows),
        "publication_authorised":False,
        "files":rows,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--release-dir",type=Path,required=True)
    p.add_argument("--url",required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    try:
        report=audit(a.release_dir,a.url)
    except Exception as e:
        report={"schema":"ventus.agent3.p2.served-bytes.v1",
                "all_served_bytes_match":False,"error":str(e),
                "publication_authorised":False}
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:report.get(k) for k in
        ("all_served_bytes_match","files_checked","error")}))
    return 0 if report["all_served_bytes_match"] else 2

if __name__=="__main__":
    raise SystemExit(main())
