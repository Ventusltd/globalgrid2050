'use strict';
// kuiper-controls.js - a cartridge of the Kuiper shell. Cut from the whole page with no change of behaviour;
// replaced, when it is, by a newer file the pointer names and the composer checks by its hash.
// ------------------------------------------------------------------ where a page is on the wafer
// A PAGE IS NOT A PLACE. tools/where.py asks git which commits touched a path and cosmos/wafer.tsv
// where each of those commits landed, and writes both files this reads. The page then does the same
// key arithmetic over its own commit table and the test is that the two agree exactly, commit by
// commit, key by key. Neither is trusted: they are made to contradict each other or agree.
async function loadTracked(){
  if (tracked) return tracked;
  const [tt, cc] = await Promise.all([tsv('cosmos/tracked.tsv'), tsv('cosmos/tracked-commits.tsv')]);
  tracked = { paths:tt.map(p => ({ repo:p[0], path:p[1], use:p[2], in_git:+p[3], on_wafer:+p[4],
                lines_in_those_commits:+p[5], k0:+p[6], k1:+p[7], first:p[8], last:p[9] })),
              commits:cc.map(p => ({ path:p[0], sha:p[1], unix:+p[2], lines:+p[3], k0:+p[4], k1:+p[5] })) };
  return tracked;
}
function raiseFlags(idx){
  pathFlags.fill(0); for (const i of idx) pathFlags[i] = 1;
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pathTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, TW, pathRows, 0, gl.RED, gl.FLOAT, pathFlags);
  gl.activeTexture(gl.TEXTURE0);
}
async function lightPath(name, quiet){
  endIsolate();
  const T = await loadTracked();
  const row = T.paths.find(p => p.path.toLowerCase() === String(name).toLowerCase());
  if (!row) return { error:'no tracked page of that name: run tools/where.py --five', asked_for:name };
  const want = T.commits.filter(c => c.path === row.path);
  const idx = [], missing = [], disagreed = [];
  for (const c of want) { const i = bySha.get(c.sha);
    if (i === undefined) { missing.push(c.sha); continue; }
    if (commits[i].k0 !== c.k0 || commits[i].k1 !== c.k1) disagreed.push({ sha:c.sha, page:[commits[i].k0, commits[i].k1], tool:[c.k0, c.k1] });
    idx.push(i); }
  idx.sort((a, b) => a - b);
  litRepo = -1; litK = [-1,-1]; litCi = null; newFrom = -1; flash = 0; pulse = -1; target = null;
  litPath = { row, idx }; raiseFlags(idx);
  tween = null; cx = 0; cy = 0; zoom = (Math.min(cv.width, cv.height)/2)*0.80/Math.sqrt(SPACE); draw();
  if (!quiet) { card.style.display = 'block';
    card.classList.remove('sheet'), card.innerHTML = 'PATH:' + row.path + '\n' + row.repo + '\n\n' + fmt(row.on_wafer) + ' commits touched it, of ' + fmt(row.in_git)
      + ' git knows\nfirst ' + row.first + ', last ' + row.last
      + '\n\nkeys ' + fmt(row.k0) + ' .. ' + fmt(row.k1)
      + '\n' + fmt(row.lines_in_those_commits) + ' lines in those commits, which is the commits, not the page'
      + '\n\nuse: ' + row.use; }
  return { row, idx, want:want.length, missing, disagreed };
}
// THE TEST. ?selftest=path:<name>. The count the page lit must be the count the tool counted, every
// sha the tool named must be a commit this wafer holds, and every key must match to the digit. Then
// the picture: at a zoom where one of those commits is more than a pixel wide, that pixel must
// actually carry the path's light, or the page is lighting a set it never drew.
addEventListener('pointerup', e => {
  // A DOT OF THE BODY IS STILL A PIECE OF WORK. It has moved; what it is has not.
  if (drag && moved < 4 && iso && body && body.shown && !bodyAnim) { let bj = -1, bd = Math.max(12, bodyDotPx() + 8);
    for (let j = 0; j < body.n; j++) { const x = (body.pos[2*j] - cx) * zoom + innerWidth / 2, y = innerHeight / 2 - (body.pos[2*j+1] - cy) * zoom;
      const d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; bj = j; } }
    if (bj >= 0) { const c0 = commits[iso.idx[bj]]; show(address(c0.k0 + Math.floor((c0.k1 - c0.k0) / 2))); pointerGone(e); return; } }
  if (drag && moved < 4 && N) { const [wx, wy] = toWorld(e.clientX, e.clientY), r = Math.hypot(wx, wy);
    if (r*r < SPACE) { let k = zoom >= POINTS_FROM ? keyAt(wx, wy) : -1; const exact = k >= 0; if (!exact) k = Math.floor(r*r);
      target = exact ? { x:keyPlace(k)[0], y:keyPlace(k)[1] } : null; show(address(k)); } }
  pointerGone(e); });
addEventListener('pointercancel', pointerGone);
addEventListener('wheel', e => { const [wx, wy] = toWorld(e.clientX, e.clientY), f = e.deltaY < 0 ? 1.18 : 1/1.18;
  zoom = Math.max(1e-4, Math.min(ZMAX, zoom*f)); cx = wx - (e.clientX - innerWidth/2)/zoom; cy = wy + (e.clientY - innerHeight/2)/zoom;
  atHome = false; tween = null; dirty = true; }, { passive:true });
// the tap targets, so a phone can do everything the keyboard can
document.getElementById('keys').addEventListener('click', e => {
  if (e.target.classList.contains('q')) { e.stopPropagation(); elFoot.classList.toggle('hints'); layout(); dirty = true; return; }
  const k = e.target.getAttribute('data-k'); if (!k) return;
  e.stopPropagation(); dispatchEvent(new KeyboardEvent('keydown', { key:k })); });
elTop.addEventListener('click', () => elTop.classList.toggle('open'));       // the long subtitle, collapsed by default
// A LINK INSIDE THE CARD IS NOT A DISMISSAL, and neither is reading it: the card is put away with
// its own cross or with Escape, the way the wafer's card is.
card.addEventListener('click', e => {
  const a = e.target.closest ? e.target.closest('a') : null;
  if (a && a.hasAttribute('data-key')) { e.preventDefault(); goToKey(+a.getAttribute('data-key')); }
});
// GOING TO A KEY, from a link inside a card or from an address a reader arrived with. The camera
// flies, the dot is marked and its card opens: one way of arriving, however the reader got here.
function goToKey(k){
  const a = address(k);
  if (!a) return;
  const p = keyPlace(k);
  litK = [k, k + 1]; litCi = null; target = { x:p[0], y:p[1] };
  show(a); flyTo(p[0], p[1], Math.max(zoom, 14)); dirty = true;
}
const gbox = document.getElementById('goto'), gin = document.getElementById('gotoin');
gin.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { gbox.style.display = 'none'; return; }
  if (e.key !== 'Enter') return; gbox.style.display = 'none'; const raw = gin.value.trim(), q = raw.replace(/[ ,_]/g,'');
  const mt = raw.match(/^(20\d\d)(?:-(\d\d))?(?:-(\d\d))?$/);
  if (mt) { lightTime(+mt[1], mt[2] ? +mt[2] : 0, mt[3] ? +mt[3] : 0); return; }
  const mnew = raw.toLowerCase().match(/^(?:show\s+)?new(?:\s+code)?(?:\s+(\d+)\s*h?)?$/);
  if (mnew) { showNew(mnew[1] ? Number(mnew[1]) : 24); return; }
  if (/^\d+$/.test(q)) goKey(Math.min(SPACE-1, Number(q)));
  else { const r = repos.find(x => x.name.toLowerCase() === raw.toLowerCase()) || repos.find(x => x.name.toLowerCase().includes(raw.toLowerCase()));
    if (r) { litRepo = r.i; target = null; card.style.display = 'none'; home(); dirty = true; } } });
addEventListener('keydown', e => { if (gbox.style.display === 'block') return;
  if (e.key === 'd') { detail = !detail; dirty = true; }
  else if (e.key === 'r' && N) { const j = Math.floor(Math.random()*N), c = commits[findBy('cum', j)]; goKey(c.k0 + (j - c.cum)); }   // uniform over issued lines
  else if (e.key === 'n' && N) showNew(24);
  else if (e.key === '/') { e.preventDefault(); gbox.style.display = 'block'; gin.value = ''; gin.focus(); }
  else if (e.key === 'Backspace') { e.preventDefault(); target = null; litRepo = -1; newFrom = -1; flash = 0; pulse = -1; litK = [-1,-1]; litCi = null; litPath = null; card.style.display = 'none';
    // GATHERED WORK GOES HOME BEFORE THE LIGHT COMES BACK: the same rule run the other way, so a
    // visitor sees that the body was made of work from all over the record and nothing else.
    if (iso && body && body.shown && ASM && !(bodyAnim && bodyAnim.home)) { bodyAnim = { k:Math.max(0, body.k), t0:performance.now(), from:new Float32Array(body.pos), gap0:body.gap, phase:'move', home:true }; isoAnim = null; dirty = true; }
    else { unisolate(true); home(); } } });
