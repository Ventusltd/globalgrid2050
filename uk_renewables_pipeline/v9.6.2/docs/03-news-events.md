# V7.3 trusted newspaper and assertion contract

## Scope

V7.3 replaces the inherited V5 NEWS SIGNAL only after V7.2 is proven. This document fixes the architecture and acceptance evidence; it does not authorise news changes during V7.2.

V7 separates:

1. A source article and its publisher-declared fields.
2. A source-specific project-event assertion created by a versioned GlobalGrid2050 method.
3. A material-event cluster supported by one or more assertions.

An article-reported event never overwrites an official REPD capacity, status, milestone or identity.

## Source adapters and health

Every publisher adapter performs bounded `fetch → parse → normalise` work and emits the same versioned candidate contract. The matcher consumes that contract and does not branch on publisher name.

Every approved source has a source card recording:

- Publisher and stable source ID.
- Licence, attribution and allowed/not-allowed use.
- Access method, rate limits, pagination and update frequency.
- Declared fields and GlobalGrid2050-derived fields.
- Known gaps, failure modes and stale threshold.
- Last attempt, last success, response class, latency and health state.

Degraded, failed, stale and unknown sources remain visible. A blind crawl cannot publish an apparently healthy empty edition.

Stable content hashes exclude run timestamps and other observation metadata. Collection uses bounded timeouts, retries/backoff where allowed, conditional requests where supported, persistent watermarks and first/last-seen history.

## Candidate blocking

Blocking exists only to remove impossible comparisons before authoritative matching. It uses the union of overlapping keys:

- REPD Ref, GlobalGrid project/development ID, NSIP and planning references.
- Exact official names plus controlled variants that preserve meaningful qualifiers.
- Distinctive multi-token shorter-name containment.
- Geography, planning authority and operator/applicant corroboration.
- Exact-identifier bypasses that cannot be lost through token filtering.

Blocking is accepted only when the frozen positive corpus has pair completeness of 100%. Pair quality and reduction ratio are reported, but efficiency cannot justify losing a known positive.

## Evidence scoring and hard gates

Hard canonical-identity, positive UK-location, technology, explicit foreign-location, inactive-record and ambiguity rules remain authoritative.

A current article cannot bind to refused, abandoned, withdrawn or expired history through a shared name alone. Planning reference, explicit reapplication, current operator and location evidence must prove continuity.

Raw official names and distinguishing qualifiers remain available throughout matching. Normalised stems, shorter-name coverage, Monge–Elkan, SoftTFIDF or Jaro-Winkler similarities may be evaluated as evidence features. They cannot establish identity alone or override a hard veto. Capacity and publisher reputation are corroboration only.

The outcome is one of:

- `published`: identity and event evidence pass every gate.
- `quarantined`: plausible but insufficient, conflicting or component-ambiguous evidence; this is the abstention state.
- `rejected`: a hard gate fails or evidence is insufficient.

Every outcome stores a stable, bounded reason and the evidence that produced it.

## Assertion and time model

Each assertion contains at minimum:

- Stable assertion, article and material-event IDs.
- Exactly one canonical project or development subject.
- Controlled event type.
- Evidence phrase or bounded source-text location.
- Identity evidence and event evidence stored separately.
- Identity confidence and event confidence stored separately.
- `occurred_at`, optional valid-time range and date precision/basis.
- `published_at`, `observed_at` and `recorded_at`.
- Matcher, extractor and schema method versions.
- Decision, rejection/abstention reason and review state.
- Correction/supersession relationship where applicable.

Unknown occurrence dates remain null. Publication, crawl or current dates are never substituted.

Duplicate reporting is clustered conservatively by canonical subject, controlled event type, explicit reference and a documented date window. Corroborating articles remain linked to the cluster. Ambiguous clusters abstain instead of being merged by headline similarity alone.

## Evaluation contract

Discovery, blocking, identity and event classification are evaluated separately.

- Freeze positive, negative and adversarial fixtures before threshold work.
- Split evaluation by development and by source/time where possible so related coverage cannot leak between training and test evidence.
- Report candidates before/after blocking, pair completeness, pair quality and reduction ratio.
- Report the full confusion counts, precision, recall and abstention coverage; uncertainty is described conservatively for the small clustered corpus.
- Preserve zero leakage on every frozen critical negative, including foreign projects, Avonmouth incidents, Witney High Street, offshore wind, healthcare, common words and inactive records.
- Preserve every canonical REPD fact and every development/component distinction.
- Record a reason for every published, quarantined and rejected item.

The hard acceptance gate is 100% frozen-positive retention through blocking plus zero frozen critical-negative leakage. This is a regression guarantee on the labelled corpus, not a claim of perfect population precision.

## Deferred methods

Transparent rules and evidence features remain the production baseline. Transformers, weak supervision, calibrated Fellegi–Sunter probabilities, conformal guarantees and learned event coreference remain research options until a larger independent domain benchmark proves material improvement without precision loss.

The public feed remains compact same-origin JSON. Build-time columnar analytics may be introduced later from the identical assertion rows, with complete JSON/Parquet reconciliation; browser DuckDB is not a V7.3 dependency.
