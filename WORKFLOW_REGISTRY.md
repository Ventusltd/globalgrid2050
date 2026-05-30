# GlobalGrid2050 Workflow Registry

Status: Initial non destructive inventory placeholder

Purpose: classify workflows before any future cleanup. This file does not move, disable, archive or delete anything.

## Rule

No workflow should be removed, renamed or archived until it has been classified and its live impact is understood.

## Categories

### 1. Live scheduled workflows

Use this section for workflows that refresh live public data, scheduled datasets, energy prices, commodity prices, grid data, EV chargers, ports or other active platform feeds.

Action during launch freeze: preserve.

### 2. Manual maintenance workflows

Use this section for workflows that are triggered manually to install features, generate reports, run GridBot patches or support controlled repository maintenance.

Action during launch freeze: preserve.

### 3. Executed migration workflows

Use this section for workflows that appear to have been used for one off migrations, version cloning, rollback, repair or historic patching.

Action during launch freeze: do not delete. Mark for post launch review only.

### 4. Unknown workflows

Use this section for workflows whose purpose is not yet clear.

Action during launch freeze: preserve until proven safe to archive.

## Future cleanup method

1. List every workflow path.
2. Classify it into one of the categories above.
3. Check whether it is referenced by documentation, scripts or app pages.
4. Check whether it has recent successful runs.
5. Confirm whether any public page depends on its output.
6. Only then propose archiving.
7. Vikram must approve before any workflow is moved, disabled or deleted.

## Launch position

During launch preparation, workflow clutter is a lower risk than accidental loss of a live data pipeline. Preservation is the correct default.
