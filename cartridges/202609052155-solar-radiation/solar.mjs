import {animate,minute,row} from '../202609052154-minute-runtime/runtime.mjs';import {solarEnergy} from './model.mjs';
const root=document.getElementById('solar-radiation'),f=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0});
if(root)animate(root,now=>{const ms=minute(now);row(root,'sun',f.format(solarEnergy(ms/1000))+' MWh',ms/60000);});
