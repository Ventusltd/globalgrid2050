# DNA test — all apps on the wafer

Run: 2026-09-17 on MSI, `python pipeline/dna.py <app>` for every app with `app == true` in apps.json (19 apps). Per-app detail in `probe/DNA-<app>.json`.

| app | lines | found | missing | passed | seconds |
|---|---:|---:|---:|:---:|---:|
| claude | 6806 | 6806 | 0 | True | 1.8 |
| code-generator | 9863 | 9863 | 0 | True | 5.0 |
| data-centres-gb | 450 | 450 | 0 | True | 0.5 |
| data-federation-map-for-globalgrid2050-all-repos | 1391 | 1391 | 0 | True | 0.9 |
| data_uk_dno_and_tso | 180 | 180 | 0 | True | 0.7 |
| globalgrid2050 | 46349 | 46349 | 0 | True | 26.2 |
| globalgrid2050-homepage | 236 | 236 | 0 | True | 0.7 |
| globalgrid2050-hompage | 236 | 236 | 0 | True | 0.7 |
| grid-dictionary | 147 | 147 | 0 | True | 0.3 |
| gridatlas | 24936 | 24936 | 0 | True | 11.6 |
| registry_of_all_content_in_repos_and_dependencies | 568 | 568 | 0 | True | 1.2 |
| reports | 99 | 99 | 0 | True | 0.4 |
| solar-electrical-topology-analysis-engine-text-based | 16400 | 16400 | 0 | True | 9.3 |
| spiders | 3029 | 3029 | 0 | True | 3.6 |
| star-maker | 585 | 585 | 0 | True | 0.8 |
| testcode | 14483 | 14483 | 0 | True | 10.1 |
| v11 | 245 | 245 | 0 | True | 0.6 |
| ventus-grid-engine | 1938 | 1938 | 0 | True | 2.1 |
| youengineer-code-review | 1150 | 1150 | 0 | True | 1.2 |
| **TOTAL (19 apps)** | **129091** | **129091** | **0** | **19/19 passed** | **77.7** |

Places scanned in total: 2771.

## Misses (first 5 per app)

None. Every key in every app was found.
