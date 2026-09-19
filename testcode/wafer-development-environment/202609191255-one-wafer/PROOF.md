# Proof 1: every line ever written, on one wafer, and any key resolves to its text

- issued keys: **37,929,255,811**, one per line in every file in every commit, in 9,940 commits across 70 repositories
- unissued keys left as measured silence between commits: 15,373,462,200 (declared constant, 600 keys per second)
- three independent counts agree: a brute force walk (565.2 s), a second brute force walk, and a Merkle walk over the 31,158 distinct git trees (4.9 s). 9,869 commits compared, 9,869 matched exactly, 0 differed.
- the unattended proof loop (`tools/key.py --prove-until`) had followed **159 random keys** to the actual line of text in git when this was published, state RUNNING. It stops dead at the first failure.
- the page fetches one 400 kB file and draws the whole in milliseconds: unresolved pixels state a count computed from the law, resolved fields draw exactly the issued keys in the field.

Repositories that are not public are measured, not named. Provided as is, without warranty of any kind; a chart, not a design.
