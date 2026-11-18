// V9.48: retain the original controls and listeners; collapse secondary news UI.
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
}
