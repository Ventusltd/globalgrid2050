# Proof 8: two checking engineers who built nothing

A proof is not checked by its author. Every proof here is now examined by two independent checkers.

**On the measuring machine** (`tools/check_proof.py`): the page, its data and its PROOF.md answer 200 on the domain; the published data re-sums to its own meta; no name of a repository that is not public appears anywhere in what was published; the disclaimer is present; three random keys drawn from the PUBLISHED data are followed by git alone to a real line of text; and a local model gives a second opinion that is only ever a candidate. It never edits a proof, never publishes and never commits: a checking engineer who can change the drawing is not checking it. Verdicts so far: proofs 1, 2, 3, 4 and 6 PASS.

**On GitHub** (`.github/workflows/check.yml`, `tools/ci_check.py`), on every push, on a machine that can see nothing local: privacy digests over every tracked file, the data re-summed three ways (37,929,255,811 issued, agreeing with the meta and with the repository table), every tool and page parsed, keys in time order with the address space closing exactly at 53,302,718,011. Every run so far: success.

## The guard does not spell what it guards

The first privacy guard listed the private repository names in plain text inside a public repository, which is the leak it existed to prevent. Names are now held as truncated SHA-256 digests and text is checked by hashing every token. On its first run the new guard found private names in 18 tracked files of this repository, committed before the rule existed. They are redacted at HEAD, and in six other public repositories (57 files), each in a fresh clone so that no live working tree was disturbed.

Provided as is, without warranty of any kind; a chart, not a design.
