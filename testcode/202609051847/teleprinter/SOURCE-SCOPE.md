# Print source code scope

This generation adds the Codex-authored Teleprinter controls. Each app's text includes the committed HTML, JavaScript, ESM and CSS in its app directory, its bootstrap, the Teleprinter browser modules and vendored renderer license, and this scope note. Atlas includes current.json, which identifies the immutable remote shell and hashed cartridges. Pipeline includes its small contracts JSON files and code loaders under scripts/data. The landing page includes index.html and capsule-launch.js.

This inventory describes the pinned base source. The reader-facing Print source code also appends the current DOM, selected layers, map state, observed runtime dependencies and their complete fetched responses. Unreadable responses and dependency-discovery limits are named in that diagnostic file. Generated diagnostic prints stay offline, not in Git.

Pinned-base exclusions: application data payload directories (atlas/data and pipeline/data), results, cases, receipts, inherited detector evidence, generated text/manifest/pin files, external CDN libraries, and the remotely hosted Atlas shell. Remote dependencies are referenced by the committed code/configuration; their contents are not represented as locally committed source. This is scoped application source, not an offline reconstruction of every dependency or dataset. source-scopes.json lists every selected path. No source file is silently truncated.

The source pin is generated only after the application code commit exists. Its full commit SHA identifies the code version; the later pin/text publication does not pretend to include itself. Prior detector results belong to the predecessor generation and have not been rerun by this build.
