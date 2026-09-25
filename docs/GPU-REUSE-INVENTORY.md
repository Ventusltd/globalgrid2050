# Existing GPU capability and reuse decision

Observed 2026-09-25T00:38:56Z. This is a navigation/integration inventory, not a new compute platform.

- Canonical measured GPU implementation owner: https://github.com/Ventusltd/gpu-drivers-for-global-grid
- Existing fused engine: https://github.com/Ventusltd/gpu-drivers-for-global-grid/blob/main/engine/fused.py
- Paired-channel source: https://github.com/Ventusltd/worlds-/blob/main/src/annihilate.py
- Historical receipt: https://github.com/Ventusltd/worlds-/blob/main/night-results/annihilate.json
- Prior corrected aggregate lessons: https://github.com/Ventusltd/gpu-drivers-for-global-grid/blob/main/docs/GPU-TESTING-LESSONS-20260924.md
- Reuse mistake and restart lesson: https://github.com/Ventusltd/gpu-drivers-for-global-grid/blob/main/docs/GPU-REUSE-RESTART-LESSON-20260925.md

## Runner observation

The GitHub Actions runners API for Ventusltd/globalgrid2050 reported twelve
registered msi-globalgrid2050 runners, all offline and not busy at this check.
Existing local CuPy execution succeeded separately. Registration, online runner
status and working local GPU execution are different facts. This observation
is historical; recheck status before submitting a job. Credential files and
private local source locations are not included here. No runner was started
and no paused workflow was enabled by this documentation.

## Workload and decision

Reuse the established fused GPU/compact-receipt pattern for suitable numerical
batches. Retain independent references, explicit boundaries, source/input hashes,
synchronized timing and separate counts for distinct inputs versus repeated
evaluations. Homepage DOM, accessibility, version validation and publication
are CPU/browser checks; GPU use is not compulsory or a substitute for them.
The historical annihilate implementation compares inclusive and strict rules;
that specific pair is a boundary probe, not a general proof of independence.
A new photon/output-script integration must retain its own verified contract.

Before proposing a replacement, read the referenced implementation and current
handoff, identify the precise missing connection, and record reuse, extension
or inapplicability with a reason. CVAA can check this record exists and is
consistent; it cannot inspect an agent's attention or certify a performance claim.
