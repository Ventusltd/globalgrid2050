"""Render the stable homepage from its reviewed navigation configuration.

Run normally after changing catalogue/site-navigation.json; --check never writes.
The archive catalogue is independent and cannot add front-page nests.
"""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

def render(config):
    if config.get('schema_version') != 1:
        raise ValueError('Unsupported navigation schema')
    nests = config['nests']
    ids = [n['id'] for n in nests]
    if not nests or len(ids) != len(set(ids)):
        raise ValueError('Nest IDs must be nonempty and unique')
    esc = lambda value: html.escape(value, quote=True)
    def url(value):
        parsed = urlsplit(value)
        if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError('Navigation requires a full HTTPS URL without credentials')
        return esc(value)
    rows = []
    for i, n in enumerate(nests, 1):
        if not re.fullmatch(r'[a-z][a-z0-9-]*', n['id']):
            raise ValueError('Invalid nest ID')
        if not isinstance(n['open'], bool):
            raise ValueError('open must be a boolean')
        opened = ' open' if n['open'] else ''
        rows.append(f'<details id="{esc(n["id"])}"{opened}><summary><span class="number">{i:02}</span><span class="title">{esc(n["title"])}<small>{esc(n["subtitle"])}</small></span></summary><div class="inside"><p>{esc(n["description"])}</p><a class="launch" href="{url(n["url"])}">{esc(n["label"])} &rarr;</a></div></details>')
    template = (ROOT / 'scripts/homepage.template.html').read_text(encoding='utf-8')
    return template.replace('{{NESTS}}', '\n'.join(rows)).replace('{{ARCHIVE_URL}}', url(config['archive']['url'])).replace('{{ARCHIVE_LABEL}}', esc(config['archive']['label']))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    output = render(json.loads((ROOT / 'catalogue/site-navigation.json').read_text(encoding='utf-8')))
    target = ROOT / 'index.html'
    if args.check:
        if target.read_text(encoding='utf-8') != output:
            raise SystemExit('Homepage differs from configuration: run python scripts/render_site_navigation.py')
        print('Homepage matches navigation configuration')
    else:
        target.write_text(output, encoding='utf-8', newline='\n')
        print('Rendered index.html')
