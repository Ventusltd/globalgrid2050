import {TAU,CONCEPTS,VIEWS,EDGES,point,focusPoint,clamp,wrapTime} from './model.mjs';
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d',{alpha:true});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const S={view:'twin',time:18,speed:1,selected:0,playing:!reduced.matches,pins:[],width:0,height:0,dpr:1,last:0,frame:0,raf:null};
let previous=null,transition=1;
const colour=g=>CONCEPTS[g].color;
function circle(x,y,r,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.globalAlpha=1;}
function line(points,color,alpha=.3,width=1){ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.globalAlpha=1;}
function rectFor(view,twin=false){
  const w=S.width,h=S.height;
  if(view==='twin'){
    if(w<620){const side=Math.min(w-20,(h-90)/1.35);return {x:(w-side)/2,y:twin?h*.46:70,w:side,h:side*.76};}
    const side=Math.min(w*.48,h*.94);return {x:(twin?w*.75:w*.25)-side/2,y:(h-side)/2+18,w:side,h:side};
  }
  if(view==='river'||view==='column')return {x:24,y:62,w:w-48,h:h-122};
  const side=Math.min(w-26,h-75)*1.2;return {x:(w-side)/2,y:(h-side)/2+18,w:side,h:side};
}
function mapped(view,g,i,time,twin=false){const r=rectFor(view,twin),p=point(view,g,i,time,twin);return{x:r.x+p.x*r.w,y:r.y+p.y*r.h};}
function displayed(g,i,time,twin=false){let p=mapped(S.view,g,i,time,twin);if(previous&&transition<1&&!twin){const old=mapped(previous,g,i,time);const eased=1-(1-transition)**3;p={x:old.x+(p.x-old.x)*eased,y:old.y+(p.y-old.y)*eased};}return p;}
function markText(text,x,y,color='#a3b3c4',align='center'){ctx.font='12px system-ui';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(text,x,y);}
function grid(){
  ctx.strokeStyle='#52728b';ctx.globalAlpha=.085;ctx.lineWidth=1;
  const gap=44;ctx.beginPath();for(let x=22;x<S.width;x+=gap){ctx.moveTo(x,80);ctx.lineTo(x,S.height-55);}for(let y=100;y<S.height-50;y+=gap){ctx.moveTo(15,y);ctx.lineTo(S.width-15,y);}ctx.stroke();ctx.globalAlpha=1;
}
function orbitGuide(view,twin=false){
  const r=rectFor(view,twin),cx=r.x+r.w/2,cy=r.y+r.h/2;
  for(const radius of [.21,.29,.36]){ctx.beginPath();ctx.ellipse(cx,cy,r.w*radius,r.h*radius,0,0,TAU);ctx.strokeStyle='#4b687b';ctx.globalAlpha=.17;ctx.lineWidth=1;ctx.stroke();}
  ctx.globalAlpha=1;
  const rad=r.w*.055,glow=ctx.createRadialGradient(cx,cy,0,cx,cy,rad*3);glow.addColorStop(0,'#76ead91f');glow.addColorStop(1,'#76ead900');ctx.fillStyle=glow;ctx.fillRect(cx-rad*3,cy-rad*3,rad*6,rad*6);
  circle(cx,cy,2,'#e2fff7',.75);
  if(view==='twin')markText(twin?(S.pins.length?'PINNED ECHO':'PHASE TWIN'):'PRESENT',cx,cy+r.h*.33);
}
function chords(){
  const r=rectFor('chord');
  for(const [a,b]of EDGES){const p=focusPoint('chord',a,S.time),q=focusPoint('chord',b,S.time);ctx.beginPath();ctx.moveTo(r.x+p.x*r.w,r.y+p.y*r.h);ctx.quadraticCurveTo(r.x+r.w/2,r.y+r.h/2,r.x+q.x*r.w,r.y+q.y*r.h);ctx.strokeStyle=colour(a);ctx.globalAlpha=a===S.selected||b===S.selected?.45:.15;ctx.lineWidth=1;ctx.stroke();
    const t=wrapTime(S.time+a*5+b)/60,xx=(1-t)**2*p.x+2*(1-t)*t*.5+t*t*q.x,yy=(1-t)**2*p.y+2*(1-t)*t*.5+t*t*q.y;circle(r.x+xx*r.w,r.y+yy*r.h,2.5,colour(a),.9);}
  ctx.globalAlpha=1;
}
function drawGroup(g,twin=false){
  const time=twin&&S.pins.length?S.pins.at(-1):S.time,color=colour(g),active=g===S.selected;
  for(let i=0;i<32;i++){
    const trail=[];
    for(let k=7;k>=0;k--)trail.push(displayed(g,i,time-k*.55,twin));
    line(trail,color,(active?.48:.24)*(twin?.75:1),active?1.5:1);
    const p=trail.at(-1);if(active)circle(p.x,p.y,4.5,color,.07);circle(p.x,p.y,active?2:1.3,color,twin?.65:.92);
  }
}
function draw(){
  if(!ctx||S.view==='table')return;
  ctx.clearRect(0,0,S.width,S.height);grid();
  if(['ring','particle','chord'].includes(S.view))orbitGuide(S.view);
  if(S.view==='twin'){orbitGuide('twin');orbitGuide('twin',true);}
  if(S.view==='chord')chords();
  if(S.view==='river'||S.view==='column'){
    const r=rectFor(S.view);
    CONCEPTS.forEach((c,g)=>{if(S.view==='river'){const p=mapped(S.view,g,0,S.time);markText(c.name,r.x+3,p.y-15,c.color,'left');}else if(S.width>=620||g===S.selected){markText(c.name,clamp(r.x+(.13+g*.148)*r.w,60,S.width-60),r.y+r.h*.95,c.color);}});
  }
  for(let g=0;g<6;g++){drawGroup(g);if(S.view==='twin')drawGroup(g,true);}
  if(S.view!=='twin'&&S.pins.length){for(let g=0;g<6;g++){const pts=[];for(let i=0;i<32;i++)pts.push(mapped(S.view,g,i,S.pins.at(-1)));line(pts,colour(g),.13,.8);}}
  if(S.view==='ring'||S.view==='chord'||S.view==='particle'){
    const r=rectFor(S.view);markText(CONCEPTS[S.selected].name,r.x+r.w/2,r.y+r.h/2+23,colour(S.selected));
  }
  S.frame++;
}
function renderTime(){ $('time-label').value=S.time.toFixed(1)+' s';$('time').value=String(S.time); }
function syncPlay(){ $('play').textContent=S.playing?'Pause':'Play';$('play').setAttribute('aria-label',S.playing?'Pause animation':'Play animation'); }
function syncHeading(){const v=VIEWS[S.view],memory=S.view==='twin'&&S.pins.length;$('view-kicker').textContent=memory?'MIRROR / MEMORY':v.kicker;$('view-title').textContent=memory?'The moving present. Its remembered twin.':v.title;canvas.setAttribute('aria-label',$('view-title').textContent+' Use the labelled concept buttons to select an idea.');}
function tick(now){S.raf=null;if(document.hidden||!S.playing||S.view==='table')return;const dt=S.last?Math.min((now-S.last)/1000,.1):0;
  if(!S.last||now-S.last>=1000/30){S.time=wrapTime(S.time+dt*S.speed);S.last=now;if(transition<1)transition=Math.min(1,transition+dt*2.5);draw();renderTime();}
  S.raf=requestAnimationFrame(tick);
}
function schedule(){if(S.raf!==null)cancelAnimationFrame(S.raf);S.raf=null;S.last=0;if(S.playing&&!document.hidden&&S.view!=='table')S.raf=requestAnimationFrame(tick);}
function resize(){const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;S.width=box.width;S.height=box.height;S.dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1600000/(box.width*box.height)));canvas.width=Math.round(box.width*S.dpr);canvas.height=Math.round(box.height*S.dpr);if(ctx)ctx.setTransform(S.dpr,0,0,S.dpr,0,0);draw();}
function selectConcept(g){S.selected=g;const c=CONCEPTS[g];$('concept-key').textContent=c.key.toUpperCase()+' / 0'+(g+1);$('concept-title').textContent=c.title;$('concept-copy').textContent=c.copy;for(const [i,b]of [...$('concepts').children].entries())b.setAttribute('aria-pressed',String(i===g));draw();}
for(const [g,c]of CONCEPTS.entries()){
  const b=document.createElement('button');b.type='button';b.style.setProperty('--concept',c.color);b.setAttribute('aria-pressed',String(g===0));const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');b.append(dot,document.createTextNode(c.name));b.addEventListener('click',()=>selectConcept(g));$('concepts').append(b);
  const tr=document.createElement('tr');for(const txt of [c.name,['Stable identity','Physical meaning','Revisit a moment','Support a conclusion','Explore a view','Connect ideas'][g],['Switch views','Compare concepts','Move the timeline','Read a concept','Select a concept','Try Chord weave'][g]]){const td=document.createElement('td');td.textContent=txt;tr.append(td);}$('state-rows').append(tr);
}
$('skin').addEventListener('change',()=>{const next=$('skin').value;if(!VIEWS[next])return;previous=S.view==='table'?null:S.view;transition=reduced.matches||!S.playing?1:0;S.view=next;const v=VIEWS[next];syncHeading();$('motion-note').textContent=v.note+' · conceptual';canvas.hidden=next==='table';$('table-wrap').hidden=next!=='table';$('pin').disabled=next==='table';$('play').disabled=next==='table';$('time').disabled=next==='table';$('speed').disabled=next==='table';resize();schedule();});
$('play').addEventListener('click',()=>{S.playing=!S.playing;syncPlay();schedule();});
$('speed').addEventListener('change',()=>{S.speed=clamp(Number($('speed').value)||1,.4,1.8);});
$('time').addEventListener('input',()=>{S.playing=false;transition=1;S.time=clamp(Number($('time').value)||0,0,60);syncPlay();schedule();draw();renderTime();});
function renderPins(){const wrap=$('pins');wrap.replaceChildren();if(!S.pins.length){const note=document.createElement('span');note.className='empty-pin';note.textContent='Pin a time to hold its echo while motion flows.';wrap.append(note);}for(const t of S.pins){const b=document.createElement('button');b.type='button';b.textContent=t.toFixed(1)+' s';b.setAttribute('aria-label','Return to pinned visual moment '+t.toFixed(1)+' seconds');b.addEventListener('click',()=>{S.time=t;S.playing=false;transition=1;syncPlay();schedule();draw();renderTime();});wrap.append(b);}$('clear-pins').hidden=!S.pins.length;syncHeading();}
$('pin').addEventListener('click',()=>{transition=1;const t=Math.round(S.time*10)/10;if(!S.pins.includes(t)){S.pins.push(t);S.pins=S.pins.slice(-4);}renderPins();draw();});
$('clear-pins').addEventListener('click',()=>{S.pins=[];renderPins();draw();($('pin').disabled?$('skin'):$('pin')).focus();});
canvas.addEventListener('click',e=>{if(S.view==='table')return;const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;let best=0,dist=Infinity;for(let g=0;g<6;g++)for(let i=0;i<32;i++)for(const twin of S.view==='twin'?[false,true]:[false]){const p=displayed(g,i,twin&&S.pins.length?S.pins.at(-1):S.time,twin),d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best=g;}}if(dist<=34**2)selectConcept(best);});
document.addEventListener('visibilitychange',schedule);
reduced.addEventListener('change',()=>{if(reduced.matches){S.playing=false;transition=1;syncPlay();schedule();draw();}});
new ResizeObserver(resize).observe(canvas);syncPlay();renderTime();resize();schedule();
if(!ctx){S.playing=false;$('error').hidden=false;$('error').textContent='2D drawing is unavailable. The readable table keeps all six concepts available.';$('skin').value='table';$('skin').dispatchEvent(new Event('change'));}
