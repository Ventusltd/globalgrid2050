// Native touch scrolling remains available; the persistent slider is an additional control.
const wrap=document.getElementById('repdScroll'),range=document.getElementById('columnScroll');
if(wrap&&range){
 const extent=()=>Math.max(0,wrap.scrollWidth-wrap.clientWidth);
 function sync(){const max=extent();range.disabled=!max;range.value=max?100*wrap.scrollLeft/max:0;}
 function size(){if(wrap.clientWidth>0){const width=wrap.clientWidth,name=Math.round(width*.62);wrap.style.setProperty('--phone-name',name+'px');wrap.style.setProperty('--phone-capacity',(width-name)+'px');}sync();}
 wrap.addEventListener('scroll',sync,{passive:true});
 range.addEventListener('input',()=>{wrap.scrollLeft=Number(range.value)*extent()/100;});
 if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(size);observer.observe(wrap);}
 window.addEventListener('resize',size,{passive:true});
 window.addEventListener('pipeline-projects-rendered',()=>requestAnimationFrame(sync));
 size();
}
