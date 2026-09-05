import {bindLayerDismissal} from './dismissal.js';
import {bindFocusBoundary} from './focus-boundary.js';
/** Isolated, persistent app layers. Each iframe owns its UI and calculation state. */
export function mountToolLayers(tools, base = import.meta.url) {
  const old = document.getElementById('codex-layout-command');
  old?.remove();
  const tray = document.createElement('nav');
  tray.id = 'codex-tool-layers'; tray.setAttribute('aria-label', 'Design tools');
  Object.assign(tray.style, {position:'fixed',right:'12px',top:'180px',zIndex:'10000',display:'flex',gap:'6px',flexWrap:'wrap',maxWidth:'calc(100vw - 24px)'});
  const layers = new Map();
  const disposers = [];
  for (const tool of tools) {
    const button = document.createElement('button');
    button.textContent = tool.title;
    Object.assign(button.style,{background:'#092326',color:'#a8ffff',border:'1px solid #367077',padding:'10px',minHeight:'44px',cursor:'pointer'});
    button.addEventListener('click', () => {
      let layer = layers.get(tool.id);
      if (!layer) {
        layer = document.createElement('section');
        layer.setAttribute('role','dialog'); layer.setAttribute('aria-modal','true'); layer.setAttribute('aria-label',tool.title);
        Object.assign(layer.style,{position:'fixed',inset:'0',zIndex:'2147483000',background:'#081218',display:'flex',flexDirection:'column'});
        const bar = document.createElement('header');
        Object.assign(bar.style,{display:'flex',alignItems:'center',justifyContent:'space-between',color:'#ccffff',background:'#092326',padding:'4px 12px',minHeight:'44px'});
        const title = document.createElement('strong'); title.textContent = tool.title;
        const close = document.createElement('button'); close.textContent = 'Close - return to GridAtlas';
        Object.assign(close.style,{minHeight:'40px',cursor:'pointer'});
        const dismiss = () => {layer.style.display='none'; button.focus();};
        close.addEventListener('click',dismiss);
        bar.append(title,close);
        const frame = document.createElement('iframe'); frame.title = tool.title;
        frame.src = new URL(tool.entry, base).href;
        // Same-origin realm isolation preserves the original application's downloads and links.
        Object.assign(frame.style,{border:'0',width:'100%',flex:'1',minHeight:'0'});
        disposers.push(bindLayerDismissal(layer,frame,dismiss));
        disposers.push(bindFocusBoundary(layer,frame,close));
        layer.append(bar,frame); document.body.append(layer); layers.set(tool.id,layer);
      }
      layer.style.display='flex';
      layer.querySelector('button').focus();
    });
    tray.append(button);
  }
  document.body.append(tray);
  return () => {for(const dispose of disposers) dispose(); tray.remove(); for (const layer of layers.values()) layer.remove();};
}
