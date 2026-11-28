// V9.63: independent thumb-movable A4 report, sourced from the existing REPD model and row MAP.
import {state} from './scripts/core/state.js';
import {reportData} from './report-model.mjs';
import {buildA4Pdf} from './report-pdf.mjs';

(() => {
  'use strict';
  const table=document.getElementById('repdScroll');
  const tbody=document.getElementById('tbody');
  if(!table||!tbody||document.getElementById('pnRepdReport'))return;
  const root=document.createElement('aside');
  root.id='pnRepdReport';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','A4 project report preview');
  root.innerHTML=
    '<nav class="pn-report-controls" aria-label="Report preview controls">'+
      '<button type="button" data-report-action="close" aria-label="Close A4 report">Close</button>'+
      '<button type="button" data-report-action="fitwidth">Fit width</button>'+
      '<button type="button" data-report-action="fitpage">Fit page</button>'+
      '<button type="button" data-report-action="minus" aria-label="Zoom out">−</button>'+
      '<button type="button" data-report-action="plus" aria-label="Zoom in">+</button>'+
      '<button type="button" data-report-action="rotate">Landscape</button>'+
      '<button type="button" data-report-action="print">Print</button>'+
      '<button type="button" data-report-action="pdf">PDF with links</button>'+
    '</nav>'+
    '<div class="pn-report-viewport" id="pnReportViewport" role="region" aria-label="Movable and zoomable A4 report preview" tabindex="0">'+
      '<div class="pn-report-frame" id="pnReportFrame">'+
        '<article class="pn-report-sheet" id="pnReportSheet">'+
          '<header class="pn-report-masthead">'+
            '<p>GLOBALGRID2050  /  REPD PROJECT INTELLIGENCE</p>'+
            '<h1 id="pnReportName"></h1>'+
            '<div class="pn-report-ref" id="pnReportRef"></div>'+
          '</header>'+
          '<section class="pn-report-identities">'+
            '<div><h2>REPD OPERATOR</h2><p id="pnReportOperator"></p></div>'+
            '<div><h2>DEVELOPER</h2><p id="pnReportDeveloper"></p></div>'+
          '</section>'+
          '<section class="pn-report-primary" aria-label="Project capacity and location">'+
            '<div><h2>PROJECT CAPACITY</h2><strong id="pnReportCapacity"></strong></div>'+
            '<div class="pn-report-location"><h2>PROJECT LOCATION</h2>'+
              '<p id="pnReportLocation"></p>'+
              '<a id="pnReportMap" href="#" target="_blank" rel="noopener">OPEN PROJECT MAP</a>'+
              '<strong id="pnReportNoMap" hidden>MAP not available for this record</strong>'+
            '</div>'+
          '</section>'+
          '<section class="pn-report-facts">'+
            '<div><h2>OFFICIAL STATUS</h2><p id="pnReportStatus"></p></div>'+
            '<div><h2>APPLICATION SUBMITTED</h2><p id="pnReportSubmitted"></p></div>'+
            '<div><h2>OPERATIONAL DATE</h2><p id="pnReportOperational"></p></div>'+
            '<div><h2>REPD RECORD UPDATED</h2><p id="pnReportUpdated"></p></div>'+
            '<div><h2>PLANNING CONSENT</h2><p id="pnReportConsent"></p></div>'+
            '<div><h2>PLANNING AUTHORITY</h2><p id="pnReportAuthority"></p></div>'+
            '<div><h2>PLANNING REFERENCE</h2><p id="pnReportPlanningRef"></p></div>'+
            '<a id="pnReportLegal" target="_blank" rel="noopener" hidden>Legal evidence</a>'+
          '</section>'+
          '<footer class="pn-report-footer">'+
            '<p id="pnReportSource"></p>'+
            '<p>Project location, capacity, status and dates come from the existing REPD record. MAP is the project-specific map link.</p>'+
          '</footer>'+
        '</article>'+
      '</div>'+
    '</div>';
  document.body.append(root);
  const $=id=>document.getElementById(id);
  const viewport=$('pnReportViewport'),frame=$('pnReportFrame'),paper=$('pnReportSheet');
  const set=(id,value)=>{$(id).textContent=value;};
  let model=null,scale=1,orientation='portrait',fit='width',restore=null,lastTrigger=null,gesture=null;
  const physical=()=>orientation==='landscape'?{width:1122.52,height:793.7}:{width:793.7,height:1122.52};
  const button=action=>root.querySelector('[data-report-action="'+action+'"]');
  function resize(scaleTo,keepCenter=false){
    const old=scale,oldCenterX=(viewport.scrollLeft+viewport.clientWidth/2)/old;
    const oldCenterY=(viewport.scrollTop+viewport.clientHeight/2)/old;
    scale=Math.max(.2,Math.min(2.5,scaleTo));
    const {width,height}=physical();
    frame.style.width=(width*scale)+'px';frame.style.height=(height*scale)+'px';
    paper.style.transform='scale('+scale+')';
    viewport.dataset.zoom=Math.round(scale*100)+'%';
    if(keepCenter){
      viewport.scrollLeft=Math.max(0,oldCenterX*scale-viewport.clientWidth/2);
      viewport.scrollTop=Math.max(0,oldCenterY*scale-viewport.clientHeight/2);
    }
  }
  function fitView(which='width'){
    fit=which;const {width,height}=physical();
    const availableW=Math.max(260,viewport.clientWidth-28),availableH=Math.max(200,viewport.clientHeight-30);
    const factor=which==='page'?Math.min(availableW/width,availableH/height):availableW/width;
    resize(Math.min(1.5,factor));
    viewport.scrollLeft=0;viewport.scrollTop=0;
  }
  function render(data){
    set('pnReportName',data.name);set('pnReportRef',(data.isRePD?'REPD REF ':'REFERENCE ')+data.reference);
    set('pnReportOperator',data.operator);set('pnReportDeveloper',data.developer);
    set('pnReportCapacity',data.capacity+' '+data.capacityUnit);
    set('pnReportLocation',data.location);
    const map=$('pnReportMap');map.hidden=!data.mapUrl;map.removeAttribute('href');
    if(data.mapUrl)map.href=data.mapUrl;
    $('pnReportNoMap').hidden=!!data.mapUrl;
    const legal = $('pnReportLegal');
    legal.hidden = !data.legalEvidenceUrl;
    if (data.legalEvidenceUrl) legal.href = data.legalEvidenceUrl;
    else legal.removeAttribute('href');
    for(const [id,value] of [
      ['pnReportStatus',data.status],['pnReportSubmitted',data.submitted],
      ['pnReportOperational',data.operational],['pnReportUpdated',data.updated],
      ['pnReportConsent',data.consent],['pnReportAuthority',data.planningAuthority],
      ['pnReportPlanningRef',data.planningReference],['pnReportSource',data.dataSource]
    ])set(id,value);
  }
  function annotate(){
    for(const row of tbody.querySelectorAll('tr[id^="repd-"]')){
      const actions=row.querySelector('td:last-child .project-actions');
      if(!actions||actions.querySelector('[data-pn-a4]'))continue;
      const b=document.createElement('button');
      b.type='button';b.className='pn-report-launch';b.dataset.pnA4=row.id.slice(5);
      b.textContent='A4';
      b.title='Open A4 project report (full details and clickable map)';
      b.setAttribute('aria-label','Open A4 report for '+(row.querySelector('.phone-project-label')?.textContent||row.id.slice(5)));
      actions.append(b);
    }
  }
  async function openReport(trigger){
    const row=trigger.closest('tr[id^="repd-"]');
    if(!row)return;
    const ref=row.id.slice(5);
    const project=(state.all||[]).find(x=>String(x.repd_ref)===ref)||
      (state.interconnectors||[]).find(x=>String(x.repd_ref)===ref);
    if(!project)return;
    // A4 HTML/PDF must use this project's native VICINITY MAP action,
    // including when expanded-view styling hides its original action cell.
    const validProjectMap=anchor=>{
      try{const u=new URL(anchor.href);
        return u.origin==='https://ventusltd.github.io'
          && u.pathname==='/gridatlas/atlas/'
          && u.searchParams.get('repd_ref')===ref;
      }catch{return false}
    };
    const links=[...row.querySelectorAll('td:last-child a.atlaslink[href]')];
    const originalMap=links.find(a=>a.classList.contains('pn-journey-link')&&validProjectMap(a))
      || links.find(validProjectMap);
    const href=originalMap?.href||'';
    model=reportData(project,href,state.canonicalModel?.metadata||{});
    if(!model)return;
    render(model);
    restore={bodyOverflow:document.body.style.overflow,
      mainScroll:document.querySelector('main')?.scrollTop||0,
      tableScroll:table.scrollTop,tableX:table.scrollLeft,y:window.scrollY};
    lastTrigger=trigger;
    document.body.classList.add('pn-report-open');
    document.body.style.overflow='hidden';
    root.hidden=false;
    orientation='portrait';paper.classList.remove('pn-report-landscape');
    button('rotate').textContent='Landscape';
    fitView('width');
    button('close').focus({preventScroll:true});
  }
  function closeReport(){
    if(root.hidden)return;
    root.hidden=true;document.body.classList.remove('pn-report-open');
    if(restore){
      document.body.style.overflow=restore.bodyOverflow;
      const snapshot=restore;restore=null;
      requestAnimationFrame(()=>{
        table.scrollLeft=snapshot.tableX;table.scrollTop=snapshot.tableScroll;
        const main=document.querySelector('main');
        if(main)main.scrollTop=snapshot.mainScroll;
        window.scrollTo(0,snapshot.y);
      });
    }
    lastTrigger?.focus({preventScroll:true});
    model=null;gesture=null;
  }
  async function pdfDownload(){
    if(!model)return;
    const bytes=buildA4Pdf(model,{landscape:orientation==='landscape'});
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download='REPD-'+model.reference+'-A4-report.pdf';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function action(name){
    if(name==='close'){closeReport();return;}
    if(root.hidden)return;
    if(name==='fitwidth'){fitView('width');return;}
    if(name==='fitpage'){fitView('page');return;}
    if(name==='minus'||name==='plus'){
      fit='custom';resize(scale*(name==='plus'?1.2:1/1.2),true);return;
    }
    if(name==='rotate'){
      orientation=orientation==='portrait'?'landscape':'portrait';
      paper.classList.toggle('pn-report-landscape',orientation==='landscape');
      button('rotate').textContent=orientation==='portrait'?'Landscape':'Portrait';
      fitView('width');return;
    }
    if(name==='pdf'){pdfDownload();return;}
    if(name==='print'){window.print();return;}
  }
  tbody.addEventListener('click',event=>{
    const b=event.target.closest('[data-pn-a4]');
    if(!b)return;
    event.preventDefault();event.stopPropagation();
    openReport(b);
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('[data-report-action]');
    if(b)action(b.dataset.reportAction);
  });
  window.addEventListener('pipeline-projects-rendered',annotate);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!root.hidden){
      event.stopImmediatePropagation();event.preventDefault();closeReport();
    }
  },true);
  window.addEventListener('resize',()=>{
    if(!root.hidden&&fit!=='custom')fitView(fit);
  },{passive:true});
  const dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  viewport.addEventListener('touchstart',event=>{
    if(event.touches.length===2){
      gesture={distance:dist(event.touches[0],event.touches[1]),scale};
    }
  },{passive:true});
  viewport.addEventListener('touchmove',event=>{
    if(event.touches.length!==2||!gesture)return;
    if(event.cancelable)event.preventDefault();
    fit='custom';
    const factor=dist(event.touches[0],event.touches[1])/Math.max(1,gesture.distance);
    resize(gesture.scale*factor,true);
  },{passive:false});
  viewport.addEventListener('touchend',event=>{
    if(event.touches.length<2)gesture=null;
  },{passive:true});
  annotate();
})();
