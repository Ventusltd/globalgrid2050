const GENERATION = "202608282200";

export const FEDERATED_RELATIONSHIP_CARTRIDGE_CONTRACT = Object.freeze({
  schema: "pipelinenews.federated-relationship-cartridge.v1",
  generation: GENERATION,
  activation: "dynamic-import-on-user-open; projection-fetch-after-explicit-open",
  maximumPayloadRequests: 1,
  expectedRows: 3,
  projectBindings: 0,
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchVerifiedProjection(asset) {
  invariant(asset && typeof asset.url === "string", "relationship payload URL missing");
  invariant(Number.isInteger(asset.bytes) && asset.bytes > 0, "relationship payload byte pin missing");
  invariant(/^[a-f0-9]{64}$/u.test(asset.sha256), "relationship payload digest pin missing");
  const target = new URL(asset.url, document.baseURI);
  invariant(target.origin === location.origin, "cross-origin relationship payload rejected");
  const response = await fetch(target, { cache: "force-cache" });
  invariant(response.ok, `relationship payload returned HTTP ${response.status}`);
  const raw = new Uint8Array(await response.arrayBuffer());
  invariant(raw.byteLength === asset.bytes, "relationship payload byte drift");
  invariant(globalThis.crypto?.subtle, "Web Crypto unavailable");
  const digest = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)));
  invariant(digest === asset.sha256, "relationship payload digest drift");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
}

function render(host, projection) {
  invariant(projection.schema === "pipelinenews.federated-relationship-status-browser.v1", "relationship schema changed");
  invariant(projection.generation === GENERATION, "relationship generation changed");
  invariant(projection.heading === "RELATIONSHIP EVIDENCE — CANDIDATES AND ABSTENTIONS", "safe heading changed");
  invariant(projection.project_bindings === 0, "project binding entered projection");
  invariant(projection.confirmed_ownership_rows === 0 && projection.confirmed_operator_rows === 0, "confirmed role entered projection");
  invariant(Array.isArray(projection.rows) && projection.rows.length === 3, "relationship row count changed");
  invariant(projection.rows.every((row) => row.decision === "ABSTAIN" && row.eligible_for_join === false), "abstention law changed");

  const heading = document.createElement("h3");
  heading.textContent = projection.heading;
  const notice = document.createElement("p");
  notice.textContent = "Governance status only. Candidate counts are not ownership, operator, developer or project-identity facts.";
  const table = document.createElement("table");
  table.className = "projects-table";
  const thead = document.createElement("thead");
  const header = document.createElement("tr");
  for (const label of ["FAMILY", "SEGMENT", "CANDIDATE ROWS", "REQUESTED ROLE", "DECISION", "JOIN", "CAVEAT"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    header.append(cell);
  }
  thead.append(header);
  const tbody = document.createElement("tbody");
  for (const row of projection.rows) {
    const tr = document.createElement("tr");
    const values = [
      row.relationship_family,
      row.segment,
      Number(row.candidate_rows).toLocaleString("en-GB"),
      row.requested_role,
      row.decision,
      row.eligible_for_join ? "ELIGIBLE" : "NO",
      row.caveat,
    ];
    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  host.replaceChildren(heading, notice, table);
  host.dataset.federatedRelationshipState = "ready";
}

export async function mountFederatedRelationships({ host, payloadAsset }) {
  invariant(host instanceof HTMLElement, "relationship host missing");
  invariant(!host.dataset.federatedRelationshipMounted, "relationship cartridge mounted twice");
  host.dataset.federatedRelationshipMounted = "true";
  const projection = await fetchVerifiedProjection(payloadAsset);
  render(host, projection);
  return Object.freeze({ payloadRequests: 1, rows: projection.rows.length, projectBindings: 0 });
}
