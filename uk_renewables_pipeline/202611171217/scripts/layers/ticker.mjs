import {latestHeadlines} from './model.mjs';
export function renderTicker(host,items,{snapshotLabel='Latest available headlines'}={}) {
  const doc=host.ownerDocument;host.classList.add('pn-ticker');host.replaceChildren();
  const headlines=latestHeadlines(items);
  if(!headlines.length){host.textContent='Headlines unavailable';return;}
  const label=doc.createElement('span');label.className='pn-ticker-label';label.textContent=snapshotLabel;
  const pause=doc.createElement('button');pause.type='button';pause.textContent='Pause';pause.setAttribute('aria-pressed','false');pause.setAttribute('aria-label','Pause headline scrolling');
  const viewport=doc.createElement('div');viewport.className='pn-ticker-viewport';
  const track=doc.createElement('div');track.className='pn-ticker-track';
  const list=doc.createElement('ul');list.setAttribute('aria-label','Ten latest available headlines');
  for(const h of headlines){const li=doc.createElement('li'),a=doc.createElement('a');a.href=h.link;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${h.title} — ${h.source}`;a.title=h.date;li.append(a);list.append(li);}
  const repeat=list.cloneNode(true);repeat.setAttribute('aria-hidden','true');repeat.removeAttribute('aria-label');
  for(const a of repeat.querySelectorAll('a'))a.tabIndex=-1;
  track.append(list,repeat);viewport.append(track);host.append(label,pause,viewport);
  pause.addEventListener('click',()=>{const stopped=host.classList.toggle('pn-paused');pause.textContent=stopped?'Play':'Pause';pause.setAttribute('aria-pressed',String(stopped));pause.setAttribute('aria-label',stopped?'Resume headline scrolling':'Pause headline scrolling');});
}
