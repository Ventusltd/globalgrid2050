"""The public-language gate.

Register entry 24: "the rule that certain words must not appear in public text
is currently checked by reading. It needs to be a check that runs before
anything is published."

This is that check. It reads the VISIBLE text of the published surface - script
and style stripped, tags removed - and fails the build if it finds language
that must not reach a customer. Intent is not the test. On 20 September 2026
the published manual carried twenty reserved words, every one of them inside a
disclaimer written to protect the reader, and it still breached the rule.

    python scripts/check_public_language.py            # check
    python scripts/check_public_language.py --list     # show the surface

Exit code 1 means do not publish.
"""
import argparse
import glob
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- the published surface. A folder that is published must be listed here,
#      the same rule the deploy workflow learned four times.
SURFACE = [
    "index.html",
    "status.html",
    "historical_builds.html",
    "compute/*.html",
    "kuiper-grid/*.html",
    "kuiper-grid/*.md",
    # A NEW PUBLISHED FOLDER MUST BE ADDED HERE OR IT IS NEVER READ. This
    # list has the same defect the deploy workflow has learned five times:
    # it is an allow-list, and a page nobody adds to it is published
    # unchecked while the gate still prints PASS. plant/ is added with the
    # page, not after it.
    "plant/*.html",
    # SIXTH TIME THE ALLOW-LIST DEFECT ABOVE BIT. On 21 September 2026 the
    # composer shell at kuiper/ and all sixteen build shells under
    # kuiper-grid/i0*/ were given visible prose - navigation, a scope note
    # and the unsourced-limit warning - and NONE of them were on this list,
    # so the gate read eight files, printed PASS, and had not looked at any
    # of the seventeen pages the text had just been added to.
    "kuiper/*.html",
    "kuiper-grid/i0*/*.html",
]

# ---- what must never appear in public text
RULES = [
    ("reserved",
     r"\b(capacity|headroom|outage|risk|measured)\b",
     "the reserved word list: these make a claim about a network or a "
     "measurement that this work does not support"),
    ("maker-or-site",
     r"\b(sungrow|huawei|sma solar|fimer|fronius|trina|jinko|longi|"
     r"ja solar|canadian solar|risen|astronergy|cleve hill|"
     r"little cheyne|larks green)\b",
     "a manufacturer or a named site: this work is nameless by rule"),
    ("dev-diary",
     r"\b(TODO|FIXME|XXX|HACK|KLUDGE|Archived Broken|DO NOT SHIP|"
     r"quick and dirty|placeholder|lorem ipsum)\b",
     "working notes left in customer-facing text"),
    ("local-path",
     r"[A-Za-z]:\\Users\\|[A-Za-z]:/Users/|E:\\swarm|E:/swarm",
     "an absolute path from the author's machine"),
    ("assistant",
     r"\b(Claude|Codex|ChatGPT|GPT-4|GPT-5|OpenAI|Anthropic|Gemini|Copilot|"
     r"subagent|prompt engineering)\b",
     "an AI assistant named outside the approved statement"),
]

# ---- the one approved place an assistant may be named. Anything matching this
#      is the deliberate positioning statement, not leakage.
APPROVED = [
    r"explores current technology with Claude and\s+Codex AI",
    r"explores current technology with Claude and Codex AI",
]


def visible(path):
    s = open(path, encoding="utf-8", errors="replace").read()
    if path.lower().endswith((".html", ".htm")):
        s = re.sub(r"(?is)<script.*?</script>", " ", s)
        s = re.sub(r"(?is)<style.*?</style>", " ", s)
        s = re.sub(r"(?s)<!--.*?-->", " ", s)
        s = re.sub(r"<[^>]+>", " ", s)
    return html.unescape(re.sub(r"[ \t]+", " ", s))


def surface():
    out = []
    for pat in SURFACE:
        out.extend(sorted(glob.glob(os.path.join(ROOT, pat))))
    return [p for p in out if os.path.isfile(p)]


def approved_spans(text):
    spans = []
    for pat in APPROVED:
        for m in re.finditer(pat, text, re.I):
            spans.append((max(0, m.start() - 200), m.end() + 200))
    return spans


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    files = surface()
    if a.list:
        for f in files:
            print(" ", os.path.relpath(f, ROOT).replace("\\", "/"))
        return 0

    # a check that reached nothing FAILS
    if not files:
        print("FAIL: the published surface matched no files. A check that "
              "reached nothing is not a pass.")
        return 1

    findings = []
    for f in files:
        text = visible(f)
        ok = approved_spans(text)
        for name, pat, why in RULES:
            for m in re.finditer(pat, text, re.I):
                if name == "assistant" and any(
                        lo <= m.start() <= hi for lo, hi in ok):
                    continue
                a0 = max(0, m.start() - 55)
                findings.append((
                    os.path.relpath(f, ROOT).replace("\\", "/"), name,
                    m.group(0),
                    re.sub(r"\s+", " ", text[a0:m.end() + 55]).strip(), why))

    print("public-language gate: %d files on the published surface" % len(files))
    if not findings:
        print("PASS: no reserved word, maker name, working note, local path or "
              "unapproved assistant reference in visible text.")
        return 0

    by_rule = {}
    for f in findings:
        by_rule.setdefault(f[1], []).append(f)
    print("\nFAIL: %d finding(s). Do not publish.\n" % len(findings))
    for name, items in by_rule.items():
        print("  [%s] %s" % (name, items[0][4]))
        for path, _n, word, ctx, _w in items[:8]:
            print("    %s  '%s'" % (path, word))
            print("        ...%s..." % ctx[:110])
        if len(items) > 8:
            print("    (and %d more)" % (len(items) - 8))
        print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
