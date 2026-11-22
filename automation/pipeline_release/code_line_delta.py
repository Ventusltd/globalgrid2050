#!/usr/bin/env python3
"""Quick immutable Pipeline News release delta; no checkout of copied app trees."""
import argparse
import difflib
import json
from pathlib import Path
import re
import subprocess

TEXT_EXT = {".html",".css",".js",".mjs",".cjs",".jsx",".ts",".tsx",".py",".sh",".md",".txt",".yml",".yaml",".json5"}
CODE_EXT = TEXT_EXT - {".md",".txt",".yml",".yaml",".json5"}
PREFIX = "uk_renewables_pipeline/"

def git(*args):
    return subprocess.check_output(["git",*args])

def versions(ref):
    names=git("ls-tree","--name-only","-d",ref+":"+PREFIX.rstrip("/")).decode().splitlines()
    return sorted(name for name in names if re.fullmatch(r"20\d{10}",name))

def entries(ref,version):
    raw=git("ls-tree","-r","-z",ref+":"+PREFIX+version)
    return {path.decode("utf-8","surrogateescape"):meta.split()[2].decode()
            for meta,path in (rec.split(b"\t",1) for rec in raw.split(b"\0") if rec)}

def text_lines(sha):
    if sha is None: return []
    data=git("cat-file","blob",sha)
    if b"\0" in data or len(data)>2000000: return None
    try: return data.decode("utf-8").splitlines()
    except UnicodeError: return None

def compare(ref,previous,current):
    old,new=entries(ref,previous),entries(ref,current)
    changes=[]
    for path in sorted(set(old)|set(new)):
        if old.get(path)==new.get(path): continue
        ext=Path(path).suffix.lower()
        kind="source" if ext in CODE_EXT else "other-text" if ext in TEXT_EXT else "binary/data"
        added=deleted=None
        if kind!="binary/data":
            a,b=text_lines(old.get(path)),text_lines(new.get(path))
            if a is not None and b is not None:
                opcodes=difflib.SequenceMatcher(a=a,b=b,autojunk=False).get_opcodes()
                added=sum(j2-j1 for tag,i1,i2,j1,j2 in opcodes if tag in ("replace","insert"))
                deleted=sum(i2-i1 for tag,i1,i2,j1,j2 in opcodes if tag in ("replace","delete"))
        changes.append(dict(path=path,kind=kind,added=added,deleted=deleted,
                            before=old.get(path),after=new.get(path)))
    def totals(rows):
        return dict(added=sum(x["added"] or 0 for x in rows),
                    deleted=sum(x["deleted"] or 0 for x in rows),
                    changed_files=len(rows))
    exact_same=sum(old.get(p)==new.get(p) for p in (set(old)|set(new)))
    return dict(previous=previous,current=current,git_ref=ref,
                identical_inherited_files=exact_same,
                all_text=totals([x for x in changes if x["added"] is not None]),
                source=totals([x for x in changes if x["kind"]=="source" and x["added"] is not None]),
                nontext_changed_files=sum(x["added"] is None for x in changes),
                changed_files=len(changes),files=changes)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--ref",default="HEAD")
    p.add_argument("--current",default="latest")
    p.add_argument("--previous")
    p.add_argument("--output",default="/tmp/pipeline-release-delta")
    args=p.parse_args()
    v=versions(args.ref)
    current=v[-1] if args.current=="latest" else args.current
    if current not in v: p.error("unknown timestamped release: "+current)
    idx=v.index(current)
    if idx==0 and args.previous is None: p.error("no predecessor")
    previous=args.previous or v[idx-1]
    if previous not in v or previous>=current:p.error("invalid predecessor")
    report=compare(args.ref,previous,current)
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    (out/"delta.json").write_text(json.dumps(report,indent=2)+"\n")
    total=report["all_text"];code=report["source"]
    summary="\n".join((
      "## Pipeline News immutable release delta",
      "",
      f"**{previous} → {current}**",
      f"**{total['added']:,} lines added, {total['deleted']:,} removed** across {total['changed_files']} text files.",
      f"Application source: +{code['added']:,} / -{code['deleted']:,} lines in {code['changed_files']} files.",
      f"Exact inherited unchanged files: {report['identical_inherited_files']:,}.",
      f"Nontext/data changes: {report['nontext_changed_files']}.",
      "",
      "Counts are source-to-source differences, not duplicated lines from full release copies.",
      "Full ledger: delta.json",
      ""
    ))
    (out/"summary.md").write_text(summary)
    print(summary)
if __name__=="__main__": main()
