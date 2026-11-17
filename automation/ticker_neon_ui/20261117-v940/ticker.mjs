/** Flowing visual strip with one semantic list. Source selection remains owner-injected. */
export function createTickerRenderer(latestHeadlines) {
 const states=new WeakMap();
 return function renderTicker(host,items,{snapshotLabel='Latest available headlines'}={}) {
  const rows=latestHeadlines(items),key=JSON.stringify(rows),old=states.get(host),D=host.ownerDocument,W=D.defaultView;
  if(old?.key===key&&old.label.parentNode===host){old.label.textContent=snapshotLabel;return;}
  old?.destroy();host.replaceChildren();host.classList.add('pn-ticker','pn-neon-ticker');host.dataset.count=String(rows.length);
  const el=(tag,cls,text)=>{const n=D.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const label=el('span','pn-ticker-label',snapshotLabel),hint=el('span','pn-ticker-hint','Moving headlines pause on focus or hover. Touch to read; tap empty ticker space again to resume. All original links remain available in the static scrolling list.');
  const viewport=el('div','pn-ticker-viewport'),track=el('div','pn-ticker-track'),list=el('ul','pn-ticker-cycle');
  viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Latest headlines; focus to pause and scroll');viewport.setAttribute('aria-live','off');
  list.setAttribute('aria-label','Original headlines with publisher attribution and dates');
  for(const row of rows){const li=el('li','pn-ticker-item'),a=el('a','pn-ticker-title',`${row.title} — ${row.source}`),time=el('time','',`${row.dateKind} ${row.date}`);a.href=row.link;a.target='_blank';a.rel='noopener noreferrer';time.dateTime=row.date;li.append(a,' · ',time);list.append(li);}
  if(!rows.length)list.append(el('li','pn-ticker-item','Headlines unavailable'));
  const copy=el('div','pn-ticker-cycle pn-ticker-copy');copy.setAttribute('aria-hidden','true');copy.setAttribute('inert','');
  for(const row of rows){const item=el('div','pn-ticker-item');item.append(el('span','pn-ticker-title',`${row.title} — ${row.source}`),' · ',el('span','pn-ticker-date',`${row.dateKind} ${row.date}`));copy.append(item);}
  track.append(list,copy);viewport.append(track);host.append(label,hint,viewport);
  const media=W.matchMedia('(prefers-reduced-motion: reduce)'),listeners=[];let touch=false,focused=false,alive=true;
  const listen=(n,t,f)=>{n.addEventListener(t,f);listeners.push(()=>n.removeEventListener(t,f));};
  function sync(){host.dataset.reading=String(media.matches||focused||touch||rows.length<2);host.dataset.motion=host.dataset.reading==='true'?'static':'flowing';}
  function measure(){if(!alive)return;const width=viewport.clientWidth;host.style.setProperty('--pn-viewport-width',width+'px');const cycle=list.getBoundingClientRect().width;host.style.setProperty('--pn-cycle-width',cycle+'px');host.style.setProperty('--pn-cycle-duration',Math.max(12,cycle/42)+'s');}
  listen(host,'focusin',e=>{focused=true;sync();e.target.closest('a')?.scrollIntoView({block:'nearest',inline:'nearest'});});listen(host,'focusout',e=>{if(!host.contains(e.relatedTarget)){focused=false;touch=false;sync();}});
  listen(host,'pointerdown',e=>{if(e.pointerType!=='touch')return;if(touch&&!e.target.closest('a')){e.preventDefault();touch=false;if(host.contains(D.activeElement))D.activeElement.blur();}else touch=true;sync();});
  listen(viewport,'keydown',e=>{if(e.key==='Escape'){touch=false;viewport.blur();sync();}});
  const preference=()=>{sync();measure();};media.addEventListener('change',preference);
  const observer=W.ResizeObserver?new W.ResizeObserver(measure):null;observer?.observe(viewport);observer?.observe(list);if(!observer)listen(W,'resize',measure);
  const state={key,label,destroy(){alive=false;observer?.disconnect();media.removeEventListener('change',preference);listeners.forEach(off=>off());}};states.set(host,state);sync();measure();D.fonts?.ready.then(()=>{if(alive)measure();});
 };
}
