/* V6 canvas design: Courier, dark field, cyan mean/gold high/red low, GBP axes. */
import {segments,dateMs,summarise} from './model.mjs';
const SERIES=[['maximum_observed_gbp_per_mwh','High','#ffcc00'],['mean_available_gbp_per_mwh','Available mean','#00ffff'],['minimum_observed_gbp_per_mwh','Low','#ff3333']];
const money=n=>n===null?'—':'£'+n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
function tickStep(span){const raw=span/6,p=10**Math.floor(Math.log10(Math.max(raw,1))),n=raw/p;return(n<=1?1:n<=2?2:n<=5?5:10)*p;}
export function drawDaily(canvas,result){
  const ratio=globalThis.devicePixelRatio||1,bounds=canvas.getBoundingClientRect();
  const width=Math.max(240,bounds.width||800),height=Math.max(300,bounds.height||440);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const g=canvas.getContext('2d');if(!g)throw Error('Canvas unavailable');g.setTransform(ratio,0,0,ratio,0,0);
  const pad={left:55,right:16,top:65,bottom:54},w=width-pad.left-pad.right,h=height-pad.top-pad.bottom;
  const all=result.rows.flatMap(r=>SERIES.map(([field])=>r[field])).filter(Number.isFinite);
  const lo=Math.min(0,...all),hi=Math.max(0,...all),margin=Math.max((hi-lo)*.08,10),bottom=lo-margin,top=hi+margin;
  const start=dateMs(result.start),end=dateMs(result.end)+86400000;
  const X=date=>pad.left+((dateMs(date)+43200000-start)/(end-start))*w,Y=value=>pad.top+(top-value)/(top-bottom)*h;
  g.clearRect(0,0,width,height);g.fillStyle='#05070c';g.fillRect(0,0,width,height);
  g.font='10px Courier New';g.textBaseline='middle';
  const step=tickStep(top-bottom);
  for(let value=Math.ceil(bottom/step)*step;value<=top;value+=step){
    const y=Y(value);g.strokeStyle=value===0?'rgba(0,255,255,.35)':'rgba(255,255,255,.07)';g.lineWidth=1;
    g.beginPath();g.moveTo(pad.left,y);g.lineTo(width-pad.right,y);g.stroke();
    g.fillStyle='#f5f7fb';g.textAlign='left';g.fillText('£'+(Math.round(value)||0).toLocaleString('en-GB'),4,y);
  }
  g.fillStyle='#9aa3b6';g.font='10px Courier New';g.textAlign='left';g.fillText('GBP/MWh · system sell',pad.left,14);
  let legendX=pad.left;
  for(const [,label,color] of SERIES){g.fillStyle=color;g.shadowColor=color;g.shadowBlur=4;g.fillRect(legendX,30,7,7);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.font='9px Courier New';g.fillText(label,legendX+10,34);legendX+=label==='Available mean'?105:55;}
  g.fillStyle='#9aa3b6';g.textAlign='left';g.fillText(result.start,pad.left,height-30);g.textAlign='right';g.fillText(result.end,width-pad.right,height-30);
  g.textAlign='left';g.font='9px Courier New';g.fillText('Gaps retained · hollow markers = partial source days',pad.left,height-12,Math.max(1,w));
  const receipt=[];
  for(const [field,,color] of SERIES){
    const groups=segments(result.rows,field);g.save();g.lineWidth=field==='mean_available_gbp_per_mwh'?2.4:2.1;g.lineCap='round';g.lineJoin='round';
    g.strokeStyle=color;g.shadowColor=color;g.shadowBlur=5;
    for(const group of groups){
      g.beginPath();group.forEach((point,i)=>{if(i)g.lineTo(X(point.date),Y(point.value));else g.moveTo(X(point.date),Y(point.value));});g.stroke();
      for(const point of group)if(group.length===1||point.partial){
        g.beginPath();g.arc(X(point.date),Y(point.value),point.partial?3:2,0,Math.PI*2);g.fillStyle=point.partial?'#05070c':color;g.fill();g.stroke();
      }
    }g.restore();receipt.push({field,segments:groups.map(group=>group.map(point=>point.date))});
  }
  const summary=summarise(result.rows);
  if(!all.length){g.fillStyle='#00ffff';g.textAlign='center';g.font='bold 12px Courier New';g.fillText('No reported prices in this window',pad.left+w/2,pad.top+h/2,Math.max(1,w));}
  else{
    // The dates label source-declared daily observations; no intraday clock is invented.
    const high=result.rows.find(r=>r.maximum_observed_gbp_per_mwh===summary.high),low=result.rows.find(r=>r.minimum_observed_gbp_per_mwh===summary.low);
    for(const [label,row,value,align] of [['HIGH',high,summary.high,'left'],['LOW',low,summary.low,'right']]){
      const x=X(row.date),y=Y(value);g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.8)';g.shadowBlur=6;
      g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill();g.shadowBlur=0;
      const text=label+' '+money(value)+' · '+row.date;g.font='bold 9px Courier New';g.textAlign=align;
      g.fillStyle='#ff5555';g.fillText(text,align==='left'?pad.left:width-pad.right,52,Math.max(1,w/2-6));
    }
  }
  return receipt;
}
