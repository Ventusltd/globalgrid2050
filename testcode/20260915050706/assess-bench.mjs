import fs from 'node:fs';
import {createHash} from 'node:crypto';
const [benchPath,fallbackPath,out]=process.argv.slice(2);
if (!out || fs.existsSync(out)) throw new Error('Supply bench report, fallback report, and a new output filename');
const raw=fs.readFileSync(benchPath),reproRaw=fs.readFileSync(fallbackPath);
const bench=JSON.parse(raw),repro=JSON.parse(reproRaw);
const mobile=bench.lenses.filter(x=>x.mobile);
const checks={
  ownerFunctionalChecks:bench.pass===true,
  mobileTargets:mobile.length===6&&mobile.every(x=>x.smallestTap?.px>=44),
  noWebGL2Fallback:repro.fallbackErrors.length===0,
  liveIndustryNest:repro.industryAfter===true&&repro.homepageErrors.length===0,
};
const report={
  utc:new Date().toISOString(),sourceCommit:'7edc6fbd7f2d19397c6106371e3ce8de0f8c8a5d',
  sourceHarnessSha256:bench.harnessSha256,
  benchSha256:createHash('sha256').update(raw).digest('hex'),
  supplementalSha256:createHash('sha256').update(reproRaw).digest('hex'),
  pass:Object.values(checks).every(x=>x===true),checks,
  failures:[...mobile.filter(x=>x.smallestTap?.px<44).map(x=>`${x.lens} at ${x.width}: ${x.smallestTap.area} ${x.smallestTap.w}x${x.smallestTap.h}px; minimum 44px`),...repro.fallbackErrors],
  renderer:[...new Set(bench.lenses.map(x=>x.renderer))],
  physicalPhoneTest:false,
  limits:['430px is desktop touch/viewport emulation at DPR2, not a physical phone.','FPS is a four-second requestAnimationFrame sample; it does not establish sustained thermal performance.','NVIDIA sampler describes a separate GPU from the Intel renderer and cannot attribute the renderer GPU utilisation.','The native owner harness does not define a pass field; the portable wrapper adds functional assertions. This assessment adds target-size and fallback requirements.']
};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.pass!==true)process.exitCode=1;
