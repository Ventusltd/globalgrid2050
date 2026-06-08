# GlobalGrid2050 The Data Spine

Status: canonical doctrine
Owner: Ventus Ltd
Created UTC: 2026 06 08
Scope: every system that ingests, distils, stores or serves grid data

## 1. One sentence

The mistake was never too much data. The mistake is storing the wrong grain for the wrong question.

## 2. Spine principle

Python fetches.
Python validates.
Python distils.
Python writes compact intelligence and the audit method.
Python deletes temporary raw data unless retention is explicitly approved.
GitHub stores the method, the facts and the trail.
The browser loads the correct grain for the question being asked.
Bulk raw data is regenerated on demand or lives outside the committed repository.

## 3. Grain ladder

### Now and live heartbeat

Question: what is happening now?
Grain: latest reading or near live short window.
Source: live or provisional feed such as FUELINST where available.
Repository rule: do not preserve raw live firehose permanently.

### Last 7 days

Question: what is the current grid heartbeat?
Grain: 5 minute where available, one selected technology by default.
Repository rule: rolling hot slice only.

### Last 30 days

Question: what is the recent operational rhythm?
Grain: 5 minute for one selected technology where practical, or 30 minute resampled fallback.
Repository rule: compact rolling hot tier file only.

### 12 months to 2 years

Question: how did the technology behave over time?
Grain: daily high, average, low and MWh.
Repository rule: confirmed or candidate daily fact files.

### 5 to 10 years

Question: what is the strategic shape of the system?
Grain: monthly and annual MWh, terawatt hour, share, range bands and completeness.
Repository rule: compact confirmed fact files.

### Historic half hourly detail

Question: what happened in a specific historic month?
Grain: selected month only.
Repository rule: regenerate on demand or keep outside the default browser path unless explicitly approved.

## 4. Source discipline

FUELHH is the canonical source for settled historic generation facts where available.
FUELINST is live or recent and provisional.
A confirmed fact is not silently derived from a provisional feed.
Each artifact declares the source dataset that produced it.

## 5. Solar discipline

FUELHH is transmission metered and can undercount embedded solar.
Solar rows must declare their method.

Allowed method states:

ELEXON TRANSMISSION ONLY
PVLIVE EMBEDDED ESTIMATE
BLENDED TRANSMISSION PLUS EMBEDDED
PROVISIONAL LIVE EDGE ESTIMATE

Do not publish a silently transmission only solar series as total national solar.

## 6. Additivity law

MWh is additive.
Peaks, lows and extremes are non additive.

Monthly and annual average MW equals total MWh divided by hours.
Technology shares are computed from additive MWh.
Technology peak is the maximum within that technology.
System peak is not the sum of technology peaks.
High time and low time must be preserved where available.

## 7. Provenance, completeness and status

Every confirmed fact file must carry schema version, generated UTC, source datasets, source hash where practical, timezone and day night rule where applicable.

Every row must carry completeness and status.

Status values:

live
provisional
candidate
confirmed

## 8. Day and night rule

Canonical day equals 06:00Z to 18:00Z.
Canonical night equals 18:00Z to 06:00Z.
Timezone equals UTC.

A civil time or solar daylight product may be created later, but it must not redefine the canonical UTC split.

## 9. Never overwrite good data

Incremental builds must preserve populated reviewed data when incoming data is weaker, empty, partial or lower completeness.

The merge guard and weak row logic are not optional. New compilers must reuse the same principle.

## 10. Promotion gate

Data flows through:

provisional acquisition
candidate aggregate
automated validation
review
confirmed fact

Candidates and audit reports may be committed. Raw temporary downloads are deleted after the audit method is written unless explicit evidence retention is approved.

## 11. Repo governance

Commit facts, not bulk.
Regenerate raw source data on demand.
Keep heavy default browser payloads out of the repository.
Use repo guard thresholds to prevent accidental growth.
Use staleness reports before removing legacy files.
History rewrite is a final maintenance step only after discipline is stable.

## Stamp block

Data grain discipline applies. Store the right grain for the question, not raw bulk. Settled FUELHH is confirmed where available. Live FUELINST is provisional. Sums roll up. Peaks do not. Solar is provenance stamped. Every fact carries schema, source, completeness and status. Never overwrite good data. Commit facts and regenerate bulk. Full doctrine: data_science_protocol/THE_DATA_SPINE.md
