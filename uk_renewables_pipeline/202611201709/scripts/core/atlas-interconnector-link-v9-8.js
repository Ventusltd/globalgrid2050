/* THE MAP LINK FOR AN INTERCONNECTOR ROW.
 *
 * A REPD row's MAP link carries repd_ref, and the Atlas resolves the project
 * from the register. An interconnector has no REPD reference and is in no
 * register the Atlas reads, so its link carries the link's own identity -
 * `interconnector=INTNED` - and `technology=interconnector`, against the same
 * canonical receiver every other MAP cell uses. The receiver is the one the
 * compiled deep-link contract names (core/atlas-receiver-v9-7.js); this module
 * adds no second route and follows the same withdrawal.
 *
 * WHAT THE COORDINATE IN THE LINK IS.
 *   valid        both converters known: the great-circle midpoint, sent as a
 *                LABEL ANCHOR with zoom 7 so the whole span is in view. The
 *                Atlas's interconnector module reads `interconnector=` and
 *                fires its span model at both converters:
 *                    40km <- Grain --[ BritNed 234.9 km ]-- Maasvlakte -> 40km
 *                Measuring from the midpoint would report the sea; it is not
 *                done, and the parameter `anchor=midpoint` says so.
 *   gb_end_only  the GB converter, zoom 10, `anchor=gb_converter`.
 *   missing      no link. The cell says why, in the row, because a title
 *                attribute is unreachable on a phone.
 */
import { atlasReceiverV9_7, atlasReceiverFailureV9_7 } from "./atlas-receiver-v9-7.js";

export const INTERCONNECTOR_PARAMS = Object.freeze([
  "interconnector", "technology", "project", "capacity_mw", "anchor", "latitude", "longitude", "zoom",
]);

export function interconnectorIdentityV9_8(record) {
  if (!record || record.technology !== "interconnector") return "";
  return String(record.bmrs_code || record.repd_ref || "").replace(/^IC-/, "");
}

export function buildAtlasInterconnectorLinkV9_8(record) {
  const route = atlasReceiverV9_7();
  if (!route) return "";
  const identity = interconnectorIdentityV9_8(record);
  if (!identity) return "";
  if (record.geometry_status !== "valid" && record.geometry_status !== "gb_end_only") return "";
  const values = {
    interconnector: identity,
    technology: "interconnector",
    project: record.name,
    capacity_mw: record.capacity_mw,
    anchor: record.geometry_status === "valid" ? "midpoint" : "gb_converter",
    latitude: record.latitude,
    longitude: record.longitude,
    zoom: record.geometry_status === "valid" ? "7" : "10",
  };
  const url = new URL(route);
  for (const key of INTERCONNECTOR_PARAMS) {
    const value = values[key];
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

export function interconnectorMapNoteV9_8(record) {
  if (!record) return "";
  switch (record.geometry_status) {
    case "valid":
      return `Straight line converter to converter, ${record.span.straight_line_km} km. The map opens on the midpoint as a label anchor, not a location; the Atlas measures each end within its own search radius.`;
    case "gb_end_only":
      return `GB converter located (${record.gb_end.name}); the far converter is not yet held, so the map opens on the GB end only.`;
    default:
      return "";
  }
}

export function interconnectorMapUnavailableReasonV9_8(record) {
  if (!atlasReceiverV9_7()) return `MAP unavailable: ${atlasReceiverFailureV9_7()}`;
  if (!interconnectorIdentityV9_8(record)) return "MAP unavailable: this row carries no interconnector identity";
  return "MAP unavailable: no converter coordinates are held for this link yet. The row stays in the table, the CSV and the search.";
}
