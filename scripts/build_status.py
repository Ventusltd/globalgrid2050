"""Publish status.json as status.html.

The context window of a long session dies, and when it does the only thing that
survives is what was written down somewhere a person can open. This publishes
the session log to the live site at intervals, so the next session - human or
model - can recover where the work had got to without reading a transcript.

Build facts only. No correspondence, no client material, nothing private: this
page is public the moment it is pushed.

Times are UTC. The architect's clock is BST, +1, so each row shows both - the
mismatch has caused typed-stamp errors in this estate before.

    python scripts/build_status.py
"""
import html
import io
import json
import os
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_status():
    with io.open(os.path.join(ROOT, "status.json"), encoding="utf-8") as handle:
        return json.load(handle)


def both_clocks(stamp):
    """202609050227 -> ('2026-09-05 02:27 UTC', '03:27 BST')."""
    try:
        moment = datetime.strptime(stamp, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return html.escape(stamp), ""
    return (moment.strftime("%Y-%m-%d %H:%M UTC"),
            (moment + timedelta(hours=1)).strftime("%H:%M BST"))


def row(entry):
    utc, bst = both_clocks(str(entry.get("utc", "")))
    commit = html.escape(str(entry.get("commit", "")))
    repo = html.escape(str(entry.get("repo", "")))
    lane = html.escape(str(entry.get("lane", "")))
    what = html.escape(str(entry.get("what", "")))
    verified = html.escape(str(entry.get("verified", "")))
    return (
        '<article class="entry">'
        f'<p class="when">{utc}<span class="bst"> · {bst}</span>'
        f'<span class="lane">lane {lane}</span></p>'
        f'<p class="where"><span class="repo">{repo}</span> '
        f'<span class="commit">{commit}</span></p>'
        f'<p class="what">{what}</p>'
        f'<p class="verified">{verified}</p>'
        "</article>"
    )


def build():
    status = read_status()
    entries = sorted(status.get("entries", []),
                     key=lambda e: str(e.get("utc", "")), reverse=True)
    written = datetime.now(timezone.utc)
    written_utc = written.strftime("%Y-%m-%d %H:%M UTC")
    written_bst = (written + timedelta(hours=1)).strftime("%H:%M BST")

    open_items = "".join(f"<li>{html.escape(str(item))}</li>"
                         for item in status.get("open", []))

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GlobalGrid2050 — build status</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {{ background:#000; color:#fff; font-family:Courier,monospace; padding:40px;
         max-width:900px; margin:0 auto; font-size:18px; line-height:1.6; }}
  h1 {{ margin-top:0; font-size:40px; line-height:1.1; }}
  h2 {{ font-size:18px; font-weight:normal; letter-spacing:.14em; text-transform:uppercase;
        color:#888; margin:46px 0 6px; }}
  a {{ color:#66ccff; text-decoration:none; }}
  a:hover {{ text-decoration:underline; }}
  .lede {{ color:#cccccc; font-size:16px; }}
  .written {{ color:#888; font-size:15px; }}
  .entry {{ border-top:1px solid #222; padding-top:12px; margin-top:22px; }}
  .when {{ color:#66ccff; font-size:15px; margin:0; }}
  .bst {{ color:#6f8f9c; }}
  .lane {{ float:right; color:#888; }}
  .where {{ margin:2px 0 0; font-size:15px; color:#aaa; }}
  .repo {{ color:#fff; }}
  .commit {{ color:#8fb6c0; }}
  .what {{ margin:6px 0 0; font-size:16px; }}
  .verified {{ margin:2px 0 0; font-size:14px; color:#7f9f88; }}
  ul {{ padding-left:20px; }}
  li {{ margin-top:10px; font-size:16px; color:#ccc; }}
  @media (max-width:600px) {{
    body {{ padding:25px; font-size:16px; }}
    h1 {{ font-size:32px; }}
    .lane {{ float:none; display:block; }}
  }}
</style>
</head>
<body>
<header>
  <h1>Build status</h1>
  <p class="lede">What is being built, as it is built. Published at intervals so the
  work can be picked up again when a session ends — by a person or by the next model.
  Times are UTC first, because stamps in this estate are read from the clock in UTC;
  the second time is the same moment in British Summer Time.</p>
  <p class="written">Written {written_utc} · {written_bst}</p>
  <p><a href="./">← GlobalGrid2050</a></p>
</header>

<h2>Open</h2>
<ul>{open_items}</ul>

<h2>Log</h2>
{''.join(row(entry) for entry in entries)}

<footer>
  <p class="written">Build facts only. This page is public.</p>
</footer>
</body>
</html>
"""
    out = os.path.join(ROOT, "status.html")
    with io.open(out, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(page)
    print("status.html written: %d entries, %d bytes" % (len(entries), len(page)))


if __name__ == "__main__":
    build()
