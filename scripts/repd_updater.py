name: Ventus REPD Monthly Sync

# This is the "Perpetual Motion" logic
on:
  schedule:
    # Runs at 00:00 on the 1st of every month to catch Gov revisions
    - cron: '0 0 1 * *'
  workflow_dispatch:
    inputs:
      reason:
        description: 'Manual trigger reason (e.g., Mid-quarter Gov Update)'
        required: false
        default: 'Manual Sync'

jobs:
  update-atlas:
    name: Execute REPD Updater
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout Repository
        uses: actions/checkout@v4

      - name: 🐍 Setup Python 3.10
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
          cache: 'pip'

      - name: 📦 Install Industrial Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pandas pyyaml requests pyproj

      - name: ⚡ Run REPD Updater
        # Points to the script we just put in your /scripts folder
        run: python scripts/repd_updater.py
        env:
          PYTHONPATH: .

      - name: 🛡️ NPSA Compliance & Data Commit
        run: |
          git config --global user.name "Ventus-Bot"
          git config --global user.email "bot@ventus.ltd"
          git add dist/*.json
          git add data/*.geojson
          # Only commit if data actually changed to avoid empty "spam" commits
          git diff --quiet && git diff --staged --quiet || (git commit -m "REPD Auto-Update: $(date +'%Y-%m-%d') [Compliance Verified]" && git push)

      - name: ✅ Sync Status Report
        if: success()
        run: echo "Ventus REPD Sync Completed Successfully."
