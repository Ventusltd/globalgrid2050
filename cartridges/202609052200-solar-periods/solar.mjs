import {animate,minute,row} from '../202609052154-minute-runtime/runtime.mjs';
import {periods} from './model.mjs';
const root=document.getElementById('solar-radiation'),format=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0});
if(root)animate(root,now=>{const values=periods(now);for(const key of ['day','hour','minute'])root.querySelector('[data-solar='+key+']').textContent=format.format(values[key])+' MWh';row(root,'sun',format.format(minute(now)/1000)+' / 60 seconds',minute(now)/60000);});
