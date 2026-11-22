// V9.64: independent A3/A4 liquid HTML overview. V9.63 individual A4/PDF is untouched.
import {state} from './scripts/core/state.js';
import {escapeHtml} from './scripts/core/utils.js';
import {atlasUrlV9_5_1} from './scripts/plugins/projects-v9-8.js';
import {buildAtlasInterconnectorLinkV9_8} from './scripts/core/atlas-interconnector-link-v9-8.js';
(() => {
  'use strict';
  const toolbar=document.getElementById('pnScanToolbar');
  const table=document.getElementById('repdScroll');
  if(!toolbar||!table||document.getElementById('pnLiquidOverview'))return;
  const launch=document.createElement('button');
  launch.id='pnLiquidLaunch'; launch.type='button';launch.textContent='A3 OVERVIEW';
  launch.title='Open the entire filtered REPD register as a scrollable HTML sheet';
  launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','pnLiquidOverview');
  toolbar.append(launch);
  const labels=[
    ['name','PROJECT'],['capacity','MW / MWp'],['county','COUNTY'],['operator','OPERATOR'],
    ['technology','TYPE'],['status','STATUS'],['repd','REPD REF'],['globalgrid','GRID REF'],
    ['updated','REPD UPDATED'],['submitted','SUBMITTED'],['operational','OPERATIONAL'],
    [null,'NOTES'],[null,'MAP']
  ];
  const widths=[14.7,5.6,7,11,7.4,10,5.6,8.3,6.8,6.8,6.8,5.7,4.3];
  const overlay=document.createElement('aside');
  overlay.id='pnLiquidOverview';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Entire REPD register liquid HTML overview');
  const header=labels.map(item=>'<th'+(item[0]?' data-liquid-key="'+item[0]+'" aria-sort="none"':'')+'>'+
    (item[0]?'<button type="button" data-liquid-sort="'+item[0]+'">'+item[1]+' <span>↕</span></button>':item[1])+'</th>').join('');
  overlay.innerHTML=[
    '<div class="pn-liquid-controls">',
    '<button type="button" data-liquid-action="close">CLOSE</button><strong>REPD · LIQUID OVERVIEW</strong>',
    '<select id="pnLiquidFormat" aria-label="Sheet size"><option value="a3">A3 LANDSCAPE</option><option value="a4">A4 LANDSCAPE</option></select>',
    '<button type="button" data-liquid-action="minus" aria-label="Zoom out">−</button>',
    '<output id="pnLiquidZoom">100%</output><button type="button" data-liquid-action="plus" aria-label="Zoom in">+</button>',
    '<button type="button" data-liquid-action="fit">FIT</button></div>',
    '<div class="pn-liquid-filters">',
    '<label>SEARCH <input type="search" id="pnLiquidSearch" placeholder="Find projects" aria-label="Search all REPD projects"></label>',
    '<label>STATUS <select id="pnLiquidStatus" aria-label="Official status"></select></label>',
    '<label>COUNTY <select id="pnLiquidCounty" aria-label="County"></select></label>',
    '<label>TYPE <select id="pnLiquidTech" aria-label="Technology"></select></label>',
    '<button type="button" data-liquid-action="clear">RESET</button>',
    '<span id="pnLiquidCount" role="status">Loading REPD…</span></div>',
    '<div id="pnLiquidViewport" role="region" tabindex="0" aria-label="Scroll horizontally and vertically across the whole REPD register">',
    '<div id="pnLiquidSheet"><div class="pn-liquid-masthead">',
    '<span>GLOBALGRID2050 · RENEWABLE ENERGY PLANNING DATABASE</span><span id="pnLiquidSourceDate"></span>',
    '</div><table id="pnLiquidTable" aria-label="All filtered REPD projects with working MAP links">',
    '<colgroup>'+widths.map(width=>'<col style="width:'+width+'%">').join('')+'</colgroup>',
    '<thead><tr>'+header+'</tr></thead><tbody id="pnLiquidBody"></tbody></table></div></div>',
    '<div class="pn-liquid-bottom"><label for="pnLiquidX">COLUMNS ↔</label>',
    '<input type="range" id="pnLiquidX" min="0" max="100" step="0.2" value="0" aria-label="Horizontal column scrollbar">',
    '<span>Swipe across rows · Live HTML, not PDF</span></div>'
  ].join('');
  document.body.append(overlay);
  const $=id=>document.getElementById(id);
  const viewport=$('pnLiquidViewport'),sheet=$('pnLiquidSheet'),body=$('pnLiquidBody'),xslider=$('pnLiquidX');
  const WIDTH={a3:1587,a4:1123},ROW=40,OVERSCAN=14;
  const names={solar:'Solar',bess:'Battery Storage',wind_onshore:'Onshore Wind',
    wind_offshore:'Offshore Wind',interconnector:'Interconnector'};
  let format='a3',zoom=1,open=false,lastStart=-1,lastEnd=-1,lastData=null,raf=0,gesture=null,saved=null,focusBack=null;
  const esc=value=>escapeHtml(String(value??''));
  const date=value=>{
    if(!value)return '—';
    const parts=String(value).split('-');
    return parts.length===3?parts[2]+'/'+parts[1]+'/'+parts[0]:String(value);
  };
  const allRows=()=>Array.isArray(state.filtered)?state.filtered:[];
  const mapUrl=project=>{
    try{
      const result=project.technology==='interconnector'?buildAtlasInterconnectorLinkV9_8(project):atlasUrlV9_5_1(project);
      const url=new URL(result);return url.protocol==='https:'?url.href:'';
    }catch{return '';}
  };
  function rowHtml(project,index){
    const name=project.name||'Project not reported',ref=project.repd_ref||'';
    const capacity=Number.isFinite(project.capacity_mw)?
      project.capacity_mw.toLocaleString('en-GB',{maximumFractionDigits:2})+' '+(project.technology==='solar'?'MWp':'MW'):'—';
    const values=[
      name,capacity,project.county||'—',project.operator||'—',
      names[project.technology]||project.technology||'—',project.status||'—',
      ref,project.gg_project_id||'—',date(project.repd_record_updated),
      date(project.planning_application_submitted),date(project.operational)
    ];
    const cells=values.map((value,i)=>'<td title="'+esc(value)+'">'+
      (i===0?'<span class="pn-liquid-row-no">'+(index+1).toLocaleString('en-GB')+'</span> ':'')+
      esc(value)+'</td>').join('');
    const note='<td><button type="button" class="machine-note-button pn-liquid-note" data-note-ref="'+esc(ref)+
      '" data-note-name="'+esc(name)+'" data-note-status="'+esc(project.status||'')+'">NOTE</button></td>';
    const href=mapUrl(project);
    const map=href?'<a class="pn-liquid-map" href="'+esc(href)+
      '" target="_blank" rel="noopener noreferrer" aria-label="Open '+esc(name)+' in GridAtlas">MAP ↗</a>':
      '<span class="pn-liquid-map-unavailable">NO MAP</span>';
    return '<tr class="pn-liquid-project" data-overview-ref="'+esc(ref)+'">'+cells+note+'<td>'+map+'</td></tr>';
  }
  function decorate(){
    const sort=new URLSearchParams(location.search).get('sort')||'capacity_desc';
    for(const th of overlay.querySelectorAll('th[data-liquid-key]')){
      const key=th.dataset.liquidKey;
      const mode=sort===key+'_asc'?'ascending':sort===key+'_desc'?'descending':'none';
      th.setAttribute('aria-sort',mode);
      const span=th.querySelector('span');
      if(span)span.textContent=mode==='ascending'?'▲':mode==='descending'?'▼':'↕';
    }
  }
  function dimensions(){
    sheet.style.setProperty('--pn-liquid-sheet-width',Math.round(WIDTH[format]*zoom)+'px');
    sheet.style.setProperty('--pn-liquid-row-height',ROW*zoom+'px');
    sheet.style.setProperty('--pn-liquid-head-height',43*zoom+'px');
    sheet.style.setProperty('--pn-liquid-font',12*zoom+'px');
    $('pnLiquidZoom').textContent=Math.round(zoom*100)+'%';
    $('pnLiquidFormat').value=format;
  }
  function updateSlider(){
    const max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
    xslider.disabled=!max;
    xslider.value=max?100*viewport.scrollLeft/max:0;
  }
  function draw(force=false){
    if(!open)return;
    const data=allRows(),n=data.length,rh=ROW*zoom;
    const before=sheet.querySelector('.pn-liquid-masthead').getBoundingClientRect().height+
      sheet.querySelector('thead').getBoundingClientRect().height;
    const start=Math.max(0,Math.floor(Math.max(0,viewport.scrollTop-before)/rh)-OVERSCAN);
    const end=Math.min(n,start+Math.ceil(viewport.clientHeight/rh)+2*OVERSCAN+4);
    if(!force&&start===lastStart&&end===lastEnd&&data===lastData)return;
    lastStart=start;lastEnd=end;lastData=data;
    const gap=px=>'<tr class="pn-liquid-gap" aria-hidden="true"><td colspan="13"><div style="height:'+Math.max(0,px)+'px"></div></td></tr>';
    body.innerHTML=gap(start*rh)+data.slice(start,end).map((record,i)=>rowHtml(record,start+i)).join('')+gap((n-end)*rh);
    body.dataset.total=String(n);body.dataset.rendered=String(end-start);
    body.dataset.start=String(start);body.dataset.end=String(end);
    $('pnLiquidCount').textContent=n.toLocaleString('en-GB')+' projects · '+(n?start+1:0)+'–'+end+' visible · all matches scrollable';
    decorate();updateSlider();
    window.dispatchEvent(new Event('pipeline-projects-rendered'));
  }
  function requestDraw(){
    if(!open||raf)return;
    raf=requestAnimationFrame(()=>{raf=0;draw();});
  }
  function zoomTo(value,holdPosition=true){
    const next=Math.max(.22,Math.min(2.2,value)),old=zoom;
    const cx=(viewport.scrollLeft+viewport.clientWidth/2)/old;
    const cy=(viewport.scrollTop+viewport.clientHeight/2)/old;
    zoom=next;lastStart=-1;dimensions();
    if(holdPosition){
      viewport.scrollLeft=Math.max(0,cx*zoom-viewport.clientWidth/2);
      viewport.scrollTop=Math.max(0,cy*zoom-viewport.clientHeight/2);
    }
    draw(true);
  }
  function sync(){
    $('pnLiquidSearch').value=document.getElementById('search')?.value||'';
    const originalStatus=$('pnScanStatus');
    if(originalStatus){
      const select=$('pnLiquidStatus');
      select.replaceChildren(...[...originalStatus.options].map(opt=>new Option(opt.textContent,opt.value)));
      select.value=originalStatus.value;
    }
    const originalCounty=$('county');
    if(originalCounty){
      const select=$('pnLiquidCounty');
      select.replaceChildren(...[...originalCounty.options].map(opt=>new Option(opt.textContent,opt.value)));
      select.value=originalCounty.value;
    }
    const buttons=[...document.querySelectorAll('#tech [data-technology]')],select=$('pnLiquidTech');
    select.replaceChildren(...buttons.map(button=>new Option(button.textContent.trim()||button.dataset.technology,button.dataset.technology)));
    const active=buttons.find(button=>button.getAttribute('aria-pressed')==='true');
    if(active)select.value=active.dataset.technology;
    $('pnLiquidSourceDate').textContent=(document.getElementById('repdReportDate')?.textContent||'').trim();
  }
  function show(){
    if(open)return;
    focusBack=document.activeElement;
    saved={body:document.body.style.overflow,html:document.documentElement.style.overflow,
      y:scrollY,x:table.scrollLeft,tableY:table.scrollTop};
    document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
    open=true;overlay.hidden=false;format='a3';zoom=1;lastStart=-1;
    dimensions();sync();viewport.scrollLeft=0;viewport.scrollTop=0;draw(true);
    overlay.querySelector('[data-liquid-action="close"]').focus({preventScroll:true});
  }
  function close(){
    if(!open)return;
    open=false;overlay.hidden=true;
    if(raf)cancelAnimationFrame(raf);raf=0;
    lastData=null;lastStart=-1;lastEnd=-1;
    if(saved){
      document.body.style.overflow=saved.body;
      document.documentElement.style.overflow=saved.html;
      const prior=saved;saved=null;
      requestAnimationFrame(()=>{table.scrollLeft=prior.x;table.scrollTop=prior.tableY;scrollTo(0,prior.y)});
    }
    (focusBack||launch).focus({preventScroll:true});
  }
  launch.addEventListener('click',show);
  overlay.addEventListener('click',event=>{
    const action=event.target.closest('[data-liquid-action]');
    if(action){
      const value=action.dataset.liquidAction;
      if(value==='close')close();
      else if(value==='minus'||value==='plus')zoomTo(zoom*(value==='plus'?1.2:1/1.2));
      else if(value==='fit'){zoomTo(Math.max(.22,(viewport.clientWidth-20)/WIDTH[format]),false);
        viewport.scrollLeft=0;viewport.scrollTop=0;draw(true);}
      else if(value==='clear'){$('clearFilters')?.click();sync();draw(true);}
      return;
    }
    const sort=event.target.closest('[data-liquid-sort]');
    if(!sort)return;
    const key=sort.dataset.liquidSort;
    const selector=({updated:'#sortUpdated',submitted:'#sortSubmitted',operational:'#sortOperational'})[key]||
      '[data-column-sort="'+key+'"]';
    const source=document.querySelector('#repdScroll thead '+selector)||document.querySelector(selector);
    if(source){source.click();draw(true);}
  });
  $('pnLiquidFormat').addEventListener('change',event=>{
    const requested=event.target.value;
    if(!Object.hasOwn(WIDTH,requested))return;
    const left=(viewport.scrollLeft+viewport.clientWidth/2)/(WIDTH[format]*zoom);
    format=requested;dimensions();lastStart=-1;
    viewport.scrollLeft=Math.max(0,left*WIDTH[format]*zoom-viewport.clientWidth/2);draw(true);
  });
  $('pnLiquidSearch').addEventListener('input',event=>{
    const source=$('search');if(!source)return;
    source.value=event.target.value;source.dispatchEvent(new Event('input',{bubbles:true}));
    viewport.scrollTop=0;draw(true);
  });
  $('pnLiquidStatus').addEventListener('change',event=>{
    const source=$('pnScanStatus');if(!source)return;
    source.value=event.target.value;source.dispatchEvent(new Event('change',{bubbles:true}));
    viewport.scrollTop=0;draw(true);
  });
  $('pnLiquidCounty').addEventListener('change',event=>{
    const source=$('county');if(!source)return;
    source.value=event.target.value;source.dispatchEvent(new Event('change',{bubbles:true}));
    viewport.scrollTop=0;draw(true);
  });
  $('pnLiquidTech').addEventListener('change',event=>{
    const source=[...document.querySelectorAll('#tech [data-technology]')]
      .find(button=>button.dataset.technology===event.target.value);
    if(source)source.click();
    viewport.scrollTop=0;draw(true);
  });
  viewport.addEventListener('scroll',()=>{requestDraw();updateSlider();},{passive:true});
  xslider.addEventListener('input',()=>{viewport.scrollLeft=Number(xslider.value)/100*
    Math.max(0,viewport.scrollWidth-viewport.clientWidth);});
  window.addEventListener('pipeline-projects-rendered',()=>{if(open){sync();requestDraw();}});
  window.addEventListener('resize',()=>{if(open){lastStart=-1;draw(true);}},{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&open){event.preventDefault();event.stopImmediatePropagation();close();}
  },true);
  const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,
    touches[0].clientY-touches[1].clientY);
  viewport.addEventListener('touchstart',event=>{
    if(event.touches.length===2)gesture={distance:distance(event.touches),zoom};
  },{passive:true});
  viewport.addEventListener('touchmove',event=>{
    if(event.touches.length!==2||!gesture)return;
    if(event.cancelable)event.preventDefault();
    zoomTo(gesture.zoom*distance(event.touches)/Math.max(1,gesture.distance));
  },{passive:false});
  viewport.addEventListener('touchend',event=>{if(event.touches.length<2)gesture=null;},{passive:true});
  window.addEventListener('pagehide',()=>{if(open)close();});
})();
