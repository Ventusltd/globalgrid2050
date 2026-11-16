import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const release='/uk_renewables_pipeline/202611161734/';
const live='https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/dist/pipeline_headlines.json';
const rankURL=live.replace(/\.json$/,'.rank.json');
const fixed='2026-11-16T14:00:00Z';
// Python producer supplies the actual sidecar consumed by browser JS.
const fixture=JSON.parse(execFileSync(process.env.PYTHON || 'python',['-c',`
import json
from automation.news.build_news_priority import build
from automation.news.tests.test_news_priority_export import document,raw
from automation.news.tests.test_news_algorithm import article
d=document([
 article('https://www.bloomberg.com/news/test-only', 'TEST FIXTURE: UK solar project financing announced', source='Bloomberg',date='2026-11-16T13:00:00Z'),
 article('https://www.gov.uk/news/test-only', 'TEST FIXTURE: UK solar planning policy announced <img src=x onerror=alert(1)>', source='GOV.UK',category='policy',date='2026-11-15T13:00:00Z'),
 article('https://news.example/undated','TEST FIXTURE: UK grid construction planned', source='Example publisher',date=None)
])
b=raw(d)
print(json.dumps({'body':b.decode(),'sidecar':build(b)}))
`],{cwd:root,encoding:'utf8'}));

async function install(page, mode='valid'){
  const d=JSON.parse(fixture.body), s=structuredClone(fixture.sidecar);
  let body=fixture.body;
  if(mode==='digest')s.input_sha256='0'.repeat(64);
  if(mode==='profile')s.profile_sha256='0'.repeat(64);
  if(mode==='duplicate')s.entries[1]=structuredClone(s.entries[0]);
  if(mode==='rank')s.entries[0].rank=2;
  if(mode==='source')s.entries[0].source='Unattributed';
  if(mode==='title')s.entries[0].title='Substituted headline';
  if(mode==='missing')s.entries.pop();
  if(mode==='foreign-link')s.entries[0].link='https://other.example/elsewhere';
  if(mode==='extra-field')s.entries[0].verification_status='VERIFIED';
  if(mode==='clock')s.as_of='2026-11-16T13:06:14Z';
  if(mode==='partial'||mode==='failed'){
    d.status=mode; d.counts.feeds_ok=mode==='failed'?0:49;d.counts.feeds_failed=mode==='failed'?50:1;
    body=JSON.stringify(d);
    const rebuilt=execFileSync(process.env.PYTHON||'python',['-c','import sys,json; from automation.news.build_news_priority import build; print(json.dumps(build(sys.stdin.buffer.read())))'],{cwd:root,input:body,encoding:'utf8'});
    Object.assign(s,JSON.parse(rebuilt));
  }
  await page.clock.setFixedTime(new Date(mode==='stale'?'2026-11-19T14:00:00Z':mode==='future'?'2026-11-16T13:00:00Z':fixed));
  const origin=new URL(test.info().project.use.baseURL).origin;
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url===live)return mode==='snapshot'?route.fulfill({status:503,body:'unavailable'}):route.fulfill({contentType:'application/json',body});
    if(url===rankURL){
      if(mode==='timeout')return new Promise(()=>{});
      return mode==='unavailable'?route.fulfill({status:404,body:'unavailable'}):route.fulfill({contentType:'application/json',body:JSON.stringify(s)});
    }
    if(mode==='snapshot'&&url===origin+release+'news/pipeline_headlines.snapshot.json')return route.fulfill({contentType:'application/json',body});
    if(url.startsWith(origin+'/'))return route.continue();
    return route.abort();
  });
}

async function ready(page){
  await page.goto(release);
  await expect(page.locator('#tbody')).toHaveAttribute('data-complete','true');
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
  await expect(page.locator('#liveNews .ln-item')).toHaveCount(3);
  await page.waitForFunction(()=>['accepted','rejected','unavailable'].includes(window.pipelineHeadlinePriorityState)
    || document.getElementById('newsStatus').getAttribute('data-state')==='snapshot');
}

test('priority is visible, credits retained, policy shown, text escaped and core pipeline intact',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await install(page);await ready(page);
  await expect(page.locator('#newsStatus')).toHaveAttribute('data-order','priority');
  await expect(page.locator('#liveNews .ln-title').first()).toContainText('planning policy');
  await expect(page.locator('#liveNews .ln-priority').first()).toContainText('Priority 1 · Government source');
  await expect(page.locator('#liveNews')).toContainText('Bloomberg');
  await expect(page.locator('#liveNews')).toContainText('Publisher date unknown');
  await expect(page.locator('#liveNews img')).toHaveCount(0);
  await expect(page.locator('#liveNews .ln-title').first()).toHaveAttribute('href','https://www.gov.uk/news/test-only');
  await expect(page.locator('#liveNews .ln-title').first()).toHaveAttribute('rel','noopener noreferrer');
  await expect(page.locator('#newsStatus')).toContainText('not project verification');
  await expect(page.locator('#evidenceCoverage')).toHaveAttribute('data-selection-count','1000');
  await page.locator('#search').fill('1018');
  await expect(page.locator('#repd-1018 a.atlaslink')).toHaveAttribute('href',/repd_ref=1018/);
  await page.locator('#clearFilters').click();
  const downloading=page.waitForEvent('download');await page.locator('#exportInline').click();
  const csv=await readFile(await (await downloading).path(),'utf8');
  expect(csv.trim().split(/\r?\n/)).toHaveLength(7776);
  await page.getByRole('tab',{name:'Global data centres',exact:true}).click();
  await expect(page.locator('#globalProjectPanel')).toContainText('12');
  await page.getByRole('tab',{name:'UK projects',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.newspaper').first().screenshot({path:info.outputPath('v926-news-block.png')});
  await page.screenshot({path:info.outputPath('v926-news-and-pipeline.png')});
  expect(errors).toEqual([]);
});

for(const mode of ['digest','profile','duplicate','rank','source','title','missing','foreign-link','extra-field','clock','unavailable','timeout']){
  test(`invalid priority ${mode} keeps credited date fallback`,async({page})=>{
    await install(page,mode);await ready(page);
    await expect(page.locator('#newsStatus')).toHaveAttribute('data-order','date');
    await expect(page.locator('#newsStatus')).toContainText('Priority unavailable');
    await expect(page.locator('#liveNews .ln-priority')).toHaveCount(0);
    await expect(page.locator('#liveNews')).toContainText('planning policy');
    await expect(page.locator('#liveNews .ln-title').first()).toHaveAttribute('href','https://www.bloomberg.com/news/test-only');
  });
}
for(const mode of ['stale','snapshot','failed','future']){
  test(`${mode} cannot promote a matching old rank`,async({page})=>{
    await install(page,mode);await ready(page);
    await expect(page.locator('#newsStatus')).toHaveAttribute('data-order','date');
    await expect(page.locator('#newsStatus')).toHaveAttribute('data-state',mode==='stale'?'overdue':mode);
    await expect(page.locator('#liveNews .ln-priority')).toHaveCount(0);
  });
}
test('partial source health remains explicit with accepted priority',async({page})=>{
  await install(page,'partial');await ready(page);
  await expect(page.locator('#newsStatus')).toHaveAttribute('data-order','priority');
  await expect(page.locator('#newsStatus')).toHaveAttribute('data-state','partial');
  await expect(page.locator('#newsStatus')).toContainText('49 sources succeeded, 1 failed');
});
