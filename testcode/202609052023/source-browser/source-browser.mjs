const tool=document.getElementById('tool'),file=document.getElementById('file'),status=document.getElementById('status'),source=document.getElementById('source'),button=document.getElementById('open');

let apps=[],sequence=0;

const option=(value,text)=>{const node=document.createElement('option');
node.value=value;
node.textContent=text;
return node;
};

function selectTool(){sequence++;
source.textContent='';
const app=apps.find(a=>a.id===tool.value);
file.replaceChildren(...app.files.map(f=>option(f.path,`${f.path} (${f.bytes} bytes)`)));
document.getElementById('owner').textContent=`${app.owner.repository} ? ${app.owner.commit} ? release ${app.owner.release}`;
status.textContent='Choose a file to read. External dependencies are declared separately and are not bundled.';
button.disabled=false;
}
button.addEventListener('click',async()=>{const token=++sequence;
source.textContent='';
status.textContent='Checking file bytes';
button.disabled=true;

try{const app=apps.find(a=>a.id===tool.value),member=app.files.find(f=>f.path===file.value);
const url=new URL('../'+member.path,location.href);
if(url.origin!==location.origin||!url.pathname.startsWith(new URL('../layer-apps/',location.href).pathname))throw Error('Source path outside this release');

const response=await fetch(url,{cache:'no-store',redirect:'error'});
if(!response.ok)throw Error('Source response '+response.status);
const bytes=await response.arrayBuffer();
const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
if(bytes.byteLength!==member.bytes||hash!==member.sha256)throw Error('Source does not match the pinned inventory');
if(token!==sequence)return;
source.textContent=new TextDecoder().decode(bytes);
status.textContent=`Verified ${bytes.byteLength} bytes against served inventory ? SHA-256 ${hash}`;

}catch(error){if(token===sequence)status.textContent=String(error);
}finally{if(token===sequence)button.disabled=false;
}});

tool.addEventListener('change',selectTool);
file.addEventListener('change',()=>{sequence++;
source.textContent='';
status.textContent='Choose Read verified file to inspect this member.';
button.disabled=false;
});

try{const response=await fetch('../layer-source-scopes.json',{cache:'no-store',redirect:'error'});
if(!response.ok)throw Error('Source index '+response.status);
const index=await response.json();
if(index.schema!=='ventus.layer-source-scopes.v1'||!index.apps?.length)throw Error('Unsupported source index');
const ids=new Set();
for(const app of index.apps){if(typeof app.id!=='string'||ids.has(app.id)||typeof app.title!=='string'||typeof app.owner?.repository!=='string'||!/^[a-f0-9]{40}$/.test(app.owner.commit||'')||!/^\d{12}$/.test(app.owner.release||'')||!/^[a-f0-9]{64}$/.test(app.owner.manifestSha256||'')||!Array.isArray(app.files)||!app.files.length)throw Error('Invalid tool source record');
ids.add(app.id);
const paths=new Set();
for(const member of app.files){if(typeof member.path!=='string'||paths.has(member.path)||!member.path.startsWith('layer-apps/')||/[\\:%?#]/.test(member.path)||member.path.split('/').some(p=>!p||p==='.'||p==='..')||!Number.isSafeInteger(member.bytes)||member.bytes<0||!/^[a-f0-9]{64}$/.test(member.sha256||''))throw Error('Invalid source member');
paths.add(member.path);
}}apps=index.apps;
tool.replaceChildren(...apps.map(a=>option(a.id,a.title)));
const requested=new URL(location.href).searchParams.get('tool');
if(apps.some(a=>a.id===requested))tool.value=requested;
selectTool();
}catch(error){status.textContent=String(error);
button.disabled=true;
}
