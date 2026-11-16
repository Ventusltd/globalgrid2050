"""Network-free failure gates and identity regression tests for V9.25."""
import hashlib
import json
from pathlib import Path

import pytest
import requests
import yaml

from automation.news.acquisition.fetch import FetchError, MAX_BYTES, fetch_source, load_sources, parse_feed
from automation.news.acquisition.match import match_articles
from automation.news.acquisition.normalise import normalise_article
from automation.news.acquisition.research_queue import ROOT, load_seed_projects


SOURCE = load_sources(include_disabled=True)[0]
RSS = b'''<?xml version="1.0"?><rss version="2.0"><channel><item>
<title>Solar Farm A plans approved</title><link>https://www.pv-magazine.com/example/</link>
<pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>A proposal.</p>]]></description>
</item></channel></rss>'''


class Response:
    def __init__(self, status=200, body=RSS, headers=None):
        self.status_code, self.body, self.headers = status, body, headers or {}
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def iter_content(self, size):
        for i in range(0, len(self.body), size):
            yield self.body[i:i + size]


class Session:
    def __init__(self, *responses):
        self.responses, self.calls = iter(responses), []
    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        value = next(self.responses)
        if isinstance(value, Exception):
            raise value
        return value


def test_exact_unchanged_selection_and_all_repd_rows():
    projects = load_seed_projects()
    seed = json.loads((ROOT / 'uk_renewables_pipeline/202611161244/solar1000/manifest.json').read_text())
    assert len(projects) == 1000
    assert [p['id'] for p in projects] == seed['ids']
    assert all(p['technology'] == 'solar' for p in projects)


def test_seed_tamper_is_fatal(tmp_path):
    release = tmp_path / 'uk_renewables_pipeline/202611161244/solar1000'
    release.mkdir(parents=True)
    (release / 'manifest.json').write_text('{"ids": []}')
    with pytest.raises(ValueError, match='Immutable'):
        load_seed_projects(tmp_path)


@pytest.mark.parametrize('change', [
    {'url': 'http://www.pv-magazine.com/feed/'}, {'url': 'https://127.0.0.1/feed/'},
    {'url': 'https://www.pv-magazine.com:444/feed/'}, {'url': 'https://user@www.pv-magazine.com/feed/'},
    {'technology': ['solar', 'bess']}, {'enabled': 'true'}, {'output_policy': 'full_text'},
])
def test_source_configuration_fail_closed(tmp_path, change):
    p = tmp_path / 'sources.yaml'
    p.write_text(yaml.safe_dump([dict(SOURCE, **change)]))
    with pytest.raises(ValueError):
        load_sources(p)


def test_duplicate_sources_rejected(tmp_path):
    p = tmp_path / 'sources.yaml'
    p.write_text(yaml.safe_dump([SOURCE, SOURCE]))
    with pytest.raises(ValueError, match='Duplicate'):
        load_sources(p)


def test_normalise_strips_html_separates_date_and_body():
    article = normalise_article({'title': '<b>Solar</b> &amp; power<script>bad()</script>',
        'link': 'https://www.pv-magazine.com/article/#tracking',
        'pub_date': 'Mon, 16 Nov 2026 11:00:00 +0100', 'content': '<p>Body</p>'}, SOURCE)
    assert article['title'] == 'Solar & power'
    assert article['pub_date'] == '2026-11-16T10:00:00Z'
    assert article['url'] == 'https://www.pv-magazine.com/article/'
    assert article['content'] == 'Body'


def test_missing_date_is_not_replaced_with_fetch_date():
    with pytest.raises(ValueError):
        normalise_article({'title': 'title', 'url': 'https://www.pv-magazine.com/article/'}, SOURCE)


def test_fetch_receipt_and_conditional_request():
    session = Session(Response(headers={'ETag': 'v1'}), Response(304))
    first = fetch_source(SOURCE, session=session, probe=True)
    second = fetch_source(SOURCE, cache=first['cache'], session=session, probe=True)
    assert first['articles'] == second['articles']
    assert first['source']['response_sha256'] == hashlib.sha256(RSS).hexdigest()
    assert second['source']['http_status'] == 304
    assert session.calls[1][1]['headers']['If-None-Match'] == 'v1'
    assert session.calls[0][1]['timeout'] == (10, 25)


@pytest.mark.parametrize('response', [Response(403), Response(429), Response(500), Response(304),
    Response(body=b'<html>unavailable</html>'), Response(body=b'<rss><channel/></rss>'),
    Response(body=b'x' * (MAX_BYTES + 1)), requests.Timeout('timeout'),
    Response(302, headers={'Location': 'http://127.0.0.1/private'})])
def test_critical_source_failures_never_produce_success(response):
    with pytest.raises(FetchError):
        fetch_source(SOURCE, session=Session(response), probe=True)


def test_rights_unknown_disabled_by_default_and_probe_never_authorizes():
    assert load_sources() == []
    session = Session(Response())
    with pytest.raises(FetchError, match='disabled'):
        fetch_source(SOURCE, session=session)
    assert session.calls == []
    probe = fetch_source(SOURCE, session=session, probe=True)
    assert probe['source']['eligible_for_publication'] is False
    assert probe['source']['probe_only'] is True
    assert probe['source']['rights_status'] == 'unknown'


def test_enabled_source_requires_attributable_rights_acceptance(tmp_path):
    p = tmp_path / 'sources.yaml'
    p.write_text(yaml.safe_dump([dict(SOURCE, enabled=True)]))
    with pytest.raises(ValueError, match='rights acceptance'):
        load_sources(p)
    # A structural review URL is necessary, not independent proof of rights.
    accepted = dict(SOURCE, enabled=True, rights_status='accepted',
                    rights_review_url='https://example.org/review/accepted')
    p.write_text(yaml.safe_dump([accepted]))
    assert load_sources(p) == [accepted]
    receipt = fetch_source(accepted, session=Session(Response()))['source']
    assert receipt['eligible_for_publication'] is True
    assert receipt['rights_review_url'] == accepted['rights_review_url']


def test_xml_entity_rejected():
    with pytest.raises(FetchError):
        parse_feed(b'<!DOCTYPE rss [<!ENTITY x "unsafe">]><rss/>', SOURCE)


def test_strict_matching_rejects_bare_ids_partial_names_and_ambiguity():
    projects = [{'id': '1019', 'name': 'Solar Farm A'}, {'id': '1020', 'name': 'Solar Farm AB'},
                {'id': '2026', 'name': 'Manor Farm'}, {'id': '2027', 'name': 'Manor Farm'}]
    base = {'url': 'https://www.pv-magazine.com/article/'}
    matches = match_articles([dict(base, title='Solar Farm A plans approved in 2026')], projects)
    assert matches == [{'project_id': '1019', 'article_url': base['url'], 'status': 'PROVISIONAL', 'match_method': 'exact_name'}]
    assert not match_articles([dict(base, title='Manor Farm output increases in 2026')], projects)
    assert not match_articles([dict(base, title='Solar Farm ABC planning')], projects)
    assert match_articles([dict(base, title='REPD Ref ID: 2026 solar update')], projects)[0]['project_id'] == '2026'


def test_content_match_and_idempotent_results():
    article = {'title': 'Update', 'content': 'Solar Farm A is mentioned.', 'url': 'https://www.pv-magazine.com/a/'}
    result = match_articles([article, article], [{'id': '1019', 'name': 'Solar Farm A'}])
    assert len(result) == 1
    assert result[0]['status'] == 'PROVISIONAL'
