// Generic release bootstrap. Native canvas, camera and string engine remain inherited.
'use strict';
let starts=0;
const start=setInterval(()=>{
  if(++starts>300){clearInterval(start);return;}
  if(typeof fireCommand==='function'&&typeof N!=='undefined'&&N>0&&window.FIRE){
    clearInterval(start);
    FIRE_PROGRAM.select={app:'generic-drawing',repository:'generic-scene'};
    apps.push({app:'generic-drawing',button:'DRAWING',repo:'generic-scene',prefixes:[],live:'./'});
    appWork['generic-drawing']=['synthetic-scene'];
    const inheritedFire=FIRE.fire;
    FIRE.fire=function(command){
      if(!/^fire (?:string|array-lab-table|synthetic-site|whole-site-routes)(?: |$)/.test(command))throw Error('This release exposes drawing geometry only.');
      const result=inheritedFire.call(this,command),seen=new WeakSet();
      function finiteTree(value){if(typeof value==='number'&&!Number.isFinite(value))throw Error('Drawing calculation returned a non-finite value.');if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const v of Object.values(value))finiteTree(v);}}
      finiteTree(result);return result;
    };
    fireCommand('fire string {"modules":30,"modules_high":1,"mounting":"fixed","orientation":"portrait","routing":"one-after-another","view":"macro"}',null);
  }
},100);
