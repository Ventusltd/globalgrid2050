/** Restart only this iframe after an explicit two-step user action. */
export function mountSessionRestart(layer, bar, frame, entry) {
  const doc=bar.ownerDocument, row=doc.createElement('div');
  row.dataset.toolSessionActions='';Object.assign(row.style,{gridColumn:'1 / -1',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'});
  const restart=doc.createElement('button'), cancel=doc.createElement('button'), note=doc.createElement('span');
  restart.textContent='Restart tool';cancel.textContent='Keep working';cancel.hidden=true;note.setAttribute('role','status');
  for(const button of [restart,cancel])Object.assign(button.style,{minHeight:'44px',cursor:'pointer'});
  let armed=false;
  const reset=()=>{armed=false;restart.textContent='Restart tool';cancel.hidden=true;note.textContent='';};
  restart.addEventListener('click',()=>{
    if(!armed){armed=true;restart.textContent='Confirm restart';cancel.hidden=false;note.textContent='Unsaved work in this tool will be lost. Other tools stay open.';return;}
    reset();frame.dispatchEvent(new Event('tool-navigation-start'));frame.src=entry;
  });
  cancel.addEventListener('click',()=>{reset();restart.focus();});
  layer.addEventListener('tool-layer-dismissed',reset);
  row.append(restart,cancel,note);bar.append(row);
  return () => {layer.removeEventListener('tool-layer-dismissed',reset);row.remove();};
}
