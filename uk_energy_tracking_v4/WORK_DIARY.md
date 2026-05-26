# UK Energy Tracking V4 Work Diary

This file is a persistent engineering and AI continuity log for V4.

## Purpose

Maintain continuity across overloaded ChatGPT threads.

Track:

```text
what changed
why it changed
what failed
what recovered
which workflows exist
which scripts are authoritative
```

## Initial architecture

Stable tracker:

```text
uk_energy_tracking/
```

Development twin:

```text
uk_energy_tracking_v4/
```

V4 was created so experimental transport energy work would not damage the live public tracker.

## Major lessons learned

### Lesson 1

Do not share feed scripts between stable and V4.

Earlier versions accidentally pointed V4 and stable at the same JSON update logic which caused corruption risk.

Resolution:

```text
create isolated _v2 scripts
create isolated V4 workflows
create isolated V4 JSON outputs
```

### Lesson 2

Always preserve a working twin.

The stable tracker acts as:

```text
comparison source
recovery source
truth source
```

### Lesson 3

GitHub push races can break workflows.

Observed issue:

```text
remote rejected HEAD -> main
internal server error
fetch first
```

Resolution:

```text
stagger schedules
use git pull --rebase before push
separate V4 cadence
```

## Diary entry: 2026-05-26 V4 electricity graph safety patch

Purpose:

```text
stop the electricity price graph from crashing browsers
make selected date ranges meaningful
improve chart readability
fix full screen chart sizing
highlight the zero price line for battery storage and negative pricing analysis
```

Patch method:

```text
remove 3 month, 6 month, 12 month, 10 year and all data dropdown options from the visible V4 electricity graph range selector
limit visible chart windows to a maximum of 30 days
load only annual Elexon System Price CSV files required for the selected date window
never load the full 2016 to present master CSV in the browser graph
cap visible plotted records to 1500 points
show selected start and end date plus time in the status line
show loaded annual files and source row count in the status line
draw white grid lines at clearer price intervals
draw a red £0 reference line whenever the price axis crosses zero
fix full screen chart flex sizing so the bottom of the chart is not cut off
make the full screen chart reuse the same selected snapshot as the inline chart
```

Files changed:

```text
uk_energy_tracking_v4/index.md
uk_energy_tracking_v4/price-history-ui.js
uk_energy_tracking_v4/price-history-fullscreen.js
uk_energy_tracking_v4/price-history-ui.css
uk_energy_tracking_v4/WORK_DIARY.md
```

Standing rule:

```text
This patch only concerns the electricity price graph pipeline and UI. It does not audit the live price gauge, generation tracker or V3. Those can be audited after the graph data pipeline is stable and before any V5 clone.
```

## Earlier diary retained in Git history

Earlier V4 diary entries remain available in commit history. This condensed entry records the current graph safety patch after the file was updated directly through the GitHub connector.
