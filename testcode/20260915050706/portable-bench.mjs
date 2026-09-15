// Run the committed Generator measurement harness without changing its owner files.
// PUPPETEER_MODULE, CHROME_PATH, BENCH_OUT, BENCH_BASE are required.
// Evidence is desktop viewport/touch emulation; it is not a physical phone test.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceFile = path.join(root, 'testcode/202609142225/proof/bench.mjs');
const original = fs.readFileSync(sourceFile, 'utf8');
for (const key of ['PUPPETEER_MODULE', 'CHROME_PATH', 'BENCH_OUT', 'BENCH_BASE']) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}
const out = path.resolve(process.env.BENCH_OUT);
if (fs.existsSync(out)) throw new Error('BENCH_OUT must be a new directory');
fs.mkdirSync(out, { recursive: true });
let source = original;
function replaceOnce(pattern, replacement) {
  const hits = source.match(new RegExp(pattern.source, 'gm')) || [];
  if (hits.length !== 1) throw new Error(`Expected one harness configuration match, got ${hits.length}`);
  source = source.replace(pattern, replacement);
}
replaceOnce(/^const puppeteer = .*;$/m, "const puppeteer = require(process.env.PUPPETEER_MODULE);");
replaceOnce(/^const PORT = .*;$/m, "const BASE = process.env.BENCH_BASE;");
replaceOnce(/^const OUT = .*;$/m, "const OUT = process.env.BENCH_OUT.replaceAll('\\\\', '/') + '/';");
replaceOnce(/^const CHROME = .*;$/m, "const CHROME = process.env.CHROME_PATH;");
replaceOnce(/} finally \{ await browser.close\(\); gpu.proc && gpu.proc.kill\(\); }/m,
  "} catch (e) { report.fatal = String(e.message); save(); } finally { await browser.close(); gpu.proc && gpu.proc.kill(); }");
source += `
report.harnessSha256 = ${JSON.stringify(createHash('sha256').update(original).digest('hex'))};
report.physicalPhoneTest = false;
report.acceptance = {
  completed: !report.fatal && report.lenses.length === 12 && report.coordination?.length === 2 && !!report.compose?.checks,
  layout: report.lenses.length === 12 && report.lenses.every(r => r.scrollWidth === r.innerWidth && r.afterInteraction.scrollWidth === r.innerWidth),
  errors: report.lenses.every(r => !r.errors.length && !r.pageErrors.length) && report.coordination?.every(r => !r.errors.length) && report.compose?.errors?.length === 0,
  selection: report.coordination?.every(r => r.steps.length === 6 && r.steps[0].haversineSelected && r.steps.slice(1).every(s => s.sameKey && s.visible)),
  recipe: !!report.compose?.checks && ['keysHave80299','keysHaveVd','everyBlockPinned','familyPinned','urlHasVd','urlHas80299'].every(k => report.compose.checks[k] === true)
};
report.pass = Object.values(report.acceptance).every(v => v === true);
save();
if (report.pass !== true) process.exitCode = 1;
`;
const runner = path.join(out, 'runner.mjs');
fs.writeFileSync(runner, source);
await import(pathToFileURL(runner));
