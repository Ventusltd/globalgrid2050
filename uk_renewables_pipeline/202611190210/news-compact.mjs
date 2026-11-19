// V9.49: retain the original controls and listeners; collapse secondary news UI.
import '../../automation/ticker_neon_ui/20261117-v940/header.mjs';
import '../../automation/energy_context_ui/20261118/view.mjs';

const D=document;
const panel=D.querySelector('.newspaper .pn-news-quality');
const search=D.querySelector('.newspaper .pn-news-header-search');
if(panel&&!panel.querySelector('.pn-news-disclosure')){
  const disclosure=D.createElement('details');
  disclosure.className='pn-news-disclosure';
  const summary=D.createElement('summary');
  summary.textContent='Search, filters & sources';
  const settings=D.createElement('div');
  settings.className='pn-news-settings';
  if(search)settings.append(search);
  for(const child of [...panel.children])settings.append(child);
  disclosure.append(summary,settings);
  panel.append(disclosure);
  const status=D.getElementById('newsStatus');
  if(status)settings.prepend(status);
  const ticker=D.getElementById('headlineTicker');
  if(ticker&&ticker.parentElement===panel.parentElement)ticker.after(panel);
  const context=D.getElementById('headlineContextStatus');
  if(context)settings.prepend(context);
}

const ticker=D.getElementById('headlineTicker');
const cleaned=new WeakSet();
function cleanTicker(){
  if(!ticker)return;
  const originals=ticker.querySelectorAll('.pn-ticker-cycle:not(.pn-ticker-copy) .pn-ticker-title');
  const copies=ticker.querySelectorAll('.pn-ticker-copy .pn-ticker-title');
  const items=window.pipelineHeadlineDocument?.items||[];
  originals.forEach((a,i)=>{
    if(!cleaned.has(a)){
      const match=items.find(item=>item.link===a.href);
      const original=a.textContent;
      const cut=original.lastIndexOf(' — ');
      const title=match?.title||(cut>=0?original.slice(0,cut):original);
      cleaned.add(a);
      if(a.textContent!==title)a.textContent=title;
    }
    if(copies[i]&&copies[i].textContent!==a.textContent)copies[i].textContent=a.textContent;
  });
  for(const item of ticker.querySelectorAll('.pn-ticker-item')){
    for(const n of [...item.childNodes])if(n.nodeType===3&&n.textContent.trim()==='·')n.remove();
  }
  const list=ticker.querySelector('ul.pn-ticker-cycle');
  if(list)list.setAttribute('aria-label','Latest headlines');
}
if(ticker){new MutationObserver(cleanTicker).observe(ticker,{childList:true,subtree:true});cleanTicker();}

const title=D.getElementById('headlinesHeading');if(title)title.textContent='HEADLINES';
