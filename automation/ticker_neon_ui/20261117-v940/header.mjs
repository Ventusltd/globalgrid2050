// Import once, then relocate its real control. Its existing filter closure remains authoritative.
import '../../news_quality_ui/20261117-v937/view.mjs';
const D=document,head=D.querySelector('.newspaper .masthead'),query=D.querySelector('.pn-news-filter-tools input[type="search"]');
if(head&&query&&!head.querySelector('.pn-news-header-search')){
 const line=D.createElement('div');line.className='pn-news-header-line';const title=D.getElementById('headlinesHeading');if(title){title.textContent='GLOBALGRID2050 HEADLINES';line.append(title);}
 const label=D.createElement('label');label.className='pn-news-header-search';const text=D.createElement('span');text.textContent='NEWS SEARCH';query.setAttribute('aria-label','Search news titles, sources or topics');query.placeholder='Search news';label.append(text,query);line.append(label);head.prepend(line);
 const strap=head.querySelector('.strap'),status=D.getElementById('newsStatus');if(strap&&status){head.append(status);const notes=D.createElement('details'),summary=D.createElement('summary');summary.textContent='News scope and matching guidance';notes.className='pn-news-guidance';notes.append(summary,strap);D.querySelector('.pn-news-quality')?.append(notes);}
}
