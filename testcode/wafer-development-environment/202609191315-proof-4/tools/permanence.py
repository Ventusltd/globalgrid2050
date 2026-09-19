#!/usr/bin/env python3
"""tools/permanence.py - did the lines written since this morning move any address issued before?

THE CLAIM. Keys are issued in the order time issued the commits, with a frozen constant for
silence. So a commit made later lands beyond the rim, and nothing that already had an address
moves. If that is true the wafer measures the future without rewriting the past, the way new data
is appended to a disk without moving what is already on it.

THE TEST, on real data and able to fail. An earlier measurement of the estate is still in git: the
belt and commit shards as they were committed in Ventusltd/cosmic. Keys are rebuilt from that older
measurement with the same law, and every commit present in both is compared:

    same address then and now  ->  kept
    different address          ->  MOVED, and the first few are printed

It fails if anything with an old timestamp arrived late: a fetch that brought in older history, a
rebase, a clock that was wrong. Those are real and this is how they would show.

    python tools/permanence.py d672e69
"""
import io
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wafer_keys import GAP_KEYS_PER_SECOND, CAP_SECONDS   # the same frozen constants, imported

COSMIC = os.path.join(HERE, '..', '..', 'cosmic')
COSMOS = os.path.join(HERE, '..', 'cosmos')


def show(rev, path):
    r = subprocess.run(['git', 'show', '%s:%s' % (rev, path)], cwd=COSMIC, capture_output=True)
    return r.stdout.decode('utf-8', 'replace') if r.returncode == 0 else None


def parse(text):
    return [l.split('\t') for l in text.split('\n') if l.strip() and not l.startswith('#')]


def keys_from(commits):
    """commits: (unix, lines, tiebreak, sha12). Returns sha12 -> first address, and the totals."""
    commits.sort(key=lambda c: (c[0], c[2], c[3]))
    out, k, prev = {}, 0, None
    for unix, n, _, sha in commits:
        if prev is not None:
            k += GAP_KEYS_PER_SECOND * min(max(unix - prev, 0), CAP_SECONDS)
        out[sha] = k
        k += n
        prev = unix
    return out, k


def main():
    rev = sys.argv[1] if len(sys.argv) > 1 else 'd672e69'
    when = subprocess.run(['git', 'log', '-1', '--format=%cI', rev], cwd=COSMIC,
                          capture_output=True, text=True).stdout.strip()
    belt = parse(show(rev, 'belt.tsv') or '')
    if not belt:
        print('REFUSED: no belt.tsv at %s' % rev)
        return 2
    old = []
    for i in range(len(belt)):
        t = show(rev, 'commits/%02d.tsv' % i)
        if t:
            old += [(int(p[0]), int(p[1]), 0, p[3]) for p in parse(t) if int(p[1]) > 0]
    old_keys, old_space = keys_from(old)

    now = [(int(p[0]), int(p[1]), 0, p[3])
           for p in parse(io.open(os.path.join(COSMOS, 'wafer.tsv'), encoding='utf-8').read())]
    now_keys, now_space = keys_from(now)

    shared = [s for s in old_keys if s in now_keys]
    moved = [s for s in shared if old_keys[s] != now_keys[s]]
    gone = [s for s in old_keys if s not in now_keys]
    new = [s for s in now_keys if s not in old_keys]
    new_lines = sum(c[1] for c in now if c[3] in set(new))
    res = {'earlier_measurement': rev, 'committed': when,
           'commits_then': len(old_keys), 'commits_now': len(now_keys),
           'in_both': len(shared), 'kept_their_address': len(shared) - len(moved),
           'MOVED': len(moved), 'no_longer_present': len(gone),
           'arrived_since': len(new), 'lines_arrived_since': new_lines,
           'address_space_then': old_space, 'address_space_now': now_space,
           'rim_moved_outward_by_keys': now_space - old_space,
           'first_moved': [(s, old_keys[s], now_keys[s]) for s in moved[:5]]}
    print(json.dumps(res, indent=1))
    json.dump(res, io.open(os.path.join(COSMOS, 'permanence.json'), 'w', encoding='utf-8',
                           newline='\n'), indent=1)
    return 1 if moved else 0


if __name__ == '__main__':
    sys.exit(main())
