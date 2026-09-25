/* Native multi-string flow adapter. Original renderer files are untouched.
 *
 * const adapter = await createNativeAdapter(rendererWindow);
 * const walks = adapter.build(model); // rebuild when geometry changes
 * adapter.drawFlow(ctx, walks, elapsedSeconds, {selected: 'S01'});
 * adapter.drawConnectors(ctx, model); // after flow, using screen-pixel context
 * adapter.svgConnectors(model, projectToSvgPixels) // portable sourced profiles
 *
 * Every circuit is validated by the inherited buildStringWalk. Its traversal is
 * INV- -> modules 1..30 -> INV+; electron heads run BACKWARDS, from INV+ through
 * module 30..1 to INV-. The inverter's internal conversion is outside this drawing.
 * Clock and spacing are illustrative; they do not express current or drift speed.
 * generic profiles are the existing local family reference drawings. Polarity,
 * gender assignment and placement are schematic; no mating approval is implied.
 */
const map = p => [p[0] * .01, -p[1] * .01];
const close = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]) < 1e-8;
const reversed = pts => pts.slice().reverse();
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');

export function buildNativeWalks(w, model) {
  const walks=[];
  for (const string of model.strings.filter(s=>s.connected)) {
    const mods=string.modules.map(id=>model.modules.find(m=>m.id===id));
    const homes=model.homes.filter(h=>h.stringId===string.id);
    const negative=homes.find(h=>h.sign==='-'),positive=homes.find(h=>h.sign==='+');
    const links=model.links.filter(l=>l.stringId===string.id);
    if (!negative||!positive||mods.length!==30||links.length!==29) throw Error(string.id+': incomplete circuit');
    if (!close(negative.drawing[0],mods[0].drawMinus)||!close(positive.drawing[0],mods.at(-1).drawPlus)) throw Error(string.id+': disconnected home cable');
    if(homes.some(h=>h.shortM>0)){walks.push({stringId:string.id,open:true,reason:'insufficient supplied cable',legs:[],total:0});continue;}
    const shapes=mods.map((m,i)=>({role:'module',module:i+1,node:m.id,pts:m.drawing.map(map),electronPath:[m.drawMinus,m.drawPlus].map(map)}));
    shapes.push({role:'cable',node:negative.id,home:true,from:'INV-',to:'M1-',pts:reversed(negative.drawing).map(map),open:!!negative.open});
    for(let i=0;i<29;i++) {
      const link=links.find(l=>l.from===mods[i].id+'+'&&l.to===mods[i+1].id+'-');
      if(!link||!close(link.drawing[0],mods[i].drawPlus)||!close(link.drawing.at(-1),mods[i+1].drawMinus)) throw Error(string.id+': disconnected series link '+(i+1));
      shapes.push({role:'cable',node:link.id,from:'M'+(i+1)+'+',to:'M'+(i+2)+'-',pts:link.drawing.map(map),open:!!link.open});
    }
    shapes.push({role:'cable',node:positive.id,home:true,from:'M30+',to:'INV+',pts:positive.drawing.map(map),open:!!positive.open});
    const native=w.buildStringWalk({shapes});
    if (!native) { walks.push({stringId:string.id,open:true,legs:[],total:0}); continue; }
    // Retain the inherited length allocations, module-outline treatment and leg order.
    walks.push({stringId:string.id,open:false,...native});
  }
  return walks;
}

export function drawElectronFlow(w, ctx, walks, clock, {selected=null, spacingPx=150, speedPx=48}={}) {
  const scale=w.shapeScale(),stats={strings:0,homePaths:0};
  const path=pts=>{ctx.beginPath();pts.map(w.shapePoint).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));};
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor='#7ff0ff';
  for(const walk of walks) {
    if(walk.open||!walk.total||walk.operatingCurrentA===0||walk.invalidOperatingPoint)continue;
    // Optional entered current uses the native renderer's restrained glow-weight
    // emphasis. Null/unknown remains illustrative and supplies no physical value.
    const currentWeight=Number.isFinite(walk.operatingCurrentA)&&walk.operatingCurrentA>0?1+.5*Math.min(1,walk.operatingCurrentA/20):1;
    stats.strings++;
    const phase=(Number(walk.stringId.slice(1))*.38196601125)%1;
    // One circuit trace plus a trace on each home conductor, so both polarities
    // remain visibly animated even when the full circuit is much longer.
    const pulses=[{legs:walk.legs,start:0,end:1,phase},...walk.legs.filter(l=>l.s?.home).map((leg,i)=>({legs:[leg],start:leg.u0,end:leg.u1,phase:(phase+i*.5)%1,home:true}))];
    for(const pulse of pulses) {
      if(pulse.home)stats.homePaths++;
      const range=pulse.end-pulse.start,pixels=walk.total*scale*range;
      const tail=Math.min(.12,18/Math.max(1,pixels));
      const head=((pulse.phase-clock*speedPx/Math.max(1,pixels))%1+1)%1;
      const spans=(head+tail>1?[[head,1],[0,head+tail-1]]:[[head,head+tail]]).map(([a,b])=>[pulse.start+a*range,pulse.start+b*range]);
      for(const leg of pulse.legs)for(const [a0,b0]of spans) {
        const a=Math.max(leg.u0,a0),b=Math.min(leg.u1,b0);if(b<=a)continue;
        const d=Math.max(1e-9,leg.u1-leg.u0),pts=leg.s?.pts||leg.mod?.electronPath;
        if(!pts)continue;
        const segment=w.polySlice(pts,(a-leg.u0)/d,(b-leg.u0)/d);if(segment.length<2)continue;
        const weight=(leg.s?.home?2.2:1.5)*(selected===walk.stringId?1.25:1)*currentWeight;
        // Same two-pass cyan casing and white core as native drawSldShapes 3b.
        ctx.shadowBlur=weight*2.6;path(segment);ctx.lineWidth=weight*2.1;ctx.strokeStyle='rgba(86,214,255,0.22)';ctx.stroke();
        path(segment);ctx.lineWidth=weight;ctx.strokeStyle='rgba(224,250,255,0.92)';ctx.stroke();
        if(leg.mod){ctx.shadowBlur=7*currentWeight;path(leg.mod.pts);ctx.closePath();ctx.lineWidth=1.4*currentWeight;ctx.strokeStyle='rgba(120,232,255,0.55)';ctx.stroke();}
      }
    }
  }
  ctx.restore();return stats;
}

export async function createNativeAdapter(w, {}={}) {
  const profiles={};
  for(const kind of ['plug','socket']) {
    const source='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="28" viewBox="0 0 100 28"><g fill="white" stroke="black" stroke-width="2"><path d="M2 9h16V4h48v4h16v4h16v4H82v4H66v4H18v-5H2z"/><path d="M26 5v18m8-18v18m8-18v18m32-15v12"/></g></svg>';
    const data='data:image/svg+xml;base64,'+btoa(source),image=new w.Image();image.src=data;await image.decode();
    profiles[kind]={entry:{id:'generic-'+kind,label:'Schematic '+kind},image,data,aspect:100/28};
  }
  // This page paints its enlarged source profiles after the cable layer. Suppress
  // only its generic native plug fallback; other inherited drawings retain it.
  if(!w.__inverter48PortProfileHook){const previous=w.drawManufacturerConnector;
    w.drawManufacturerConnector=function(ctx,shape,drawing){if(drawing?.inverter48)return true;return previous?.call(this,ctx,shape,drawing)||false;};
    w.__inverter48PortProfileHook=true;
  }
  function sizes(model,project,desired) {
    const points=model.ports.map(p=>project(p.drawing));
    const pitch=Math.min(...points.slice(1).map((q,i)=>Math.hypot(q[0]-points[i][0],q[1]-points[i][1])));
    return {length:desired||Math.max(8,Math.min(48,pitch*.64*Math.min(profiles.plug.aspect,profiles.socket.aspect))),points};
  }
  return {
    profiles,
    build:model=>buildNativeWalks(w,model),
    drawFlow:(ctx,walks,clock,options)=>drawElectronFlow(w,ctx,walks,clock,options),
    drawConnectors(ctx,model,{lengthPx}={}) {
      const {length,points}=sizes(model,p=>w.shapePoint(map(p)),lengthPx);
      ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='invert(1)';
      model.ports.forEach((port,i)=>{const profile=profiles[port.sign==='+'?'plug':'socket'],q=points[i],height=length/profile.aspect;
        // Both manufacturer profiles have their cable gland at the right edge.
        // That edge is anchored to the existing home cable endpoint at the inverter.
        ctx.drawImage(profile.image,q[0]-length,q[1]-height/2,length,height);
      });ctx.restore();return model.ports.length;
    },
    svgConnectors(model,project,{lengthPx}={}) {
      const {length,points}=sizes(model,project,lengthPx);
      const filter='<defs><filter id="generic-profile-ink" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer></filter>'+Object.entries(profiles).map(([kind,p])=>'<image id="generic-source-'+kind+'" width="'+p.image.naturalWidth+'" height="'+p.image.naturalHeight+'" href="'+p.data+'"/>').join('')+'</defs>';
      return filter+model.ports.map((port,i)=>{const profile=profiles[port.sign==='+'?'plug':'socket'],q=points[i],height=length/profile.aspect;
        const kind=port.sign==='+'?'plug':'socket',factor=length/profile.image.naturalWidth;
        return '<use data-port="'+esc(port.id)+'" data-profile="'+esc(profile.entry.id)+'" transform="translate('+(q[0]-length)+' '+(q[1]-height/2)+') scale('+factor+')" filter="url(#generic-profile-ink)" href="#generic-source-'+kind+'"><title>'+esc(profile.entry.label)+' — schematic family reference</title></use>';
      }).join('');
    }
  };
}
