import {assetRows, selectRows, locationLink, voltageLabel} from './model.mjs';
const node = (doc, tag, text, cls) => { const n=doc.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
function link(doc, label, href) { const a=node(doc,'a',label); a.href=href; a.target='_blank'; a.rel='noopener noreferrer'; return a; }
function csvCell(value) {
  let s=String(value??'');
  if(typeof value!=='number' && /^[=+@\-\t\r]/.test(s))s="'"+s;
  return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
export function assetCsv(rows,{sourceUrl=null,datasetAttribution=null}={}) {
  return [['Source ID','Name','Operator','Category','Published voltage','Longitude','Latitude','MAP location','Source dataset URL','Source attribution and licences','Dataset attribution and licence','Source record'],
    ...rows.map(r=>[r.sourceId,r.name,r.operator,r.category,r.voltage,r.coordinates?.[0],r.coordinates?.[1],locationLink(r),sourceUrl,
      JSON.stringify(r.properties?.sources??[]),JSON.stringify(datasetAttribution),JSON.stringify(r.properties)])]
    .map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function renderAssets(host,{data,layer}) {
  const doc=host.ownerDocument, rows=assetRows(data,layer.kind); let page=0;
  host.append(node(doc,'p',layer.sourceLabel,'pn-source'));
  const provenance={sourceUrl:layer.data.url,sha256:layer.data.sha256,
    datasetAttribution:data.licence??data.license??data.attribution??layer.sourceLabel};
  const disclosure=node(doc,'details'),disclosureTitle=node(doc,'summary','Dataset source and attribution');
  disclosure.append(disclosureTitle,node(doc,'pre',JSON.stringify(provenance,null,2)));host.append(disclosure);
  host.append(node(doc,'p',layer.kind==='substation'
    ? 'Mapped substations; source names and voltages retained. A mapped site does not establish available capacity or a project connection.'
    : 'Potential offtakers for screening. Data-centre overlap is retained; a listed site is not confirmed demand, a contract or a connection.','pn-note'));
  const tools=node(doc,'div',undefined,'pn-tools');
  const search=node(doc,'input'); search.type='search'; search.placeholder='Name, operator, source ID…'; search.setAttribute('aria-label','Search '+layer.label);
  const exportButton=node(doc,'button','Export results'); exportButton.type='button';
  const plotButton=node(doc,'button','2D locations'); plotButton.type='button'; plotButton.setAttribute('aria-pressed','false');
  const statsButton=node(doc,'button','Analytics'); statsButton.type='button'; statsButton.setAttribute('aria-pressed','false');
  tools.append(search,exportButton,plotButton,statsButton); host.append(tools);
  const status=node(doc,'p',undefined,'pn-count'); status.setAttribute('role','status');
  const graph=node(doc,'div',undefined,'pn-plot'); graph.hidden=true;
  const graphTitle=node(doc,'p','2D source locations · schematic longitude/latitude view, north up');
  const canvas=node(doc,'canvas'); canvas.width=720; canvas.height=360; canvas.setAttribute('aria-label','Source locations. Use the searchable table for names and MAP links.');
  graph.append(graphTitle,canvas);
  const analytics=node(doc,'div',undefined,'pn-analytics'); analytics.hidden=true;
  const wrap=node(doc,'div',undefined,'pn-tablewrap'), table=node(doc,'table'), head=node(doc,'thead'), header=node(doc,'tr'), body=node(doc,'tbody');
  for(const value of ['Name / source ID','Operator','Voltage / category','Map']) { const th=node(doc,'th',value); th.scope='col'; header.append(th); }
  head.append(header); table.append(head,body); wrap.append(table);
  const paging=node(doc,'div',undefined,'pn-tools'), previous=node(doc,'button','Previous'), next=node(doc,'button','Next'), pageText=node(doc,'span');
  previous.type=next.type='button'; paging.append(previous,pageText,next);
  host.append(status,graph,analytics,wrap,paging);
  let filtered=rows, points=[];
  function draw() {
    if(graph.hidden)return;
    const context=canvas.getContext('2d'); if(!context)return;
    context.clearRect(0,0,canvas.width,canvas.height);
    const located=filtered.filter(r=>r.coordinates);
    if(!located.length) { graphTitle.textContent='No locations recorded for these results'; points=[]; return; }
    graphTitle.textContent='2D source locations · schematic longitude/latitude view, north up';
    const xs=located.map(r=>r.coordinates[0]),ys=located.map(r=>r.coordinates[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    points=located.map(row=>({row,x:18+(row.coordinates[0]-minX)/(maxX-minX||1)*684,y:342-(row.coordinates[1]-minY)/(maxY-minY||1)*324}));
    context.fillStyle='#00ffff';
    for(const p of points){context.beginPath();context.arc(p.x,p.y,2.1,0,Math.PI*2);context.fill();}
  }
  function drawAnalytics() {
    if(analytics.hidden)return;
    const counts=new Map();
    for(const row of filtered){const key=String(layer.kind==='substation'?(row.voltage??'Voltage not recorded'):(row.category??'Category not recorded'));counts.set(key,(counts.get(key)||0)+1);}
    analytics.replaceChildren(node(doc,'p',`Source-record counts by ${layer.kind==='substation'?'published voltage text (volts)':'category'}; not MW, demand or available capacity.`));
    const ordered=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,20), maximum=Math.max(1,...ordered.map(x=>x[1]));
    for(const [label,count] of ordered){const row=node(doc,'div',undefined,'pn-bar-row'), text=node(doc,'span',`${label}: ${count}`),bar=node(doc,'meter');bar.min=0;bar.max=maximum;bar.value=count;bar.setAttribute('aria-label',label);row.append(text,bar);analytics.append(row);}
  }
  function update() {
    filtered=selectRows(rows,search.value); page=Math.min(page,Math.max(0,Math.ceil(filtered.length/100)-1));
    const located=filtered.filter(r=>r.coordinates).length,named=filtered.filter(r=>r.name).length;
    status.textContent=`${filtered.length.toLocaleString('en-GB')} records · ${named.toLocaleString('en-GB')} source names · ${located.toLocaleString('en-GB')} locations`;
    body.replaceChildren();
    for(const row of filtered.slice(page*100,(page+1)*100)) {
      const tr=node(doc,'tr'); tr.dataset.sourceId=row.sourceId;
      const name=node(doc,'td'); name.append(node(doc,'strong',row.name||'Name not recorded'),node(doc,'small',row.sourceId));
      const details=node(doc,'details'),summary=node(doc,'summary','Source record');details.append(summary);
      details.addEventListener('toggle',()=>{if(!details.open || details.childNodes.length>1)return;
        const pre=node(doc,'pre',JSON.stringify(row.properties,null,2));details.append(pre);
      });name.append(details);
      tr.append(name,node(doc,'td',row.operator||'Not recorded'),node(doc,'td',layer.kind==='substation'?voltageLabel(row.voltage):String(row.category??'Not recorded')));
      const td=node(doc,'td'),href=locationLink(row); if(href){const a=link(doc,'MAP',href);a.title='Open source location in GridAtlas; not a declared connection';td.append(a);}else td.textContent='Location not recorded';
      tr.append(td);body.append(tr);
    }
    previous.disabled=page===0;next.disabled=(page+1)*100>=filtered.length;pageText.textContent=`Page ${page+1} / ${Math.max(1,Math.ceil(filtered.length/100))}`;
    draw();drawAnalytics();
  }
  search.addEventListener('input',()=>{page=0;update();});
  previous.addEventListener('click',()=>{page--;update();});next.addEventListener('click',()=>{page++;update();});
  plotButton.addEventListener('click',()=>{graph.hidden=!graph.hidden;plotButton.setAttribute('aria-pressed',String(!graph.hidden));draw();});
  statsButton.addEventListener('click',()=>{analytics.hidden=!analytics.hidden;statsButton.setAttribute('aria-pressed',String(!analytics.hidden));drawAnalytics();});
  canvas.addEventListener('click',event=>{
    const b=canvas.getBoundingClientRect(),x=(event.clientX-b.left)*canvas.width/b.width,y=(event.clientY-b.top)*canvas.height/b.height;
    let selected=null,distance=144;
    for(const p of points){const d=(p.x-x)**2+(p.y-y)**2;if(d<distance){selected=p.row;distance=d;}}
    if(selected){search.value=selected.sourceId;page=0;update();search.focus();}
  });
  exportButton.addEventListener('click',()=>{
    const href=URL.createObjectURL(new Blob([assetCsv(filtered,provenance)],{type:'text/csv;charset=utf-8'}));
    const a=link(doc,'',href);a.download=layer.id+'-results.csv';doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  });
  update();
}
export function renderGridProjects(host) {
  const doc=host.ownerDocument;
  host.append(node(doc,'p','No independently approved news-derived Grid project records are connected to this view yet.'));
  host.append(node(doc,'p','The existing Ventus News Engine owns acquisition and candidate associations. Unreviewed fixtures, nearby assets and name matches are not published project events.','pn-note'));
}
export function renderPrices(host,{layer}) {
  const doc=host.ownerDocument;
  host.append(node(doc,'p',layer.sourceLabel,'pn-source'),link(doc,'Open original electricity market workspace',layer.url));
  host.append(node(doc,'p','Inspect each graph’s observation dates and actual-data label. The existing workspace can show indicative price baselines when actual prices are unavailable.','pn-note'));
  const button=node(doc,'button','Show original graphs here');button.type='button';host.append(button);
  button.addEventListener('click',()=>{
    const frame=node(doc,'iframe');frame.title='Original Electricity Market Intelligence graphs';frame.loading='lazy';frame.src=layer.url;frame.referrerPolicy='no-referrer';
    host.append(frame);button.remove();
  },{once:true});
}
export const renderers={assets:renderAssets,'grid-projects':renderGridProjects,prices:renderPrices};
