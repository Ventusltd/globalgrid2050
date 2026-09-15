// Harmonic paths illustrate concepts; their positions and phase are not engineering results.
export const TAU = Math.PI * 2;
export const KEYS = ['identity','physics','replay','validation','interaction','composition'];
export const CONCEPTS = [
  {key:'identity',name:'Identity',color:'#76ead9',title:'A name can change. An identity stays.',copy:'Keep a stable key while the shape around it changes.'},
  {key:'physics',name:'Physics',color:'#f5bd73',title:'Give every number its physical meaning.',copy:'Power, energy and capacity are different quantities. Units, intervals and missing values need explicit rules.'},
  {key:'replay',name:'Replay',color:'#8fabff',title:'Return to the same starting point.',copy:'Return to the same inputs to repeat a study. Here, move the timeline to revisit a visual moment.'},
  {key:'validation',name:'Evidence',color:'#ed91bb',title:'A compelling picture still needs evidence.',copy:'A visual pattern can suggest a question. Tests and observations are needed to support a conclusion.'},
  {key:'interaction',name:'Interaction',color:'#b6cf79',title:'Make the invisible explorable.',copy:'Use the labelled buttons with touch or a keyboard. Pause the motion to explore a still frame.'},
  {key:'composition',name:'Composition',color:'#b7a1ee',title:'Six ideas. One understandable study.',copy:'Explore how these ideas fit together. Lines in the chord view show connections between the six concepts.'}
];
export const VIEWS = {
  twin:{kicker:'MIRROR / CONTINUITY',title:'The present, seen from both sides.',note:'Inspired by Quantum Twin Star · mirrored phase paths'},
  ring:{kicker:'ORBIT / CONTINUITY',title:'Different paths. Stable identities.',note:'Inspired by the ring lens · harmonic orbits'},
  particle:{kicker:'FIELD / POSSIBILITY',title:'Ideas in motion, without losing their centre.',note:'Inspired by the particle lens · bounded flowing clusters'},
  chord:{kicker:'WEAVE / DEPENDENCY',title:'Connections make a whole.',note:'Inspired by the chord lens · connections between ideas'},
  river:{kicker:'FLOW / REPLAY',title:'Follow an idea through time.',note:'Inspired by the river lens · reversible phase traces'},
  column:{kicker:'RHYTHM / COMPOSITION',title:'Separate voices, moving together.',note:'Inspired by the column lens · visual amplitude, not progress'},
  table:{kicker:'READ / OVERVIEW',title:'Stillness is another useful perspective.',note:'Inspired by the table lens · six ideas to explore'}
};
export const EDGES = [[0,2],[1,3],[2,3],[3,4],[0,5],[1,5],[2,5],[3,5],[4,5]];
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const wrapTime = n => ((n % 60) + 60) % 60;
export function point(view,group,index,time,twin=false){
  const u=index/32, a=group*TAU/6-Math.PI/2, phase=TAU*time/60;
  const q=u*TAU, wobble=Math.sin(q*3+phase*2+group);
  let x,y;
  if(view==='twin'){
    const r=.22+.055*Math.sin(q*3+phase+group)+.018*Math.cos(q*5-phase);
    x=.5+r*Math.cos(a+q+phase); y=.5+r*Math.sin(a+q+phase)*1.06;
  }else if(view==='ring'||view==='chord'){
    const theta=a+(u-.5)*.74+phase;
    const r=.29+.034*Math.sin(q*2+phase*3+group);
    x=.5+r*Math.cos(theta);y=.5+r*Math.sin(theta);
  }else if(view==='particle'){
    const theta=a+phase;
    const rr=.055+.05*Math.sin(q*3+phase+group);
    x=.5+.22*Math.cos(theta)+rr*Math.cos(q*2-phase*(1+group%2));
    y=.5+.23*Math.sin(theta)+rr*Math.sin(q*3+phase);
  }else if(view==='river'){
    x=.08+u*.84;
    y=.23+group*.105+.035*Math.sin(u*TAU*1.6-phase*2+group*.4)+.012*wobble;
  }else if(view==='column'){
    x=.13+group*.148+.025*Math.sin(q*2+phase+group);
    y=.22+u*.57+.04*Math.sin(q+phase*2+group);
  }else{throw new Error('Unknown visual view');}
  if(twin){x=1-x;y=1-y;}
  return {x,y};
}
export function focusPoint(view,group,time){
  if(view==='river')return point(view,group,16,time);
  if(view==='column')return {x:.13+group*.148,y:.5};
  const a=group*TAU/6-Math.PI/2+TAU*time/60;
  const r=view==='particle'?.22:.29;
  return {x:.5+Math.cos(a)*r,y:.5+Math.sin(a)*r};
}
export function nearestConcept(view,x,y,time){
  let best=0,distance=Infinity;
  for(let g=0;g<6;g++)for(let i=0;i<32;i++){
    const p=point(view,g,i,time),d=(p.x-x)**2+(p.y-y)**2;
    if(d<distance){distance=d;best=g;}
  }
  return best;
}
