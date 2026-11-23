import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildRepdCapacityReport} from "../../../uk_renewables_pipeline/202611231600/repd-reports-model.mjs";
import {canonicalOperator} from "./operator-aliases.mjs";
const root="uk_renewables_pipeline/202611231600/";
const read=p=>JSON.parse(readFileSync(root+p,"utf8"));
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.011,a+" != "+b);
test("V9.75 exact 7,775 REPD refs, three group dimensions and audited operator aliases",()=>{
 const manifest=read("data/v9.1/build_manifest.json");
 const rows=manifest.project_partitions.flatMap(x=>read(x.path).projects);
 assert.equal(rows.length,7775);
 const reports=["operator","status","region"].map(d=>buildRepdCapacityReport(rows,d));
 for(const report of reports){
   assert.equal(report.total.count,rows.length);
   assert.equal(report.uniqueRefs,rows.length);
   close(report.total.recordedCapacity,manifest.capacity_mw);
   close(report.groups.reduce((s,g)=>s+g.count,0),rows.length);
   close(report.groups.reduce((s,g)=>s+g.recordedCapacity,0),report.total.recordedCapacity);
   close(report.total.solarMwp+report.total.otherMw,report.total.recordedCapacity);
 }
 const [operators,statuses,regions]=reports;
 assert.deepEqual(new Set(statuses.groups.map(x=>x.name)),
  new Set(rows.map(p=>p.status?.trim()||"Not reported")));
 assert.deepEqual(new Set(regions.groups.map(x=>x.name)),
  new Set(rows.map(p=>p.region?.trim()||"Not reported")));
 const exact=new Set(rows.map(p=>p.operator?.trim()||"Not reported"));
 const mapped=new Set(rows.map(p=>canonicalOperator(p.operator)));
 assert.deepEqual(new Set(operators.groups.map(x=>x.name)),mapped);
 assert.ok(operators.groups.length<=exact.size);
 assert.ok(exact.has("Low Carbon Limited"),"Source operator preserved");
 assert.ok(!mapped.has("Low Carbon Limited"),"Reporting alias applied");
 assert.ok(mapped.has("Low Carbon"));
 assert.ok(operators.groups.find(g=>g.name==="Low Carbon").projects.some(p=>p.operator==="Low Carbon Limited"));
 assert.ok(rows.some(p=>p.operator==="Low Carbon Limited"),"Source REPD rows never rewritten");
 console.log("PASS 7775 true REPD refs, 3 report dimensions, exact legal source intact, operator spelling aliases report-only; original",exact.size,"grouped",mapped.size);
});
