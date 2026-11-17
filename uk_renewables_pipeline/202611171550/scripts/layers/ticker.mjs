import {latestHeadlines} from './model.mjs';
const states=new WeakMap();
export function renderTicker(host,items,{snapshotLabel='Latest available headlines'}={}) {
  const doc=host.ownerDocument,headlines=latestHeadlines(items),size=20;
  const key=JSON.stringify(headlines),previousState=states.get(host);
  if(previousState?.key===key&&previousState.label.parentNode===host){previousState.label.textContent=snapshotLabel;return;}
  host.classList.add('pn-ticker');host.replaceChildren();host.dataset.count=String(headlines.length);
  const el=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;};
  const label=el('span','pn-ticker-label',snapshotLabel),tools=el('div','pn-ticker-tools');
  const search=el('input');search.type='search';search.placeholder='Search headlines';search.setAttribute('aria-label','Search ticker headlines by title or publisher');
  search.value=previousState?.query||'';
  const previous=el('button','', 'Previous'),next=el('button','','Next'),count=el('span','pn-ticker-count');
  previous.type=next.type='button';previous.setAttribute('aria-label','Previous headlines');next.setAttribute('aria-label','Next headlines');count.setAttribute('role','status');
  tools.append(search,previous,next,count);
  const viewport=el('div','pn-ticker-viewport');viewport.tabIndex=0;viewport.setAttribute('role','region');
  const track=el('div','pn-ticker-track'),list=el('ul');track.append(list);viewport.append(track);host.append(label,tools,viewport);
  let page=0;
  const state={key,label,query:search.value,page};states.set(host,state);
  function draw(){
    const query=search.value.trim().toLocaleLowerCase('en-GB'),matches=headlines.filter(h=>!query||[h.title,h.source].some(value=>value.toLocaleLowerCase('en-GB').includes(query)));
    const pages=Math.ceil(matches.length/size);page=Math.max(0,Math.min(page,pages-1));const start=page*size,shown=matches.slice(start,start+size);
    state.query=search.value;state.page=page;
    list.replaceChildren();host.dataset.filteredCount=String(matches.length);host.dataset.page=String(pages?page+1:0);
    count.textContent=`${matches.length} of ${headlines.length} headlines; ${shown.length?start+1:0}-${start+shown.length}; page ${pages?page+1:0}/${pages}`;
    viewport.setAttribute('aria-label',count.textContent+'; scroll horizontally');list.setAttribute('aria-label',count.textContent);
    for(const h of shown){
      const li=el('li'),a=el('a'),time=el('time');a.href=h.link;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${h.title} \u2014 ${h.source}`;
      time.dateTime=h.date;time.textContent=`${h.dateKind} ${h.date}`;li.append(a,' \u00b7 ',time);list.append(li);
    }
    if(!shown.length)list.append(el('li','',headlines.length?'No matching headlines':'Headlines unavailable'));
    previous.disabled=page===0;next.disabled=page+1>=pages;search.disabled=!headlines.length;viewport.scrollLeft=0;
  }
  search.addEventListener('input',()=>{page=0;draw();});previous.addEventListener('click',()=>{page--;draw();});next.addEventListener('click',()=>{page++;draw();});draw();
}
