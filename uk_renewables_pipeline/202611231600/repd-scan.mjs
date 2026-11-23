// V9.62: manual prospect scan. Show only project, real capacity and MAP by default.
// Status and date selectors use the canonical existing REPD filter handlers, not a duplicate filter engine.
(() => {
  'use strict';
  const panel=document.getElementById('repdPanel');
  const wrap=document.getElementById('repdScroll');
  const toolbar=document.getElementById('pnScanToolbar');
  const switcher=document.getElementById('pnScanModeToggle');
  const statusSelect=document.getElementById('pnScanStatus');
  const dateCount=document.getElementById('pnScanDateCount');
  const years=toolbar?.querySelectorAll('[data-year-filter]');
  if(!panel||!wrap||!toolbar||!switcher||!statusSelect||!years?.length)return;
  let scan=true;
  const updateMode=()=>{
    wrap.classList.toggle('pn-scan-mode',scan);
    switcher.textContent=scan?'All columns':'Scan view';
    switcher.setAttribute('aria-pressed',String(scan));
    switcher.title=scan?'Display the unchanged full REPD table':'Return to Project / MW / MAP';
    if(scan)wrap.scrollLeft=0;
    wrap.dispatchEvent(new Event('scroll'));
  };
  switcher.addEventListener('click',()=>{scan=!scan;updateMode();});
  statusSelect.addEventListener('change',()=>{
    const selected=[...document.querySelectorAll('#status [data-official-status]')]
      .find(button=>button.dataset.officialStatus===statusSelect.value);
    if(selected)selected.click();
    else { const native=document.getElementById("repdNativeStatus"); if(native) {native.value=statusSelect.value;native.dispatchEvent(new Event("change",{bubbles:true}));} }
  });
  const sync=()=>{
    const active=document.querySelector('#status [data-official-status][aria-pressed="true"]');
    const native=document.getElementById("repdNativeStatus");
    const current=native?.value || active?.dataset.officialStatus || "All";
    if(statusSelect.value!==current)statusSelect.value=current;
    const count=[...years].filter(select=>select.value&&select.value!=='All').length;
    dateCount.textContent=count?String(count):'';
  };
  for(const select of years)select.addEventListener('change',sync);
  window.addEventListener('pipeline-projects-rendered',sync);
  sync();
  updateMode();
})();
