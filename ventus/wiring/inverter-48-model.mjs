// Generic geometry only. Physical routes and presentation coordinates are separate.
export const sources = {
  module: '#drawing-basis',
  inverter: '#drawing-basis'
};
export const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
export const length = pts => pts.slice(1).reduce((n,p,i)=>n+distance(pts[i],p),0);
export function build({physicalOffset=2, drawingOffset=30, gap=.02, tilt=8}={}) {
  for (const [v,min,max] of [[physicalOffset,.2,100],[drawingOffset,10,100],[gap,0,.5],[tilt,0,60]])
    if (!Number.isFinite(v)||v<min||v>max) throw Error('Geometry input outside supported range');
  const width=1.303,height=2.384,pitch=width+gap, rowPitch=height+gap;
  const faceDepth=5*height+4*gap, ridgeGap=.3, bankGap=6, lanePitch=.8, drawRowPitch=height+1.5+6*lanePitch;
  const inverterXYZ=[-physicalOffset,faceDepth*Math.cos(tilt*Math.PI/180)+ridgeGap/2,1];
  const modules=[],strings=[],homes=[],links=[],ports=[],mppts=[];
  const physicalPoint=(side,x,y)=>[x,y*Math.cos(tilt*Math.PI/180)+(side?faceDepth*Math.cos(tilt*Math.PI/180)+ridgeGap:0),1+(side?faceDepth-y:y)*Math.sin(tilt*Math.PI/180)];
  for(let side=0;side<2;side++)for(let row=0;row<5;row++)for(let col=0;col<3;col++) {
    const n=side*15+row*3+col+1,id='S'+String(n).padStart(2,'0'),connected=row<4;
    const slot=side*12+row*3+col,mppt=connected?Math.floor(slot/2)+1:null,input=connected?slot%2+1:null;
    const yD=side*(5*drawRowPitch+bankGap)+row*drawRowPitch;
    const s={id,side:side?'WEST':'EAST',row:row+1,column:col+1,connected,destination:connected?'INV-01':'OTHER-INVERTER-OFF-DRAWING',mppt,input,modules:[],kwp:19.8,drawY:yD};
    for(let j=0;j<30;j++) {
      const x=(col*30+j)*pitch,mId=id+'-M'+String(j+1).padStart(2,'0');
      const m={id:mId,stringId:id,side:s.side,physicalOrigin:physicalPoint(side,x,row*rowPitch),
        minus:physicalPoint(side,x+width*.35,row*rowPitch+height/2),plus:physicalPoint(side,x+width*.65,row*rowPitch+height/2),
        drawing:[[x,yD],[x+width,yD],[x+width,yD+height],[x,yD+height],[x,yD]],
        drawMinus:[x+width*.35,yD+height/2],drawPlus:[x+width*.65,yD+height/2]};
      modules.push(m);s.modules.push(mId);
    }
    const ms=modules.slice(-30);
    for(let j=0;j<29;j++) {
      const a=ms[j],b=ms[j+1];
      links.push({id:id+'-L'+(j+1),stringId:id,connected,from:a.id+'+',to:b.id+'-',physical:[a.plus,b.minus],routeM:distance(a.plus,b.minus),drawing:[a.drawPlus,[a.drawPlus[0]+.12,yD+height*.64],[b.drawMinus[0]-.12,yD+height*.64],b.drawMinus]});
    }
    s.minus=ms[0].drawMinus;s.plus=ms.at(-1).drawPlus;
    if(connected)for(const [k,sign] of ['-','+'].entries()) {
      const portId='MPPT'+String(mppt).padStart(2,'0')+'-'+input+sign;
      const terminal=sign==='-'?ms[0].minus:ms.at(-1).plus, drawTerminal=sign==='-'?s.minus:s.plus;
      // Distinct routing lanes are spread on the drawing only. The physical route
      // follows the supporting row to a common assumed mounting point at its end.
      const rowY=row*rowPitch+height+.08+k*.04;
      const p1=physicalPoint(side,terminal[0],rowY),p2=physicalPoint(side,-.15,rowY);
      const physical=[terminal,p1,p2,[-physicalOffset,p2[1],p2[2]],inverterXYZ];
      const routeM=length(physical),lane=yD+height+.7+(2*col+k)*lanePitch;
      const portY=2+side*(5*drawRowPitch+bankGap)+row*drawRowPitch+(2*col+k)*lanePitch,port=[-drawingOffset,portY];
      const laneX=-1-(23-slot)*((drawingOffset-3)/25)-k*.15;
      const drawing=[drawTerminal,[drawTerminal[0],lane],[laneX,lane],[laneX,portY],port];
      const h={id:id+sign,stringId:id,sign,mppt,input,portId,physical,drawing,routeM,from:id+sign,to:portId,
        electronDirection:sign==='-'?'string-to-inverter':'inverter-to-string'};
      homes.push(h);ports.push({id:portId,stringId:id,sign,mppt,input,drawing:port});
    }
    strings.push(s);
  }
  for(let i=1;i<=12;i++)mppts.push({id:i,strings:strings.filter(s=>s.mppt===i).map(s=>s.id),kwp:39.6});
  return {layout:{lanePitch,drawRowPitch,bankGap,westY:5*drawRowPitch+bankGap},schema:'VENTUS.inverter-48/1',sources,width,height,gap,tilt,physicalOffset,drawingOffset,inverterXYZ,
    modules,strings,homes,links,ports,mppts,faceDepth,arrayWidth:90*width+89*gap,
    inverterDrawing:{x:-drawingOffset-15,y:-3,width:15,height:2*5*drawRowPitch+bankGap+5},
    totals:{modules:900,strings:30,connectedStrings:24,spareStrings:6,connectedKwp:475.2,spareKwp:118.8,installedKwp:594,acKva:352,
      homeRouteM:homes.reduce((n,h)=>n+h.routeM,0),seriesRouteM:links.reduce((n,l)=>n+l.routeM,0)},
    assumptions:['2D developed view; rows separated for cable legibility.','Port order and positions illustrative; not manufacturer mechanical coordinates.',
      'Physical route estimate follows entered module dimensions and assumed support routing to one mounting point; excludes slack, connector bodies and obstacles.',
      'Animation illustrates electron direction in an assumed operating circuit; no MPPT operating point or drift speed is solved.',
      '352 kVA inverter 12-MPPT variant; 352 kVA at 30 C, 320 kVA at 40 C, 295 kVA at 50 C.']};
}
