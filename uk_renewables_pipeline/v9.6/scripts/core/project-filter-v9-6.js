export function parseCapacityBoundV9_6(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}

export function capacityRangeV9_6(minRaw, maxRaw) {
  const minMW = parseCapacityBoundV9_6(minRaw);
  const maxMW = parseCapacityBoundV9_6(maxRaw);
  if (Number.isNaN(minMW) || Number.isNaN(maxMW)) {
    return Object.freeze({ minMW, maxMW, valid: false, reason: "Enter non-negative MW values" });
  }
  if (minMW !== null && maxMW !== null && minMW > maxMW) {
    return Object.freeze({ minMW, maxMW, valid: false, reason: "Minimum MW must not exceed maximum MW" });
  }
  return Object.freeze({ minMW, maxMW, valid: true, reason: "" });
}

export function projectMatchesOfficialCapacityV9_6(project, range) {
  if (!range?.valid) return false;
  const capacity = Number(project?.capacity_mw);
  if (!Number.isFinite(capacity)) return false;
  if (range.minMW !== null && capacity < range.minMW) return false;
  if (range.maxMW !== null && capacity > range.maxMW) return false;
  return true;
}

export function capacityRangeLabelV9_6(range) {
  if (!range?.valid) return range?.reason || "Invalid official-capacity range";
  if (range.minMW === null && range.maxMW === null) return "All official capacities";
  if (range.minMW !== null && range.maxMW !== null) return `${range.minMW.toLocaleString("en-GB")}–${range.maxMW.toLocaleString("en-GB")} MW inclusive`;
  if (range.minMW !== null) return `${range.minMW.toLocaleString("en-GB")} MW and above`;
  return `Up to ${range.maxMW.toLocaleString("en-GB")} MW`;
}
