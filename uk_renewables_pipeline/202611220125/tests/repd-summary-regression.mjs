import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
const base = process.env.HUD_URL || 'http://127.0.0.1:8765/uk_renewables_pipeline/202611201709/';
for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:393,height:852},reducedMotion:'reduce'});
    await page.goto(base+'?technology=all',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(() => document.querySelector('#tbody')?.dataset.total === '7775' &&
      document.querySelector('#evidenceCoverage')?.dataset.selectionCount === '1000' &&
      /Evidence snapshot|Evidence unavailable/.test(document.querySelector('[data-evidence-status]')?.textContent || ''),
      null,{timeout:90000});
    const canonical = await page.evaluate(async () => {
      const {loadCanonicalProjectsV9_5_1} = await import(new URL('scripts/data/canonical-projects-v9-5-1.js',location.href).href);
      const {shortProjectName} = await import(new URL('scripts/plugins/projects-v9-8.js',location.href).href);
      const {projects} = await loadCanonicalProjectsV9_5_1();
      const manifest = await fetch('solar1000/manifest.json').then(r=>r.json());
      return {projects:projects.map(p=>({id:String(p.repd_ref),name:p.name,short:shortProjectName(p.name),status:p.status||'Status not supplied',mw:p.capacity_mw})),ids:manifest.ids.map(String)};
    });
    const expected = new Map(canonical.projects.map(p=>[p.id,p]));
    const cohort = new Set(canonical.ids);
    assert.equal(expected.size,7775);
    assert.equal(cohort.size,1000);
    const lyneham=expected.get('2203');
    assert.match(lyneham.name,/Bradenstoke/i);
    assert.equal(lyneham.status,'Operational');assert.equal(lyneham.mw,69.8);
    const seen = new Set();let evidenceCount=0;
    const readRows = () => page.locator('#tbody > tr[id^="repd-"]').evaluateAll(rows=>rows.map(row=>{
      const s=row.querySelector('td.site .project-record > summary');
      const name=s?.querySelector('.phone-project-label'), status=s?.querySelector('.phone-project-status');
      const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible'&&getComputedStyle(e).display!=='none';
      return {id:row.id.slice(5),name:name?.textContent,title:name?.title,status:status?.textContent,
        visible:visible(name)&&visible(status), desktop:row.querySelector('.compact-project-name')?.textContent,
        evidence:!!row.querySelector('[data-integrated-evidence]'),mw:row.querySelector('td.mw')?.textContent};
    }));
    // Visit every page through the actual UI render and evidence event, not merely source data.
    const pages=Number(await page.locator('#tbody').getAttribute('data-pages'));
    assert.equal(pages,156);
    for(let n=1;n<=pages;n++){
      const rows=await readRows();
      assert.equal(rows.length, n===pages?25:50);
      for(const row of rows){
        const p=expected.get(row.id);
        assert.ok(p, 'Unknown record '+row.id);assert.ok(!seen.has(row.id),'Duplicate '+row.id);
        assert.equal(row.name,p.short,'Mobile name REPD '+row.id);
        assert.equal(row.title,p.name,'Full name REPD '+row.id);
        assert.equal(row.desktop,p.name,'Desktop name REPD '+row.id);
        assert.equal(row.status,p.status,'Status REPD '+row.id);
        assert.ok(row.visible,'Hidden name/status REPD '+row.id);
        assert.equal(row.evidence,cohort.has(row.id),'Evidence membership REPD '+row.id);
        if(row.evidence)evidenceCount++;
        if(row.id==='2203')assert.equal(row.mw,'69.8 MWp');
        seen.add(row.id);
      }
      if(n<pages){
        await page.locator('#projectPager [data-page-step="1"]').evaluate(b=>b.click());
        await page.waitForFunction(n=>document.querySelector('#tbody')?.dataset.page===String(n),n+1);
      }
    }
    assert.equal(seen.size,7775);assert.equal(evidenceCount,1000);
    // Search re-render and desktop switch; evidence remains available behind the summary.
    console.log(engine+': PASS all 7775 rendered rows and 1000 evidence memberships; starting interactive checks');
    const filters = page.locator('.compact-register-filters');
    if (!(await filters.evaluate(e=>e.open))) await filters.locator(':scope > summary').click();
    await page.locator('#search').fill('Bradenstoke');
    const row=page.locator('#repd-2203');
    await row.waitFor();
    assert.equal(await row.locator('.phone-project-label').isVisible(),true);
    assert.equal(await row.locator('.phone-project-status').isVisible(),true);
    await row.locator('td.site .project-record > summary').click();
    assert.equal(await row.locator('[data-integrated-evidence]').isVisible(),true);
    await row.locator('td.site .project-record > summary').click();
    await page.setViewportSize({width:1440,height:900});
    assert.equal(await row.locator('.compact-project-name').isVisible(),true);
    assert.equal(await row.locator('.desktop-details-label').textContent(),'PROJECT RECORD · SOURCES');
    assert.equal(await row.locator('td:nth-child(6)').textContent(),'Operational');
    console.log(engine+': PASS 7775 unique rendered REPD rows; 1000 evidence summaries; Bradenstoke mobile and desktop');
  } finally {await browser.close();}
}
