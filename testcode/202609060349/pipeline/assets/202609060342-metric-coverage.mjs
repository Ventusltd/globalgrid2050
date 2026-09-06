export function summarizeCoverage(projects,index) {
  return {available:index!==null&&typeof index==='object',total:projects.length,
    measured:projects.filter(project=>{const k=index?.[String(project.repd_ref)]?.k;return Number.isFinite(k)&&k>=0;}).length,
    withoutCoordinates:projects.filter(project=>project.geometry_status!=='valid'||!Number.isFinite(project.longitude)||!Number.isFinite(project.latitude)).length,
    sourceKeys:index?Object.keys(index).length:0};
}
