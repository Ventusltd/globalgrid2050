#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def safe_rel(path_text: str) -> Path:
    path = Path(path_text)
    if not path_text or path.is_absolute() or ".." in path.parts:
        raise SystemExit(f"Unsafe path: {path_text}")
    return path


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"&", " and ", text)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "section"


def split_top_level_sections(text: str) -> tuple[str, list[dict[str, str]]]:
    matches = list(re.finditer(r"(?m)^# (\d+)\.\s+(.+)$", text))
    if not matches:
        raise SystemExit("No numbered top level sections found")

    preamble = text[: matches[0].start()].rstrip() + "\n"
    sections: list[dict[str, str]] = []

    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        number = match.group(1)
        title = match.group(2).strip()
        body = text[start:end].strip() + "\n"
        slug = f"{int(number):02d}_{slugify(title)}"
        sections.append({"number": number, "title": title, "slug": slug, "body": body})

    return preamble, sections


def extract_disclaimer(text: str) -> str:
    marker = "# Disclaimer"
    idx = text.find(marker)
    if idx < 0:
        return ""
    return text[idx:].strip() + "\n"


def remove_disclaimer_from_last_section(sections: list[dict[str, str]]) -> None:
    marker = "\n# Disclaimer"
    for section in sections:
        idx = section["body"].find(marker)
        if idx >= 0:
            section["body"] = section["body"][:idx].rstrip() + "\n"
            return


def write_section_pages(base_dir: Path, sections: list[dict[str, str]], page_title: str) -> None:
    sections_dir = base_dir / "sections"
    sections_dir.mkdir(parents=True, exist_ok=True)

    for idx, section in enumerate(sections):
        section_dir = sections_dir / section["slug"]
        section_dir.mkdir(parents=True, exist_ok=True)
        prev_link = ""
        next_link = ""
        if idx > 0:
            prev_section = sections[idx - 1]
            prev_link = f"Previous: [{prev_section['number']}. {prev_section['title']}](../{prev_section['slug']}/)  \n"
        if idx + 1 < len(sections):
            next_section = sections[idx + 1]
            next_link = f"Next: [{next_section['number']}. {next_section['title']}](../{next_section['slug']}/)  \n"

        nav = (
            f"[Back to {page_title}](../../)  \n"
            "[Print selected sections](../../print/)  \n"
            f"{prev_link}{next_link}\n"
        )
        content = section["body"].strip() + "\n\n---\n\n" + nav
        (section_dir / "index.md").write_text(content, encoding="utf-8")


def markdown_to_basic_html(md: str) -> str:
    out: list[str] = []
    in_list = False
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line:
            if in_list:
                out.append("</ul>")
                in_list = False
            continue
        if line.startswith("# "):
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append(f"<h1>{html.escape(line[2:].strip())}</h1>")
        elif line.startswith("## "):
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append(f"<h2>{html.escape(line[3:].strip())}</h2>")
        elif line.startswith("### "):
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append(f"<h3>{html.escape(line[4:].strip())}</h3>")
        elif line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{html.escape(line[2:].strip())}</li>")
        else:
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append(f"<p>{html.escape(line)}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


def write_print_page(base_dir: Path, sections: list[dict[str, str]], disclaimer: str, page_title: str) -> None:
    print_dir = base_dir / "print"
    print_dir.mkdir(parents=True, exist_ok=True)

    checklist = []
    bodies = []
    for section in sections:
        sid = section["slug"]
        label = f"{section['number']}. {section['title']}"
        checklist.append(
            f'<label><input type="checkbox" data-target="{sid}" checked> {html.escape(label)}</label>'
        )
        bodies.append(
            f'<section class="print-section" id="{sid}">\n{markdown_to_basic_html(section["body"])}\n</section>'
        )

    disclaimer_html = markdown_to_basic_html(disclaimer) if disclaimer else ""
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(page_title)} Print Builder</title>
<style>
body {{ font-family: system-ui, Arial, sans-serif; margin: 0; background: #080b0f; color: #f2f2f2; }}
a {{ color: #7dd3fc; }}
.wrap {{ max-width: 1100px; margin: 0 auto; padding: 24px; }}
.panel {{ border: 1px solid #334155; background: #111827; padding: 18px; border-radius: 12px; margin-bottom: 18px; }}
.checklist {{ columns: 2; column-gap: 28px; }}
.checklist label {{ display: block; break-inside: avoid; margin: 0 0 8px; line-height: 1.35; }}
button {{ margin: 6px 8px 6px 0; padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }}
.print-section {{ background: white; color: #111827; padding: 28px; margin: 18px 0; border-radius: 10px; }}
.print-section h1 {{ border-bottom: 2px solid #111827; padding-bottom: 8px; }}
.disclaimer {{ background: white; color: #111827; padding: 28px; margin: 18px 0; border-radius: 10px; }}
@media print {{
  body {{ background: white; color: black; }}
  .no-print {{ display: none !important; }}
  .wrap {{ max-width: none; padding: 0; }}
  .print-section, .disclaimer {{ break-inside: avoid; border-radius: 0; margin: 0 0 18px; padding: 0; }}
}}
</style>
</head>
<body>
<div class="wrap">
  <div class="panel no-print">
    <h1>{html.escape(page_title)} Print Builder</h1>
    <p>Select the sections required, then print or save as PDF from the browser.</p>
    <p><a href="../">Back to modular index</a></p>
    <button onclick="selectAll(true)">Select all</button>
    <button onclick="selectAll(false)">Clear all</button>
    <button onclick="applySelection()">Apply checklist</button>
    <button onclick="applySelection(); window.print();">Print selected</button>
    <div class="checklist">{''.join(checklist)}</div>
  </div>
  <main id="print-root">
    {''.join(bodies)}
    <section class="disclaimer">{disclaimer_html}</section>
  </main>
</div>
<script>
function selectAll(value) {{
  document.querySelectorAll('input[type="checkbox"][data-target]').forEach(cb => cb.checked = value);
}}
function applySelection() {{
  document.querySelectorAll('input[type="checkbox"][data-target]').forEach(cb => {{
    const el = document.getElementById(cb.dataset.target);
    if (el) el.style.display = cb.checked ? '' : 'none';
  }});
}}
</script>
</body>
</html>
"""
    (print_dir / "index.html").write_text(page, encoding="utf-8")


def write_main_index(base_dir: Path, preamble: str, sections: list[dict[str, str]], disclaimer: str, page_title: str) -> None:
    intro = preamble.strip()
    cards = []
    for section in sections:
        cards.append(f"- [{section['number']}. {section['title']}](sections/{section['slug']}/)")

    content = f"{intro}\n\n# Modular Section Index\n\nThis page is intentionally shallow. Each technical topic opens into its own subpage so readers can navigate the guidance without being overwhelmed by the full depth of the document.\n\n[Print selected sections](print/)\n\n" + "\n".join(cards) + "\n\n"
    if disclaimer:
        content += disclaimer
    (base_dir / "index.md").write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--report-dir", default="gridbot_reports")
    parser.add_argument("--page-title", default="Employers Requirements Large Scale Solar")
    args = parser.parse_args()

    target = REPO_ROOT / safe_rel(args.target)
    if not target.exists():
        raise SystemExit(f"Target missing: {target}")

    base_dir = target.parent
    original = target.read_text(encoding="utf-8")
    preamble, sections = split_top_level_sections(original)
    disclaimer = extract_disclaimer(original)
    remove_disclaimer_from_last_section(sections)

    timestamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_dir = REPO_ROOT / safe_rel(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{target.stem}_before_modularise_{timestamp}{target.suffix}"
    backup_path.write_text(original, encoding="utf-8")

    sections_dir = base_dir / "sections"
    if sections_dir.exists():
        shutil.rmtree(sections_dir)
    print_dir = base_dir / "print"
    if print_dir.exists():
        shutil.rmtree(print_dir)

    write_section_pages(base_dir, sections, args.page_title)
    write_print_page(base_dir, sections, disclaimer, args.page_title)
    write_main_index(base_dir, preamble, sections, disclaimer, args.page_title)

    manifest = {
        "generated_at_utc": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "target": args.target,
        "backup": str(backup_path.relative_to(REPO_ROOT)),
        "section_count": len(sections),
        "sections": [
            {"number": s["number"], "title": s["title"], "slug": s["slug"], "path": f"{base_dir.as_posix()}/sections/{s['slug']}/index.md"}
            for s in sections
        ],
        "print_page": f"{base_dir.as_posix()}/print/index.html",
    }
    (base_dir / "section_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    report_dir = REPO_ROOT / safe_rel(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"solar_er_modularise_{timestamp}.md"
    report_path.write_text(
        "# Solar ER Modularisation Report\n\n"
        f"UTC: {dt.datetime.utcnow().isoformat(timespec='seconds')}Z\n\n"
        f"Target: `{args.target}`\n\n"
        f"Backup: `{backup_path.relative_to(REPO_ROOT)}`\n\n"
        f"Sections generated: `{len(sections)}`\n\n"
        f"Print builder: `{base_dir.as_posix()}/print/index.html`\n\n"
        "Change: split top level numbered sections into clickable subpages and generated a checklist based print builder.\n",
        encoding="utf-8",
    )

    print(f"Modularised {target.relative_to(REPO_ROOT)}")
    print(f"Sections generated: {len(sections)}")
    print(f"Backup: {backup_path.relative_to(REPO_ROOT)}")
    print(f"Report: {report_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
