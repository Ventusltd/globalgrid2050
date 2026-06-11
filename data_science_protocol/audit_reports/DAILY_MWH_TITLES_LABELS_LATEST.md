# Daily MWh Titles And Labels

Generated UTC: `2026-06-11T07:58:13.454237Z`
Mode: `apply`
Target file: `uk_energy_tracking_v6/generation_history/index.md`
Changed: `True`
Replacement count: `7`
Missing markers: `0`
Pass: `True`

## Purpose

This changes visible titles and source labels for the daily MWh chart so the page describes daily energy output by technology, while preserving Solar PVLive as the currently enabled chart data source and leaving Elexon data wiring for the next audited step.

## Safety

This workflow does not modify data files. It does not wire new chart data. It does not change calculations. It only changes title, label and cache bust text in the generation history page.
