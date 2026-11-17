import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,unlinkSync,renameSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import test from 'node:test';
import {protectedEditionChanges} from '../edition_history.mjs';

const PREFIX='globalgrid2050-edition-history-';
const editions=['202601010000','202611170512','999999999999'];
const frozen=id=>'uk_renewables_pipeline/'+id+'/index.html';
function fixture(run,{numeric=true}={}) {
  const parent=realpathSync(tmpdir()),repo=mkdtempSync(join(parent,PREFIX));
  const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write=(path,text='original\n')=>{const target=resolve(repo,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,text);};
  try {
    git(['init','--quiet']);git(['config','user.email','history-test@example.invalid']);git(['config','user.name','Edition history tests']);
    git(['config','core.autocrlf','false']);git(['config','core.quotepath','true']);
    write('.gitignore','*.ignored\n');write('uk_renewables_pipeline/v7/index.html');
    if(numeric)for(const id of editions)write(frozen(id));
    git(['add','--all']);git(['commit','--quiet','-m','Frozen baseline']);
    const base=git(['rev-parse','HEAD']),changes=()=>protectedEditionChanges({cwd:repo,base});
    return run({repo,git,write,base,changes});
  } finally {
    // Resolve and verify the exact generated directory before recursive cleanup,
    // including on Windows. Never delete a caller-supplied repository path.
    const target=realpathSync(repo);
    assert.equal(dirname(target),parent,'Temporary repository must remain inside its verified parent');
    assert.ok(basename(target).startsWith(PREFIX),'Temporary repository prefix must match');
    rmSync(target,{recursive:true,force:true});
  }
}

test('unchanged baseline has no protected changes',()=>fixture(({changes})=>assert.deepEqual(changes(),[])));

test('new committed, staged and untracked edition files are append-only additions',()=>fixture(({git,write,changes})=>{
  write('uk_renewables_pipeline/202611170513/index.html');git(['add','--all']);git(['commit','--quiet','-m','Append edition']);
  write('uk_renewables_pipeline/202611170514/index.html');git(['add','--all']);
  write('uk_renewables_pipeline/202611170515/source note.txt');
  assert.deepEqual(changes(),[]);
}));

for(const id of editions)test('baseline edition '+id+' is protected regardless of age or current/future label',()=>fixture(({write,changes})=>{
  write(frozen(id),'modified\n');assert.deepEqual(changes(),[frozen(id)]);
}));

test('deleting an existing file is rejected',()=>fixture(({repo,changes})=>{
  unlinkSync(resolve(repo,frozen(editions[0])));assert.deepEqual(changes(),[frozen(editions[0])]);
}));

test('untracked insertion inside any frozen edition is rejected',()=>fixture(({write,changes})=>{
  const path='uk_renewables_pipeline/'+editions[1]+'/extra/new source.json';write(path,'{}\n');assert.deepEqual(changes(),[path]);
}));

test('moving an old file into a new edition still reports the original deletion',()=>fixture(({repo,write,git,changes})=>{
  const destination='uk_renewables_pipeline/202611170513/index.html';write(destination);
  unlinkSync(resolve(repo,destination));renameSync(resolve(repo,frozen(editions[0])),resolve(repo,destination));git(['add','--all']);
  assert.deepEqual(changes(),[frozen(editions[0])]);
}));

test('NUL paths preserve Unicode and spaces without Git quote escaping',()=>fixture(({write,git,changes})=>{
  const original='uk_renewables_pipeline/'+editions[0]+'/source receipts/énergie 电力.txt';
  const inserted='uk_renewables_pipeline/'+editions[0]+'/source receipts/未確認 note.txt';
  write(original);git(['add','--all']);git(['commit','--quiet','-m','Add protected Unicode baseline']);
  const base=git(['rev-parse','HEAD']);write(original,'changed\n');write(inserted);
  assert.deepEqual(protectedEditionChanges({cwd:git(['rev-parse','--show-toplevel']),base}),[original,inserted].sort());
}));

test('a restored working file cannot conceal a staged mutation',()=>fixture(({write,git,changes})=>{
  write(frozen(editions[0]),'staged mutation\n');git(['add','--all']);write(frozen(editions[0]));
  assert.deepEqual(changes(),[frozen(editions[0])]);
}));

test('ignored insertions are excluded but tracked changes remain protected',()=>fixture(({write,changes})=>{
  write('uk_renewables_pipeline/'+editions[0]+'/cache.ignored');assert.deepEqual(changes(),[]);
  write(frozen(editions[0]),'changed\n');assert.deepEqual(changes(),[frozen(editions[0])]);
}));

test('non-numeric directories and unrelated source files are outside edition history',()=>fixture(({write,changes})=>{
  write('uk_renewables_pipeline/v7/index.html','changed\n');write('automation/new-test.mjs');assert.deepEqual(changes(),[]);
}));

test('missing or invalid pinned bases fail closed',()=>fixture(({repo,base})=>{
  for(const invalid of [undefined,null,'','missing-history-ref','-invalid',base+':missing'])
    assert.throws(()=>protectedEditionChanges({cwd:repo,base:invalid}),/pinned base/);
}));

test('a valid commit without numeric baseline editions fails closed',()=>fixture(({changes})=>{
  assert.throws(changes,/Cannot resolve immutable edition history/);
},{numeric:false}));

test('a missing baseline pipeline tree fails closed',()=>fixture(({repo,git,write})=>{
  git(['checkout','--orphan','empty-baseline']);git(['rm','-r','--quiet','--cached','.']);write('unrelated.txt');
  git(['add','--','unrelated.txt']);git(['commit','--quiet','-m','No pipeline baseline']);
  assert.throws(()=>protectedEditionChanges({cwd:repo,base:git(['rev-parse','HEAD'])}),/Cannot resolve immutable edition history/);
}));
