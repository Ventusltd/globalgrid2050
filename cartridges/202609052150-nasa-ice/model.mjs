export function iceRows(s,now){
 if(s?.schema!=='ventus.ice-rate.v1'||!Number.isFinite(now)||![s.greenlandGtPerYear,s.antarcticaGtPerYear,s.modelYearDays].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid ice baseline');
 const fraction=((now%86400000)+86400000)%86400000/86400000;
 return [['greenland',s.greenlandGtPerYear],['antarctica',s.antarcticaGtPerYear]].map(([id,annual])=>({id,tonnes:annual*1e9/s.modelYearDays*fraction,perSecond:annual*1e9/(s.modelYearDays*86400),fraction,annual}));
}
