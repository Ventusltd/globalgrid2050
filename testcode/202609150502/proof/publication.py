"""Build or verify a byte manifest, including the shared Generator runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEPENDENCIES = ['../202609142225/core.js', '../202609142225/gl.js', '../202609142225/GRAMMAR.md']

def digest(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--base', help='Served URL of this stamped folder')
    parser.add_argument('--report')
    args = parser.parse_args()
    if not args.verify:
        files = {p.relative_to(ROOT).as_posix(): digest(p.read_bytes()) for p in sorted(ROOT.rglob('*'))
                 if p.is_file() and p.name != 'publication.json' and '__pycache__' not in p.parts}
        result = {'schema': 'public-byte-manifest-v1', 'files': files,
                  'dependencies': {name: digest((ROOT / name).read_bytes()) for name in DEPENDENCIES}}
        (ROOT / 'publication.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8', newline='\n')
        print(json.dumps({'pass': True, 'files': len(files), 'dependencies': len(DEPENDENCIES)}))
        return
    manifest_bytes = (ROOT / 'publication.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    report = {'pass': False, 'checked': []}
    try:
        if args.base:
            with urllib.request.urlopen(args.base.rstrip('/')+'/publication.json', timeout=60) as r:
                if r.read() != manifest_bytes:
                    raise ValueError('Served manifest differs from the committed manifest')
        for name, expected in {**manifest['files'], **manifest['dependencies']}.items():
            data = (ROOT / name).read_bytes()
            if digest(data) != expected:
                raise ValueError(f'Committed bytes differ: {name}')
            if args.base:
                with urllib.request.urlopen(args.base.rstrip('/')+'/'+name, timeout=60) as r:
                    if r.read() != data:
                        raise ValueError(f'Served bytes differ: {name}')
            report['checked'].append({'file': name, **expected})
        report['pass'] = True
    except Exception as error:
        report['error'] = str(error)
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    if not report['pass']:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
