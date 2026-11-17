"""Inherited features, including explicit, executable presentation migrations.

Migration contracts are code-reviewed validators, not aliases for missing strings.
An unknown contract fails. The original release's marker remains independently
checked; only descendants declaring this migration use its stronger contract.
"""
import json
import hashlib
import re
from html.parser import HTMLParser

from common import data_digest


SOLAR_MIGRATION = {"id": "solar1000-pilot", "from": "202611161244", "contract": "solar1000-inline-v1"}
NEWS_MIGRATION = {"id": "news-editorial-priority", "from": "202611161734", "contract": "news-priority-internal-v1"}
GLOBAL_DC_MIGRATION = {"id": "global-dc-tab", "from": "202611161630", "contract": "global-dc-ui-v928-v1"}
RESEARCH_MIGRATIONS = [
    {"id": feature, "from": "202611161747", "contract": "research-priority-internal-v1"}
    for feature in ("inline-research-priority", "source-bound-priority")
]
NEON_MIGRATIONS = [{"id": feature, "from": "202611171507", "contract": "ticker-neon-v940-v1"}
                   for feature in ("v936-ticker-contract", "v936-ticker-bounded-static")]
KNOWN_MIGRATIONS = [SOLAR_MIGRATION, NEWS_MIGRATION, *RESEARCH_MIGRATIONS, GLOBAL_DC_MIGRATION, *NEON_MIGRATIONS]
MIGRATION_FLAGS = {
    "solar1000-inline-v1": [SOLAR_MIGRATION],
    "news-priority-internal-v1": [NEWS_MIGRATION],
    "research-priority-internal-v1": RESEARCH_MIGRATIONS,
    "global-dc-ui-v928-v1": [GLOBAL_DC_MIGRATION],
    "ticker-neon-v940-v1": NEON_MIGRATIONS,
}


def _ticker_neon(folder, source):
    """Explicit owner presentation replacement; historical static feature stays intact."""
    failures = []
    contract = json.loads((folder / "contracts/ticker.v940.json").read_text(encoding="utf-8"))
    if contract.get("schema") != "globalgrid2050.neon-headline-ticker.v940" or contract.get("limit") != 100:
        failures.append("invalid moving ticker contract")
    shared = folder.parents[1] / "automation/ticker_neon_ui/20261117-v940"
    hashes = contract.get("shared_sha256", {})
    if set(hashes) != {"ticker.mjs", "header.mjs", "styles.css"}:
        failures.append("incomplete shared successor pins")
    for name, digest in hashes.items():
        if name not in {"ticker.mjs", "header.mjs", "styles.css"} or hashlib.sha256((shared / name).read_bytes()).hexdigest() != digest:
            failures.append("changed shared ticker/header bytes")
    if data_digest(folder) != data_digest(source) or (folder / "scripts/layers/model.mjs").read_bytes() != (source / "scripts/layers/model.mjs").read_bytes():
        failures.append("changed inherited source data or headline selection policy")
    binding = "import {latestHeadlines} from './model.mjs';\nimport {createTickerRenderer} from '../../../../automation/ticker_neon_ui/20261117-v940/ticker.mjs';\nexport const renderTicker=createTickerRenderer(latestHeadlines);\n"
    if (folder / "scripts/layers/ticker.mjs").read_text(encoding="utf-8") != binding:
        failures.append("missing shared ticker binding")
    probe = "(()=>{const t=document.querySelector('#headlineTicker'),q=document.querySelector('.pn-news-header-search input'),c=t?.querySelector('.pn-ticker-copy');return !!q&&q.closest('.masthead')&&t.querySelectorAll('input,button').length===0&&t.querySelectorAll('ul').length===1&&!!c&&c.hasAttribute('inert')&&c.getAttribute('aria-hidden')==='true'&&c.querySelectorAll('a,[tabindex]').length===0;})()"
    return failures, [{"name": "V9.40 singular main header query and one semantic ticker list", "selector": "#headlineTicker", "js": probe}]
INTERNAL_PRIORITY_IDS = {NEWS_MIGRATION["id"], *(m["id"] for m in RESEARCH_MIGRATIONS)}
DC_PINS = {
    "projects.json": "faf617d9979151b7d309554cb1cd59d343f70b9d60616f90db45e5c2a227d449",
    "official-projects.json": "bcf6473bebe78e7a7dab566b1998ea51237d653c5a8584420690c2cea9a5180f",
    "project-groups.json": "b77afd5846a3c27697e49664fabb4c0020a81a88ccaa680fb5130f6d6d1b8970",
    "selection-audit.json": "faa79b4651d62baee822b8e6f748e447d0b8aebbe1c8c13beafd81d973b1c592",
}


def _global_dc_ui(folder, source):
    failures = []
    for name, digest in DC_PINS.items():
        if hashlib.sha256((folder / "global-datacentres" / name).read_bytes()).hexdigest() != digest:
            failures.append(f"changed accepted 100-lead recovery input: {name}")
    projects = json.loads((folder / "global-datacentres/projects.json").read_text(encoding="utf-8"))
    original = json.loads((source / "global-datacentres/projects.json").read_text(encoding="utf-8"))
    rows, baseline = projects["records"], original["records"]
    by_id = {row["id"]: row for row in rows}
    if len(rows) != 100 or len(by_id) != 100 or len(baseline) != 12:
        failures.append("invalid recovered/original Data Centre populations")
    def semantic(row):
        value = json.loads(json.dumps(row))
        value["source"].pop("retrieved_at", None)
        return value
    if any(row["id"] not in by_id or semantic(by_id[row["id"]]) != semantic(row) for row in baseline):
        failures.append("lost original 12 Data Centre semantic identities")
    if (sum(row["country"]["code"] == "GB" for row in rows) != 54
            or any(row["operating_status"] != "not_assessed" or row["verification_status"] != "SOURCE_INDEXED"
                   or any(value is not None for value in row["capacity"].values()) for row in rows)):
        failures.append("unsupported Data Centre operation/capacity or changed UK population")
    if data_digest(folder) != data_digest(source):
        failures.append("official REPD data changed by Data Centre presentation migration")
    html = _Scripts((folder / "index.html").read_text(encoding="utf-8"))
    if not {"datacentreTab", "datacentrePanel", "datacentreHost"} <= html.ids:
        failures.append("missing consolidated Data Centre tab/host")
    for script in ("../../automation/news/datacentre-ui/model.js", "../../automation/news/datacentre-ui/view.js",
                   "scripts/plugins/preview-v928.js"):
        if script not in html.sources:
            failures.append(f"missing Data Centre dependency wiring: {script}")
    host = (folder / "scripts/plugins/preview-v928.js").read_text(encoding="utf-8")
    if any(marker not in host for marker in ("!dcStarted", "GGDataCentreUI.mount", "dcInputs", "datacentreHost")):
        failures.append("missing lazy integrity-pinned host implementation")
    if "scripts/plugins/global-datacentres-v925.js" in html.sources:
        failures.append("old competing Data Centre renderer still wired")
    probe = {"name": "Data Centre migration: actual lazy tab, original source states and no extra principal panel",
             "selector": "body", "js": """(async () => {
const host=document.querySelector('#datacentreHost'),tab=document.querySelector('#datacentreTab');
if(!host||!tab||!window.GGDataCentreModel?.validateBundle)return false;
const previous=document.querySelector('#officialRegister [role=tab][aria-selected=true]');
try{
tab.click();const stop=performance.now()+6000;
while(host.querySelectorAll('.ggdc-table tbody tr').length!==54&&performance.now()<stop)await new Promise(r=>setTimeout(r,25));
if(host.querySelectorAll('.ggdc-table tbody tr').length!==54||document.querySelectorAll('main>section').length!==2)return false;
const global=[...host.querySelectorAll('button')].find(n=>n.textContent==='Global leads (100)');
if(!global)return false;global.click();
if(host.querySelectorAll('.ggdc-table tbody tr').length!==100||!host.innerText.includes('not assessed'))return false;
const paths=['projects.json','official-projects.json','project-groups.json','selection-audit.json'];
const docs=await Promise.all(paths.map(async path=>{const r=await fetch('global-datacentres/'+path);if(!r.ok)throw Error('Data Centre input absent');return r.json();}));
const baseline=await fetch('../202611161630/global-datacentres/projects.json').then(r=>r.json());
const bundle={projects:docs[0],official:docs[1],groups:docs[2],audit:docs[3],baseline};
GGDataCentreModel.validateBundle(bundle);
const forged=structuredClone(bundle);forged.projects.records[0].capacity.it_load_mw=100;
let rejected=false;try{GGDataCentreModel.validateBundle(forged);}catch{rejected=true;}
return rejected&&docs[0].records.length===100&&baseline.records.length===12&&docs[3].quarantined.length===38
&&docs[0].records.every(r=>r.operating_status==='not_assessed'&&Object.values(r.capacity).every(v=>v===null));
}finally{const uk=[...host.querySelectorAll('button')].find(n=>n.textContent==='UK leads (54)');uk?.click();previous?.click();}
})()"""}
    return failures, [probe]


class _Scripts(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.sources, self.ids = [], set()
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "script" and isinstance(attrs.get("src"), str):
            self.sources.append(attrs["src"].split("?", 1)[0])


def _news_internal(folder, source):
    failures = []
    if data_digest(folder) != data_digest(source):
        failures.append("official data changed from internal-news migration source")
    html = _Scripts((folder / "index.html").read_text(encoding="utf-8"))
    plugin = (folder / "scripts/plugins/live-news.js").read_text(encoding="utf-8")
    original = (source / "scripts/plugins/live-news.js").read_text(encoding="utf-8")
    if "scripts/plugins/live-news.js" not in html.sources:
        failures.append("source-attributed headline renderer is not wired")
    # Retain the exact cryptographic envelope validator while presentation may
    # change. A schema string alone cannot stand in for the accepted algorithm.
    pattern = r"async function validatePriority\(.*?(?=\n  function when\()"
    before, after = re.search(pattern, original, re.S), re.search(pattern, plugin, re.S)
    if before is None or after is None or before.group() != after.group():
        failures.append("exact-input priority validation was changed or removed")
    for marker in ("globalgrid2050.news.headline-priority.v1", "priorities.get(doc)",
                   "validatePriority(doc, bytes", "item.source", "safeLink(item.link)"):
        if marker not in plugin:
            failures.append(f"missing internal headline implementation: {marker}")
    snapshot = json.loads((folder / "news/pipeline_headlines.snapshot.json").read_text(encoding="utf-8"))
    if (not isinstance(snapshot, dict) or snapshot.get("schema") != "globalgrid2050.news.pipeline-headlines.v1"
            or not isinstance(snapshot.get("items"), list)
            or any(not isinstance(item, dict) or not all(isinstance(item.get(k), str) and item[k] for k in ("title", "source", "link"))
                   for item in snapshot.get("items", []))):
        failures.append("headline snapshot lost original source/title/link provenance")
    # This is an explicitly synthetic renderer/sidecar test, not source evidence.
    probe = {"name": "Internal headline priority: reject forged receipts, retain ranked attribution without visible scores",
             "selector": "body", "js": """(async () => {
const p=window.pipelineHeadlines, original=window.pipelineHeadlineDocument;
if(!p?.validatePriority||!p?.render)return false;
const now=Date.now(),stamp=new Date(now).toISOString();
const items=[{title:'Synthetic older ranked headline',source:'Synthetic source A',link:'https://example.org/v928-a',date:new Date(now-86400000).toISOString(),first_seen:stamp},
{title:'Synthetic newer headline',source:'Synthetic source B',link:'https://example.org/v928-b',date:stamp,first_seen:stamp}];
const doc={schema:p.schema,generated_at:stamp,status:'ok',items,counts:{feeds_ok:2,feeds_failed:0}};
const bytes=new TextEncoder().encode(JSON.stringify(doc));
const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const side={schema:p.prioritySchema,input_sha256:hash,input_bytes:bytes.byteLength,input_generated_at:stamp,input_count:2,as_of:stamp,
profile_id:'uk-transition-global-context.v1',profile_sha256:'06250f2435088a522d8d25676f31f813165a430df1e19f602bd8baae03961c05',
entries:items.map((v,i)=>({...v,rank:i+1,source_kind:'government',role:'primary_context',topics:['solar'],freshness_state:'current',uk_context:true,score:99-i,requires_primary_followup:false,subscription_notice:false}))};
side.entries=side.entries.map(({date,first_seen,...entry})=>entry);
try{
const bad=structuredClone(side);bad.input_sha256='0'.repeat(64);
if(await p.validatePriority(doc,bytes,bad))return false;
const forged=structuredClone(side);forged.entries[0].source='Forged attribution';
if(await p.validatePriority(doc,bytes,forged))return false;
if(!await p.validatePriority(doc,bytes,side))return false;
p.render(doc,'live',now);
const rows=[...document.querySelectorAll('#liveNews .ln-item')];
const visible=n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().width>0;
return rows.length===2&&rows.every((r,i)=>r.querySelector('.ln-title')?.href===items[i].link&&r.querySelector('.ln-title')?.textContent===items[i].title&&r.querySelector('.ln-meta')?.textContent.includes(items[i].source))
&&document.querySelector('#newsStatus')?.dataset.order==='priority'&&![...document.querySelectorAll('#liveNews .ln-priority')].some(visible)
&&!/\\bPriority\\s+\\d/.test(document.querySelector('#liveNews')?.innerText||'');
}finally{p.render(original,'snapshot');}
})()"""}
    return failures, [probe]


def _research_internal(folder, source):
    failures = []
    if data_digest(folder) != data_digest(source):
        failures.append("official data changed from internal-research migration source")
    preserved = ("prospecting/manifest.json", "prospecting/priority.json", "prospecting/priority.csv",
                 "scripts/plugins/research-priority-v927.js", "scripts/plugins/prospecting/adapter.mjs",
                 "scripts/plugins/prospecting/bundle.mjs", "scripts/plugins/prospecting/view.mjs")
    for relative in preserved:
        if (folder / relative).read_bytes() != (source / relative).read_bytes():
            failures.append(f"changed retained internal research artifact: {relative}")
    manifest_bytes = (folder / "prospecting/manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    if not isinstance(manifest, dict):
        return failures + ["invalid retained research manifest"], []
    if (manifest.get("schema") != "globalgrid2050.prospecting.export.v1"
            or manifest.get("publication_state") != "REVIEW_ARTIFACT"
            or [manifest.get(k) for k in ("official_count", "solar_count", "solar1000_count")] != [7775, 3604, 1000]):
        failures.append("retained research provenance/population state changed")
    for name in ("priority.json", "priority.csv"):
        raw = (folder / "prospecting" / name).read_bytes()
        pin = manifest["files"][name]
        if pin["bytes"] != len(raw) or pin["sha256"] != hashlib.sha256(raw).hexdigest():
            failures.append(f"retained research receipt differs: {name}")
    html = _Scripts((folder / "index.html").read_text(encoding="utf-8"))
    if "researchPriorityStatus" in html.ids or "scripts/plugins/research-priority-v927.js" in html.sources:
        failures.append("withdrawn research-score presentation is still wired")
    digest = hashlib.sha256(manifest_bytes).hexdigest()
    probe = {"name": "Internal research priority: execute retained pinned parser without public score presentation",
             "selector": "body", "js": """(async () => {
const visible=n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().width>0;
if([...document.querySelectorAll('.v927-priority-hint,[data-priority-id],#researchPriorityStatus')].some(visible))return false;
const [m,p]=await Promise.all(['prospecting/manifest.json','prospecting/priority.json'].map(async path=>{const r=await fetch(path);if(!r.ok)throw Error('retained research unavailable');return new Uint8Array(await r.arrayBuffer());}));
const parser=await import(new URL('scripts/plugins/prospecting/bundle.mjs',location.href).href);
const bundle=await parser.parsePriorityBundle(p,m,""" + json.dumps(digest) + """);
return bundle.members.size===7775&&bundle.byId.size===1000&&bundle.manifest.solar1000_count===1000
&&bundle.manifest.publication_state==='REVIEW_ARTIFACT'&&document.querySelector('#tbody')?.dataset.complete==='true'
&&![...document.querySelectorAll('.v927-priority-hint,[data-priority-id],#researchPriorityStatus')].some(visible);
})()"""}
    return failures, [probe]


def _solar_inline(folder, source):
    failures, probes = [], []
    for relative in ("solar1000/manifest.json", "solar1000/candidates.json"):
        if (folder / relative).read_bytes() != (source / relative).read_bytes():
            failures.append(f"changed frozen {relative}")
    manifest = json.loads((folder / "solar1000/manifest.json").read_text(encoding="utf-8"))
    ids = manifest.get("ids", [])
    if (len(ids) != 1000 or any(not isinstance(i, str) or not i.isascii() or not i.isdecimal() for i in ids)
            or len(set(ids)) != 1000 or sorted(ids, key=int) != ids
            or manifest.get("selection") != "numeric-repd-ref-ascending"
            or manifest.get("selection_count") != 1000 or manifest.get("record_count") != 7775
            or manifest.get("independently_verified") != 0):
        failures.append("invalid frozen Solar-1000 membership/order/counts")
    candidates = json.loads((folder / "solar1000/candidates.json").read_text(encoding="utf-8"))
    if len(candidates) != 2 or any(c.get("repd_ref") not in ids for c in candidates):
        failures.append("invalid inherited source candidates")
    if data_digest(folder) != data_digest(source):
        failures.append("official data changed from migration source")
    html = (folder / "index.html").read_text(encoding="utf-8")
    plugin = (folder / "scripts/plugins/solar1000-v924.js").read_text(encoding="utf-8")
    for marker in ('id="evidenceCoverage"', 'data-evidence-selection', 'data-evidence-status',
                   'src="scripts/plugins/solar1000-v924.js'):
        if marker not in html:
            failures.append(f"missing inline wiring: {marker}")
    for marker in ("solar1000/manifest.json", "solar1000/candidates.json", "pipeline-projects-rendered",
                   ".project-record", "integratedEvidence", "renderEvidence"):
        if marker not in plugin:
            failures.append(f"missing inline implementation: {marker}")
    # Runtime probes prove the retained sources are reachable inside the existing
    # project records; static marker checks alone cannot establish this migration.
    probes.append({"name": "Solar-1000 migration: unchanged selection in consolidated register", "selector": "body",
                   "js": "document.querySelector('#evidenceCoverage')?.dataset.selectionCount==='1000' && !document.querySelector('#solar1000Pilot') && document.querySelector('#tbody')?.dataset.complete==='true'"})
    for candidate in candidates:
        ref, url = candidate["repd_ref"], candidate["source_url"]
        probes.append({"name": f"Solar-1000 migration: inherited source inside project {ref}", "search": ref,
                       "row": f"repd-{ref}", "selector": ".project-record",
                       "js": "(() => {const d=document.querySelector(" + json.dumps(f"#repd-{ref} .project-record") + ");"
                             "if(!d)return false;d.open=true;const h=d.querySelector('[data-integrated-evidence]');"
                             "const e=h?.querySelector('[data-evidence-project]');const a=h?.querySelector('.v925-inherited-source a');"
                             "return !!h&&!!e&&h.dataset.integratedEvidence===" + json.dumps(ref) +
                             "&&e.dataset.evidenceProject===" + json.dumps(ref) + "&&a?.href===" + json.dumps(url) +
                             "&&a.getBoundingClientRect().width>0&&h.textContent.includes('unverified')&&d.open;})()"})
    return failures, probes


def check_features(version, by_id, pipeline):
    """Return the offline verdict and mandatory browser probes for migrations."""
    inherited, dropped, migrations, errors = [], set(), {}, []
    node, visited = version, set()
    while node:
        if node["id"] in visited:
            errors.append("cyclic feature ancestry")
            break
        visited.add(node["id"])
        dropped |= set(node.get("removed_features", []))
        inherited = [(f, node["id"]) for f in node["features"] if f["id"] not in dropped] + inherited
        local_migration_ids = set()
        for migration in node.get("feature_migrations", []):
            if not isinstance(migration, dict) or migration not in KNOWN_MIGRATIONS:
                errors.append("unknown feature migration contract")
                continue
            if migration["id"] in local_migration_ids:
                errors.append("duplicate feature migration")
            local_migration_ids.add(migration["id"])
            # A descendant may explicitly restate the same audited contract;
            # duplicates within one declaration remain invalid.
            if migration["id"] in migrations and migrations[migration["id"]] != migration:
                errors.append("conflicting inherited feature migration")
            migrations.setdefault(migration["id"], migration)
        node = by_id.get(node["parent"])
    if dropped & INTERNAL_PRIORITY_IDS:
        errors.append("internal priority features require an audited migration, not removal")
    folder = pipeline / version["id"]
    missing, receipts, probes = [], [], []
    for feature_id, migration in migrations.items():
        origins = [origin for feature, origin in inherited if feature["id"] == feature_id]
        faults = []
        if origins != [migration["from"]] or feature_id in dropped or version["id"] == migration["from"]:
            faults.append("migration must preserve its exact inherited feature and source")
        else:
            try:
                validator = {"solar1000-inline-v1": _solar_inline,
                             "news-priority-internal-v1": _news_internal,
                             "research-priority-internal-v1": _research_internal,
                             "global-dc-ui-v928-v1": _global_dc_ui,
                             "ticker-neon-v940-v1": _ticker_neon}[migration["contract"]]
                faults, runtime = validator(folder, pipeline / migration["from"])
                probes.extend(runtime)
            except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
                # Paths may be private locally; public verdicts contain no exception path.
                faults = [f"invalid or unavailable migration input ({type(exc).__name__})"]
        receipts.append(dict(migration, **{"pass": not faults, "failures": faults}))
        if faults:
            missing.append(feature_id)
    for feature, _ in inherited:
        if feature["id"] in migrations:
            continue
        path = folder / feature["file"]
        if not path.is_file() or feature["contains"] not in path.read_text(encoding="utf-8", errors="replace"):
            missing.append(feature["id"])
    probes = list({probe["name"]: probe for probe in probes}.values())
    return {"pass": not missing and not errors, "features": [f["id"] for f, _ in inherited],
            "missing": missing, "withdrawn_on_purpose": sorted(dropped),
            "migrations": receipts, "errors": errors}, probes
