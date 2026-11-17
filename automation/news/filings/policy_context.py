"""Offline, bounded GOV.UK policy facts; never project compliance or connectivity."""
from __future__ import annotations

from datetime import datetime
from hashlib import sha256
import re

from .documents import BoundedHTML, day

SOURCE = 'https://www.gov.uk/government/publications/data-centre-covenant/the-data-centre-covenant'
OGL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
HEADINGS = (
    ('energy', '1. Lower electricity bills', 'Energy-system costs, clean power and flexibility'),
    ('community', '2. Invest in improving local communities', 'Benefits for host communities'),
    ('environment', '3. Adhere to the highest environmental standards', 'Energy, water and heat-reuse context'),
    ('jobs', '4. Create jobs, apprenticeships, and drive reindustrialisation', 'Jobs, skills and supply chains'),
    ('resilience', '5. Strengthen Britain’s security', 'Reliable infrastructure and resilience'),
)


def extract_covenant(payload: bytes, *, source_url: str, retrieved_at: str) -> dict:
    """Extract only the named document; output retains locators and policy scope."""
    if source_url != SOURCE:
        raise ValueError('source_not_approved')
    if not isinstance(payload, bytes) or not 100 <= len(payload) <= 250_000:
        raise ValueError('document_size_bound')
    retrieved = datetime.fromisoformat(retrieved_at.replace('Z', '+00:00'))
    if retrieved.tzinfo is None:
        raise ValueError('retrieval_requires_timezone')
    parser = BoundedHTML()
    parser.feed(payload.decode('utf-8', errors='strict'))
    mains = [n for n in parser.root.walk() if n.tag == 'main' and n.attrs.get('id') == 'content']
    if len(mains) != 1:
        raise ValueError('one_main_required')
    nodes = list(mains[0].walk())
    if [n.text() for n in nodes if n.tag == 'h1'] != ['The Data Centre Covenant']:
        raise ValueError('wrong_document_title')
    dates = [n.text().removeprefix('Published ') for n in nodes if n.tag == 'p' and n.text().startswith('Published ')]
    if len(dates) != 1 or day(dates[0])['value'] != '2026-10-28':
        raise ValueError('publication_date_unavailable')
    publishers = [n.attrs.get('content') for n in parser.root.walk() if n.tag == 'meta' and n.attrs.get('name') == 'govuk:primary-publishing-organisation']
    if publishers != ['HM Treasury']:
        raise ValueError('publisher_missing_or_ambiguous')
    if retrieved.date().isoformat() < '2026-10-28':
        raise ValueError('publication_after_retrieval')
    links = {n.attrs.get('href') for n in parser.root.walk() if n.tag == 'a'}
    if not any(isinstance(link, str) and link.rstrip('/') == OGL.rstrip('/') for link in links):
        raise ValueError('licence_link_unavailable')
    headings = []
    for theme, expected, label in HEADINGS:
        found = [n for n in nodes if n.tag == 'h2' and n.text() == expected]
        if len(found) != 1:
            raise ValueError('policy_heading_missing_or_ambiguous')
        node = found[0]
        headings.append({'id': theme, 'label': label, 'locator': node.selector(),
                         'text_sha256': sha256(node.text().encode()).hexdigest(),
                         'fragment': node.attrs.get('id')})
    paragraphs = [n for n in nodes if n.tag == 'p']
    quantities = []
    for name, expression, value, unit, meaning in (
        ('national_ai_capacity', r'\b6\s+GW\b.*\b2030\b', '6', 'GW', 'Government estimate of national AI data-centre capacity required by 2030; not existing capacity'),
        ('new_facility_pue', r'Power Usage Effectiveness of 1\.3 or better', '1.3', 'ratio', 'Policy design expectation for new facilities; not a measured project efficiency'),
    ):
        found = [n for n in paragraphs if re.search(expression, n.text())]
        if len(found) != 1:
            raise ValueError('policy_quantity_missing_or_ambiguous')
        node = found[0]
        quantities.append({'id': name, 'value': value, 'unit': unit, 'meaning': meaning,
                           'locator': node.selector(), 'text_sha256': sha256(node.text().encode()).hexdigest()})
    return {'schema': 'globalgrid2050.energy-policy-context.v1', 'title': 'The Data Centre Covenant',
            'publisher': 'HM Treasury', 'source_url': SOURCE, 'source_sha256': sha256(payload).hexdigest(),
            'source_bytes': len(payload), 'retrieved_at': retrieved_at,
            'published_date': {'value': '2026-10-28', 'precision': 'DAY'},
            'rights': {'licence_url': OGL, 'scope': 'government_authored_facts_only_no_images_or_third_party_material', 'review_state': 'REVIEW_REQUIRED'},
            'themes': headings, 'quantities': quantities,
            'scope': 'NATIONAL_POLICY_CONTEXT_ONLY', 'project_compliance': None,
            'asset_associations': [], 'connections': [], 'available_capacity': None}
