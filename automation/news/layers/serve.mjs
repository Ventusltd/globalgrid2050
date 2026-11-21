import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const server=createServer((request,response)=>{
  try {
    let path=resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+sep)){response.writeHead(403).end();return;}
    if(path===root)path=resolve(root,'demo/index.html');
    else if(statSync(path).isDirectory())path=resolve(path,'index.html');
    response.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(readFileSync(path));
  }catch{response.writeHead(404).end();}
});
server.listen(0,'127.0.0.1',()=>console.log(`Local module review: http://127.0.0.1:${server.address().port}/demo/`));
process.on('SIGINT',()=>server.close());
