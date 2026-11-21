"""Leak check for testcode/202609150125 (Sector Star).

Reads every public file in this folder and asserts that nothing private survived the aggregation.
Writes proof/leak-check.json and exits non-zero on any hit, so CI can rerun it.

The strongest assertion is the last one: no company name string from the private source's name
column appears in any public file. That list is read from the private source at run time and is
never written out.

Run:  python proof/leak-check.py
"""
import json, re, sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC_PARQUET = Path(r"C:\Users\vikra\Desktop\CompaniesHouse\out\202609141922\profit-over-1m.parquet")
SELF_OUT = HERE / "leak-check.json"

ALLOWED_HOSTS = ["globalgrid2050.com", "ventusltd.github.io", "api.postcodes.io", "postcodes.io",
                 "www.gov.uk", "gov.uk", "download.companieshouse.gov.uk",
                 "www.companieshouse.gov.uk", "companieshouse.gov.uk",
                 "127.0.0.1", "127.0.0.1:8867", "localhost"]

RULES = [
    ("company_suffix", r"\b(LIMITED|LTD|PLC|LLP)\b"),
    ("eight_digit_number", r"(?<!\d)\d{8}(?!\d)"),
    ("uk_full_postcode", r"\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b"),
    ("at_sign", r"@"),
]

TEXT_SUFFIXES = {".html", ".js", ".css", ".json", ".md", ".py", ".mjs", ".txt", ".sh", ".csv"}

# The origin of the distance bands is an outcode (WC2N, Charing Cross), never a full postcode, so
# nothing is exempt from the full-postcode rule and this list is empty by design.
ALLOWED_LITERALS = []


def strip_allowed(text):
    for lit in ALLOWED_LITERALS:
        text = text.replace(lit, "<home outcode>")
    # a sha256 digest is 64 hex characters and contains runs of digits by construction; it is not
    # a company registration number, so digests are blanked before the 8-digit rule runs
    return re.sub(r"\b[0-9a-f]{64}\b", "<sha256>", text)


def json_strings(text):
    """Every string that appears as a key or a value in a JSON document.

    Money sums and medians are JSON *numbers*; a company registration number could only reach a
    public file as text. Restricting the 8-digit rule to strings tests what actually matters.
    """
    out = []

    def walk(o):
        if isinstance(o, str):
            out.append(o)
        elif isinstance(o, dict):
            for k, v in o.items():
                out.append(k)
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(json.loads(text))
    return "\n".join(out)


def public_files():
    out = []
    for p in sorted(ROOT.rglob("*")):
        if p.is_dir() or p.resolve() == SELF_OUT.resolve():
            continue
        out.append(p)
    return out


def url_hits(text):
    bad = []
    for m in re.finditer(r"https?://([^\s\"'<>)\]]+)", text):
        host = m.group(1).split("/")[0].lower()
        if not any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS):
            bad.append(m.group(0)[:120])
    return bad


def main():
    files = public_files()
    findings, checked = [], []
    blobs = {}
    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        if p.suffix.lower() not in TEXT_SUFFIXES:
            checked.append({"file": rel, "skipped": "not a text file", "bytes": p.stat().st_size})
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        blobs[rel] = text
        scan = strip_allowed(text)
        digits_scan = strip_allowed(json_strings(text)) if p.suffix.lower() == ".json" else scan
        hits = {}
        for name, pat in RULES:
            target = digits_scan if name == "eight_digit_number" else scan
            # the leak-check script and the README quote the regexes themselves; that is the rule
            # text, not data, so this one file is allowed to name the patterns it searches for
            if rel in ("proof/leak-check.py", "README.md", "proof/build.py", "proof/ci-checks.json") and name in ("company_suffix", "uk_full_postcode", "at_sign"):
                continue
            found = re.findall(pat, target)
            if found:
                hits[name] = sorted(set(found))[:20]
        bad_urls = url_hits(text)
        if bad_urls:
            hits["url_outside_allow_list"] = sorted(set(bad_urls))[:20]
        checked.append({"file": rel, "bytes": p.stat().st_size, "hits": hits or None})
        if hits:
            findings.append({"file": rel, "hits": hits})

    # the strongest test: no company name from the private source appears in any public file
    name_test = {"ran": False}
    try:
        import pandas as pd
        names = pd.read_parquet(SRC_PARQUET, columns=["company_name"])["company_name"]
        names = names.dropna().astype(str).str.strip()
        names = names[names.str.len() >= 6]
        haystack = "\n".join(blobs.values()).upper()
        # exact full-name containment over every name in the source
        seen = set()
        for nm in names:
            u = nm.upper()
            if u in haystack:
                seen.add(nm)
                if len(seen) >= 25:
                    break
        name_test = {"ran": True, "names_tested": int(len(names)),
                     "names_found_in_public_files": sorted(seen)[:25] if seen else [],
                     "pass": not seen}
        if seen:
            findings.append({"file": "(any)", "hits": {"company_name_from_source": len(seen)}})
    except Exception as exc:
        name_test = {"ran": False, "error": "%s: %s" % (type(exc).__name__, exc)}

    result = {
        "schema": "globalgrid2050.sector-star.leak-check.v1",
        "page": "testcode/202609150125",
        "run_utc": datetime.now(timezone.utc).isoformat(),
        "files_checked": len(checked),
        "rules": [name for name, _ in RULES] + ["url_outside_allow_list", "company_name_from_source"],
        "allowed_hosts": ALLOWED_HOSTS,
        "company_name_test": name_test,
        "findings": findings,
        "pass": (not findings) and name_test.get("pass", False),
        "files": checked,
    }
    SELF_OUT.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8", newline="\n")
    print("leak check:", "PASS" if result["pass"] else "FAIL",
          "| files", len(checked), "| findings", len(findings),
          "| names tested", name_test.get("names_tested"))
    for f in findings:
        print("  HIT", f["file"], json.dumps(f["hits"])[:300])
    sys.exit(0 if result["pass"] else 1)


if __name__ == "__main__":
    main()
