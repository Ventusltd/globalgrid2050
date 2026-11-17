// Top-level datasets have separate identities, counts and controls.
(function(){
  'use strict';
  const tabs=[document.getElementById('ukProjectsTab'),document.getElementById('globalProjectsTab')];
  if(tabs.some(tab=>!tab))return;
  function select(index,focus=false){
    tabs.forEach((tab,i)=>{
      const active=i===index;
      tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;
    });
    if(focus)tabs[index].focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(index));
    tab.addEventListener('keydown',event=>{
      if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();select(event.key==='Home'?0:event.key==='End'?1:1-index,true);
      }
    });
  });
  // An inherited headline's project-search action must reveal the UK results.
  document.getElementById('search')?.addEventListener('input',()=>select(0));
  document.getElementById('export')?.addEventListener('click',()=>select(0));
})();
