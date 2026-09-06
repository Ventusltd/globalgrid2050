/* Keep the existing Drawing View toggle reachable while its parent panel is hidden. */
(()=>{
 const original=document.getElementById('drawing_view_btn');
 if(!original||document.getElementById('exit_drawing_view'))return;
 const exit=document.createElement('button');
 exit.id='exit_drawing_view';exit.type='button';exit.textContent='Exit Drawing View';
 exit.style.cssText='position:fixed;right:16px;bottom:16px;z-index:1000;min-height:44px;padding:10px 16px;color:#050505;background:#0ff;border:2px solid #fff;border-radius:5px;font:bold 14px monospace;cursor:pointer';
 exit.hidden=true;document.body.append(exit);
 const sync=()=>{exit.hidden=!document.body.classList.contains('drawing-view');};
 const leave=()=>{if(exit.hidden)return;original.click();original.focus();};
 exit.addEventListener('click',leave);
 original.addEventListener('click',()=>{sync();if(!exit.hidden)exit.focus();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!exit.hidden){event.preventDefault();leave();}});
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 sync();
})();
