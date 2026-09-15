import ring from './ring.mjs';
export default {
  ...ring,id:'table',from:'UK solar record table; Generator GRAMMAR section 2',
  always:[],
  hint(){return 'All projects remain available by permanent REPD key, including records without coordinates.';},
  layout(core,view,out){
    out.fill(NaN);
    let height=0;
    for(const row of view.params.tableRows||[]){out[2*row.i]=row.x;out[2*row.i+1]=row.y;height=Math.max(height,row.y+row.height/2);}
    return {bounds:[0,0,view.w,height],home:{pan:[0,0],zoom:1,rotate:0}};
  },
  overlay(core,view,host,shell){
    host.replaceChildren();
    const refs=view.visible;
    for(const i of refs){
      const b=document.createElement('button');b.className='project-row';b.dataset.ref=core.keyStr[i];
      b.textContent=`${core.label(i)} · ${core.rec[i].capacity_mw ?? 'capacity not recorded'}${core.rec[i].capacity_mw===null?'':' MW'} · ${core.rec[i].status}${core.rec[i].latitude===null?' · coordinates missing':''}`;
      b.style.borderLeftColor=core.colour(i);b.setAttribute('aria-pressed',String(view.focus===i));
      b.addEventListener('click',()=>shell.navigate(i));host.append(b);
    }
  },
  leave(){}
};
