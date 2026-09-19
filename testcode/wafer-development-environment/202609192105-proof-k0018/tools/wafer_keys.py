#!/usr/bin/env python3
"""tools/wafer_keys.py - issue every line ever written its key, in the order time issued it.

THE RINGS ARE TIME. The CPU wafer is beautiful because of its dark rings, and those rings are
numbers that were never issued. This estate has a measured source of exactly that: silence. Every
commit in every repository is put in one order, by its own timestamp, and before each commit a run
of keys is left UNISSUED in proportion to the time since the commit before it. A night is a dark
ring. A fortnight away is a wide one. Nothing is drawn in: the rings are commit times.

    issued keys      one per line in every file in every commit. Their count is the measurement.
    unissued keys    GAP_KEYS_PER_SECOND x the seconds of silence, capped at CAP_SECONDS.

GAP_KEYS_PER_SECOND is a DECLARED CONSTANT, frozen here. It is not fitted on each run, because a
constant that moved whenever a commit arrived would move every key after it.

A line not yet written already has its place: the next issued key, on the rim. That is what makes
the surface unbounded rather than merely large, and it is the same property RAM has: the address
exists before anything is stored at it.

Reads   cosmos/belt.tsv, cosmos/commits/NN.tsv          (measured, redacted where not public)
Writes  cosmos/wafer.tsv   unix  lines  repo_index  sha12  gap_before     in time order
        cosmos/wafer-meta.json
and refuses if the commits do not sum to the belt, or the belt to itself.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COSMOS = os.path.join(HERE, '..', 'cosmos')

GAP_KEYS_PER_SECOND = 600         # declared, frozen. About three tenths of the wafer is silence.
CAP_SECONDS = 14 * 86400          # no silence counts for more than a fortnight


def rows(path):
    return [l.rstrip('\n').split('\t') for l in io.open(path, encoding='utf-8')
            if l.strip() and not l.startswith('#')]


def main():
    belt = [(p[0], int(p[1])) for p in rows(os.path.join(COSMOS, 'belt.tsv'))]
    commits = []
    for i, (name, lines) in enumerate(belt):
        path = os.path.join(COSMOS, 'commits', '%02d.tsv' % i)
        if not os.path.exists(path):
            if lines:
                print('REFUSED: %s holds lines and has no commit shard' % name)
                return 2
            continue
        shard = [(int(p[0]), int(p[1]), p[3]) for p in rows(path)]
        if sum(c[1] for c in shard) != lines:
            print('REFUSED: shard %02d sums to %d, belt says %d' % (i, sum(c[1] for c in shard), lines))
            return 2
        commits += [(unix, n, i, sha) for unix, n, sha in shard if n > 0]

    commits.sort(key=lambda c: (c[0], c[2], c[3]))            # time, then a stable tiebreak
    issued = sum(c[1] for c in commits)
    if issued != sum(l for _, l in belt):
        print('REFUSED: commits hold %d lines, belt holds %d' % (issued, sum(l for _, l in belt)))
        return 2

    out, unissued, prev = [], 0, None
    for unix, n, i, sha in commits:
        gap = 0 if prev is None else GAP_KEYS_PER_SECOND * min(max(unix - prev, 0), CAP_SECONDS)
        unissued += gap
        out.append('%d\t%d\t%d\t%s\t%d' % (unix, n, i, sha, gap))
        prev = unix

    with io.open(os.path.join(COSMOS, 'wafer.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# unix\tlines\trepo_index\tsha12\tgap_before\n' + '\n'.join(out) + '\n')
    with io.open(os.path.join(COSMOS, 'repos.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# repo_index\tname\tlines\n'
                + '\n'.join('%d\t%s\t%d' % (i, n, l) for i, (n, l) in enumerate(belt)) + '\n')
    meta = {'issued_keys': issued, 'unissued_keys': unissued, 'address_space': issued + unissued,
            'silence_share': round(unissued / (issued + unissued), 4), 'commits': len(commits),
            'repositories': len(belt), 'first_unix': commits[0][0], 'last_unix': commits[-1][0],
            'gap_keys_per_second': GAP_KEYS_PER_SECOND, 'cap_seconds': CAP_SECONDS,
            'law': 'r = sqrt(key), theta = 2 pi frac(key x 2654435769 / 2^32)'}
    json.dump(meta, io.open(os.path.join(COSMOS, 'wafer-meta.json'), 'w', encoding='utf-8',
                            newline='\n'), indent=1)
    print(json.dumps(meta, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
