// V9.65: native REPD dashboard maximised, without duplicating tables, gauges or data.
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
  launch.title='Maximise the existing REPD table and its real analytics gauges';
  launch.setAttribute('aria-haspopup','dialog');
  launch.setAttribute('aria-controls','pnExpandedHost');
  toolbar.append(launch);
  const host=document.createElement('aside');
  host.id='pnExpandedHost';host.hidden=true;
  host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');
  host.setAttribute('aria-label','Expanded REPD table');
  host.innerHTML='<div class="pn-expanded-top"><strong>EXPANDED REPD VIEW</strong>'+
    '<span class="pn-expanded-subtitle">LIVE REPD · 100 ROWS PER PAGE</span>'+
    '<button type="button" id="pnExpandedClose" aria-label="Close expanded REPD view">CLOSE ×</button></div>'+
    '<aside id="pnExpandedFilter" hidden aria-label="Column filter"></aside>';
  document.body.append(host);
  const filter=document.getElementById('pnExpandedFilter');
  const closeButton=document.getElementById('pnExpandedClose');
  let expanded=false,rootMark=null,techMark=null,snapshot=null,hadScan=false;
  let lastFocus=null;
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
  const columns=['name','capacity','county','operator','technology','status','repd',null,
                 'updated','submitted','operational',null,null];
  // Every filter lives inside its own column heading. Existing heading sort buttons remain native.
  [...table.querySelectorAll('thead th')].forEach((th,i)=>{
    const key=columns[i];
    if(!['name','capacity','county','operator','technology','status','updated','submitted','operational'].includes(key))return;
    const button=document.createElement('button');
    button.type='button';button.className='pn-expanded-column-filter';
    button.dataset.pnExpandedFilter=key;
    button.setAttribute('aria-label','Filter '+(th.querySelector('[data-column-sort],#sortUpdated,#sortSubmitted,#sortOperational')?.textContent||key).trim());
    button.textContent='▾';
    th.append(button);
  });
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
    wrap.scrollLeft=0;wrap.scrollTop=0;
    paintOperators();
    scheduleGaugeResize();
    closeButton.focus({preventScroll:true});
  }
  function close(){
    if(!expanded)return;
    dismissFilter();setExpandedPageRows(false);
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
  window.addEventListener('pipeline-projects-rendered',paintOperators);
  window.addEventListener('resize',()=>{if(expanded)scheduleGaugeResize();},{passive:true});
  window.addEventListener('pagehide',()=>{if(expanded)close();});
})();
