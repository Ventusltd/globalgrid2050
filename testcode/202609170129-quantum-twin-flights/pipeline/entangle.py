"""Step ENTANGLE: is every code block on the wafer still coupled to its twin?
For each key: twin = (repo, commit, path, line). Fetch that exact line from the local clone at that commit,
hash it, and record whether the pair holds. A pair is BROKEN if the clone lacks the commit/path or the line
does not exist. Deterministic; writes entangle.json. Reads nothing but git objects and keys.json."""
import json, os, sys, subprocess, hashlib, collections, time, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GITHUB = os.environ.get('GITHUB_DIR', os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')))
K = json.load(open(os.path.join(ROOT, 'keys.json'), encoding='utf-8'))
by_place = collections.defaultdict(list)
for i, pi in enumerate(K['place']):
    if pi is not None and pi >= 0: by_place[pi].append(i)
t0 = time.time(); hashes = [None] * len(K['keys']); broken = []; reasons = collections.Counter(); per_repo = collections.defaultdict(lambda: [0, 0])
for pi, idxs in by_place.items():
    repo, commit, path = K['places'][pi]; clone = os.path.join(GITHUB, repo.split('/')[1])
    text = None; reason = None
    if not os.path.isdir(clone): reason = 'no local clone'
    else:
        if not re.fullmatch(r'[0-9a-f]{7,40}', str(commit)) or str(path).startswith('-'): r = None
        else: r = subprocess.run(['git', '-C', clone, 'show', f'{commit}:{path}'], capture_output=True)
        if r is not None and r.returncode == 0:
            text = r.stdout.decode('utf-8', 'replace').split('\n')
            if text and text[-1] == '': text.pop()
        else: reason = 'commit or path missing in clone'
    for i in idxs:
        per_repo[repo][0] += 1; ln = K['line'][i]
        if text is None: broken.append(K['keys'][i]); reasons[reason] += 1; continue
        if not ln or ln > len(text): broken.append(K['keys'][i]); reasons['line beyond file end'] += 1; continue
        hashes[i] = hashlib.sha1(text[ln - 1].strip().encode('utf-8')).hexdigest()[:10]; per_repo[repo][1] += 1
resolved = sum(1 for h in hashes if h)
out = {'generated_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'keys': len(K['keys']), 'places': len(by_place), 'resolved': resolved, 'broken': len(broken),
       'rate': round(resolved / len(K['keys']), 5), 'reasons': dict(reasons), 'per_repo': {r: {'keys': v[0], 'resolved': v[1]} for r, v in sorted(per_repo.items())},
       'broken_keys': broken, 'hash': hashes}
if out['rate'] < 0.95: print(json.dumps({'step': 'entangle', 'rate': out['rate'], 'broken': len(broken), 'reasons': dict(reasons)})); sys.exit('FAIL: fewer than 95% of pairs hold; entangle.json not written')
json.dump(out, open(os.path.join(ROOT, 'entangle.json'), 'w'), separators=(',', ':'))
print(json.dumps({'step': 'entangle', 'keys': len(K['keys']), 'places': len(by_place), 'resolved': resolved, 'broken': len(broken), 'rate': out['rate'], 'reasons': dict(reasons), 'seconds': round(time.time() - t0, 1)}))
if resolved == 0: sys.exit('FAIL: no twin could be reached')
