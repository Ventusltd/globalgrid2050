const receiver='https://ventusltd.github.io/gridatlas/atlas/';
const kinds=new Set(['repd','datacentre','substation']);
export function checkedOrigin(value){
  if(!value||!kinds.has(value.origin_type)||typeof value.origin_id!=='string'||!value.origin_id.trim()||value.origin_id.length>160||/[\s\x00-\x1f\x7f]/.test(value.origin_id))return null;
  if(value.origin_type==='repd'&&!/^repd:[1-9]\d*$/.test(value.origin_id))return null;
  const {latitude,longitude}=value;
  if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||(latitude===0&&longitude===0))return null;
  return Object.freeze({origin_type:value.origin_type,origin_id:value.origin_id,latitude,longitude,
    ...(typeof value.name==='string'&&value.name.trim()?{name:value.name.trim().slice(0,200)}:{}),
    ...(typeof value.technology==='string'?{technology:value.technology.slice(0,80)}:{})});
}
export function checkedNewsContextBase(value){
  if(typeof value!=='string')return null;
  let u;try{u=new URL(value)}catch{return null}
  if(u.origin!=='https://globalgrid2050.com'||u.username||u.password||u.port||u.search||u.hash||!/^\/uk_renewables_pipeline\/\d{12}\/(?:index\.html)?$/.test(u.pathname))return null;
  return u.href;
}
export function buildJourneyUrl(mapHref,origin,{radiusKm=10,newsContextUrl}={}){
  const checked=checkedOrigin(origin);if(!checked||!Number.isInteger(radiusKm)||radiusKm<1||radiusKm>50)return null;
  let url;try{url=new URL(mapHref)}catch{return null}
  if(url.origin+url.pathname!==receiver||url.username||url.password||url.port||url.hash)return null;
  for(const key of ['repd_ref','latitude','longitude','technology'])if(url.searchParams.getAll(key).length>1)return null;
  if(checked.origin_type==='repd'&&url.searchParams.get('repd_ref')!==checked.origin_id.slice(5))return null;
  if(!url.searchParams.get('latitude')?.trim()||!url.searchParams.get('longitude')?.trim()||Number(url.searchParams.get('latitude'))!==checked.latitude||Number(url.searchParams.get('longitude'))!==checked.longitude)return null;
  url.searchParams.delete('news_context_url');
  for(const [key,value]of Object.entries({journey:'vicinity',origin_type:checked.origin_type,origin_id:checked.origin_id,latitude:checked.latitude,longitude:checked.longitude,radius_km:radiusKm}))url.searchParams.set(key,String(value));
  if(checked.name&&!url.searchParams.has('project'))url.searchParams.set('project',checked.name);
  if(newsContextUrl!==undefined){const base=checkedNewsContextBase(newsContextUrl);if(!base)return null;url.searchParams.set('news_context_url',base)}
  return url.href;
}
export function mapOrigin(mapHref,{origin_type,origin_id,name}={}){
  let url;try{url=new URL(mapHref)}catch{return null}
  const latitude=url.searchParams.get('latitude'),longitude=url.searchParams.get('longitude');
  if(latitude===null||longitude===null||!latitude.trim()||!longitude.trim())return null;
  return checkedOrigin({origin_type,origin_id,name,latitude:Number(latitude),longitude:Number(longitude),technology:url.searchParams.get('technology')||undefined});
}
