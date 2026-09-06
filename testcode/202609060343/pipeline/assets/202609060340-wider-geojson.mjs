export function widerGeoJSON(rows,metricLookup,metadata={}) {
  const numeric=value=>Number.isFinite(value)&&value>=0?value:null;
  const features=rows.map(row=>{
    const records=Array.isArray(row.repd_records)?row.repd_records.map(record=>({...record})):
      row.ref?[{ref:String(row.ref),status:row.s,operator:row.o}]:[];
    const refs=[...new Set(records.map(record=>String(record.ref??'')).filter(ref=>/^\d+$/.test(ref)))];
    const point=Array.isArray(row.ll)&&row.ll.length===2&&row.ll.every(Number.isFinite)&&Math.abs(row.ll[0])<=180&&Math.abs(row.ll[1])<=90;
    return {type:'Feature',geometry:point?{type:'Point',coordinates:row.ll.slice()}:null,properties:{
      site_name:row.n,technology:row.rt,capacity_mw:row.c,operator:row.o,county:row.cty,postcode:row.pc,
      repd_refs:refs,repd_records:records,statuses:[...new Set(records.map(record=>record.status).filter(Boolean))],
      observations:refs.map(ref=>({repd_ref:ref,grid_km:numeric(metricLookup(ref,'GRID')),sub_km:numeric(metricLookup(ref,'SUB'))})),
      geometry_note:point?'Published wider-fleet site point; shared group location is not a cadastral boundary.':'No published site point; null geometry retained.'
    }};
  });
  return {type:'FeatureCollection',metadata:{...metadata,site_groups:features.length,located:features.filter(feature=>feature.geometry).length,
    identity_scope:'Published wider-fleet site groups with exact REPD memberships. No core-spine joins or canonical GlobalGrid identity inferred.',
    coordinate_reference:'WGS84 longitude, latitude',distance_units:'km',boundary:'Mapped straight-line observations, not a cable route, connection offer or headroom.'},features};
}
