import {
  buildAtlasV8Url,
  buildCanonicalProjectTableView,
} from "./canonical-project-table.js";

const CSV_BOM = "\ufeff";
const CSV_MIME_TYPE = "text/csv;charset=utf-8";

function invariant(condition, message) {
  if (!condition) throw new Error(`V7.2 canonical export: ${message}`);
}

function joinRefs(values) {
  return values.join("|");
}

const VALUE_GETTERS = Object.freeze({
  site_name: ({ project }) => project.name,
  repd_ref: ({ project }) => project.repd_ref,
  gg_project_id: ({ project }) => project.gg_project_id,
  gg_development_id: ({ project }) => project.gg_development_id,
  identity_status: ({ project }) => project.identity_status,
  identity_confidence: ({ project }) => project.identity_confidence,
  technology: ({ project }) => project.technology_label,
  repd_technology: ({ project }) => project.repd_technology,
  official_capacity: ({ project }) => project.capacity_mw,
  capacity_unit: ({ project }) => project.capacity_unit,
  official_status: ({ project }) => project.status,
  derived_lifecycle: ({ project }) => project.lifecycle,
  derived_lifecycle_view: ({ project }) => project.lifecycle_view,
  operator: ({ project }) => project.operator,
  county: ({ project }) => project.county,
  region: ({ project }) => project.region,
  country: ({ project }) => project.country,
  planning_authority: ({ project }) => project.planning_authority,
  planning_reference: ({ project }) => project.planning_application_reference,
  repd_record_updated: ({ project }) => project.repd_record_updated,
  planning_application_submitted: ({ project }) => project.planning_application_submitted,
  planning_application_withdrawn: ({ project }) => project.planning_application_withdrawn,
  planning_permission_granted: ({ project }) => project.planning_permission_granted,
  planning_permission_refused: ({ project }) => project.planning_permission_refused,
  planning_permission_expired: ({ project }) => project.planning_permission_expired,
  under_construction: ({ project }) => project.under_construction,
  operational: ({ project }) => project.operational,
  repd_old_ref: ({ project }) => project.repd_old_ref,
  direct_related_repd_refs: ({ project }) => joinRefs(project.direct_related_repd_refs),
  planning_sibling_repd_refs: ({ project }) => joinRefs(project.planning_sibling_repd_refs),
  development_repd_refs: ({ project }) => joinRefs(project.development_repd_refs),
  relationships_json: ({ project }) => JSON.stringify(project.relationships),
  geometry_status: ({ project }) => project.geometry_status,
  easting: ({ project }) => project.easting,
  northing: ({ project }) => project.northing,
  source_crs: ({ metadata }) => metadata.geometry_policy.source_crs,
  longitude: ({ project }) => project.longitude,
  latitude: ({ project }) => project.latitude,
  atlas_url: ({ project }) => buildAtlasV8Url(project),
  output_crs: ({ metadata }) => metadata.geometry_policy.output_crs,
  coordinate_transform: ({ metadata }) => metadata.geometry_policy.transform,
  coordinate_use: ({ metadata }) => metadata.geometry_policy.use,
  source_dataset: ({ metadata }) => metadata.source_provenance.dataset,
  source_row: ({ project }) => project.source_row,
  projects_sha256: ({ metadata }) => metadata.projects_sha256,
  source_identity_sha256: ({ metadata }) => metadata.source_identity_sha256,
  source_coordinate_fixture_sha256: ({ metadata }) => metadata.source_coordinate_fixture_sha256,
  source_workbook_sha256: ({ metadata }) => metadata.source_workbook_sha256,
  reconciliation: ({ metadata }) => metadata.source_provenance.reconciliation,
  legacy_news_signal: ({ tableRow }) => tableRow.primary.legacyNews.label,
  legacy_news_note: ({ tableRow }) => tableRow.primary.legacyNews.note,
});

export function neutraliseSpreadsheetFormula(value) {
  if (typeof value !== "string") return value;
  return /^(?:[=+\-@]|\s+[=+\-@]|\t|\r|\n)/u.test(value) ? `'${value}` : value;
}

export function quoteCsvCell(value) {
  const safe = neutraliseSpreadsheetFormula(value ?? "");
  return `"${String(safe).replaceAll('"', '""')}"`;
}

function isoDate(value) {
  if (value === undefined) return new Date().toISOString().slice(0, 10);
  const parsed = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : null;
  invariant(
    parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value,
    "date must be a valid YYYY-MM-DD value",
  );
  return value;
}

export function buildCanonicalProjectCsv(state, { legacySignalResolver, date } = {}) {
  const snapshot = Object.freeze({
    filtered: state?.filtered,
    contract: state?.contract,
    metadata: state?.metadata,
  });
  const table = buildCanonicalProjectTableView(state, { legacySignalResolver });
  invariant(table.available, "validated canonical project model is unavailable");
  invariant(
    state.filtered === snapshot.filtered
      && state.contract === snapshot.contract
      && state.metadata === snapshot.metadata,
    "canonical state changed while the export was being built",
  );
  invariant(snapshot.contract.interface.export.scope === "current filtered rows only", "filtered export contract is absent");
  invariant(snapshot.contract.interface.export.zero_results === "header only", "zero-result export contract is absent");
  const columns = snapshot.contract.interface.export.columns;
  invariant(Array.isArray(columns) && columns.length > 0, "export columns are absent");
  invariant(columns.every((column) => typeof VALUE_GETTERS[column.id] === "function"), "export contains an unknown column");
  invariant(snapshot.filtered.length === table.rows.length, "table and filtered export row counts disagree");

  const lines = [columns.map((column) => quoteCsvCell(column.label)).join(",")];
  snapshot.filtered.forEach((project, index) => {
    const context = { project, metadata: snapshot.metadata, tableRow: table.rows[index] };
    lines.push(columns.map((column) => quoteCsvCell(VALUE_GETTERS[column.id](context))).join(","));
  });
  const content = `${CSV_BOM}${lines.join("\r\n")}`;
  const filename = `globalgrid2050_uk_renewables_pipeline_v9_0_${isoDate(date)}.csv`;
  return Object.freeze({
    content,
    filename,
    mimeType: CSV_MIME_TYPE,
    rowCount: snapshot.filtered.length,
    columnCount: columns.length,
    encoding: "UTF-8 with BOM",
  });
}
