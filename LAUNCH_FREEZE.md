# GlobalGrid2050 Launch Freeze

Status: Pre launch preservation mode

Purpose: protect the working platform while visible functions are stabilised for launch.

## Governing rule

Freeze structure. Fix function. Document risks. Clean later.

Until launch is complete, do not perform destructive cleanup or broad refactoring unless Vikram explicitly approves the exact change.

## Protected actions

Do not delete working version folders.

Do not move shared datasets or GeoJSON paths.

Do not archive or remove GitHub workflows.

Do not restructure the homepage in a way that hides important tools or satellite pages.

Do not rename live application folders.

Do not perform Git LFS migration or history rewriting.

Do not mass refactor large HTML, CSS or JavaScript cartridges for appearance only.

## Allowed safe actions

Fix broken references.

Add documentation that clarifies current state.

Add guardrail files such as `.gitignore`.

Patch visible functional defects in current apps.

Add non destructive inventories of workflows, scripts, datasets and applications.

Improve modular apps only where the public function is preserved or restored.

## Launch principle

Old versions are retained intentionally as rollback references until launch is complete. They are not clutter during launch. They are safety memory.

After launch, the repository can be pruned through a controlled archive plan with testable path checks and human approval.
