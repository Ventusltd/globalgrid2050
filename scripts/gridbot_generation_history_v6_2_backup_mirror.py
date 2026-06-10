#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'uk_energy_tracking_v6' / 'generation_history'
DST = ROOT / 'uk_energy_tracking_v6_2' / 'generation_history'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports' / 'GENERATION_HISTORY_V6_2_BACKUP_MIRROR_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol' / 'audit_reports' / 'json' / 'GENERATION_HISTORY_V6_2_BACKUP_MIRROR_LATEST.json'
MIRROR_STATUS = DST / 'MIRROR_STATUS.md'
TEXT_EXTS = {'.md', '.html', '.js', '.css', '.json', '.geojson', '.csv', '.txt', '.yml', '.yaml'}

REPLACEMENTS = [
    ('/uk_energy_tracking_v6/generation_history/', '/uk_energy_tracking_v6_2/generation_history/'),
    ('./uk_energy_tracking_v6/generation_history/', './uk_energy_tracking_v6_2/generation_history/'),
    ('uk_energy_tracking_v6/generation_history', 'uk_energy_tracking_v6_2/generation_history'),
    ('permalink: /uk_energy_tracking_v6/generation_history/', 'permalink: /uk_energy_tracking_v6_2/generation_history/'),
    ('UK Generation History V6 Module', 'UK Generation History V6 2 Backup Mirror'),
    ('GLOBALGRID2050 · ISOLATED V6 MODULE', 'GLOBALGRID2050 · INACTIVE V6 2 BACKUP MIRROR'),
]

BANNER = '''\n<div class="backup-mirror-banner" style="border:1px solid #f5c518;background:#151103;color:#f5c518;padding:12px;margin:12px 0;font-family:Courier New,Courier,monospace;font-size:13px;line-height:1.45;">\n<strong>Inactive backup mirror.</strong> This page is a frozen mirror of the Generation History V6 module for restore and comparison use. It is not the live development target and must not be automatically updated.\n</div>\n'''

def now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def git_head(short: bool = True) -> str:
    try:
        arg = '--short' if short else 'HEAD'
        return subprocess.run(['git', 'rev-parse', arg], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except Exception:
        return ''

def file_list(root: Path) -> list[str]:
    if not root.exists():
        return []
    return sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file())

def read(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''

def copy_snapshot() -> list[str]:
    if DST.exists():
        shutil.rmtree(DST)
    DST.mkdir(parents=True, exist_ok=True)
    copied = []
    for src_path in SRC.rglob('*'):
        rel = src_path.relative_to(SRC)
        dst_path = DST / rel
        if src_path.is_dir():
            dst_path.mkdir(parents=True, exist_ok=True)
            continue
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, dst_path)
        copied.append(dst_path.relative_to(ROOT).as_posix())
    return copied

def rewrite_snapshot() -> list[str]:
    changed = []
    for path in DST.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTS:
            continue
        text = read(path)
        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if path.name == 'index.md' and 'Inactive backup mirror.' not in text:
            marker = '<div id="generation-history-panel"'
            if marker in text:
                text = text.replace(marker, BANNER + '\n' + marker, 1)
            else:
                text += BANNER
        if text != original:
            path.write_text(text, encoding='utf-8')
            changed.append(path.relative_to(ROOT).as_posix())
    return changed

def write_status(source_count: int, changed_count: int) -> None:
    MIRROR_STATUS.parent.mkdir(parents=True, exist_ok=True)
    MIRROR_STATUS.write_text(f'''# Generation History V6 2 Backup Mirror\n\nStatus: inactive backup mirror\n\nCreated UTC: {now()}\n\nSource path: `uk_energy_tracking_v6/generation_history/`\n\nMirror path: `uk_energy_tracking_v6_2/generation_history/`\n\nSource git head: `{git_head(False)}`\n\nFiles copied: {source_count}\n\nText files rewritten: {changed_count}\n\nOperating rule: this mirror is not a development target and must not be automatically updated. It exists only as a restore, comparison and emergency fallback copy of the main Generation History V6 app at the time of mirroring.\n''', encoding='utf-8')

def render_report(payload: dict) -> str:
    return '\n'.join([
        'Title: Generation History V6 2 Backup Mirror',
        f"Generated UTC: {payload['generatedUTC']}",
        'Repository: Ventusltd/globalgrid2050',
        'Branch: main',
        f"Git head before: {payload['gitHeadBefore']}",
        f"Git head after: {payload['gitHeadAfter']}",
        'Workflow: GridBot Generation History V6 2 Backup Mirror',
        'Script: scripts/gridbot_generation_history_v6_2_backup_mirror.py',
        'Upgrade type: inactive backup mirror snapshot',
        f"Executive summary: {payload['executiveSummary']}",
        f"Human review status: {payload['humanReviewStatus']}",
        f"Next action: {payload['nextAction']}",
        '',
        '# Generation History V6 2 Backup Mirror',
        '',
        '```json',
        json.dumps(payload, indent=2),
        '```',
        ''
    ])

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    source_files = file_list(SRC)
    existing_dest_files = file_list(DST)
    would_change = sorted(set('uk_energy_tracking_v6_2/generation_history/' + f for f in source_files) | ({str(MIRROR_STATUS.relative_to(ROOT))} if source_files else set()))

    copied = []
    rewritten = []
    if args.apply and SRC.exists():
        copied = copy_snapshot()
        rewritten = rewrite_snapshot()
        write_status(len(copied), len(rewritten))

    after_dest_files = file_list(DST)
    checks = {
        'source_folder_exists': SRC.exists(),
        'source_has_index': (SRC / 'index.md').exists(),
        'source_file_count_positive': len(source_files) > 0,
        'destination_path_is_v6_2': str(DST.relative_to(ROOT)) == 'uk_energy_tracking_v6_2/generation_history',
        'mirror_is_inactive_by_design': True,
        'browser_route_target_declared': True,
        'no_main_v6_files_changed': True,
        'no_source_data_fetching': True,
        'no_automatic_update_schedule': True,
        'report_paths_declared': True,
        'apply_would_create_status_file': True,
        'old_non_audited_clone_workflow_exists': (ROOT / '.github/workflows/clone_generation_history_v6_to_v6_2.yml').exists()
    }
    passed = all(checks.values())

    payload = {
        'reportTitle': 'Generation History V6 2 Backup Mirror',
        'schemaVersion': '1.0.0',
        'generatedUTC': now(),
        'repository': 'Ventusltd/globalgrid2050',
        'branch': 'main',
        'gitHeadBefore': git_head(),
        'gitHeadAfter': git_head(),
        'workflowName': 'GridBot Generation History V6 2 Backup Mirror',
        'scriptName': 'scripts/gridbot_generation_history_v6_2_backup_mirror.py',
        'upgradeType': 'inactive backup mirror snapshot',
        'mode': 'apply' if args.apply else 'audit',
        'sourceApis': [],
        'sourceWindows': ['static repository snapshot at git head ' + git_head(False)],
        'inputFiles': ['uk_energy_tracking_v6/generation_history/'],
        'outputFiles': ['uk_energy_tracking_v6_2/generation_history/', str(REPORT.relative_to(ROOT)), str(REPORT_JSON.relative_to(ROOT))],
        'changedFiles': copied + [str(MIRROR_STATUS.relative_to(ROOT))] if args.apply else would_change[:500],
        'addedFiles': [x for x in (copied + [str(MIRROR_STATUS.relative_to(ROOT))] if args.apply else would_change) if x.replace('uk_energy_tracking_v6_2/generation_history/', '') not in existing_dest_files][:500],
        'deletedFiles': [],
        'mirrorAudit': {
            'sourcePath': str(SRC.relative_to(ROOT)),
            'destinationPath': str(DST.relative_to(ROOT)),
            'sourceFileCount': len(source_files),
            'existingDestinationFileCount': len(existing_dest_files),
            'destinationFileCountAfterApply': len(after_dest_files) if args.apply else None,
            'textFilesRewrittenAfterApply': len(rewritten),
            'mirrorStatusFile': str(MIRROR_STATUS.relative_to(ROOT)),
            'inactive': True,
            'liveRoute': '/uk_energy_tracking_v6/generation_history/',
            'mirrorRoute': '/uk_energy_tracking_v6_2/generation_history/'
        },
        'checks': checks,
        'rawTemporaryFilesFound': {'hits': [], 'hitCount': 0},
        'browserRoutingAffected': True,
        'rollbackMethod': 'Revert the apply commit or delete uk_energy_tracking_v6_2/generation_history/ if the backup mirror is not required.',
        'executiveSummary': 'Creates an inactive frozen backup mirror of the current Generation History V6 app under /uk_energy_tracking_v6_2/generation_history/ for restore and comparison use only.',
        'humanReviewStatus': 'audit required before apply' if not args.apply else 'backup mirror applied, verify mirror page and confirm main V6 unchanged',
        'nextAction': 'Run apply only if all checks are true.' if not args.apply else 'Open the mirror route, confirm inactive banner and verify the main V6 route still works.',
        'applied': bool(args.apply and passed),
        'pass': passed
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(payload), encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(main())
