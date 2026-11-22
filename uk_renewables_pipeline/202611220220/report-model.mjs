// V9.63 A4 report: official REPD identity and existing source location. No land area.
const s=v=>typeof v==='string'?v.trim():'';
const date=v=>s(v)||'Not reported';
export function reportData(project,mapHref,metadata={}){
  if(!project||typeof project.repd_ref!=='string')return null;
  let mapUrl='';
  try{const url=new URL(mapHref);if(url.protocol==='https:')mapUrl=url.href;}catch{}
  const isRePD=project.technology!=='interconnector';
  const location=[project.county,project.region,project.country].map(s).filter(Boolean).join(' · ')||'Location not reported';
  return Object.freeze({
    reference:String(project.repd_ref),
    name:s(project.name)||'Project name not reported',
    operator:s(project.operator)||'Operator not reported',
    developer:'Developer not separately reported',
    capacity:Number.isFinite(project.capacity_mw)?project.capacity_mw.toLocaleString('en-GB',{maximumFractionDigits:2}):'Not reported',
    capacityUnit:project.technology==='solar'?'MWp':'MW',
    county:s(project.county)||'Not reported',
    region:s(project.region)||'Not reported',
    country:s(project.country)||'Not reported',
    location,
    status:s(project.status)||'Not reported',
    submitted:date(project.planning_application_submitted),
    operational:date(project.operational),
    updated:date(project.repd_record_updated),
    consent:date(project.planning_permission_granted),
    planningAuthority:s(project.planning_authority)||'Not reported',
    planningReference:s(project.planning_application_reference)||'Not reported',
    dataSource:isRePD?(s(metadata.source_dataset)||'DESNZ Renewable Energy Planning Database'):'Separate interconnector dataset - not REPD',
    mapUrl,isRePD
  });
}
