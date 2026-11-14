"""Rebuild the identity-relevant columns of the July V6 canonical CSV from the committed
dist/project_identity_v6.json (the canonical CSV itself was never committed), so the
identity stage can be re-run under the default (July) descriptor and compared byte-for-byte."""
import csv, json, sys
ident = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
rel_cols = [c["field"] for c in ident["detected_relationship_columns"]]
base = ["Ref ID", "Old Ref ID", "Record Last Updated (dd/mm/yyyy)", "Site Name", "Technology Type",
        "Installed Capacity (MWelec)", "Development Status (short)", "Operator (or Applicant)", "County", "Region",
        "Country", "Planning Authority", "Planning Application Reference", "Planning Application Submitted",
        "Planning Application Withdrawn", "Planning Permission Refused", "Planning Permission Granted",
        "Planning Permission Expired", "Under Construction", "Operational"]
headers = base + rel_cols
fillers = [f"Unused Column {i}" for i in range(ident["detected_header_count"] - len(headers))]
headers += fillers
raw_key = {"Record Last Updated (dd/mm/yyyy)": "repd_record_updated_raw", "Site Name": "site_name",
           "Technology Type": "technology", "Installed Capacity (MWelec)": "capacity_mw_raw",
           "Development Status (short)": "status", "Operator (or Applicant)": "operator", "County": "county",
           "Region": "region", "Country": "country", "Planning Authority": "planning_authority",
           "Planning Application Reference": "planning_application_reference",
           "Planning Application Submitted": "planning_application_submitted_raw",
           "Planning Application Withdrawn": "planning_application_withdrawn_raw",
           "Planning Permission Refused": "planning_permission_refused_raw",
           "Planning Permission Granted": "planning_permission_granted_raw",
           "Planning Permission Expired": "planning_permission_expired_raw",
           "Under Construction": "under_construction_raw", "Operational": "operational_raw"}
recs = ident["records"]
assert [r["source_row"] for r in recs] == list(range(2, len(recs) + 2))
with open(out, "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(headers)
    for r in recs:
        row = {"Ref ID": r["repd_ref"] or "", "Old Ref ID": r["repd_old_ref"] or ""}
        for col, key in raw_key.items():
            # dated fields: the identity keeps *_raw only for the update date; the 7 official
            # dates are stored normalised, so write them back as dd/mm/yyyy
            if key.endswith("_raw") and key not in r:
                iso = r[key[:-4]]
                row[col] = f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}" if iso else ""
            else:
                row[col] = r.get(key) or ""
        for col in rel_cols:
            row[col] = ", ".join(x["repd_ref"] for x in r["relationships"] if x["source_field"] == col)
        w.writerow([row.get(h, "") for h in headers])
print("rows", len(recs), "headers", len(headers))
