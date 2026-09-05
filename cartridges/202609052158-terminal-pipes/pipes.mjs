// Direction glyph table adapted from pipeseroni/pipes.sh (MIT); see LICENSE.pipes.txt.
// Original bounded browser rendering. Decorative trace, not actual grid topology.
const root=document.getElementById('terminal-pipes');
if(root){const glyphs=Array.from('│┌ ┐┘─┐  └│┘└ ┌─'),w=40,h=4,grid=Array.from({length:h},()=>Array(w).fill(' '));let x=0,y=1,d=1,n=0,last=0,paused=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');root.querySelector('button').onclick=()=>{paused=!paused;root.querySelector('button').textContent=paused?'Play sketch':'Pause sketch';};
function frame(t){if(!root.isConnected)return;if(!paused&&!document.hidden&&t-last>=(reduced.matches?1000:80)){const next=n%11===0?(d+1)%4:d;grid[y][x]=glyphs[d*4+next];d=next;x=(x+[0,1,0,-1][d]+w)%w;y=(y+[-1,0,1,0][d]+h)%h;if(++n%240===0)grid.forEach(r=>r.fill(' '));root.querySelector('pre').textContent=grid.map(r=>r.join('')).join('\n');last=t;}requestAnimationFrame(frame);}requestAnimationFrame(frame);}
