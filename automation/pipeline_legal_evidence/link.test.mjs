import assert from "node:assert/strict";
import {test} from "node:test";
import {legalEvidenceURL, legalEvidenceAction} from "./link.mjs";

const fixture = {repd_ref:"999999",gg_project_id:"GG2050-REPD-999999",name:"Fictional A & B",technology:"solar",status:"Application Submitted",country:"Wales",capacity_known:true,capacity_mw:32.4};
test("encode a canonical project into the reader", () => {
  const link = new URL(legalEvidenceURL(fixture));
  assert.equal(link.origin, "https://ventusltd.github.io");
  assert.equal(link.pathname, "/legislation/legal-evidence/");
  assert.deepEqual(Object.fromEntries(link.searchParams),{source_app:"pipelinenews",repd_ref:"999999",project:"Fictional A & B",technology:"solar",status:"Application Submitted",jurisdiction:"Wales",mw:"32.4"});
  assert.match(legalEvidenceAction(fixture), /Legal evidence/);
});
test("unknown and mismatched records", () => {
  assert.equal(legalEvidenceAction({...fixture,gg_project_id:"interconnector"}),"");
  const url = new URL(legalEvidenceURL({...fixture,country:"Offshore",capacity_known:false}));
  assert.equal(url.searchParams.has("jurisdiction"),false);
  assert.equal(url.searchParams.has("mw"),false);
});
