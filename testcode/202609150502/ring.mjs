import { unit } from './model.mjs';
export default {
  id:'ring', from:'UK solar REPD snapshot; Generator GRAMMAR section 2',
  wants:['block'], always:['block'], draws:[],
  hint() { return 'Each point is a project. Ring positions are seeded, not geographic coordinates.'; },
  layout(core,view,out) {
    const r = Math.max(1, Math.min(view.w,view.h)/2-22), cx=view.w/2, cy=view.h/2;
    for(let i=0;i<core.N;i++) {
      const angle=unit(view.seed,core.keyStr[i]+':angle')*Math.PI*2;
      const radius=r*Math.sqrt(.10+.90*unit(view.seed,core.keyStr[i]+':radius'));
      out[2*i]=cx+Math.cos(angle)*radius; out[2*i+1]=cy+Math.sin(angle)*radius;
    }
    return {bounds:[0,0,view.w,view.h],home:{pan:[0,0],zoom:1,rotate:0}};
  },
  edges() { return {a:new Uint32Array(),b:new Uint32Array(),kind:new Uint8Array(),cls:new Uint8Array(),w:new Float32Array()}; },
  geometry(){return null;}, labels(core,view,max){return view.focus>=0&&max>0?Uint32Array.of(view.focus):new Uint32Array();},
  hit(){return -1;}, camera(){return {pan:false,zoom:null,rotate:false};}, simplify(){return {};}, leave(){}
};
