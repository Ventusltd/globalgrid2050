/** Size only the integration frame; the original application's layout remains its own. */
export function applyToolViewport(layer, bar, frame) {
  Object.assign(layer.style,{boxSizing:'border-box',width:'100%',height:'100%',overflow:'hidden'});
  if(globalThis.CSS?.supports('height','100dvh')) layer.style.height='100dvh';
  Object.assign(bar.style,{
    display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(100px,auto)',
    columnGap:'12px',rowGap:'2px',flexShrink:'0',boxSizing:'border-box',
    paddingTop:'max(6px, env(safe-area-inset-top))',paddingBottom:'6px',
    paddingLeft:'max(12px, env(safe-area-inset-left))',paddingRight:'max(12px, env(safe-area-inset-right))'
  });
  const title=bar.querySelector('strong'), status=bar.querySelector('[data-tool-readiness]'), close=bar.querySelector('button');
  Object.assign(title.style,{gridColumn:'1',gridRow:'1',minWidth:'0',overflowWrap:'anywhere'});
  Object.assign(status.style,{gridColumn:'1',gridRow:'2',fontSize:'12px',minWidth:'0',overflowWrap:'anywhere'});
  Object.assign(close.style,{gridColumn:'2',gridRow:'1 / 3',minHeight:'44px',maxWidth:'min(220px,45vw)',whiteSpace:'normal'});
  Object.assign(frame.style,{display:'block',minWidth:'0',minHeight:'0',width:'100%',flex:'1 1 0',boxSizing:'border-box'});
}
