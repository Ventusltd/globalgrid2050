import {iceRows} from './model.mjs';
const root=document.getElementById('nasa-ice');
if(root)boot().catch(()=>root.querySelector('[data-status]').textContent='Ice baseline unavailable; no estimate shown.');
async function boot(){
 const r=await fetch(new URL('./source.json',import.meta.url));if(!r.ok)throw Error();const s=await r.json();iceRows(s,Date.now());
 const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}),rate=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});let paused=false,last=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const b=root.querySelector('button');b.disabled=false;b.onclick=()=>{paused=!paused;b.textContent=paused?'Resume counters':'Pause counters';b.setAttribute('aria-pressed',String(paused));status();};
 function status(){root.querySelector('[data-status]').textContent=(paused?'Paused. ':'')+'Net ice loss illustrated at the 2002-2025 average rate. Not live melting.';}
 function draw(){for(const row of iceRows(s,Date.now())){const el=root.querySelector('[data-ice="'+row.id+'"]');el.querySelector('output').textContent=number.format(row.tonnes)+' tonnes';el.querySelector('progress').value=row.fraction;el.querySelector('small').textContent='~'+rate.format(row.perSecond)+' tonnes / second; '+row.annual+' Gt / year baseline';}}
 status();draw();function frame(t){if(!root.isConnected)return;if(!paused&&!document.hidden&&t-last>=(reduced.matches?1000:50)){draw();last=t;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
