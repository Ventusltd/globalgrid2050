// Run with: node --test harness.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {getTestPort} from './server.mjs';

const cwd=fileURLToPath(new URL('.',import.meta.url));
const release='/uk_renewables_pipeline/202611161630/';

test('default and explicit port configuration share one loopback origin',()=>{
  assert.equal(getTestPort({}),4173);
  for(const value of [undefined,'1','4187','65535']){
    const env={...process.env};
    delete env.EVIDENCE_TEST_PORT;
    if(value!==undefined)env.EVIDENCE_TEST_PORT=value;
    const output=execFileSync(process.execPath,['--input-type=module','-e',
      "import c from './playwright.config.mjs'; console.log(JSON.stringify({base:c.use.baseURL,ready:c.webServer.url,reuse:c.webServer.reuseExistingServer}))"],{cwd,env,encoding:'utf8'});
    const config=JSON.parse(output);
    const origin=`http://127.0.0.1:${getTestPort(env)}`;
    assert.deepEqual(config,{base:origin,ready:origin+release,reuse:false});
  }
});

test('invalid ports fail before opening a listener',()=>{
  for(const value of ['', '0', '-1', '65536', '4187.5', '4187abc', ' 4187', '1e3']){
    assert.throws(()=>getTestPort({EVIDENCE_TEST_PORT:value}),/integer from 1 to 65535/);
  }
});

async function unusedPort(){
  const server=createServer().listen(0,'127.0.0.1');
  await once(server,'listening');
  const port=server.address().port;
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  return port;
}

async function start(port,t){
  const child=spawn(process.execPath,['server.mjs'],{cwd,env:{...process.env,EVIDENCE_TEST_PORT:String(port)},stdio:['ignore','ignore','pipe']});
  let stderr='';
  child.stderr.on('data',chunk=>stderr+=chunk);
  t.after(async()=>{
    if(child.exitCode===null && child.signalCode===null){
      const stopped=once(child,'exit');
      child.kill();
      await stopped;
    }
  });
  for(let attempt=0;attempt<100;attempt++){
    assert.equal(child.exitCode,null,stderr);
    try{
      const response=await fetch(`http://127.0.0.1:${port}${release}`,{signal:AbortSignal.timeout(500)});
      assert.equal(response.status,200);
      assert.match(response.headers.get('content-type'),/text\/html/);
      assert.match(await response.text(),/<!doctype html>/i);
      return child;
    }catch(error){
      if(attempt===99)throw error;
      await delay(50);
    }
  }
}

test('two distinct ports serve the candidate concurrently without reusing a server',{timeout:15000},async t=>{
  const firstPort=await unusedPort();
  const first=await start(firstPort,t);
  const secondPort=await unusedPort();
  assert.notEqual(secondPort,firstPort);
  const second=await start(secondPort,t);
  assert.equal(first.exitCode,null);
  assert.equal(second.exitCode,null);
  assert.notEqual(first.pid,second.pid);
});
