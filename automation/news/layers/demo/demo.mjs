import {catalogue} from '../catalogue.mjs';
import {createDataRegistry} from '../registry.mjs';
import {mountLayerControls} from '../controls.mjs';
import {renderers} from '../views.mjs';
import {renderTicker} from '../ticker.mjs';
const registry=createDataRegistry(catalogue);
window.pipelineLayers=mountLayerControls(document.getElementById('intelligence'),{registry,renderers});
// Existing source owner; fallback stays visibly unavailable rather than inventing news.
try {
  const response=await fetch('https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/dist/pipeline_headlines.json',{credentials:'omit'});
  if(!response.ok)throw Error('Headline feed unavailable');
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>4*1024*1024)throw Error('Headline feed too large');
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(data.schema!=='globalgrid2050.news.pipeline-headlines.v1')throw Error('Unexpected headline schema');
  renderTicker(document.getElementById('headlines'),data.items,{snapshotLabel:'Latest available · '+String(data.generated_at||'date unknown')});
}catch{renderTicker(document.getElementById('headlines'),[]);}
