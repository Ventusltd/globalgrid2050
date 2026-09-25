"""Publish only the hash-pinned small homepage bundle from its confirmed owner."""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {'index.html', 'assets/versioned-homepage.css', 'assets/versioned-homepage.js', 'data/homepage.json', 'data/active-pages.json', 'data/presentation.json', 'data/entity-types.json'}

def main():
    pin = json.loads((ROOT/'catalogue/homepage-owner.json').read_text(encoding='utf-8'))
    if pin['repository'] != 'Ventusltd/globalgrid2050-homepage' or not re.fullmatch('[0-9a-f]{40}', pin['commit']):
        raise ValueError('Unexpected homepage owner or unpinned commit')
    if set(pin['files']) != FILES:
        raise ValueError('Unexpected homepage bundle files')
    bundle = {}
    for name, digest in pin['files'].items():
        url = f'https://raw.githubusercontent.com/{pin["repository"]}/{pin["commit"]}/{name}'
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read(1000001)
        if len(data) > 1000000 or hashlib.sha256(data).hexdigest() != digest:
            raise ValueError(f'Homepage size/hash mismatch: {name}')
        bundle[name] = data
    if sum(map(len, bundle.values())) >= 1000000:
        raise ValueError('Homepage bundle exceeds 1 MB')
    config = json.loads(bundle['data/homepage.json'].decode('utf-8-sig'))
    if config.get('schema_version') != 1:
        raise ValueError('Unsupported owner catalogue')
    index = bundle.pop('index.html').decode('utf-8-sig')
    for name in ('versioned-homepage.css', 'versioned-homepage.js'):
        source = f'./assets/{name}'
        if index.count(source) != 1:
            raise ValueError(f'Unexpected index reference: {name}')
        index = index.replace(source, f'./homepage-shell/assets/{name}')
    # All remote inputs are verified before any output changes. Site promotion is
    # performed by Pages after the complete build, not while these files write.
    for name, data in bundle.items():
        target = ROOT/'homepage-shell'/name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (ROOT/'index.html').write_text(index.rstrip() + '\n', encoding='utf-8', newline='\n')
    print(f'Imported verified homepage {pin["commit"]}: {len(FILES)} files')

if __name__ == '__main__':
    main()
