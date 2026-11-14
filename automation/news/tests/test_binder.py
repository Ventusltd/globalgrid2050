import json

import pytest

from automation.repd import diff as repd
from automation.news import binder as B
from automation.news.tests.conftest import row, write_csv

PROJECTS = [
    row(11034, "Coalburn Energy -  Battery Storage", "Battery", 500, "Operational", county="Strathclyde",
        operator="Zenobe Energy"),
    row(12206, "Coalburn II Energy Storage Facility - Battery Storage Facility", "Battery", 1000,
        "Under Construction", county="Lanarkshire"),
    row(6920, "West Burton", "Battery", 49, "Operational", county="Nottinghamshire"),
    row(10916, "West Burton Solar Project", "Solar Photovoltaics", 480, "Awaiting Construction"),
    row(10917, "West Burton Solar Project", "Battery", 20, "Awaiting Construction"),
    row(11928, "West Burton Power Station, North Road - Battery Storage", "Battery", 500,
        "Awaiting Construction", county="Nottinghamshire"),
    row(13599, "Beacon Fen Energy Park", "Solar Photovoltaics", 400, "Awaiting Construction", pref="EN010151"),
    row(13600, "Beacon Fen Energy Park", "Battery", 600, "Awaiting Construction", pref="EN010151"),
    row(500, "The Grange", "Solar Photovoltaics", 49.9, "Awaiting Construction"),
    row(5967, "Kells Solar Farm", "Solar Photovoltaics", 25, "Revised", county="Co. Derry / Londonderry",
        country="Northern Ireland"),
    row(11974, " Hessay Solar Farm", "Solar Photovoltaics", 40, "Awaiting Construction", county="North Yorkshire"),
    row(13003, "Eccles Substation, Eccles - Battery Energy Storage System", "Battery", 50, "Under Construction",
        operator="Eccles Grid Stability Limited", county="Borders"),
    row(11867, "Eccles Battery Energy Storage System", "Battery", 400, "Under Construction", county="Borders"),
    row(700, "Carlton Solar Farm", "Solar Photovoltaics", 49.99, "Awaiting Construction", county="North Yorkshire"),
    row(701, "Carlton Solar Farm", "Solar Photovoltaics", 30, "Application Submitted", county="Bedfordshire"),
]


@pytest.fixture(scope="module")
def index(tmp_path_factory):
    p = write_csv(tmp_path_factory.mktemp("b") / "repd.csv", PROJECTS)
    return B.ProjectIndex(repd.load_csv(p))


def b(index, headline, source="Solar Power Portal"):
    return B.bind({"headline": headline, "source": source}, index)


def test_longest_name_wins(index):
    r = b(index, "Meadow Partners acquires ground lease for Coalburn II battery storage project")
    assert (r["class"], r["ref"]) == ("STRONG", "12206")
    r = b(index, "1GWh Coalburn 1 battery energy storage enters operations in Scotland")
    assert r["ref"] == "11034"


def test_ambiguous_name_resolved_by_technology_and_capacity(index):
    r = b(index, "Fidra Energy reaches financial close on 500 MW West Burton C BESS project")
    assert (r["class"], r["ref"]) == ("STRONG", "11928")
    assert "capacity" in r["evidence"]["resolved_by"]


def test_ambiguous_name_left_as_candidate(index):
    r = b(index, "Lender advises on West Burton C BESS financing")
    assert r["class"] == "CANDIDATE" and r["ref"] is None
    assert len(r["candidates"]) >= 2


def test_planning_reference_is_exact_and_sibling_primary_is_solar(index):
    r = b(index, "Decision on EN010151 published", source="GOV.UK")
    assert r["class"] == "EXACT" and r["ref"] == "13599" and r["related_refs"] == ["13600"]
    r = b(index, "Beacon Fen Energy Park battery storage plans")
    assert r["ref"] == "13600"


def test_generic_names_never_bind(index):
    assert b(index, "The Grange celebrates national care award")["class"] == "UNBOUND"


def test_foreign_place_downgrades(index):
    r = b(index, "Kells solar farm plan setback after archaeological find", source="Meath Chronicle")
    assert r["class"] == "CANDIDATE"


def test_one_word_name_needs_technology_word(index):
    assert b(index, "Triple Point acquires 49.2MW Hessay Solar project")["ref"] == "11974"
    assert b(index, "Hessay village hall reopens")["class"] == "UNBOUND"


def test_operator_words_inside_the_site_name_prove_nothing(index):
    r = b(index, "Eccles battery storage system plan secures finance deal")
    assert r["class"] == "CANDIDATE"


def test_capacity_mismatch_keeps_ambiguity(index):
    r = b(index, "Greencells signs 71 MW Carlton solar farm EPC deal")
    assert r["class"] == "CANDIDATE"
    r = b(index, "Carlton solar farm in North Yorkshire secures financing")
    assert (r["class"], r["ref"]) == ("STRONG", "700")


def test_tech_contradiction(index):
    r = b(index, "Hessay Solar wind turbine plan")
    assert r["class"] in ("STRONG", "CANDIDATE")  # both families named: solar keeps it


def test_news_capacities():
    assert B.news_capacities("500MW/1,000MWh and 1.2GW, 49.9MWp, 1,000 MW") == [500.0, 1200.0, 49.9, 1000.0]
    assert B.capacity_corroborates(400, [395.0]) and not B.capacity_corroborates(40, [49.2])
    assert not B.capacity_corroborates(None, [10.0])


def test_evaluate_counts(index):
    labels = [
        {"id": "a", "headline": "Coalburn II battery storage acquired", "gold_ref": "12206", "label": "bind", "baseline_ref": "11034"},
        {"id": "b", "headline": "The Grange care award", "gold_ref": None, "label": "none", "baseline_ref": "500"},
        {"id": "c", "headline": "West Burton C BESS financing", "gold_ref": "11928", "label": "bind"},
        {"id": "d", "headline": "Something unclear", "gold_ref": None, "label": "unsure"},
    ]
    ev = B.evaluate(labels, index)
    assert ev["n_scored"] == 3 and ev["n_unsure"] == 1
    assert ev["signal_metrics"]["tp"] == 1 and ev["signal_metrics"]["fp"] == 0 and ev["signal_metrics"]["fn"] == 1
    assert ev["baseline_v9_5_1_primary_match_metrics"]["fp"] == 2


def test_datacentre_binding_is_separate_category(tmp_path):
    g = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": None, "properties": {"id": "dcuk-aaaa", "name": "Cobalt Park Data Centres", "status": "operational"}},
        {"type": "Feature", "geometry": None, "properties": {"id": "dcuk-bbbb", "name": "Unnamed data centre", "status": "operational"}},
        {"type": "Feature", "geometry": None, "properties": {"id": "dcuk-cccc", "name": "Hertfordshire Data Centre", "status": "operational"}}]}
    p = tmp_path / "dc.geojson"
    p.write_text(json.dumps(g))
    dci = B.DatacentreIndex(p)
    r = dci.bind({"headline": "Cobalt Park data centres to host new GPUs"})
    assert r["topic_datacentres"] and r["bindings"][0]["id"] == "dcuk-aaaa"
    assert r["bindings"][0]["entity_type"] == "DATA_CENTRE" and "ref" not in r["bindings"][0]
    assert dci.bind({"headline": "Hertfordshire solar farm approved"})["bindings"] == []
    assert "dcuk-bbbb" not in dci.sites
