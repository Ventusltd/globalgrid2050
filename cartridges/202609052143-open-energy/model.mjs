// Original VENTUS model. Statistics and reuse terms are recorded in source.json.
export const MWH_PER_QUAD = 1e15 * 1055.05585262 / 3.6e9;
export const DAY_MS = 86400000;
export function validate(s) {
  if (s?.schema !== 'ventus.energy-baseline.v1' || !Number.isInteger(s.referenceYear) || s.referenceYear < 1900 || s.referenceYear > 9998 || !Number.isFinite(s.totalQuadBtu) || s.totalQuadBtu <= 0 || !Number.isFinite(s.renewableQuadBtu) || s.renewableQuadBtu < 0 || s.renewableQuadBtu > s.totalQuadBtu || !s.url?.startsWith('https://') || !s.reuseUrl?.startsWith('https://') || !Number.isFinite(Date.parse(s.reviewAfter))) throw new Error('Energy baseline is missing or invalid.');
  return s;
}
export function calculate(source, now) {
  const s=validate(source);
  if(!Number.isFinite(now)) throw new Error('Invalid clock');
  const days=(Date.UTC(s.referenceYear+1,0,1)-Date.UTC(s.referenceYear,0,1))/DAY_MS;
  const fraction=((now%DAY_MS)+DAY_MS)%DAY_MS/DAY_MS;
  const daily=s.totalQuadBtu*MWH_PER_QUAD/days;
  const renewable=s.renewableQuadBtu*MWH_PER_QUAD/days;
  return {days, fraction, stale:now>=Date.parse(s.reviewAfter), daily,
    rows:[['total',daily],['renewable',renewable],['nonrenewable',daily-renewable]].map(([id,value])=>({id,daily:value,mwh:value*fraction,perSecond:value/86400,bar:value*fraction/daily}))};
}
