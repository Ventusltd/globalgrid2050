/* Drives the published page, not its library. Written because the library
   proofs passed while the page threw on load. */
import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const B = process.env.WAFER_BASE || 'http://127.0.0.1:8899/testcode/202609151339/';
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--use-angle=d3d11','--use-gl=angle','--enable-gpu','--ignore-gpu-blocklist']});
const cases=[
 ['boot',            B,                       t=>/250,174 numbered lines/.test(t.count)],
 ['self 3 to 3',     B+'?line=3&to=3',        t=>/same line/i.test(t.panel) && !/Joined by/.test(t.panel)],
 ['join 3 to 4',     B+'?line=3&to=4',        t=>/Joined by/.test(t.panel) && /clampInteger/.test(t.panel) && /co-membership/i.test(t.panel)],
 ['bad to=',         B+'?line=3&to=banana',   t=>/Refused/i.test(t.panel) && /banana/.test(t.panel)],
 ['bad line=',       B+'?line=12abc',         t=>/Refused/i.test(t.panel)],
 ['huge line=',      B+'?line=1e308',         t=>/Refused/i.test(t.panel)],
 ['never issued',    B+'?line=342794&to=3',   t=>/never issued/i.test(t.panel)],
 ['focus 2',         B+'?line=2',             t=>/empty line/.test(t.panel) && /2,281|families/.test(t.panel)],
];
let pass=0, fail=[];
for(const [name,url,ok] of cases){
  const p=await b.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await p.setViewport({width:430,height:900,deviceScaleFactor:2});
  await p.goto(url,{waitUntil:'load',timeout:60000});
  await new Promise(r=>setTimeout(r,7000));
  const t=await p.evaluate(()=>({
    count:document.getElementById('count').textContent,
    panel:(document.getElementById('panelbody').innerText||''),
    hidden:document.getElementById('panel').hidden,
    overflowX:document.documentElement.scrollWidth>window.innerWidth }));
  const good = errs.length===0 && !t.overflowX && ok(t);
  good?pass++:fail.push(`${name}: ${errs.length?'PAGE ERROR '+errs[0]:''}${t.overflowX?' overflowX':''} panel="${t.panel.replace(/\s+/g,' ').slice(0,110)}"`);
  console.log(`[${good?'PASS':'FAIL'}] ${name}`);
  await p.close();
}
await b.close();
if(fail.length){console.error('\nPAGE CHECK FAILED '+fail.length+' of '+cases.length+':\n- '+fail.join('\n- '));process.exit(1);}
console.log(`\npage check PASS — ${pass} cases in a 430px browser`);
