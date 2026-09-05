export const minute=now=>((now%60000)+60000)%60000;
export function animate(root,draw){
 let paused=false,last=-Infinity;const reduced=matchMedia('(prefers-reduced-motion: reduce)'),button=root.querySelector('button[data-pause]');
 if(button){button.disabled=false;button.onclick=()=>{paused=!paused;button.textContent=paused?'Resume':'Pause';button.setAttribute('aria-pressed',String(paused));};}
 function frame(t){if(!root.isConnected)return;if(!paused&&!document.hidden&&t-last>=(reduced.matches?1000:50)){draw(Date.now(),t);root.dataset.frames=String(Number(root.dataset.frames||0)+1);last=t;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
export function row(root,key,text,fraction){const target=root.querySelector('[data-row="'+key+'"]');target.querySelector('output').textContent=text;target.querySelector('progress').value=Math.max(0,Math.min(1,fraction));}
