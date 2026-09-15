# Check proposals from a local reviewer model

A local reviewer model was shown the two pages' quoted vocabulary and asked to
propose extra checks for the overnight job. This file records what it proposed
and what happened to each proposal.

A local model's proposals are suggestions; every accepted check was verified
against the live page before use.

| field | value |
| --- | --- |
| model | `ventus-stars` (a local reviewer model) |
| prompt sha256 | `8be7a97f8153a57368b890f0c57377ed7e2db04eae1b04ea04a794d7dfdbc4e2` |
| answered (UTC) | `2026-09-15T01:01:23Z` |
| proposals | 12 |
| accepted | 3 |
| rejected | 9 |

## How a proposal was judged

1. **Vocabulary.** Every substring the proposal uses must appear verbatim in the
   quoted vocabulary of the prompt. Nothing invented, nothing paraphrased.
2. **Live page.** The check must pass right now against the live page. Each one
   was run locally against `https://globalgrid2050.com/` at 430x900 before this
   file was written.

A proposal that fails either test is rejected with the reason below. The
accepted three are in `checks.json` with `"source": "ollama:ventus-stars"`;
the baseline checks alongside them carry `"source": "claude"`.

## Accepted

| proposal | page | substring | why it was accepted |
| --- | --- | --- | --- |
| Check GPU Line | qts | `on GPU: 250,174 unique numbered lines` | in the prompt's vocabulary; present in the live HUD at 430x900 |
| Check Family-Line Entries | qts | `664,940 family-line entries` | in the prompt's vocabulary; present in the live HUD at 430x900 |
| Check AWAY | qts | `AWAY` | in the prompt's vocabulary; present in the live visible text at 430x900 |

## Rejected

| proposal | page | reason |
| --- | --- | --- |
| Check WebGL2 Failure | qts | does not pass against the live page: `WebGL2 path failed` is not in the visible text. The page logs that line to the console only when WebGL2 is missing, so it can never be a *must contain*. The job records WebGL2 as present or absent instead. |
| Check Born Rule | qts | does not pass against the live page: `Born rule` is not in the visible text at 430x900 (it sits in prose the reader opens, not in the always-on text) |
| Check P(away) | qts | does not pass against the live page: `P(away)` is not in the visible text at 430x900 until a measurement is taken |
| Check Not a Measurement | qts | does not pass against the live page: `not a measurement` is not in the visible text at 430x900 |
| Check Blocks on Table | generator | the Star Generator is not published yet (HTTP 404), so the check could not be verified against a live page |
| Check Groups Off Table | generator | not published yet (HTTP 404); could not be verified |
| Check Function Families | generator | not published yet (HTTP 404); could not be verified |
| Check Unique Numbered Lines | generator | not published yet (HTTP 404); could not be verified |
| Check Repositories | generator | not published yet (HTTP 404); could not be verified |

The five generator proposals were sound in vocabulary and are covered by the
baseline check `generator count sentence`, which is written into `checks.json`
now and arms itself the moment that page is published. It is reported as
skipped until then.

## Note on timing

The model answered at 01:01:23 UTC. The answer's recorded `prompt_sha256`
matches the sha256 of the prompt file exactly, so this is the answer to this
prompt and not to an earlier one. No further answer had been written by
01:08 UTC, when the proposals were frozen and this file was produced.
