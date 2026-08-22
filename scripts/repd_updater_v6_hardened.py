#!/usr/bin/env python3
"""Compatibility entry point for isolated V6 source reconciliation.

The former implementation rewrote the shared V1–V5 `repd_master.json`. V6 now
publishes only V6-specific outputs from a reconciled Q2 CSV/XLSX staging table.
"""
from repd_sources_v6 import main


if __name__ == "__main__":
    main()
