This test uses the installed Playwright **Pixel 7** and **Galaxy S9+** presets with actual Android user agents, touch input, DPR and CDP portrait/landscape rotation. It runs host Chromium emulation; physical Android, browser chrome and TalkBack acceptance remain unknown.

Run from any working directory after installing the existing locked browser dependencies and Chromium:

```sh
PLAYWRIGHT_MODULE="$GITHUB_WORKSPACE/automation/news/acquisition/browser/node_modules/playwright/index.mjs" \
V940_ANDROID_OUT="$RUNNER_TEMP/v940-android" \
ANDROID_DEVICE="Pixel 7,Galaxy S9+" \
node automation/v940_preview/android.mjs
```

`PLAYWRIGHT_MODULE` is optional when `playwright` resolves normally. `PLAYWRIGHT_BROWSERS_PATH` retains its normal Playwright meaning. The repository root is derived from this script. No network collector or system dependency is added. CI can invoke this after its existing npm/Chromium setup and upload the output directory; no separate workflow or schedule is needed.

Default acceptance uses the actual committed edition and saved news, blocking external requests to exercise the existing local fallback. It asserts frozen HTML/shared UI hashes; observes the candidate and edition tree identities; checks rendered frame movement, portrait→landscape→portrait, touch pause/read swipe/resume without link activation, one functioning header query, literal original link/publisher/date equality, inert visual clones, reduced motion, all 7,775 rows, overflow and page errors. Each run writes a source-pinned JSON receipt and screenshots. Use a fresh output directory to preserve earlier evidence.

Set `V940_ANDROID_PUBLIC=1` only for separate, bounded, unintercepted live observations of the dated V9.37 page and root. Live transport/content is recorded separately and cannot establish acceptance or publication of V9.40. The default CI run does not depend on publisher availability. No shallow-history fetch of the source anchor is required: the runtime pins are embedded in this test, and current Git identities are recorded.
