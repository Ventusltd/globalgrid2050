// A distance's source and limits must be accessible to touch and keyboard users.
export function installMetricDetails() {
  if (document.documentElement.dataset.metricDetailsInstalled) return;
  document.documentElement.dataset.metricDetailsInstalled='true';
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('button[data-repd-metric]');
    if(!trigger)return;
    let dialog=document.getElementById('wider-metric-dialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='wider-metric-dialog';
      dialog.setAttribute('aria-labelledby','wider-metric-heading');
      dialog.style.cssText='box-sizing:border-box;max-width:92vw;width:480px;max-height:80dvh;overflow:auto;background:#080d13;color:#d8e4ed;border:1px solid #66ccff;padding:20px;font:14px/1.6 monospace';
      const heading=document.createElement('h2');heading.id='wider-metric-heading';heading.style.fontSize='16px';
      const text=document.createElement('p');text.id='wider-metric-explanation';
      const close=document.createElement('button');close.type='button';close.textContent='Close';close.style.cssText='min-width:80px;min-height:44px;background:#111;color:#fff;border:1px solid #777';close.addEventListener('click',()=>dialog.close());
      dialog.append(heading,text,close);document.body.append(dialog);
    }
    dialog.querySelector('h2').textContent=(trigger.dataset.metricKind||trigger.textContent.split(/\s/)[0])+' observation \u00b7 REPD '+trigger.dataset.repdMetric;
    dialog.querySelector('p').textContent=trigger.title;
    dialog.showModal();
  });
}
