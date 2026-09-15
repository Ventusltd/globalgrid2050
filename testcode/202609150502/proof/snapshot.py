"""Pin already-public Sun owner files; no collectors or private inputs live here."""
import argparse
import hashlib
import json
import pathlib
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    if len(args.commit) != 40 or any(c not in '0123456789abcdef' for c in args.commit):
        raise ValueError('A full public source commit is required')
    files = {}
    (ROOT / 'data').mkdir(exist_ok=True)
    for name in ['uk-solar.json', 'today.json', 'provenance.json']:
        url = f'https://raw.githubusercontent.com/Ventusltd/star-solar-star/{args.commit}/sun/{name}'
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        json.loads(data)
        dest = 'sun-provenance.json' if name == 'provenance.json' else name
        (ROOT / 'data' / dest).write_bytes(data)
        files[dest] = {'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    result = {'schema': 'uk-solar-snapshot-v1', 'source_commit': args.commit,
              'fetched_utc': datetime.now(timezone.utc).isoformat(), 'files': files,
              'source_provenance': 'sun-provenance.json',
              'grammar_commit': '1e8424f947399c67f61836c51393b6cb73995d5b',
              'grammar_sha256': '53a290e62c1f47b5d621899623b0c048a29d45d77d6f7464bfc757900eb79ecb'}
    (ROOT / 'data/provenance.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'pass': True, 'source_commit': args.commit, 'files': files}, indent=2))

if __name__ == '__main__':
    main()
