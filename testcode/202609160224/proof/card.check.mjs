/* card.check.mjs — the card must get out of the way without getting lost.
 *
 * Run: node proof/card.check.mjs            (from testcode/202609160224)
 *      node proof/card.check.mjs --mutate   (shows the checks can fail)
 *
 * This reads the three shipped files rather than a copy of their logic. It cannot
 * click, so it checks the CONTRACT that makes clicking work: the handle exists, the
 * states are defined, the handlers are bound, and the card no longer covers the sky.
 * Where it cannot verify something, it says so rather than passing quietly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(path.join(here, '..', f), 'utf8');
const MUT = process.argv.includes('--mutate');

let html = read('index.html'), css = read('style.css'), js = read('nest.mjs');
if (MUT) {                      // break each contract in turn
  html = html.replace('id="grip"', 'id="grip-broken"').replace('id="reopen"', 'id="reopen-broken"');
  css = css.replace('#panel.min #panelbody{display:none}', '');
  js = js.replace("gripEl.addEventListener('pointermove'", "gripEl.noSuchThing('pointermove'");
}

const checks = [];
const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

ok('the card has a drag handle', /id="grip"/.test(html), 'index.html #grip');
ok('the handle carries a title, minimise and close',
   /id="griptitle"/.test(html) && /id="min"/.test(html) && /id="close"/.test(html),
   'griptitle + min + close');
ok('a reopen control exists outside the card', /id="reopen"/.test(html),
   'index.html #reopen — a closed card must be recoverable');

ok('the card no longer spans the viewport',
   !/#panel\{[^}]*bottom:calc\(var\(--bot\) \+ 2\.2rem\)[^}]*\}/.test(css.split('@media')[0]),
   'top+bottom pinning removed from the base rule, so the galaxy stays visible');
ok('the card has a bounded width', /#panel\{[^}]*width:min\(/.test(css), 'width:min(30rem, …)');
ok('minimised hides the body but keeps the handle',
   /#panel\.min #panelbody\{display:none\}/.test(css), '#panel.min #panelbody{display:none}');
ok('the handle is exempt from browser touch panning',
   /#grip\{[^}]*touch-action:none/.test(css), 'touch-action:none — drag works on touch');
ok('the handle shows it is draggable', /#grip\{[^}]*cursor:grab/.test(css), 'cursor:grab');

ok('drag is wired to pointer events',
   /gripEl\.addEventListener\('pointerdown'/.test(js) &&
   /gripEl\.addEventListener\('pointermove'/.test(js) &&
   /gripEl\.addEventListener\('pointerup'/.test(js), 'pointerdown/move/up on the grip');
ok('a drag that leaves the window still ends', /pointercancel/.test(js), 'pointercancel bound');
ok('buttons inside the handle do not start a drag',
   /e\.target\.closest\('button'\)/.test(js), "closest('button') guard");
ok('the card is kept inside the window', /function clampToView/.test(js), 'clampToView()');
ok('minimise toggles both ways', /function setMin/.test(js) && /setMin\(!panel\.classList\.contains\('min'\)\)/.test(js),
   'setMin(on) with a toggle caller');
ok('reopen restores and un-minimises',
   /reopenEl\.addEventListener\('click'[\s\S]{0,200}setMin\(false\)/.test(js), 'reopen -> setMin(false)');
ok('stored position never breaks the card',
   (js.match(/catch \(_\)/g) || []).length >= 2 && /sessionStorage/.test(js),
   'sessionStorage reads and writes are guarded — blocked storage must not stop the card');
ok('phone escape targets meet WCAG 2.2 SC 2.5.8 (24x24 minimum)',
   /@media \(max-width:640px\)[\s\S]*?#grip button\{[\s\S]*?min-width:44px[\s\S]*?min-height:44px/.test(css),
   'on the one device class where the card cannot be dragged, minimise must be hittable');
ok('the escape target is separated from the destructive one',
   /@media \(max-width:640px\)[\s\S]*?#grip button\{[\s\S]*?margin-left:8px/.test(css),
   'minimise hides the card, close destroys it — a mis-tap must not cost the reader their card');
ok('phones dock the card instead of dragging it',
   /@media \(max-width:640px\)/.test(css) && /innerWidth <= 640/.test(js),
   'CSS dock + JS drag guard agree on the same breakpoint');

const pass = checks.filter(c => c.pass).length;
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}\n        ${c.detail}`);
console.log(`\n${pass}/${checks.length} passed` + (MUT ? '   (--mutate: failures above are the proof the checks can fail)' : ''));
console.log('NOT CHECKED HERE: that a real pointer drags a real card. That needs a browser; this proves the contract only.');
process.exit(MUT ? 0 : (pass === checks.length ? 0 : 1));
