import {calculate,validate} from './model.mjs';
const root=document.getElementById('open-energy');
if(root) start().catch(()=>{root.querySelector('[data-status]').textContent='Energy baseline unavailable. No estimated values shown.';});
async function start(){
 const response=await fetch(new URL('./source.json',import.meta.url));
 if(!response.ok)throw Error('Baseline unavailable');
 const source=validate(await response.json());
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fmt=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0});
 const rate=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
 let paused=false,last=0;
 const button=root.querySelector('button');button.disabled=false;
 button.addEventListener('click',()=>{paused=!paused;button.textContent=paused?'Resume counters':'Pause counters';button.setAttribute('aria-pressed',String(paused));if(!paused)render();else root.querySelector('[data-status]').textContent='Paused. Illustration at 2024 average rates.';});
 function render(){
   const result=calculate(source,Date.now());
   root.querySelector('[data-status]').textContent=(paused?'Paused. ':'')+(result.stale?'Baseline due for review. ':'')+'Illustration at 2024 average rates. Day resets at 00:00 UTC.';
   for(const row of result.rows){const el=root.querySelector('[data-energy="'+row.id+'"]');el.querySelector('output').textContent=fmt.format(row.mwh)+' MWh';el.querySelector('progress').value=row.bar;el.querySelector('[data-rate]').textContent='~'+rate.format(row.perSecond)+' MWh / second';}
 }
 render();
 function frame(t){if(!root.isConnected)return;if(!paused&&!document.hidden&&t-last>=(reduced.matches?1000:50)){render();last=t;}requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}
