import test from "node:test";
import assert from "node:assert/strict";
import {canonicalOperator,OPERATOR_ALIASES_V1} from "./operator-aliases.mjs";
import {buildRepdCapacityReport} from "../../../uk_renewables_pipeline/202611231600/repd-reports-model.mjs";
test("Only explicit Low Carbon spelling aliases, no blind parent inference",()=>{
  for(const x of ["Low Carbon","LOW CARBON","Low Carbon Ltd","Low Carbon Limited"," low   carbon   limited "])
    assert.equal(canonicalOperator(x),"Low Carbon");
  for(const x of ["Low Carbon Energy","Low Carbon Group","Low Carbon Solar UK","Carbon Low Ltd"])
    assert.equal(canonicalOperator(x),x);
  assert.equal(canonicalOperator(""),"Not reported");
  assert.equal(canonicalOperator(null),"Not reported");
  assert.equal(Object.keys(OPERATOR_ALIASES_V1).length,3);
});
test("Alias grouping retains every original REPD ref and unit",()=>{
  const data=[
    {repd_ref:"101",operator:"Low Carbon Limited",capacity_mw:15,technology:"solar",status:"Operational"},
    {repd_ref:"102",operator:"low carbon ltd",capacity_mw:20,technology:"solar",status:"Application Submitted"},
    {repd_ref:"103",operator:"Low Carbon Group",capacity_mw:2,technology:"bess",status:"Operational"}
  ];
  const result=buildRepdCapacityReport(data,"operator");
  assert.equal(result.uniqueRefs,3);
  assert.equal(result.groups.length,2);
  const low=result.groups.find(g=>g.name==="Low Carbon");
  assert.equal(low.count,2); assert.equal(low.solarMwp,35); assert.equal(low.otherMw,0);
  assert.equal(data[0].operator,"Low Carbon Limited");
  assert.equal(data[1].operator,"low carbon ltd");
});
