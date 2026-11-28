// V9.61: independent project-column width and density control. Does not alter data or sort handlers.
(() => {
  'use strict';
  const panel=document.getElementById('repdPanel');
  const wrap=document.getElementById('repdScroll');
  const toolbar=document.querySelector('.column-scroll-tools');
  const body=document.getElementById('tbody');
  if(!panel||!wrap||!toolbar||!body||document.getElementById('repdProjectWidth'))return;
  const select=document.createElement('select');
  select.id='repdProjectWidth';
  select.setAttribute('aria-label','Project name column width');
  select.title='Choose compact, minimised or full project names; all official columns remain available';
  for(const [value,label] of [['compact','Names: compact'],['mini','Names: minimise'],['full','Names: full']]){
    const option=document.createElement('option');
    option.value=value;option.textContent=label;select.append(option);
  }
  toolbar.prepend(select);
  let mode='compact';
  function updateMode(next){
    if(!['compact','mini','full'].includes(next))return;
    mode=next;select.value=mode;
    wrap.classList.toggle('pn-project-mini',mode==='mini');
    wrap.classList.toggle('pn-project-full',mode==='full');
    wrap.dispatchEvent(new Event('scroll'));
  }
  function annotateRows(){
    for(const row of body.querySelectorAll('tr[id^="repd-"]')){
      const label=row.querySelector('.phone-project-label');
      if(label&&!label.dataset.mini){
        const words=(label.textContent||'').trim().split(/[\s\-]+/).filter(Boolean);
        label.dataset.mini=(words.length>1?words.slice(0,2).map(w=>w[0]).join(''):words[0]?.slice(0,2)||'P').toUpperCase();
        if(!label.title)label.title=label.textContent.trim();
      }
      for(const td of row.cells){
        if(td.classList.contains('site')||td.title||td.querySelector('button,a'))continue;
        const value=td.textContent.trim();
        if(value)td.title=value;
      }
    }
  }
  select.addEventListener('change',()=>updateMode(select.value));
  // Opening the existing full-details control restores a readable name column first.
  body.addEventListener('click',event=>{
    if(mode==='mini'&&event.target.closest('.project-record > summary'))updateMode('full');
  },true);
  window.addEventListener('pipeline-projects-rendered',annotateRows);
  annotateRows();
  updateMode('compact');
})();
