import {animate,minute} from './runtime.mjs';
import {calculate} from '../202609052143-open-energy/model.mjs';
import {iceRows} from '../202609052150-nasa-ice/model.mjs';
const format=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0});
async function start(id,path,model,selector,unit){const root=document.getElementById(id);if(!root)return;try{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw Error();const data=await response.json();model(data,Date.now());const b=root.querySelector('button');b.dataset.pause='';
 root.querySelector('[data-status]').textContent=id==='open-energy'?'This minute at EIA 2024 average rates; not live demand.':'This minute at NASA 2002-2025 average net-loss rates; not live melting.';
 animate(root,now=>{const seconds=minute(now)/1000;for(const r of model(data,now)){const el=root.querySelector('['+selector+'="'+r.id+'"]');el.querySelector('output').textContent=format.format(r.perSecond*seconds)+' '+unit;el.querySelector('progress').value=seconds/60;const small=el.querySelector('small');if(small)small.textContent='~'+format.format(r.perSecond)+' '+unit+' / second';}});
 }catch{root.querySelector('[data-status]').textContent='Baseline unavailable; no estimated values shown.';}}
start('open-energy','../202609052143-open-energy/source.json',(d,n)=>calculate(d,n).rows,'data-energy','MWh');
start('nasa-ice','../202609052150-nasa-ice/source.json',iceRows,'data-ice','tonnes');
