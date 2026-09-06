export function hasMapPoint(project) {
  return project.geometry_status==='valid'&&Number.isFinite(project.longitude)&&Number.isFinite(project.latitude)&&Math.abs(project.longitude)<=180&&Math.abs(project.latitude)<=90;
}
export function matchesGeometry(project,mode) {
  if(mode==='all')return true;
  if(mode==='located')return hasMapPoint(project);
  if(mode==='missing')return !hasMapPoint(project);
  throw Error('Unknown geometry filter');
}
