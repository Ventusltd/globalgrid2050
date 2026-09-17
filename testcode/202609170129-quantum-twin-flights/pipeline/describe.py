"""Step DESCRIBE: a plain-English note for every atlas line, by fixed rules (no model). Writes describe.json
{key: note}. The same rules live in the pilot (describeLine) so the card and the record agree. Deterministic."""
import json, os, re, sys, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub'))
RULES = [
 (r'^\s*$', 'blank line'), (r'^\s*//', 'a comment'), (r'^\s*/\*|^\s*\*', 'a comment block'),
 (r'^\s*(import|export)\b', 'brings code in or out of this file'), (r'^\s*(async\s+)?function\s+(\w+)', 'defines the function {2}'),
 (r'^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(?[^=]*=>', 'defines the function {2}'), (r'^\s*(const|let|var)\s+(\w+)\s*=', 'sets {2}'),
 (r'\.addEventListener\(\s*[\'"](\w+)', 'listens for a {1} on the page'), (r'^\s*return\b', 'hands a result back'), (r'^\s*if\b', 'decides: only when the condition holds'),
 (r'^\s*(else|\} else)', 'otherwise'), (r'^\s*for\b|^\s*while\b', 'repeats for each item'), (r'^\s*try\b', 'tries, ready to catch a failure'), (r'^\s*catch\b|\} catch', 'handles a failure'),
 (r'\.(querySelector|getElementById)\(', 'finds a part of the page'), (r'\.innerHTML\s*=|\.textContent\s*=', 'writes text onto the page'), (r'\bfetch\(', 'asks a server for data'),
 (r'\bclassList\.', 'changes how a part of the page looks'), (r'\bconsole\.', 'writes to the developer console'), (r'\bthrow\b', 'stops with an error'),
 (r'^\s*\}\s*\)?;?\s*$|^\s*\]\s*;?\s*$', 'closes a block'), (r'^\s*(\w+)\s*\(.*\)\s*;?\s*$', 'calls {1}'), (r'\bawait\b', 'waits for a result'), (r'=', 'sets a value'),
]
def describe(line):
    for pat, note in RULES:
        m = re.search(pat, line)
        if m:
            try: return note.format(*m.groups())
            except Exception: return note
    return 'a line of code'
if __name__ == '__main__':
    K = json.load(open(os.path.join(ROOT, 'keys.json'), encoding='utf-8'))
    R = json.load(open(os.path.join(ROOT, 'route-gridatlas.json'), encoding='utf-8'))
    want = set(R['keys']); out = {}; cache = {}; missing = 0
    for i, k in enumerate(K['keys']):
        if k not in want: continue
        pl = K['places'][K['place'][i]]; repo, commit, path = pl; ln = K['line'][i]; clone = os.path.join(GH, repo.split('/')[1])
        ck = (repo, commit, path)
        if ck not in cache:
            r = subprocess.run(['git', '-C', clone, 'show', f'{commit}:{path}'], capture_output=True)
            cache[ck] = r.stdout.decode('utf-8', 'replace').split('\n') if r.returncode == 0 else None
        lines = cache[ck]
        if not lines or ln > len(lines): missing += 1; continue
        out[str(k)] = describe(lines[ln - 1])
    if not out: sys.exit('FAIL: nothing described')
    json.dump({'rule_count': len(RULES), 'described': len(out), 'missing': missing, 'notes': out}, open(os.path.join(ROOT, 'describe.json'), 'w'), separators=(',', ':'))
    kinds = {}
    for v in out.values(): kinds[v.split(' ')[0]] = kinds.get(v.split(' ')[0], 0) + 1
    print(json.dumps({'step': 'describe', 'described': len(out), 'missing': missing, 'top': sorted(kinds.items(), key=lambda x: -x[1])[:6]}))
