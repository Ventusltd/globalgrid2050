/** Loopback-only preview; no deployment or write endpoint. */
import {createServer} from 'node:http';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const port=Number(process.env.V928_PORT||17828);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid loopback preview port');
const deadline=process.env.V928_DEADLINE_UTC?Date.parse(process.env.V928_DEADLINE_UTC):null;
if(deadline!==null&&(!Number.isFinite(deadline)||deadline<=Date.now()))throw new Error('Preview window has expired');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.geojson':'application/geo+json','.csv':'text/csv','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.split('/').some(part=>part.startsWith('.'))){res.writeHead(403).end();return;}
    let file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(existsSync(file)&&statSync(file).isDirectory())file=resolve(file,'index.html');
    if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:readFileSync(file));
  }catch{res.writeHead(400).end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`Non-live preview: http://127.0.0.1:${port}/uk_renewables_pipeline/202611161757/`));
if(deadline!==null)setTimeout(()=>server.close(),deadline-Date.now());
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
