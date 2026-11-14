import json

from automation.news import events as E


def _build(releases, **kw):
    old, new = E.load_pair(*releases)
    return E.build_events(old, new, "prev", "new", **kw)


def _by(doc):
    out = {}
    for ev in doc["events"]:
        out.setdefault((ev["ref"], ev["event_type"]), ev)
    return out


def test_every_status_event_type(releases):
    by = _by(_build(releases))
    assert ("1", "CONSENTED") in by and ("2", "CONSENTED") in by
    assert ("3", "CONSTRUCTION_STARTED") in by
    assert ("4", "OPERATIONAL") in by
    assert ("5", "REFUSED") in by
    assert ("6", "WITHDRAWN") in by
    assert ("7", "STATUS_REVERSAL") in by
    assert ("12", "LAPSED_OR_REVISED") in by
    assert ("9", "REMOVED_FROM_REGISTER") in by
    assert ("20", "NEW_LARGE_APPLICATION") in by
    assert ("21", "NEW_APPLICATION") in by
    assert ("22", "CONSENTED") in by and by[("22", "CONSENTED")]["basis"] == "new_record"
    assert ("23", "NEW_RECORD") in by


def test_capacity_operator_technology_changes(releases):
    by = _by(_build(releases))
    cap = by[("8", "CAPACITY_CHANGE")]["change"]
    assert cap == {"old_mw": 50.0, "new_mw": 57.0, "delta_mw": 7.0, "kind": "revised"}
    stated = by[("10", "CAPACITY_CHANGE")]["change"]
    assert stated["old_mw"] is None and stated["new_mw"] == 30.0 and stated["kind"] == "stated"
    assert by[("8", "OPERATOR_CHANGE")]["change"]["new_operator"] == "New Owner Plc"
    assert by[("11", "TECHNOLOGY_CHANGE")]["change"] == {"old_technology": "Solar Photovoltaics", "new_technology": "Battery"}


def test_cosmetic_operator_change_not_emitted(releases):
    doc = _build(releases)
    assert ("6", "OPERATOR_CHANGE") not in _by(doc)
    assert doc["operator_cosmetic_changes_not_emitted"] == 1


def test_unknown_capacity_is_null_never_zero(releases):
    doc = _build(releases)
    india = [e for e in doc["events"] if e["ref"] == "10"]
    assert all(e["previous_capacity_mw"] is None for e in india)
    assert "capacity not stated" not in india[0]["headline"] or india[0]["capacity_mw"] is None


def test_headline_is_from_data_only(releases):
    by = _by(_build(releases))
    h = by[("1", "CONSENTED")]["headline"]
    assert h == "Consented: Alpha Fen Solar Farm, 400 MW solar, Lincolnshire (REPD 1); previously Application Submitted"
    assert by[("7", "STATUS_REVERSAL")]["headline"].endswith("moved from Awaiting Construction back to Application Submitted")
    assert "first listed in this release" in by[("20", "NEW_LARGE_APPLICATION")]["headline"]


def test_event_dates_from_milestone_columns(releases):
    by = _by(_build(releases))
    assert by[("1", "CONSENTED")]["event_date"] == "2026-09-15"
    assert by[("1", "CONSENTED")]["event_date_source"] == "Planning Permission Granted"
    assert by[("3", "CONSTRUCTION_STARTED")]["event_date"] == "2026-09-20"
    assert by[("7", "STATUS_REVERSAL")]["event_date"] is None


def test_colocated_siblings_share_group(releases):
    by = _by(_build(releases))
    assert by[("1", "CONSENTED")]["group_key"] == by[("2", "CONSENTED")]["group_key"] == "DEV-1"
    assert by[("1", "CONSENTED")]["sibling_refs_same_event"] == ["2"]


def test_large_application_threshold(releases):
    by = _by(_build(releases, large_application_mw=1000))
    assert ("20", "NEW_APPLICATION") in by


def test_deterministic_ids_and_bytes(releases):
    a = json.dumps(_build(releases), sort_keys=True)
    b = json.dumps(_build(releases), sort_keys=True)
    assert a == b
    ids = [e["event_id"] for e in _build(releases)["events"]]
    assert len(ids) == len(set(ids))


def test_classify_status_ladder():
    assert E.classify_status("Under Construction", "Awaiting Construction") == ["STATUS_REVERSAL"]
    assert E.classify_status("Operational", "Decommissioned") == ["DECOMMISSIONED"]
    assert E.classify_status("Application Refused", "Awaiting Construction") == ["CONSENTED"]
    assert E.classify_status("Application Submitted", "Appeal Lodged") == ["APPEAL_LODGED"]
    assert E.classify_status("Awaiting Construction", None) == ["REMOVED_FROM_REGISTER"]
