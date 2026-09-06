export function sortWiderRows(rows,mode,metricLookup) {
  const value=row=>{
    if(mode==='capacity_desc')return Number.isFinite(row.c)?-row.c:Infinity;
    const label=mode==='grid_asc'?'GRID':'SUB';
    const refs=(Array.isArray(row.repd_records)?row.repd_records:[row]).map(record=>String(record.ref??''));
    const distances=refs.map(ref=>metricLookup(ref,label)).filter(k=>Number.isFinite(k)&&k>=0);
    return distances.length?Math.min(...distances):Infinity;
  };
  if(!['capacity_desc','name_asc','grid_asc','sub_asc'].includes(mode))throw Error('Unknown wider-fleet order');
  return rows.slice().sort((a,b)=>{
    if(mode!=='name_asc'){const av=value(a),bv=value(b);if(av!==bv)return av<bv?-1:1;}
    return String(a.n).localeCompare(String(b.n),'en-GB')||String(a.ref??'').localeCompare(String(b.ref??''),'en-GB');
  });
}
