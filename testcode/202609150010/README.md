# Dual-compute Sun Star evidence candidate

Stamp: `202609150010`. Status: test-only; not promoted or linked from the homepage.

This candidate converts the first Sun Star conceptual task into a deterministic Python payload. It scans only public files already pinned in this repository: the latest Pipeline News project pack, the solar deployment and component pages, the London solar-geometry module, and the public podcast index. It does not fetch, publish, or modify source data.

The pinned project pack contains 3,563 solar records totalling 67,013 MW when rounded, but only 3,558 have coordinates. The five missing-geometry records remain named in the result; the scope's “all with coordinates” claim is retained as a visible mismatch and is not used to invent locations.

Two independent lanes must agree before a result can be merged:

1. Local: `python testcode/202609150010/concept_compute.py --lane local --output testcode/202609150010/runs/local-result.json`
2. GitHub Actions: manually run `testcode 202609150010 dual compute` and download `sun-star-ci-result` into `testcode/202609150010/runs/ci-result.json`.
3. Gate: `python testcode/202609150010/merge_results.py --local testcode/202609150010/runs/local-result.json --ci testcode/202609150010/runs/ci-result.json --output testcode/202609150010/merged/result.json`
4. Manifest: `python testcode/202609150010/publication.py`

The merge rejects altered payloads, differing input hashes, failed pinned-count checks, or mislabeled lanes. Runner metadata and commit identities remain visible but do not change the deterministic payload.

## Dependency closure

- Destination: this stamped `globalgrid2050/testcode` candidate only.
- Runtime: Python standard library, Python 3.11 or newer.
- Inputs: paths and SHA-256 values recorded inside each result.
- Output: lane result JSON, then one merged JSON only after byte-equivalent payload agreement.
- Rollback: delete or revert this single stamp and its manual workflow; no homepage, release, source dataset, or current pointer is changed.
