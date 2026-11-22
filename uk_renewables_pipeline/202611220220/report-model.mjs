// V9.63 report model: canonical REPD identity and strictly provenance-backed area only.
export const HA_TO_ACRES = 2.471053814671653;
export const AREA_KINDS = Object.freeze({
  site_area:'Site area',
  development_area:'Development area',
  land_take:'Land take',
  red_line_boundary:'Red-line boundary area'
});
const s = value => typeof value==='string' ? value.trim() : '';
const reportedDate = value => s(value) || 'Not reported';
export function areaFromEvidence(project, catalogue) {
  const unknown = Object.freeze({reported:false,display:'Area not reported',
    kind:'',sourceLabel:'No verified project-area record is available',sourceUrl:''});
  if(!project?.repd_ref || catalogue?.schema!=='globalgrid2050.repd-area-evidence.v1')return unknown;
  const entry=catalogue.records?.[String(project.repd_ref)];
  if(!entry || entry.verified!==true || String(entry.repd_ref)!==String(project.repd_ref))return unknown;
  const unit=s(entry.unit).toLowerCase();
  const area=entry.value;
  const areaKind=s(entry.area_kind);
  const sourceUrl=s(entry.source_url);
  const sourceTitle=s(entry.source_title);
  if(!Number.isFinite(area)||area<=0|| !['ha','acres','m2'].includes(unit) ||
    !Object.hasOwn(AREA_KINDS,areaKind)||!sourceTitle||!/^https:\/\//i.test(sourceUrl))return unknown;
  const hectares=unit==='ha'?area:unit==='acres'?area/HA_TO_ACRES:area/10000;
  const acres=hectares*HA_TO_ACRES;
  if(!Number.isFinite(hectares)||hectares<=0)return unknown;
  return Object.freeze({
    reported:true,
    display:hectares.toLocaleString('en-GB',{maximumFractionDigits:2})+' ha · '+
      acres.toLocaleString('en-GB',{maximumFractionDigits:2})+' acres',
    kind:AREA_KINDS[areaKind],
    sourceLabel:sourceTitle,
    sourceUrl,
  });
}
export function reportData(project,mapHref,areaCatalogue,metadata={}) {
  if(!project || typeof project.repd_ref!=='string')return null;
  // A MAP link must be taken from this project's own existing, validated row anchor.
  let mapUrl='';
  try{const u=new URL(mapHref);if(u.protocol==='https:')mapUrl=u.href;}catch{}
  const area=areaFromEvidence(project,areaCatalogue);
  const isRePD=project.technology!=='interconnector';
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
    status:s(project.status)||'Not reported',
    submitted:reportedDate(project.planning_application_submitted),
    operational:reportedDate(project.operational),
    updated:reportedDate(project.repd_record_updated),
    consent:reportedDate(project.planning_permission_granted),
    planningAuthority:s(project.planning_authority)||'Not reported',
    planningReference:s(project.planning_application_reference)||'Not reported',
    dataSource:isRePD?(s(metadata.source_dataset)||'DESNZ Renewable Energy Planning Database'):'Separate interconnector dataset - not REPD',
    mapUrl,area,
    isRePD
  });
}
