// V9.68: landscape reading view; native colours and sorting, focused columns, original MAP/A4.
import {state} from './scripts/core/state.js';
import {setExpandedPageRows} from './scripts/plugins/projects-v9-8.js';
(() => {
  'use strict';
  const root=document.getElementById('officialRegister');
  const panel=document.getElementById('repdPanel');
  const wrap=document.getElementById('repdScroll');
  const toolbar=document.getElementById('pnScanToolbar');
  const table=wrap?.querySelector('table');
  const tbody=document.getElementById('tbody');
  const tech=document.getElementById('tech');
  const gauges=panel?.querySelector('.hud-gauges');
  if(!root||!panel||!wrap||!toolbar||!table||!tbody||!tech||!gauges)return;
  const launch=document.createElement('button');
  launch.id='pnLiquidLaunch';launch.type='button';
  launch.textContent='EXPANDED REPD VIEW';
  launch.title='Open the focused, landscape REPD table';
  launch.setAttribute('aria-haspopup','dialog');
  launch.setAttribute('aria-controls','pnExpandedHost');
  toolbar.append(launch);
  const host=document.createElement('aside');
  host.id='pnExpandedHost';host.hidden=true;
  host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');
  host.setAttribute('aria-label','Expanded REPD table');
  host.innerHTML='<div class="pn-expanded-top"><strong>EXPANDED REPD VIEW</strong>'+
    '<span class="pn-expanded-subtitle">100 ROWS · SWIPE TO EXPLORE</span>'+
    '<button type="button" id="pnExpandedClose" aria-label="Close expanded REPD view">CLOSE ×</button></div>'+
    '<aside id="pnExpandedFilter" hidden aria-label="Column filter"></aside>';
  document.body.append(host);
  const filter=document.getElementById('pnExpandedFilter');
  const closeButton=document.getElementById('pnExpandedClose');
  const landscapeGate=document.createElement('div');
  landscapeGate.id='pnLandscapeGate';
  landscapeGate.hidden=true;
  landscapeGate.setAttribute('role','status');
  landscapeGate.setAttribute('aria-live','polite');
  landscapeGate.innerHTML='<div class="pn-landscape-message"><strong>LANDSCAPE VIEW</strong>'+
    '<p>Rotate your device to landscape to explore the REPD table comfortably.</p>'+
    '<button type="button" id="pnLandscapeCancel">CLOSE</button></div>';
  document.body.append(landscapeGate);
  const inLandscape=()=>window.innerWidth>window.innerHeight;
  let pendingLandscape=false;
  landscapeGate.querySelector('button').addEventListener('click',()=>close());
  let expanded=false,rootMark=null,techMark=null,snapshot=null,hadScan=false;
  let lastFocus=null;
  // A legible landscape reading table starts at its native size.
  // Pinch scales table content only; the original normal-view gauges stay intact.
  // Safari and Chromium understand CSS zoom, which also preserves scroll extents
  // and native anchor/button hit targets (unlike a visual-only transform).
  let fitScale=1,scale=1,pinch=null,gesture=null;
  const scaleClamp=value=>Math.min(2,Math.max(.8,value));
  function setTableScale(next,clientX=null,clientY=null){
    if(!expanded)return;
    const bounds=wrap.getBoundingClientRect();
    const x=clientX===null?bounds.width/2:clientX-bounds.left;
    const y=clientY===null?bounds.height/2:clientY-bounds.top;
    const prior=Math.max(.001,scale);
    const baseX=(wrap.scrollLeft+x)/prior,baseY=(wrap.scrollTop+y)/prior;
    scale=scaleClamp(next);
    table.style.zoom=String(scale);
    wrap.dataset.zoom=String(scale);
    wrap.scrollLeft=Math.max(0,baseX*scale-x);
    wrap.scrollTop=Math.max(0,baseY*scale-y);
  }
  function fitAllColumns(){
    if(!expanded)return;
    // Do not miniaturise columns to fit: readable text and sideways scrolling
    // are more useful than a tiny screenshot-like overview.
    fitScale=1;scale=1;
    table.style.zoom='1';
    wrap.dataset.zoom='1';
    wrap.scrollLeft=0;wrap.scrollTop=0;
  }
  function distance(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
  function centre(a,b){return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};}
  wrap.addEventListener('touchstart',event=>{
    if(!expanded||event.touches.length!==2)return;
    const [a,b]=event.touches;
    const mid=centre(a,b);
    pinch={distance:Math.max(1,distance(a,b)),startScale:scale};
    pinch.mid=mid;
  },{passive:true});
  wrap.addEventListener('touchmove',event=>{
    if(!expanded||!pinch||event.touches.length!==2)return;
    if(event.cancelable)event.preventDefault();
    const [a,b]=event.touches,mid=centre(a,b);
    setTableScale(pinch.startScale*distance(a,b)/pinch.distance,mid.x,mid.y);
  },{passive:false});
  const endPinch=event=>{if(event.touches.length<2)pinch=null;};
  wrap.addEventListener('touchend',endPinch,{passive:true});
  wrap.addEventListener('touchcancel',()=>{pinch=null;},{passive:true});
  // Trackpad pinch gestures also zoom the TABLE, not the browser or gauges.
  wrap.addEventListener('wheel',event=>{
    if(!expanded||!event.ctrlKey)return;
    event.preventDefault();
    setTableScale(scale*Math.exp(-event.deltaY*.013),event.clientX,event.clientY);
  },{passive:false});
  // Safari's GestureEvent is a fallback for iOS browser-host pinch variants.
  wrap.addEventListener('gesturestart',event=>{
    if(!expanded)return;
    event.preventDefault();
    gesture={startScale:scale};
  },{passive:false});
  wrap.addEventListener('gesturechange',event=>{
    if(!expanded||!gesture)return;
    event.preventDefault();
    setTableScale(gesture.startScale*event.scale,event.clientX,event.clientY);
  },{passive:false});
  wrap.addEventListener('gestureend',()=>{gesture=null;},{passive:true});
  // Chart.js keeps its old measured canvas after its actual REPD node is moved.
  // Resize the three real gauges once the expanded container has laid out.
  function resizeLiveGauges(){
    if(!window.Chart?.getChart)return;
    for(const canvas of gauges.querySelectorAll('canvas')){
      window.Chart.getChart(canvas)?.resize();
    }
  }
  function scheduleGaugeResize(){
    requestAnimationFrame(()=>{resizeLiveGauges();requestAnimationFrame(resizeLiveGauges);});
  }
  // The existing native header buttons remain sortable. Do not add a second
  // layer of filter arrows to the expanded reading view.
  function paintOperators(){
    if(!expanded)return;
    for(const row of tbody.querySelectorAll('tr[id^="repd-"]')){
      const td=row.cells[3];
      if(!td||td.querySelector('.pn-expanded-operator'))continue;
      const full=td.textContent.trim();
      const s=document.createElement('span');s.className='pn-expanded-operator';
      s.textContent=full;td.textContent='';td.append(s);td.title=full;
    }
  }
  function updateExpandedPager(){
    if(!expanded)return;
    const nav=document.getElementById('projectPager');
    const meta=nav?.querySelector('.pager-meta');
    if(!meta||!nav.dataset.page)return;
    const n=Number(tbody.dataset.total)||0;
    const start=Number(nav.dataset.from)||0;
    const end=Number(nav.dataset.to)||0;
    const current=Number(nav.dataset.page)||1;
    const pages=Number(nav.dataset.pages)||1;
    meta.title=start.toLocaleString('en-GB')+'–'+end.toLocaleString('en-GB')+
      ' of '+n.toLocaleString('en-GB')+' records, page '+current+' of '+pages;
    meta.textContent=start.toLocaleString('en-GB')+'–'+end.toLocaleString('en-GB')+
      ' / '+n.toLocaleString('en-GB')+' · '+current+'/'+pages;
  }
  function dismissFilter(){filter.hidden=true;filter.replaceChildren();}
  const make=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==null)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  function chooser(label,choices,value,onChange){
    const l=make('label',label);
    const s=make('select',null,'pn-expanded-select');
    for(const [v,t] of choices){
      const option=new Option(t,v);s.add(option);
    }
    s.value=value;
    s.addEventListener('change',()=>{onChange(s.value);dismissFilter();});
    l.append(s);filter.append(l);return s;
  }
  function srcSelect(selector){
    const source=document.querySelector(selector);
    if(!source)return null;
    return {source,choices:[...source.options].map(o=>[o.value,o.textContent.trim()])};
  }
  function openFilter(key,button){
    if(!expanded)return;
    if(!filter.hidden&&filter.dataset.key===key){dismissFilter();return;}
    dismissFilter();filter.dataset.key=key;
    filter.append(make('strong','FILTER · '+key.toUpperCase()));
    if(key==='technology'||key==='status'){
      const selector=key==='technology'?'#tech [data-technology]':'#status [data-official-status]';
      const buttons=[...document.querySelectorAll(selector)];
      const prop=key==='technology'?'technology':'officialStatus';
      const choices=buttons.map(b=>[b.dataset[prop],b.textContent.trim()]);
      const active=buttons.find(b=>b.getAttribute('aria-pressed')==='true');
      chooser(key,choices,active?.dataset[prop]||choices[0]?.[0],value=>{
        buttons.find(b=>b.dataset[prop]===value)?.click();
      });
    } else if(key==='county'){
      const c=srcSelect('#county');
      if(c)chooser('County / location',c.choices,c.source.value,value=>{
        c.source.value=value;c.source.dispatchEvent(new Event('change',{bubbles:true}));
      });
    } else if(['updated','submitted','operational'].includes(key)){
      const field=key==='updated'?'updatedYear':key==='submitted'?'submittedYear':'operationalYear';
      const c=srcSelect('[data-year-filter="'+field+'"]');
      if(c)chooser(key+' year',c.choices,c.source.value,value=>{
        c.source.value=value;c.source.dispatchEvent(new Event('change',{bubbles:true}));
      });
    } else if(key==='capacity'){
      const row=make('div',null,'pn-expanded-range');
      for(const [id,text] of [['minMW','MIN MW'],['maxMW','MAX MW']]){
        const label=make('label',text);
        const input=make('input',null);
        input.type='number';input.step='any';input.min='0';
        input.value=document.getElementById(id)?.value||'';
        input.dataset.for=id;
        label.append(input);row.append(label);
      }
      const apply=make('button','APPLY MW','pn-expanded-apply');apply.type='button';
      const doApply=()=>{
        for(const input of row.querySelectorAll('input')){
          document.getElementById(input.dataset.for).value=input.value;
        }
        document.getElementById('applyMW').click();
        dismissFilter();
      };
      apply.addEventListener('click',doApply);
      row.addEventListener('keydown',e=>{if(e.key==='Enter')doApply();});
      filter.append(row,apply);
    } else if(key==='name'||key==='operator'){
      const label=make('label',key==='operator'?'Find operator or project':'Find project');
      const input=make('input',null);
      input.type='search';input.placeholder='Search REPD';
      const source=document.getElementById('search');
      input.value=source.value;
      input.addEventListener('input',()=>{
        source.value=input.value;
        source.dispatchEvent(new Event('input',{bubbles:true}));
      });
      input.addEventListener('keydown',e=>{if(e.key==='Enter')dismissFilter();});
      label.append(input);filter.append(label);
    }
    if(filter.children.length===1)return;
    filter.hidden=false;
    const rect=button.getBoundingClientRect();
    const vw=window.innerWidth,vh=window.innerHeight;
    filter.style.left=Math.max(6,Math.min(rect.left,vw-238))+'px';
    filter.style.top=Math.max(6,Math.min(rect.bottom+3,vh-290))+'px';
    filter.querySelector('select,input')?.focus({preventScroll:true});
  }
  function show(){
    if(expanded)return;
    if(!inLandscape()){
      pendingLandscape=true;
      landscapeGate.hidden=false;
      return;
    }
    pendingLandscape=false;
    landscapeGate.hidden=true;
    lastFocus=document.activeElement;
    const active=document.querySelector('.pipeline-tabs [role="tab"][aria-selected="true"]');
    if(active?.id!=='solarTab'&&active?.id!=='bessTab')document.getElementById('solarTab')?.click();
    const html=document.documentElement;
    snapshot={overflow:document.body.style.overflow,htmlOverflow:html.style.overflow,
      pageY:window.scrollY,scrollX:wrap.scrollLeft,scrollY:wrap.scrollTop};
    rootMark=document.createComment('original REPD register');
    root.parentNode.insertBefore(rootMark,root);
    techMark=document.createComment('original technology filters');
    tech.parentNode.insertBefore(techMark,tech);
    hadScan=wrap.classList.contains('pn-scan-mode');
    if(hadScan)document.getElementById('pnScanModeToggle')?.click();
    host.append(root);
    gauges.after(tech);
    expanded=true;
    host.hidden=false;
    html.classList.add('pn-expanded-open');
    document.body.style.overflow='hidden';html.style.overflow='hidden';
    wrap.classList.add('pn-expanded-grid');
    setExpandedPageRows(true);
    // A single frame ensures the full-viewport table has its final dimensions.
    requestAnimationFrame(fitAllColumns);
    paintOperators();
    requestAnimationFrame(updateExpandedPager);
    closeButton.focus({preventScroll:true});
  }
  function close(){
    pendingLandscape=false;
    landscapeGate.hidden=true;
    if(!expanded)return;
    dismissFilter();
    // Clear view-only zoom BEFORE restoring the standard REPD dashboard.
    pinch=null;gesture=null;table.style.removeProperty('zoom');delete wrap.dataset.zoom;
    scale=1;fitScale=1;
    setExpandedPageRows(false);
    if(hadScan&&!wrap.classList.contains('pn-scan-mode'))document.getElementById('pnScanModeToggle')?.click();
    techMark?.replaceWith(tech);techMark=null;
    rootMark?.replaceWith(root);rootMark=null;
    wrap.classList.remove('pn-expanded-grid');
    host.hidden=true;expanded=false;
    document.documentElement.classList.remove('pn-expanded-open');
    const s=snapshot;snapshot=null;
    if(s){
      document.body.style.overflow=s.overflow;
      document.documentElement.style.overflow=s.htmlOverflow;
      requestAnimationFrame(()=>{
        wrap.scrollLeft=s.scrollX;wrap.scrollTop=s.scrollY;window.scrollTo(0,s.pageY);
        resizeLiveGauges();
      });
    }
    (lastFocus||launch).focus({preventScroll:true});
  }
  launch.addEventListener('click',show);
  closeButton.addEventListener('click',close);
  host.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-pn-expanded-filter]');
    if(trigger){event.preventDefault();event.stopPropagation();openFilter(trigger.dataset.pnExpandedFilter,trigger);return;}
    if(!filter.hidden&&!event.target.closest('#pnExpandedFilter'))dismissFilter();
  });
  document.addEventListener('keydown',event=>{
    if(!expanded||event.key!=='Escape')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!filter.hidden)dismissFilter();else close();
  },true);
  window.addEventListener('pipeline-projects-rendered',()=>{
    paintOperators();requestAnimationFrame(updateExpandedPager);
  });
  window.addEventListener('resize',()=>{
    if(pendingLandscape && inLandscape()){
      pendingLandscape=false;
      landscapeGate.hidden=true;
      show();
      return;
    }
    if(!expanded)return;
    landscapeGate.hidden=inLandscape();
    if(!inLandscape())return;
    const wasFit=Math.abs(scale-fitScale)<.01;
    const priorScale=scale,oldFit=fitScale;
    fitAllColumns();
    if(!wasFit)setTableScale(priorScale*(oldFit?fitScale/oldFit:1));
    scheduleGaugeResize();
  },{passive:true});
  window.addEventListener('pagehide',()=>{if(expanded||pendingLandscape)close();});
})();
