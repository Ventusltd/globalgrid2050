import { buildAtlasDeepLinkV9_7 } from "../core/atlas-receiver-v9-7.js";

const CAPACITY_BASIS = "official_repd_record_capacity_not_development_deduplicated";
const NO_RELATIONSHIPS = "none recorded";
const LEGACY_NEWS_AUTHORITY = "external legacy intelligence — unverified";

function invariant(condition, message) {
  if (!condition) throw new Error(`V7.2 canonical table: ${message}`);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function hasValidatedModel(state) {
  return Boolean(
    state?.contract
    && state?.metadata
    && Array.isArray(state.all)
    && state.all.length > 0
    && Array.isArray(state.filtered),
  );
}

function isCanonicalOrder(projects) {
  return projects.every((project, index) => {
    if (index === 0) return true;
    const previous = projects[index - 1];
    return previous.capacity_mw > project.capacity_mw
      || (
        previous.capacity_mw === project.capacity_mw
        && previous.gg_project_id.localeCompare(project.gg_project_id) <= 0
      );
  });
}

function displayOfficial(value, missingValueLabel) {
  return value === null || value === undefined || value === "" ? missingValueLabel : String(value);
}

function displayCapacity(project) {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(project.capacity_mw)} ${project.capacity_unit}`;
}

function displayOfficialDate(value, missingValueLabel) {
  if (!value) return missingValueLabel;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/* The name is kept because the CSV column it feeds is a published
   contract pinned by contracts/projects-plugin.v7.2.json and by
   tests/check_v9_0.mjs. What it BUILDS is now the receiver the engine
   publishes as canonical; renaming the column is a separate, governed
   decision and is recorded as an erratum rather than taken here. */
export function buildAtlasV8Url(project) {
  return buildAtlasDeepLinkV9_7(project);
}

function sameFlatRecord(left, right) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const keys = Object.keys(left).sort();
  return keys.join("\n") === Object.keys(right).sort().join("\n")
    && keys.every((key) => left[key] === right[key]);
}

export function buildCanonicalNewsSearchUrl(project) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", `${project.name} ${project.technology_label} UK`);
  url.searchParams.set("tbm", "nws");
  return url.href;
}

function legacyNewsFor(project, resolver) {
  if (typeof resolver !== "function") {
    return {
      authority: LEGACY_NEWS_AUTHORITY,
      verified: false,
      status: "not_evaluated_in_isolated_v7_2",
      label: "not evaluated",
      note: "Trusted project-event binding is V7.3 scope",
    };
  }
  try {
    const result = resolver(project);
    const label = typeof result?.label === "string" && result.label.trim()
      ? result.label.trim()
      : "no matched legacy headline";
    const note = typeof result?.note === "string" && result.note.trim()
      ? result.note.trim()
      : "No legacy-news note supplied";
    return {
      authority: LEGACY_NEWS_AUTHORITY,
      verified: false,
      status: label === "no matched legacy headline" ? "no_match" : "legacy_match_unverified",
      label,
      note,
    };
  } catch {
    return {
      authority: LEGACY_NEWS_AUTHORITY,
      verified: false,
      status: "legacy_news_unavailable",
      label: "legacy news unavailable",
      note: "Legacy news resolver failed",
    };
  }
}

function validatePublishedMetadata(state) {
  const expected = state.contract.canonical_universe.published_snapshot;
  const actual = state.metadata;
  invariant(expected && typeof expected === "object", "published snapshot contract is absent");
  for (const field of [
    "projects_sha256",
    "source_identity_sha256",
    "source_coordinate_fixture_sha256",
    "source_workbook_sha256",
  ]) {
    invariant(actual[field] === expected[field], `${field} is not the contracted published value`);
  }
  invariant(sameFlatRecord(actual.source_provenance, expected.source_provenance), "source provenance is not the contracted published value");
  invariant(sameFlatRecord(actual.geometry_policy, expected.geometry_policy), "geometry policy is not the contracted published value");
}

function evidenceFor(project, state, inScopeRefs, missingValueLabel) {
  const milestoneFields = state.contract.interface.official_milestone_fields;
  const milestones = Object.fromEntries(milestoneFields.map((field) => [
    field,
    {
      value: project[field],
      display: displayOfficial(project[field], missingValueLabel),
      authority: "official REPD field",
    },
  ]));
  const relationships = project.relationships.map((relationship) => ({
    repdRef: relationship.repd_ref,
    type: relationship.type,
    sourceField: relationship.source_field,
    targetInCurrentUniverse: inScopeRefs.has(relationship.repd_ref),
  }));
  const metadata = state.metadata;
  return {
    identity: {
      ggDevelopmentId: project.gg_development_id,
      status: project.identity_status,
      confidence: project.identity_confidence,
    },
    officialPlanning: {
      authority: project.planning_authority,
      repdRecordUpdated: {
        value: project.repd_record_updated,
        display: displayOfficial(project.repd_record_updated, missingValueLabel),
      },
      milestones,
    },
    lifecycle: {
      value: project.lifecycle,
      view: project.lifecycle_view,
      derived: true,
      note: "Derived lifecycle; does not replace the official REPD status",
    },
    relationships: {
      items: relationships,
      display: relationships.length ? null : NO_RELATIONSHIPS,
      directRelatedRepdRefs: [...project.direct_related_repd_refs],
      planningSiblingRepdRefs: [...project.planning_sibling_repd_refs],
      developmentRepdRefs: [...project.development_repd_refs],
      outOfScopeTargetsRemainContextOnly: true,
    },
    geometry: {
      status: project.geometry_status,
      easting: project.easting,
      northing: project.northing,
      longitude: project.longitude,
      latitude: project.latitude,
      coordinateSource: project.coordinate_source,
      policy: { ...metadata.geometry_policy },
      contextOnly: true,
    },
    provenance: {
      kind: "published snapshot metadata",
      dataset: metadata.source_provenance.dataset,
      sourcePath: state.source,
      sourceRow: project.source_row,
      projectsSha256: metadata.projects_sha256,
      sourceIdentitySha256: metadata.source_identity_sha256,
      sourceCoordinateFixtureSha256: metadata.source_coordinate_fixture_sha256,
      sourceWorkbookSha256: metadata.source_workbook_sha256,
      canonicalIdentitySourceXlsxSha256: metadata.source_provenance.canonical_identity_source_xlsx_sha256,
      coordinateWorkbookCopySha256: metadata.source_provenance.coordinate_workbook_copy_sha256,
      reconciliation: metadata.source_provenance.reconciliation,
      note: "Published snapshot metadata; not recomputed by the browser",
    },
  };
}

function rowFor(project, state, inScopeRefs, resolver, missingValueLabel) {
  const legacyNews = legacyNewsFor(project, resolver);
  return {
    key: project.gg_project_id,
    primary: {
      project: project.name,
      location: [project.county, project.region, project.country].filter(Boolean).join(", "),
      operator: project.operator,
      technology: project.technology_label,
      officialStatus: project.status,
      capacity: {
        value: project.capacity_mw,
        unit: project.capacity_unit,
        display: displayCapacity(project),
        authority: "official REPD record",
      },
      repdRef: project.repd_ref,
      ggProjectId: project.gg_project_id,
      planningReference: displayOfficial(project.planning_application_reference, missingValueLabel),
      repdRecordUpdated: {
        value: project.repd_record_updated,
        display: displayOfficialDate(project.repd_record_updated, missingValueLabel),
        authority: "official REPD field",
      },
      atlas: {
        label: "Open Atlas V8",
        url: buildAtlasV8Url(project),
        exactFocusSupported: project.geometry_status === "valid",
        note: "Atlas V8 opens with canonical coordinates supplied, but does not yet consume the deep-link parameters",
      },
      legacyNews,
      news: {
        label: "Search news",
        url: buildCanonicalNewsSearchUrl(project),
        role: "external search context; not canonical evidence",
      },
    },
    evidence: evidenceFor(project, state, inScopeRefs, missingValueLabel),
  };
}

export function buildCanonicalProjectTableView(state, { legacySignalResolver } = {}) {
  if (!hasValidatedModel(state)) {
    return deepFreeze({
      available: false,
      status: state?.status || "idle",
      error: state?.error || null,
      columns: [],
      evidenceFields: [],
      rows: null,
      rowCount: null,
      missingValueLabel: null,
      capacityBasis: CAPACITY_BASIS,
    });
  }

  const snapshot = Object.freeze({
    all: state.all,
    filtered: state.filtered,
    contract: state.contract,
    metadata: state.metadata,
    source: state.source,
    status: state.status,
    error: state.error,
  });
  validatePublishedMetadata(snapshot);
  const primaryFields = snapshot.contract.interface.primary_table_fields;
  invariant(Array.isArray(primaryFields) && primaryFields.length === 13, "13-column table contract is absent");
  invariant(
    primaryFields.map((field) => field.label).join("\n")
      === snapshot.contract.interface.primary_table_columns.join("\n"),
    "table field labels do not match the frozen column order",
  );
  const canonicalById = new Map(snapshot.all.map((project) => [project.gg_project_id, project]));
  const inScopeRefs = new Set(snapshot.all.map((project) => project.repd_ref));
  invariant(
    snapshot.filtered.every((project) => canonicalById.get(project.gg_project_id) === project),
    "filtered rows are not exact canonical project objects",
  );
  invariant(
    new Set(snapshot.filtered.map((project) => project.gg_project_id)).size === snapshot.filtered.length,
    "filtered rows contain a duplicate canonical project",
  );
  invariant(isCanonicalOrder(snapshot.filtered), "filtered rows are not in canonical capacity/project-ID order");
  const missingValueLabel = snapshot.contract.interface.missing_value_label;
  const rows = snapshot.filtered.map((project) => rowFor(
    project,
    snapshot,
    inScopeRefs,
    legacySignalResolver,
    missingValueLabel,
  ));
  invariant(
    state.all === snapshot.all
      && state.filtered === snapshot.filtered
      && state.contract === snapshot.contract
      && state.metadata === snapshot.metadata
      && state.source === snapshot.source,
    "canonical state changed while the table view was being built",
  );
  return deepFreeze({
    available: true,
    status: snapshot.status,
    error: snapshot.error,
    columns: primaryFields.map((field) => ({ ...field })),
    evidenceFields: [...snapshot.contract.interface.evidence_fields],
    rows,
    rowCount: rows.length,
    missingValueLabel,
    capacityBasis: CAPACITY_BASIS,
  });
}
