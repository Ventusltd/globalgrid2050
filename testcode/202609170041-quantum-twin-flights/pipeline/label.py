"""Step LABEL: what each app IS, in plain British English, so a person learns the kinds by looking:
an engine (pure calculations, no screen), a website, an API (data for other programs), a calculator, a dictionary,
a catalogue, rules, reports, notes, or just HTML with nothing to see. Known apps are labelled by hand; unknown ones
by simple evidence (what files the clone holds). Writes labels.json. Deterministic."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub'))
KNOWN = {
 'gridatlas': ('website', 'the map of the GB grid: substations, lines, projects, with tools on top'),
 'globalgrid2050': ('website', 'the home page: mission, atlas, engine, test pages, all in one place'),
 'pipelinenews': ('website', 'news on grid and renewable projects, updated as they move'),
 'ventus-grid-engine': ('engine', 'pure calculations for connections, cables and demand; no screen of its own'),
 'cable-trench-or-drill': ('calculator', 'works out whether a cable route should be trenched or drilled'),
 'grid-distance-maths': ('engine', 'the maths of distance on the earth, used by the atlas'),
 'cvaa': ('rules', 'checks that other code must pass before it is trusted; a vaccine against old mistakes'),
 'stars': ('reports', 'daily summaries of test results across the estate'),
 'star-solar-star': ('reports', 'a daily record of GB solar output and projects'),
 'star-sector-star': ('reports', 'market sizing by sector, aggregates only'),
 'star-electron-star': ('website', 'this page: the wafer with a command box on top'),
 'star-quantum-twin': ('website', 'the quantum twin star: every block as a two-state atom'),
 'elements': ('catalogue', 'every element, app, surface and function with a permanent key'),
 'grid-dictionary': ('dictionary', 'grid terms A to Z, tied to the code that uses them'),
 'code-generator': ('tool', 'writes new apps from work orders'),
 'testcode': ('laboratory', 'test pages, one folder per experiment'),
 'galaxies-wafers': ('website', 'maps of all our code, drawn as galaxies and wafers'),
 'spiders': ('maps', 'dead ends in the code, hunted and explained'),
 'control-pad': ('tool', 'a control surface for the estate'),
 'data-grid-gb': ('data', 'connection points and grid data for GB; an API of files'),
 'data-gridatlas': ('data', 'the atlas\'s own data files'), 'data-interconnectors': ('data', 'interconnector records'),
 'data-gb-electricity': ('data', 'GB electricity records'), 'data-centres-gb': ('data', 'data centres in GB'),
 'companies': ('data', 'company records used for market sizing'), 'claude': ('notes', 'working notes from the AI sessions'),
 'registry_of_all_content_in_repos_and_dependencies': ('catalogue', 'what every repository contains and depends on'),
 'reports': ('reports', 'written reports'), 'teleprinter': ('tool', 'prints a page\'s source as one record'),
 'layout-tool': ('calculator', 'lays out equipment on a site'), 'gpu-drivers-for-global-grid': ('notes', 'graphics driver notes for the machines'),
 'linux-for-the-power-grid': ('notes', 'operating system notes for grid machines'), 'gridmachine1': ('notes', 'a machine\'s own notes'), 'gemini': ('notes', 'transcripts with another AI'),
 'chatgpt-audits': ('notes', 'audits written by another AI'),
}
def evidence(name):
    clone = os.path.join(GH, name)
    if not os.path.isdir(clone): return ('unknown', 'no local copy to look at')
    files = set(os.listdir(clone)); js = any(f.endswith(('.js', '.mjs')) for f in files); html = 'index.html' in files; data = any(f.endswith(('.json', '.csv', '.parquet')) for f in files)
    if html and js: return ('website', 'a page with code behind it')
    if html: return ('html', 'just HTML: nothing to see here beyond the page itself')
    if js: return ('engine', 'code with no page of its own')
    if data: return ('data', 'files of data, no page')
    return ('notes', 'text only')
A = json.load(open(os.path.join(ROOT, 'apps.json'), encoding='utf-8'))
labels = {}
for a in A['apps']:
    kind, what = KNOWN.get(a['name'], evidence(a['name']))
    labels[a['name']] = {'kind': kind, 'what': what, 'blocks': a['keys'], 'app': a['app']}
KINDS = {'engine': 'an engine: calculations with no screen', 'website': 'a website: pages people open', 'api': 'an API: data for other programs', 'calculator': 'a calculator: numbers in, an answer out', 'dictionary': 'a dictionary', 'catalogue': 'a catalogue', 'rules': 'rules that code must pass', 'reports': 'reports built on a schedule', 'notes': 'notes: words, not code', 'html': 'just HTML: nothing to see here', 'data': 'data files', 'tool': 'a tool', 'laboratory': 'a laboratory of test pages', 'maps': 'maps', 'unknown': 'not yet labelled'}
out = {'kinds': KINDS, 'labels': labels, 'english': 'British'}
if not labels: sys.exit('FAIL: no apps to label')
json.dump(out, open(os.path.join(ROOT, 'labels.json'), 'w'), separators=(',', ':'))
counts = {}
for v in labels.values(): counts[v['kind']] = counts.get(v['kind'], 0) + 1
print(json.dumps({'step': 'label', 'apps': len(labels), 'kinds': counts}))
