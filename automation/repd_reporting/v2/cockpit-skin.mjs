/**
 * PipelineNews cockpit skin v1 — source-derived presentation contract.
 *
 * READS the live REPD V9.73 palette. Does not introduce an alternate theme,
 * mutate table/gauge/headline styles, or change the application colour scheme.
 * Pair with cockpit-skin.css in a future immutable release.
 *
 * Source of truth:
 *   uk_renewables_pipeline/202611222330/styles/v7.css (:root, .mw, th)
 *   uk_renewables_pipeline/202611222330/scripts/plugins/projects-v9-8.js (badges)
 */
export const REPD_ROOT_TOKENS = Object.freeze([
  "--bg", "--panel", "--line", "--soft", "--text",
  "--muted", "--accent", "--ok", "--solar", "--bess", "--off"
]);

// Expected published V9.73 palette, pinned for drift detection; never substituted
// for live values by the binding function.
export const REPD_V973_REFERENCE = Object.freeze({
  "--bg": "#000",
  "--panel": "#0b0e14",
  "--line": "#2f343d",
  "--soft": "#222",
  "--text": "#fff",
  "--muted": "#a6adbb",
  "--accent": "#00ffff",
  "--ok": "#00ff88",
  "--solar": "#ffff00",
  "--bess": "#ffae00",
  "--off": "#0066ff"
});
export const REPD_TECH_BADGE_TOKENS = Object.freeze({
  solar: "--solar",
  bess: "--bess",
  wind_onshore: "--accent",
  wind_offshore: "--off",
  interconnector: "--off"
});

function requireBrowser(documentRef, windowRef) {
  if (!documentRef?.documentElement || typeof windowRef?.getComputedStyle !== "function") {
    throw new Error("REPD skin requires a mounted browser document and getComputedStyle");
  }
  if (!documentRef.getElementById("repdPanel")) {
    throw new Error("REPD skin source panel is missing; refusing to invent a palette");
  }
}
export function readRepdSkin(documentRef, windowRef) {
  requireBrowser(documentRef, windowRef);
  const declarations = windowRef.getComputedStyle(documentRef.documentElement);
  const tokens = {};
  for (const name of REPD_ROOT_TOKENS) {
    const value = declarations.getPropertyValue(name)?.trim();
    if (!value) throw new Error("Missing official REPD skin token " + name);
    tokens[name] = value;
  }
  return Object.freeze(tokens);
}
export function verifyRepdSkin(tokens, reference = REPD_V973_REFERENCE) {
  const differences = [];
  for (const name of REPD_ROOT_TOKENS) {
    const actual = tokens?.[name]?.trim()?.toLowerCase();
    if (!actual) {
      differences.push({ name, expected: reference[name], actual: "(missing)" });
    } else if (actual !== reference[name]) {
      // A future owner-approved source palette revision requires explicit review.
      differences.push({ name, expected: reference[name], actual });
    }
  }
  return { matchesV973: differences.length === 0, differences };
}
/**
 * Applies the EXISTING REPD theme only to a new cockpit host.
 * All existing panels and globally defined CSS variables stay unchanged.
 * Returns a receipt for CI to compare with the source palette.
 */
export function applyRepdCockpitSkin(host, { documentRef, windowRef } = {}) {
  if (!host?.style?.setProperty) throw new Error("A cockpit host element is required");
  const tokens = readRepdSkin(documentRef, windowRef);
  const aliases = {
    "--bg": "--pn-cockpit-bg",
    "--panel": "--pn-cockpit-panel",
    "--line": "--pn-cockpit-line",
    "--soft": "--pn-cockpit-soft",
    "--text": "--pn-cockpit-text",
    "--muted": "--pn-cockpit-muted",
    "--accent": "--pn-cockpit-accent",
    "--ok": "--pn-cockpit-mw",
    "--solar": "--pn-cockpit-solar",
    "--bess": "--pn-cockpit-bess",
    "--off": "--pn-cockpit-offshore"
  };
  for (const [source, target] of Object.entries(aliases)) {
    host.style.setProperty(target, tokens[source]);
  }
  host.style.setProperty("--pn-cockpit-onshore", tokens["--accent"]);
  const verdict = verifyRepdSkin(tokens);
  // Do not silently conceal source drift. We deliberately USE the live
  // palette, and integration QA must resolve any source/reference mismatch.
  return Object.freeze({ source: "REPD-CURRENT-COMPUTED-STYLE", ...verdict, tokens });
}
