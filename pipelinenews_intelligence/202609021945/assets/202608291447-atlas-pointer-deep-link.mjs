const GRIDATLAS_RECEIVER = Object.freeze({"schema":"pipelinenews.gridatlas-live-pointer-receipt.v3","classification":"VERIFIED_PROMOTION_ELIGIBLE_GRIDATLAS_V9","generation":"202608300453","release_id":"202608300453-atlas-v9","base_url":"https://ventusltd.github.io/gridatlas/202608300453-atlas-v9/","source_commit":"4f3e8fc5c7ea28edf83dbac9b231024723bcf231","publication_commit":"bf16a713b9e5d926822efe80c681c017cc4edcee","query_parameter":"repd_ref","identity_rule":"EXACT_REPD_REF_ONLY","golden_repd_ref":"13599","state_url":"https://ventusltd.github.io/gridatlas/state/live-set.json"});

function invariant(condition, message) {
  if (!condition) throw new Error(`Atlas receiver contract: ${message}`);
}

const receiverUrl = new URL(GRIDATLAS_RECEIVER.base_url);
invariant(GRIDATLAS_RECEIVER.classification === "VERIFIED_PROMOTION_ELIGIBLE_GRIDATLAS_V9", "receiver not verified");
invariant(receiverUrl.protocol === "https:", "receiver is not HTTPS");
invariant(receiverUrl.hostname === "ventusltd.github.io", "receiver hostname changed");
invariant(receiverUrl.pathname === `/gridatlas/${GRIDATLAS_RECEIVER.release_id}/`, "receiver route mismatch");
invariant(GRIDATLAS_RECEIVER.identity_rule === "EXACT_REPD_REF_ONLY", "identity rule changed");

export const ATLAS_V9_DEEP_LINK_CONTRACT = Object.freeze({
  schema: "pipelinenews.atlas-current-deep-link-cartridge.v1",
  generation: "202608300309",
  receiver: GRIDATLAS_RECEIVER,
  eligibility: Object.freeze({
    field: "geometry_status",
    equals: "valid",
    ineligible_result: "",
    presentation: "NO MAP"
  }),
  identity_anchor: "repd_ref",
  query_parameter_order: Object.freeze(["repd_ref"]),
  inbound_match_semantics: "EXACT_PROJECT_REPD_REF",
  lifecycle: "timestamped PipelineNews release; receiver authenticated at build and public readback"
});

export function buildAtlasV9DeepLink(project) {
  if (project?.[ATLAS_V9_DEEP_LINK_CONTRACT.eligibility.field]
      !== ATLAS_V9_DEEP_LINK_CONTRACT.eligibility.equals) return "";
  const repdRef = String(project?.repd_ref ?? "").trim();
  if (!/^\d+$/u.test(repdRef)) return "";
  const url = new URL(GRIDATLAS_RECEIVER.base_url);
  url.searchParams.set("repd_ref", repdRef);
  return url.href;
}
