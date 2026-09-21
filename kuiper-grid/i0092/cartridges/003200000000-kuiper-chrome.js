'use strict';
// kuiper-chrome.js - a cartridge of the Kuiper shell: HOW THE PAGE IS DRESSED. What sits over the disc,
// and how much of it. The shell is never edited, so the dressing lives here, where it can be changed.
//
// ON A PHONE THE KUIPER IS THE MAIN EVENT. GridAtlas settled this already (v9.43: tools collapse behind
// one chip): the application buttons fold behind ONE chip, the top box is one word, and the disc gets
// the room. Nothing is removed: one tap opens the row, and choosing an application closes it again.
// A desktop has the room and is left exactly as it is. The warranty line is on the screen at every width.
(function(){
  const css = document.createElement('style');
  css.textContent = `
  #appschip{display:none}
  @media (max-width:640px){
    #use{display:none} #top.open #use{display:block}
    #top{padding:5px 10px} #big{font-size:12px}
    #appschip{display:inline-block;background:#061018;color:#00ffff;border:1px solid #1d6470;padding:8px 12px;
      font:inherit;font-weight:bold;letter-spacing:.08em;cursor:pointer;touch-action:manipulation;margin-bottom:6px}
    #appschip.on{background:#00ffff;color:#000}
    #apps{display:none} #foot.appsopen #apps{display:flex}
    #keys{flex-wrap:nowrap;gap:4px} #keys button{padding:8px 7px;font-size:10px;letter-spacing:.02em;white-space:nowrap}
    #foot .short{margin-top:4px;font-size:10px;line-height:1.35}
  }`;
  document.head.appendChild(css);
  const foot = document.getElementById('foot'), apps = document.getElementById('apps');
  const chip = document.createElement('button'); chip.id = 'appschip'; chip.type = 'button'; chip.textContent = 'APPS';
  chip.setAttribute('aria-expanded', 'false');
  foot.insertBefore(chip, apps);
  const set = open => { foot.classList.toggle('appsopen', open); chip.setAttribute('aria-expanded', String(open));
    if (typeof layout === 'function') layout(); if (typeof atHome !== 'undefined' && atHome && typeof homeCamera === 'function' && SPACE) { const h = homeCamera(); flyTo(h.x, h.y, h.z); } dirty = true; };
  chip.addEventListener('click', e => { e.stopPropagation(); set(!foot.classList.contains('appsopen')); });
  // choosing an application puts the row away again, so the show has the screen; the chip says which is on
  apps.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
    chip.textContent = b.textContent; chip.classList.add('on'); set(false); });
  addEventListener('keydown', e => { if (e.key === 'Backspace') { chip.textContent = 'APPS'; chip.classList.remove('on'); } });
})();
