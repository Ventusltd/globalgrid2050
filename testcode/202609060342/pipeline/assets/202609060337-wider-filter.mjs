const normal=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en-GB');
export function filterWiderRows(rows,query) {
  const terms=normal(query).trim().split(/\s+/).filter(Boolean);
  if(!terms.length)return rows;
  return rows.filter(row=>{
    const refs=Array.isArray(row.repd_records)?row.repd_records.map(record=>record.ref):[row.ref];
    const text=normal([row.n,row.o,row.rt,row.s,row.cty,row.pc,...refs].join(' '));
    return terms.every(term=>text.includes(term));
  });
}
