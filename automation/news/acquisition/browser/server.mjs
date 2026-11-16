// Isolated local static server for browser tests; never a production server.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, sep, extname} from 'node:path';
const root = fileURLToPath(new URL('../../../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.css':'text/css','.svg':'image/svg+xml'};
// One resolver keeps Playwright's origin and its child server in agreement.
// Use a distinct EVIDENCE_TEST_PORT for each concurrent worktree test run.
export function getTestPort(env=process.env){
  const value=env.EVIDENCE_TEST_PORT ?? '4173';
  if(!/^[1-9][0-9]*$/.test(value) || Number(value)>65535){
    throw new Error('EVIDENCE_TEST_PORT must be an integer from 1 to 65535');
  }
  return Number(value);
}
export function createTestServer(){
return createServer(async(req,res)=>{
  try{
    let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root.endsWith(sep)?root:root+sep))throw Error('outside test root');
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('not found');}
});
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createTestServer().listen(getTestPort(),'127.0.0.1');
}
