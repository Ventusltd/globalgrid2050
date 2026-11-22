"""COP31 news-priority contract: international diplomacy is not an REPD fact."""
import json
from pathlib import Path
import sys
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import pipeline_headlines as P
from automation.news import news_algorithm as N

NOW="2026-11-22T00:12:00Z"
BBC="https://www.bbc.co.uk/news/articles/c6ly5w40eg07o"
TITLE="Fight over fossil fuels leaves COP31 climate talks in deadlock"
FEED={"source":"BBC News","url":"https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
      "uk_only":True,"lane":"keywords","primary":True}
REPD=P.Repd([])


@pytest.mark.parametrize("headline,level",[
    (TITLE,2),
    ("COP31 summit agrees new fossil fuel transition language",2),
    ("Cop 31 climate finance commitments disputed by negotiators",2),
    ("COP32 climate talks end with emissions deal",1),
    ("UN climate summit agrees new coal phase-out timetable",1),
    ("COP31 solar flare observations released",0),
    ("COP31 football fans fly to Turkey",0),
    ("Climate change makes spring flowers bloom early",0),
    ("French energy firm approves a solar farm",0),
])
def test_bounded_climate_policy_detection(headline,level):
    assert P.climate_policy_priority(headline)==level


def test_bbc_fossil_fuels_story_kept_without_solar_or_data_centre():
    assert P.topics_of(TITLE)==[]
    assert P.category_of(TITLE)=="policy"
    assert P.label(TITLE,REPD)==("policy",None,None)
    assert P.priority_label(TITLE,"",REPD) is None  # normal BBC lane needs no bypass here
    def fetch(url):
        assert url==FEED["url"]
        xml=("<rss><channel><item><title>"+TITLE+"</title><link>"+BBC+
             "</link><pubDate>Sat, 21 Nov 2026 07:31:05 GMT</pubDate>"+
             "</item></channel></rss>")
        return xml.encode()
    items,health=P.collect([FEED],fetch,REPD,NOW)
    assert len(items)==1
    assert items[0]["title"]==TITLE
    assert items[0]["category"]=="policy"
    assert items[0]["possible_match"] is None
    assert items[0]["technology"] is None
    assert health[0]["kept"]==1


def test_global_cop_policy_not_discarded_as_foreign_or_unknown_repd():
    other={"url":"https://www.un.org/en/climatechange/news.rss",
           "source":"United Nations","uk_only":False}
    def fetch(_):
        return ("<rss><channel><item><title>"
                "COP31 climate deal faces fossil fuel opposition in Turkey"
                "</title><link>https://www.un.org/en/climatechange/negotiations</link>"
                "</item></channel></rss>").encode()
    found,_=P.collect([other],fetch,REPD,NOW)
    assert len(found)==1 and found[0]["possible_match"] is None
    assert found[0]["category"]=="policy"


def test_curated_owner_link_publishes_without_fetching_article_body():
    feeds=json.loads((ROOT/"pipeline_feeds.json").read_text())["feeds"]
    special=[x for x in feeds if x["url"]==BBC]
    assert len(special)==1
    assert special[0]["kind"]=="curated"
    assert special[0]["source"]=="BBC News"
    assert len(feeds)==69
    def forbidden(_):
        raise AssertionError("BBC article body must never be requested")
    items,health=P.collect(special,forbidden,REPD,NOW)
    assert len(items)==1 and len(health)==1 and health[0]["status"]=="ok"
    assert items[0]["link"]==BBC
    assert items[0]["category"]=="policy"
    assert items[0]["possible_match"] is None
    assert items[0]["date"].startswith("2026-11-21T07:31")


def article(title,url,source="BBC News",category="policy"):
    return {"title":title,"link":url,"source":source,
            "date":"2026-11-21T07:31:05Z","first_seen":NOW,
            "category":category,"technology":None,"possible_match":None}


def test_cop31_ranks_above_standard_news_without_inventing_verification():
    items=[
      article("UK solar farm approved in Gloucestershire",
              "https://www.gov.uk/government/news/solar-decision","GOV.UK","consent"),
      article(TITLE,BBC)
    ]
    rows=N.rank_headlines(items,as_of=NOW)["items"]
    assert rows[0]["link"]==BBC
    assert rows[0]["editorial"]["components"]["cop31_climate_policy"]==75
    assert rows[0]["editorial"]["category_hint"]=="policy"
    assert rows[0]["editorial"]["topics"]==[]
    assert rows[0]["editorial"]["verification_status"]=="NOT_VERIFIED"
    assert rows[0]["possible_match"] is None
    assert rows[1]["editorial"]["components"]["cop31_climate_policy"]==0


def test_rejected_publisher_and_general_climate_headlines_remain_rejected():
    assert P.excluded_publisher("Solar Power Portal","https://www.solarpowerportal.co.uk/solar/")
    assert P.category_of("Climate causes warm November weather") is None
    assert P.category_of("COP31 cultural festival opens in Antalya") is None
