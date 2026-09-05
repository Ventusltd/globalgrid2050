export function shouldOfferRecovery(state) {
  return state.interface==='unrecognised' || state.timedOut==='true';
}
/** A retry requests confirmation; it never directly replaces a tool's document. */
export function mountToolRecovery(bar, status, requestConfirmation) {
  const button=bar.ownerDocument.createElement('button');button.textContent='Retry tool loading';
  Object.assign(button.style,{gridColumn:'1 / -1',minHeight:'44px',justifySelf:'start',cursor:'pointer'});
  const reflect=()=>{button.hidden=!shouldOfferRecovery(status.dataset);};
  button.addEventListener('click',requestConfirmation);reflect();bar.append(button);
  const observer=new MutationObserver(reflect);observer.observe(status,{attributes:true});
  return ()=>{observer.disconnect();button.removeEventListener('click',requestConfirmation);button.remove();};
}
