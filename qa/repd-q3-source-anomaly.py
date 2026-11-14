#!/usr/bin/env python3
"""Pin and independently inspect the one published CSV-vs-XLSX text discrepancy.
This is a data-quality exception, NOT an assertion that either source is correct.
The acceptance harness may waive exactly (Ref 15915, Address) only after this
script confirms both official bytes and their divergent values.
"""
import csv
import hashlib
import json
from pathlib import Path
from openpyxl import load_workbook
import sys

csv_path, xlsx_path, clean_path, out_path = map(Path, sys.argv[1:5])
pins = {
 "csv": "48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862",
 "xlsx": "87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea"
}
for name,path in (("csv",csv_path),("xlsx",xlsx_path)):
 actual=hashlib.sha256(path.read_bytes()).hexdigest()
 assert actual==pins[name],f"{name} sha mismatch {actual}"

def find_csv(p):
 with p.open(encoding="cp1252",newline="") as f:
  rows=csv.DictReader(f)
  found=[r for r in rows if r["Ref ID"].strip()=="15915"]
 assert len(found)==1,(p,len(found))
 return found[0]

raw=find_csv(csv_path)
with clean_path.open(encoding="utf-8-sig",newline="") as f:
 rows=csv.DictReader(f)
 cleaned=[r for r in rows if r["Ref ID"].strip()=="15915"]
assert len(cleaned)==1,len(cleaned)
wb=load_workbook(xlsx_path,read_only=True,data_only=True)
ws=wb.active
it=ws.iter_rows(values_only=True)
header=list(next(it))
assert "Ref ID" in header and "Address" in header,header
ref_ix,addr_ix=header.index("Ref ID"),header.index("Address")
match=[]
for row in it:
 if str(row[ref_ix]).strip().removesuffix(".0")=="15915":
  match.append(row[addr_ix])
assert len(match)==1,len(match)
xv=match[0]
cv=raw["Address"]
cc=cleaned[0]["Address"]
assert cc==cv,f"Canonical cleaned source diverged from CSV {cc!r}"
assert isinstance(xv,str) and xv!=cv,f"Expected independently different Excel text {xv!r}"
from difflib import SequenceMatcher
changes=[(tag,cv[i:j],xv[k:l]) for tag,i,j,k,l in SequenceMatcher(None,cv,xv).get_opcodes() if tag!="equal"]
print(json.dumps({"source_csv":repr(cv),"source_excel":repr(xv),"cleaned":repr(cc),"diff":changes,
 "excel_codepoints":[f"U+{ord(c):04X}" for c in xv]},indent=2),flush=True)
assert len(changes)==1,f"More than one source-text difference: {changes!r}"
tag,old,new=changes[0]
assert old=="?" and len(new)==1 and (ord(new)>126 or ord(new)<32),f"Not the documented single unknown character: {changes!r}"
record={
 "status":"PASS_WITH_DOCUMENTED_EXCEPTION",
 "ref":"15915","field":"Address","raw_csv_value":cv,
 "cleaned_value":cc,
 "excel_repr":repr(xv),
 "excel_codepoints":[f"U+{ord(c):04X}" for c in xv],
 "csv_sha256":pins["csv"],"xlsx_sha256":pins["xlsx"],
 "decision":"Preserve literal '?' from official CSV, do not invent an address; waiver applies only to this one documented official CSV-vs-Excel conflict."
}
out_path.parent.mkdir(parents=True,exist_ok=True)
out_path.write_text(json.dumps(record,indent=2)+"\n")
print(json.dumps(record,indent=2))
