// Independent, entered-input DC screening arithmetic. No licensed tables embedded.
export const conductorReference = {
  title:'cable PV DC copper cable, reference',
  url:'#drawing-basis',
  sourcePages:'1–2',conductorClass:'5',coating:'Tinned copper',alpha:.00393,
  resistanceBasis:'Manufacturer maximum DC resistance at 20°C; independently checked against the IEC 60228:2004, Table 3, class 5 metal-coated wires. Copper temperature coefficient checked against informative Annex B.',
  ampacityBasis:'Owner-held BS EN 50618:2014 Table A.3: two loaded cables touching on a surface, 60°C ambient, 120°C maximum conductor temperature. Table A.4 factor is 1 up to 60°C ambient, 0.92 at 70°C, 0.84 at 80°C and 0.75 at 90°C. Additional grouping requires HD 60364-5-52 evidence; the 48-cable grouping is not determined here. Standard notes the limited 20,000-hour operating period at maximum conductor/ambient conditions.',
  sizes:[{size:4,r20:5.09,outerDiameterMm:5.5,baseAmpacity:44},{size:6,r20:3.39,outerDiameterMm:6.1,baseAmpacity:57},{size:10,r20:1.95,outerDiameterMm:7.2,baseAmpacity:79}],
  ratedVoltageV:1500,maximumVoltageV:1800,maximumOperatingTemperatureC:120,
  minimumBendDiameterFactorFixed:4,minimumBendDiameterFactorMoved:5
};
export const electricalBasis = {
  method: 'R(T)=R20 × L/1000 × [1+alpha20 × (T−20)]; ΔV=IR; P=I²R; Iz=Ibase × kTemperature × kGrouping × kOther',
  resistance: 'Optional cable class-5 tinned-copper values cite reference and were checked against IEC 60228:2004 Table 3. Its mΩ/m values equal Ω/km numerically. The copper coefficient 0.00393/K follows informative Annex B. This is not a conductor conformity test; cable ampacity requires separate installation evidence.',
  standard: 'IEC 62548-1:2023, reference review: 7.2.8.3 installation, 7.2.9 connectors, 7.3.3.3 wiring loops. These calculations do not establish installation compliance.',
  scope: '48 home conductors and their entered mated contacts; 29 intermodule mates per connected string. Complete loop result additionally requires the total series-lead copper resistance at operating temperature. Excludes inverter internal loss and module internal resistance.',
  missingEvidence: ['Cable size/class/coating and resistance evidence', 'Installation method, segment grouping and thermal rating evidence', 'Maximum design-current basis, including bifacial contribution', 'Connector family compatibility and resistance at relevant condition', 'Cold Voc, equipment ratings, protection/backfeed and earthing', 'Actual operating point and climate/site evidence']
};
export const emptyElectricalState = () => ({defaults:{},overrides:{},stringOverrides:{},basis:'entered'});
export function number(value, {min=0,max=Infinity,exclusive=false}={}) {
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)&&n<=max&&(exclusive?n>min:n>=min)?n:null;
}
export function contactList(value) {
  if(Array.isArray(value))return value.map(v=>number(v));
  if(value===null||value===undefined||String(value).trim()==='')return null;
  return String(value).split(',').map(v=>number(v));
}
const sumKnown=values=>values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null;
function contacts(input) {
  const list=contactList(input);return {count:list?.length??null,valuesMilliOhm:list,resistanceOhm:list&&list.every(v=>v!==null)?list.reduce((a,b)=>a+b,0)/1000:null};
}
export function calculateElectrical(model,state=emptyElectricalState(),getCableLength=h=>h.routeM) {
  const defaults=state.defaults||{},overrides=state.overrides||{},stringOverrides=state.stringOverrides||{};
  const cables=model.homes.map(h=>{
    const config={...defaults,...(overrides[h.id]||{})},sconfig={...defaults,...(stringOverrides[h.stringId]||{})};
    const lengthM=number(getCableLength(h)),r20=number(config.r20,{exclusive:true}),temp=number(config.temperature,{min:-100,max:250}),alpha=number(config.alpha,{max:.02});
    const currentA=number(sconfig.current),designCurrentA=number(sconfig.designCurrent),baseAmpacityA=number(config.baseAmpacity,{exclusive:true});
    const factors=['temperatureFactor','groupingFactor','otherFactor'].map(k=>number(config[k],{exclusive:true,max:10}));
    const correction=temp!==null&&alpha!==null?1+alpha*(temp-20):null;
    const copperOhm=lengthM!==null&&r20!==null&&correction!==null&&correction>0?r20*lengthM/1000*correction:null;
    const contact=contacts(config.homeContacts),totalOhm=sumKnown([copperOhm,contact.resistanceOhm]);
    const ampacityA=baseAmpacityA!==null&&factors.every(v=>v!==null)?baseAmpacityA*factors.reduce((a,b)=>a*b,1):null;
    const missing=[];
    if(lengthM===null)missing.push('length');if(r20===null)missing.push('R20');if(correction===null||correction<=0)missing.push('temperature/alpha');
    if(contact.resistanceOhm===null)missing.push('mated contact resistance');if(currentA===null)missing.push('operating current');
    if(ampacityA===null)missing.push('base ampacity/derating factors');if(designCurrentA===null)missing.push('design current');
    return {id:h.id,stringId:h.stringId,polarity:h.sign,lengthM,config,currentA,designCurrentA,copperOhm,contact,totalOhm,
      copperDropV:copperOhm!==null&&currentA!==null?currentA*copperOhm:null,
      contactDropV:contact.resistanceOhm!==null&&currentA!==null?currentA*contact.resistanceOhm:null,
      dropV:totalOhm!==null&&currentA!==null?currentA*totalOhm:null,
      lossW:totalOhm!==null&&currentA!==null?currentA*currentA*totalOhm:null,
      contactLossW:contact.resistanceOhm!==null&&currentA!==null?currentA*currentA*contact.resistanceOhm:null,
      ampacityA,ampacityMarginA:ampacityA!==null&&designCurrentA!==null?ampacityA-designCurrentA:null,
      ampacityState:ampacityA===null||designCurrentA===null?'unresolved':ampacityA>=designCurrentA?'within entered rating':'exceeds entered rating',missing};
  });
  const strings=model.strings.filter(s=>s.connected).map(s=>{
    const config={...defaults,...(stringOverrides[s.id]||{})},pair=cables.filter(c=>c.stringId===s.id);
    const currentA=number(config.current),voltageV=number(config.voltage,{exclusive:true});
    const series=contacts(config.seriesContacts),seriesCopperOhm=number(config.seriesCopperOhm);
    const homeCopperOhm=sumKnown(pair.map(c=>c.copperOhm)),homeContactOhm=sumKnown(pair.map(c=>c.contact.resistanceOhm));
    const homeLoopOhm=sumKnown([homeCopperOhm,homeContactOhm]);
    const allContactOhm=sumKnown([homeContactOhm,series.resistanceOhm]);
    const completeLoopOhm=sumKnown([homeLoopOhm,series.resistanceOhm,seriesCopperOhm]);
    const homeDropV=currentA!==null&&homeLoopOhm!==null?currentA*homeLoopOhm:null;
    const dropV=currentA!==null&&completeLoopOhm!==null?currentA*completeLoopOhm:null;
    const lossW=dropV!==null?currentA*dropV:null;
    const homeLossW=homeDropV!==null?currentA*homeDropV:null;
    return {id:s.id,side:s.side,mppt:s.mppt,currentA,voltageV,series,seriesCopperOhm,homeCopperOhm,homeContactOhm,homeLoopOhm,allContactOhm,completeLoopOhm,homeDropV,homeLossW,dropV,lossW,
      homeDropPercent:homeDropV!==null&&voltageV!==null?100*homeDropV/voltageV:null,
      dropPercent:dropV!==null&&voltageV!==null?100*dropV/voltageV:null,
      deliveredVoltageV:dropV!==null&&voltageV!==null?voltageV-dropV:null,
      contactLossW:allContactOhm!==null&&currentA!==null?currentA*currentA*allContactOhm:null,
      seriesCountExpected:s.modules.length-1,seriesCountMatches:series.count===null?null:series.count===s.modules.length-1,
      invalidOperatingPoint:dropV!==null&&voltageV!==null&&dropV>voltageV,
      ampacityState:pair.some(c=>c.ampacityState==='exceeds entered rating')?'exceeds entered rating':pair.every(c=>c.ampacityState==='within entered rating')?'within entered rating':'unresolved'};
  });
  return {schema:'VENTUS.inverter-48-electrical/1',basis:state.basis||'entered',method:electricalBasis,cables,strings,
    totals:{completeStrings:strings.filter(s=>s.lossW!==null).length,homeLossW:sumKnown(strings.map(s=>s.homeLossW)),completeLossW:sumKnown(strings.map(s=>s.lossW)),contactLossW:sumKnown(strings.map(s=>s.contactLossW)),
      unresolvedCables:cables.filter(c=>c.missing.length).length,ampacityExceeded:cables.filter(c=>c.ampacityState==='exceeds entered rating').length,
      homeMatedPairs:cables.every(c=>c.contact.count!==null)?cables.reduce((a,c)=>a+c.contact.count,0):null,
      seriesMatedPairs:strings.every(s=>s.series.count!==null)?strings.reduce((a,s)=>a+s.series.count,0):null}};
}
