"""Tests for automation/news/signals/planning_file.py. Offline."""
from __future__ import annotations

import json
import sys
from pathlib import Path

SIG = Path(__file__).resolve().parents[1] / "signals"
sys.path.insert(0, str(SIG))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import official as O  # noqa: E402
import planning_file as P  # noqa: E402

from test_signals_official import FakeFetcher, project  # noqa: E402

REG = P.load_registers()


def test_every_authority_in_the_200_has_a_register_and_every_project_a_planning_file():
    projects = O.load_projects()
    assert {p["planning_authority"] for p in projects} <= set(REG)
    for register in REG.values():
        for key in ("home", "council", "search", "application"):
            assert register.get(key, "https://").startswith("https://")
    kinds = {}
    for p in projects:
        f = P.planning_file_for(p)
        assert f["label"] == "planning file" and f["kind"] in P.KINDS and f["url"].startswith("https://")
        assert f["authority"] and "family" not in f and "title" not in f      # never shaped like a news signal
        if f["kind"] == "search_page" and p["planning_ref"]:
            assert p["planning_ref"] in f["note"]
        kinds[f["kind"]] = kinds.get(f["kind"], 0) + 1
    assert kinds["pins_project"] >= 37 and kinds["ecu_case"] == 20 and sum(kinds.values()) == 200


def test_kinds_by_reference_and_authority():
    f = P.planning_file_for(project())
    assert (f["kind"], f["reference"]) == ("pins_project", "EN010147") and f["url"].endswith("/projects/EN010147")
    f = P.planning_file_for(project("17779", "Bowshiel Solar Farm", "ECU00005085", "Scottish Government (S36)"))
    assert f["kind"] == "ecu_case" and f["url"].endswith("cr=ECU00005085")
    f = P.planning_file_for(project("7936", "Nuneham Courtenay Solar Farm", "P20/S4360/FUL", "South Oxfordshire"))
    assert f["kind"] == "application" and f["url"].endswith("REF=P20/S4360/FUL")
    f = P.planning_file_for(project("12162", "Winterton Road solar farm", "PA/2024/129", "North Lincolnshire"))
    assert f["url"].endswith("/application/pa-2024-129")
    f = P.planning_file_for(project("1", "Example Solar Farm", "21/00077/FUL", "Thurrock"))
    assert f["kind"] == "search_page" and "search.do" in f["url"] and "21/00077/FUL" in f["note"] and not f["verified"]
    f = P.planning_file_for(project("2", "Welsh Solar Farm", "DNS/3274702", "Welsh Government (NSIP)"))
    assert f["kind"] == "search_page" and "wales" in f["url"] and f["authority"] == "Planning and Environment Decisions Wales"
    f = P.planning_file_for(project("3", "Unknown Solar Farm", "X/1", "Not A Listed Authority"))
    assert f["kind"] == "search_page" and f["url"] == P.GENERIC_SEARCH


def test_a_member_finding_is_used_only_when_it_points_at_a_case():
    case = {"authority": "Thurrock", "reference": "21/00077/FUL", "kind": "application", "verified": False,
            "url": "https://regs.thurrock.gov.uk/online-applications/applicationDetails.do?activeTab=summary&keyVal=QN50FLQGFP500"}
    f = P.planning_file_for(project("8026", "Bulphan Fen Solar Farm", "21/00077/FUL", "Thurrock", planning_file=case))
    assert f["kind"] == "application" and "keyVal=QN50FLQGFP500" in f["url"]
    front = dict(case, url="https://regs.thurrock.gov.uk/online-applications/", kind="application")
    f = P.planning_file_for(project("8026", "Bulphan Fen Solar Farm", "21/00077/FUL", "Thurrock", planning_file=front))
    assert f["kind"] == "search_page"
    national = {"kind": "pins_project", "reference": "EN010999", "verified": True,
                "url": "https://national-infrastructure-consenting.planninginspectorate.gov.uk/projects/EN010999"}
    f = P.planning_file_for(project("18870", "Hedgehog Grove Solar Farm", "26/00440/FUL", planning_file=national))
    assert f["kind"] == "pins_project" and f["reference"] == "EN010999" and "26/00440/FUL" in f["note"]


def test_verify_sets_verified_from_what_answers_and_falls_back_when_a_link_is_gone():
    projects = [
        project(),                                                                       # page shows the reference
        project("17779", "Bowshiel Solar Farm", "ECU00005085", "Scottish Government (S36)"),  # blocked
        project("7936", "Nuneham Courtenay Solar Farm", "P20/S4360/FUL", "South Oxfordshire"),  # gone -> search page
        project("1", "Example Solar Farm", "21/00077/FUL", "Thurrock"),                   # register answers
        project("2", "Other Solar Farm", "20/1/FUL", "Hart"),                             # register gone, council answers
    ]
    fetcher = FakeFetcher({
        "https://national-infrastructure-consenting": b"<h1>Botley West Solar Farm</h1> EN010147",
        "https://www.energyconsents.scot/": O.FetchError("HTTP 403", 403),
        "https://data.southoxon.gov.uk/ccm/support/Main.jsp?MODULE=ApplicationDetails": O.FetchError("HTTP 404", 404),
        "https://data.southoxon.gov.uk/ccm/support/Main.jsp?MODULE=ApplicationCriteria": b"search",
        "https://regs.thurrock.gov.uk/": b"search",
        "https://publicaccess.hart.gov.uk/": O.FetchError("URLError: [Errno -2] Name or service not known"),
        "https://www.hart.gov.uk/": b"council",
    })
    files, records = P.verify(projects, fetcher)
    assert files["12588"]["verified"] is True and files["12588"]["kind"] == "pins_project"
    assert files["17779"]["kind"] == "ecu_case" and files["17779"]["verified"] is False and "403" in files["17779"]["check"]
    assert files["7936"]["kind"] == "search_page" and "did not answer" in files["7936"]["note"]
    assert files["7936"]["register_status"] == "ok"
    assert files["1"]["register_status"] == "ok" and files["1"]["verified"] is False
    assert files["2"]["url"] == "https://www.hart.gov.uk/" and files["2"]["register_status"] == "council_page_only"
    assert {r["authority"]: r["status"] for r in records} == {"Hart": "council_page_only", "South Oxfordshire": "ok", "Thurrock": "ok"}
    result = P.build(projects, files, records, "2026-11-14T12:00:00Z", True)
    assert result["counts"]["nothing"] == 0 and result["counts"]["verified_direct"] == 1
    assert result["counts"]["search_page"] == 3 and result["projects"]["12588"]["planning_file"]["label"] == "planning file"
    official = {"items": [{"repd_ref": "12588"}], "sources": [{"id": "govuk-search", "status": "partial"}]}
    report = P.probe_report(projects, files, records, "2026-11-14T12:00:00Z", official)
    assert "| at least one official signal | 1 |" in report and "govuk-search (partial)" in report
    assert "Projects with nothing: none" in report
