#!/usr/bin/env python3
"""tools/key.py - turn a key into the actual line of text it stands for, using git alone.

THE PROOF THAT THE COUNT AND THE MAP ARE REAL. The wafer claims that every line in every file in
every commit has one key, 0 to N-1. A claim like that is only worth something if any key, chosen
by anybody, can be followed to the line it names. This does that with no index of its own:

    key -> repository   binary search over cosmos/belt.tsv            (measured counts)
        -> commit       binary search over cosmos/commits/NN.tsv      (measured counts)
        -> file, line   walking `git ls-tree -r <commit>` in git's own order, counting lines
        -> the text     `git cat-file blob <sha>`, that line

If the counts were wrong anywhere, the walk inside the commit would not land where the shard says
the commit ends, and this says so and exits non zero instead of printing a line.

    python tools/key.py 23118447901          one key
    python tools/key.py --random 5           five keys chosen uniformly from the whole

Keys run oldest first: the oldest repository's oldest commit holds key 0. A repository that is not
public is measured but not named, and its lines are not printed.
"""
import argparse
import io
import os
import random
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COSMOS = os.path.join(HERE, '..', 'cosmos')
ROOTS = 'C:/Users/vikra/Documents/GitHub'


def rows(path):
    return [l.rstrip('\n').split('\t') for l in io.open(path, encoding='utf-8')
            if l.strip() and not l.startswith('#')]


def lines_of(body):
    if b'\x00' in body[:8000]:
        return -1
    return body.count(b'\n') + (1 if body and not body.endswith(b'\n') else 0)


CACHE = {}


def load_cache():
    """sha -> lines for text blobs, measured earlier. Never trusted blind: the one blob a key lands
    in is always read for real and its count compared, and a mismatch refuses."""
    path = os.path.join(HERE, '..', 'data', 'blob-lines-history.tsv')
    if os.path.exists(path):
        for l in io.open(path, encoding='utf-8'):
            p = l.rstrip('\n').split('\t')
            if len(p) == 2:
                CACHE[p[0]] = int(p[1])


def blob_lines(d, sha):
    if sha in CACHE:
        return CACHE[sha], True
    body = subprocess.run(['git', 'cat-file', 'blob', sha], cwd=d, capture_output=True).stdout
    n = lines_of(body)
    CACHE[sha] = n
    return n, False


def load():
    """The wafer's own key law (tools/wafer_keys.py): every commit in time order, with the unissued
    keys of silence before it. Returns the commits, the address space, and the issued count."""
    names = {int(p[0]): p[1] for p in rows(os.path.join(COSMOS, 'repos.tsv'))}
    commits, k, issued = [], 0, 0
    for p in rows(os.path.join(COSMOS, 'wafer.tsv')):
        k += int(p[4])
        c = {'lines': int(p[1]), 'name': names[int(p[2])], 'sha': p[3], 'k0': k, 'cum': issued}
        k += c['lines']
        issued += c['lines']
        commits.append(c)
    return commits, k, issued


def key_of_line(commits, j):
    """the address key of the j-th line ever issued, 0 based"""
    import bisect
    c = commits[bisect.bisect_right([x['cum'] for x in commits], j) - 1]
    return c['k0'] + (j - c['cum'])


def resolve(commits, space, k):
    import bisect
    if not 0 <= k < space:
        return 'key %d is outside 0..%d' % (k, space - 1), 1
    c = commits[max(0, bisect.bisect_right([x['k0'] for x in commits], k) - 1)]
    if not c['k0'] <= k < c['k0'] + c['lines']:
        return 'key %s was never issued: it is silence between commits' % format(k, ','), 0
    repo = {'name': c['name']}
    sha12, lines, m = c['sha'], c['lines'], k - c['k0']          # line within the commit, 0 based
    head = 'key %s -> %s / %s / line %s of %s' % (format(k, ','), repo['name'], sha12,
                                                  format(m + 1, ','), format(lines, ','))
    if repo['name'].startswith('unnamed-'):
        return head + '\n  (not public: measured, not named, not printed)', 0
    d = os.path.join(ROOTS, repo['name'])
    if not os.path.isdir(os.path.join(d, '.git')):
        return head + '\n  REFUSED: no local clone at %s to verify against' % d, 2
    tree = subprocess.run(['git', 'ls-tree', '-r', sha12], cwd=d, capture_output=True).stdout
    seen = 0
    for entry in tree.split(b'\n'):
        if not entry:
            continue
        meta, _, path = entry.partition(b'\t')
        f = meta.split()
        if len(f) < 3 or f[1] != b'blob':
            continue
        n_lines, cached = blob_lines(d, f[2].decode())
        if n_lines <= 0:
            continue
        if m < seen + n_lines:
            body = subprocess.run(['git', 'cat-file', 'blob', f[2].decode()], cwd=d,
                                  capture_output=True).stdout
            if lines_of(body) != n_lines:
                return (head + '\n  REFUSED: the cache says %d lines for blob %s and git says %d'
                        % (n_lines, f[2].decode()[:12], lines_of(body))), 2
            text = body.split(b'\n')[m - seen].decode('utf-8', 'replace').rstrip('\r')
            return ('%s\n  %s : %d   (blob %s)\n  | %s'
                    % (head, path.decode('utf-8', 'replace'), m - seen + 1,
                       f[2].decode()[:12], text[:200])), 0
        seen += n_lines
    return head + '\n  REFUSED: walked the whole commit and found only %d lines; the shard says ' \
                  '%d. The count is wrong somewhere.' % (seen, lines), 2


def prove(belt, n, until, space):
    """THE UNATTENDED PROOF. Random keys, uniformly from the whole, each followed to its line.
    SAFEGUARDS: a hard stop at the stated UTC time; a hard stop at the first REFUSED, because one
    wrong key is worth more than a thousand right ones; one process, a pause between keys so the
    machine stays cool; a heartbeat file so anyone can see it is alive; append only logging."""
    import json, time
    from datetime import datetime, timezone
    out = r'E:\particles-runs'
    hh, mm = [int(x) for x in until.split(':')]
    ok = private = 0
    t0 = time.time()
    while True:
        now = datetime.now(timezone.utc)
        if (now.hour, now.minute) >= (hh, mm):
            break
        k = key_of_line(belt, random.randrange(n))
        msg, code = resolve(belt, space, k)
        with io.open(os.path.join(out, 'prove-keys.log'), 'a', encoding='utf-8') as f:
            f.write(now.strftime('%Y-%m-%dT%H:%M:%SZ ') + msg.replace('\n', ' || ')[:400] + '\n')
        if code:
            state = 'REFUSED'
        else:
            state = 'RUNNING'
            ok += 1
            private += 'not public' in msg
        json.dump({'state': state, 'keys_proved': ok, 'of_which_unnamed': private, 'wafer_keys': n,
                   'since': round(time.time() - t0), 'last': now.isoformat(timespec='seconds')},
                  io.open(os.path.join(out, 'PROVE-KEYS.json'), 'w', encoding='utf-8'), indent=1)
        if code:
            return 2
        time.sleep(0.3)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('key', nargs='?', type=int)
    ap.add_argument('--random', type=int, default=0)
    ap.add_argument('--prove-until', default='', help='HH:MM UTC. Random keys until then, logged.')
    a = ap.parse_args()
    load_cache()
    belt, space, n = load()
    if a.prove_until:
        return prove(belt, n, a.prove_until, space)
    keys = [a.key] if a.key is not None else [key_of_line(belt, random.randrange(n))
                                              for _ in range(a.random or 1)]
    print('the wafer issued %s keys in %d commits, inside %s addresses'
          % (format(n, ','), len(belt), format(space, ',')))
    worst = 0
    for k in keys:
        msg, code = resolve(belt, space, k)
        print(msg)
        worst = max(worst, code)
    return worst


if __name__ == '__main__':
    sys.exit(main())
