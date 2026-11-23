/** Conservative, report-only spelling aliases. NOT a corporate ownership assertion.
 * Never rewrite original REPD operator strings or group unrelated subsidiaries.
 */
export const OPERATOR_ALIASES_V1=Object.freeze({
  "low carbon":"Low Carbon",
  "low carbon ltd":"Low Carbon",
  "low carbon limited":"Low Carbon"
});
export function canonicalOperator(raw) {
  const source=String(raw??"").normalize("NFKC").replace(/\s+/g," ").trim();
  if(!source)return "Not reported";
  const key=source.toLocaleLowerCase("en-GB").replace(/[.,]+$/g,"").replace(/\s+/g," ");
  return OPERATOR_ALIASES_V1[key]||source;
}
