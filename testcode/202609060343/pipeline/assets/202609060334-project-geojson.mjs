export function projectGeoJSON(projects, metadata = {}) {
  const seen=new Set(),positions=[];
  const features=projects.map(project=>{
    const ref=String(project.repd_ref ?? '');
    if(!/^\d+$/.test(ref)||seen.has(ref))throw Error('Export requires unique exact REPD identities.');
    if(typeof project.gg_project_id!=='string'||!project.gg_project_id)throw Error('Canonical project identity missing for REPD '+ref);
    seen.add(ref);
    const lon=project.longitude,lat=project.latitude;
    const located=project.geometry_status==='valid'&&Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90;
    if(located)positions.push([lon,lat]);
    return {type:'Feature',id:project.gg_project_id,geometry:located?{type:'Point',coordinates:[lon,lat]}:null,properties:{
      repd_ref:ref,gg_project_id:project.gg_project_id,name:project.name,technology:project.technology,status:project.status,
      capacity:project.capacity_mw,capacity_unit:project.capacity_unit,operator:project.operator,county:project.county,
      repd_record_updated:project.repd_record_updated,geometry_status:project.geometry_status,
      geometry_note:located?'Published register coordinate; not a surveyed boundary.':'No usable register coordinate. The record is retained with null geometry.'
    }};
  });
  const result={type:'FeatureCollection',metadata:{...metadata,coordinate_reference:'WGS84 longitude, latitude',records:features.length,located:positions.length,null_geometry:features.length-positions.length,boundary:'Register map context only; not evidence of a grid connection or cadastral boundary.'},features};
  if(positions.length)result.bbox=[Math.min(...positions.map(p=>p[0])),Math.min(...positions.map(p=>p[1])),Math.max(...positions.map(p=>p[0])),Math.max(...positions.map(p=>p[1]))];
  return result;
}
