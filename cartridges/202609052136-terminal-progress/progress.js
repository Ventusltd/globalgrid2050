/* Terminal presentation adapted from wolph/python-progressbar, BSD-3-Clause.
 * Copyright (c) 2022, Rick van Hattem (Wolph). See LICENSE.progressbar2.txt.
 * Review progress is a fixed evidence snapshot. Only clock values animate.
 */
const root=document.getElementById('precision-progress');
if(root){
  const target=Date.UTC(2050,0,1),start=Date.UTC(2026,0,1);
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=t=>Object.fromEntries(formatter.formatToParts(t).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  const midnight=(year,month,day)=>{const nominal=Date.UTC(year,month-1,day);let candidate=nominal;for(let i=0;i<3;i++){const q=parts(candidate);candidate+=nominal-Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute,q.second);}return candidate;};
  function updateBar(id,fraction,label){const bar=root.querySelector('#'+id);bar.value=Math.max(0,Math.min(1,fraction));root.querySelector('#'+id+'-value').textContent=label;}
  function calendar(){
    const now=Date.now(),days=Math.max(0,target-now)/86400000,q=parts(now),end=midnight(q.year,q.month,q.day+1),begin=midnight(q.year,q.month,q.day);
    const fraction=(now-start)/(target-start);
    updateBar('precision-days',fraction,Math.ceil(days).toLocaleString('en-GB')+' days remaining');
    updateBar('precision-weeks',fraction,(days/7).toFixed(1)+' weeks remaining');
    updateBar('precision-months',fraction,(days/(365.2425/12)).toFixed(1)+' months remaining');
    updateBar('precision-today',(now-begin)/(end-begin),Math.max(0,Math.ceil((end-now)/60000))+' minutes remaining');
  }
  calendar();const calendarTimer=setInterval(()=>{if(!root.isConnected)clearInterval(calendarTimer);else calendar();},1000);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=0;
  function minute(t){
    if(!root.isConnected)return;
    if(t-last>=(reduced.matches?1000:33)){const left=60000-(Date.now()%60000);updateBar('precision-minute',1-left/60000,String(left).padStart(5,'0')+' ms remaining');last=t;}
    requestAnimationFrame(minute);
  }
  requestAnimationFrame(minute);
}
