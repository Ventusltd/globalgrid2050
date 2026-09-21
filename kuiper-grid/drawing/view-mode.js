'use strict';
(function boot(){
 if(!window.__arrayLab?.engineReady){setTimeout(boot,200);return;}
 const style=document.createElement('style');
 style.textContent='.proposal-explore .app{grid-template-columns:minmax(0,1fr)}.proposal-explore aside,.proposal-explore main>.detail,.proposal-explore #circuit-workbench,.proposal-explore #mppt-workbench,.proposal-explore #pair-workbench,.proposal-explore #ac-station,.proposal-explore .placement-tools{display:none!important}.proposal-explore .stage{height:66vh}.view-mode-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 17px;border-bottom:1px solid #35475a;background:#102133}.view-mode-bar p{margin:0;color:#b7ccdf;font-size:12px}.view-mode-bar button[aria-pressed="true"]{border-color:#72e5dc;background:#20514f}';
 document.head.append(style);
 style.textContent+=' .proposal-explore #site-navigation,.proposal-explore .explore-advanced{display:none!important}';
 function markAdvanced(){
  document.getElementById('scale-command')?.closest('.actions')?.classList.add('explore-advanced');
  document.getElementById('scale-export')?.parentElement?.parentElement?.classList.add('explore-advanced');
  document.querySelectorAll('#site-scale>p.note:not(#scale-status)').forEach(p=>p.classList.add('explore-advanced'));
 }
 const bar=document.createElement('nav');bar.className='view-mode-bar';bar.setAttribute('aria-label','Detail level');
 bar.innerHTML='<button id="view-explore" type="button" aria-pressed="false">Explore proposal</button><button id="view-engineer" type="button" aria-pressed="true">Design &amp; engineering</button><p id="view-mode-note">One shared model. Proposed geometry and entered ratings remain development assumptions.</p>';
 document.querySelector('header').after(bar);
 document.getElementById('edit-placement')?.closest('.toolbar')?.classList.add('placement-tools');
 let current='engineer';
 function set(mode){
  if(!['explore','engineer'].includes(mode))throw Error('Unknown detail level');
  markAdvanced();current=mode;document.body.classList.toggle('proposal-explore',mode==='explore');
  for(const key of ['explore','engineer'])document.getElementById('view-'+key).setAttribute('aria-pressed',String(mode===key));
  document.getElementById('view-mode-note').textContent=mode==='explore'?'Explore the same design: open the site controls to size the proposal, then select blocks and strings. Layout is provisional; capacity is DC nameplate, not grid export.':'One shared model. Proposed geometry and entered ratings remain development assumptions.';
  if(mode==='explore'){const scale=document.getElementById('site-scale');if(scale)scale.open=true;}
  window.dispatchEvent(new Event('resize'));
 }
 document.getElementById('view-explore').onclick=()=>set('explore');
 document.getElementById('view-engineer').onclick=()=>set('engineer');
 window.__viewMode={set,get current(){return current;}};
})();
