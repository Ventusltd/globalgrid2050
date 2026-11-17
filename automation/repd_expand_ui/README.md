# Expand REPD analytics

Integration in a new candidate edition (after the existing styles and scripts):

```html
<link rel="stylesheet" href="../../automation/repd_expand_ui/expand.css">
<script type="module" src="../../automation/repd_expand_ui/expand.mjs"></script>
```

Adds EXPAND ANALYTICS to `#officialRegister`. A native modal dialog covers the
browser viewport with a persistent close bar. It moves the existing section
and returns the same nodes on close, preserving filters, CSV handlers, table
scroll and paging. Escape closes the view; focus and document scroll return to
the launcher. Native modal behavior contains focus and makes the background
inert. Existing note dialogs may open above it. Dynamic viewport units and safe
area padding support rotation and browser chrome; no browser fullscreen
permission is needed. Browsers without `showModal` retain the ordinary dashboard.

This is presentation only: no source, cohort, route or release-pointer changes.
Use the browser harness against an explicit edition/root; it injects these two
assets into the served HTML without editing the candidate. Local touch/browser
emulation does not establish physical handset acceptance.

Run the harness with Node and an existing Playwright installation:

```powershell
$env:PLAYWRIGHT_MODULE='<playwright/index.mjs>'
$env:PLAYWRIGHT_BROWSERS_PATH='<installed browser cache>'
$env:REPD_EXPAND_ROOT='<candidate checkout>'
$env:REPD_EXPAND_EDITION='uk_renewables_pipeline/<candidate edition>'
node automation/repd_expand_ui/browser.mjs
```

`REPD_EXPAND_OUT` optionally selects the receipt/screenshot directory. The
harness exits after closing its owned loopback server and browser.
