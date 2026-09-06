// Uses the existing Pipeline Global Grid reference convention.
export const globalGridReference = ref => `GG2050-REPD-${ref}`;
const normalise = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function allocateProvisional(records, project) {
  const existing = records.find(row => row.source_key === project.source_key);
  if (existing) return structuredClone(existing);
  let number=9999;
  const used=new Set(records.flatMap(row=>[row.repd_ref,...(row.aliases ?? [])]));
  while(used.has(`${number}-REPD-TBC`)) number++;
  const repd_ref=`${number}-REPD-TBC`;
  return {...structuredClone(project),repd_ref,official_repd_ref:null,
    gg_project_id:globalGridReference(repd_ref),identity_status:'REPD_PENDING',
    aliases:[],identity_history:[]};
}

export function reconcileProvisional(records, official, source) {
  if (!source?.path || !/^[a-f0-9]{64}$/.test(source.sha256 ?? '')) throw Error('Quarterly source identity required');
  const numeric=official.filter(row=>/^\d+$/.test(String(row.repd_ref)));
  const occupied=new Set(records.filter(row=>row.official_repd_ref).map(row=>row.official_repd_ref));
  return records.map(input=>{
    const row=structuredClone(input);
    if(row.official_repd_ref) return row;
    // A common name or a nearby site is insufficient: require the declared
    // name/alias, developer, county and reported capacity to agree uniquely.
    const names=[row.name,...(row.name_aliases ?? [])].map(normalise);
    const matches=numeric.filter(candidate=>names.includes(normalise(candidate.name))
      && normalise(candidate.operator)===normalise(row.operator)
      && normalise(candidate.county)===normalise(row.county)
      && Number(candidate.capacity_mw)===Number(row.capacity_mw));
    if(matches.length!==1 || occupied.has(String(matches[0].repd_ref))) {
      row.reconciliation={status:matches.length?'AMBIGUOUS_REQUIRES_REVIEW':'NO_VERIFIED_MATCH',source,candidate_count:matches.length};
      return row;
    }
    const previous=row.repd_ref, next=String(matches[0].repd_ref);
    occupied.add(next);
    row.aliases=[...new Set([...row.aliases,previous,row.gg_project_id])];
    row.repd_ref=next;row.official_repd_ref=next;row.gg_project_id=globalGridReference(next);
    row.identity_status='REPD_BOUND';
    row.identity_history.push({from:previous,to:next,source,reason:'unique name/developer/county/capacity match'});
    row.reconciliation={status:'REPLACED_TEMPORARY_ID',source,candidate_count:1};
    return row;
  });
}

export function resolveProject(records, identity) {
  return records.find(row=>[row.repd_ref,row.gg_project_id,...row.aliases].includes(identity)) ?? null;
}
