from automation.news.filings.policy_context import HEADINGS, OGL, SOURCE, extract_covenant
import pytest


def document(extra=''):
    headings = ''.join(f'<h2 id="{key}">{text}</h2>' for key, text, _ in HEADINGS)
    return ('<meta name="govuk:primary-publishing-organisation" content="HM Treasury">'
            '<main id="content"><h1>The Data Centre Covenant</h1>'
            '<p>Published 28 October 2026</p>'
            f'<a href="{OGL}">Licence</a>{headings}'
            '<p>The Government estimates 6 GW of AI data centre capacity by 2030.</p>'
            '<p>New facilities should achieve a Power Usage Effectiveness of 1.3 or better.</p>'
            f'{extra}</main>').encode()


def extract(data=None, **changes):
    return extract_covenant(document() if data is None else data,
                            **{'source_url': SOURCE, 'retrieved_at': '2026-11-18T00:00:00Z', **changes})


def test_typed_policy_quantities_never_become_project_capacity_or_compliance():
    result = extract()
    assert len(result['themes']) == 5
    assert [(q['value'], q['unit']) for q in result['quantities']] == [('6', 'GW'), ('1.3', 'ratio')]
    assert result['quantities'][1]['comparison'] == 'AT_MOST'
    assert '1.3 or better' in result['quantities'][1]['meaning']
    assert result['published_date'] == {'value': '2026-10-28', 'precision': 'DAY'}
    assert result['project_compliance'] is result['available_capacity'] is None
    assert result['connections'] == result['asset_associations'] == []
    assert result['rights']['review_state'] == 'REVIEW_REQUIRED'


@pytest.mark.parametrize('url', [SOURCE + '?spoof=1', SOURCE.replace('gov.uk', 'evil.test'), 'file:///policy'])
def test_unapproved_source_refused(url):
    with pytest.raises(ValueError, match='source_not_approved'):
        extract(source_url=url)


@pytest.mark.parametrize('data', [b'', b'x' * 250001, document().replace(b'The Data Centre Covenant', b'Other policy'), document().replace(b'1.3 or better', b'1.2 or better'), document().replace(b'28 October 2026', b'28 October 2027'), document().replace(OGL.encode(), b'https://evil.test'), document().replace(b'HM Treasury', b'Other authority')])
def test_missing_or_changed_evidence_fails_closed(data):
    with pytest.raises(ValueError):
        extract(data)


def test_duplicate_quantities_and_headings_are_not_silently_selected():
    for extra in ['<p>Power Usage Effectiveness of 1.3 or better</p>', '<h2>1. Lower electricity bills</h2>']:
        with pytest.raises(ValueError, match='ambiguous'):
            extract(document(extra))


def test_hidden_script_text_cannot_supply_policy_quantity():
    data = document().replace(b'<p>The Government estimates 6 GW of AI data centre capacity by 2030.</p>', b'<script>6 GW by 2030</script>')
    with pytest.raises(ValueError, match='quantity_missing'):
        extract(data)


def test_timestamp_and_publication_order():
    for timestamp in ['2026-10-27T10:00:00Z', '2026-11-18T00:00:00']:
        with pytest.raises(ValueError):
            extract(retrieved_at=timestamp)
