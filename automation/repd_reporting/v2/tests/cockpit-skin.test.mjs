import test from "node:test";
import assert from "node:assert/strict";
import {
  REPD_ROOT_TOKENS, REPD_V973_REFERENCE, REPD_TECH_BADGE_TOKENS,
  readRepdSkin, verifyRepdSkin, applyRepdCockpitSkin
} from "../cockpit-skin.mjs";

function fixture(tokens = REPD_V973_REFERENCE) {
  const documentRef = {
    documentElement: { tag: "html" },
    getElementById: (id) => id === "repdPanel" ? { id } : null,
  };
  const windowRef = {
    getComputedStyle(node) {
      assert.equal(node, documentRef.documentElement);
      return { getPropertyValue: name => tokens[name] || "" };
    },
  };
  const touched = new Map();
  const host = { style: { setProperty: (key, value) => touched.set(key, value) } };
  return { documentRef, windowRef, host, touched };
}
test("palette is exactly the source V9.73 REPD root scheme (no alternative colours)", () => {
  const env = fixture();
  assert.deepEqual(readRepdSkin(env.documentRef, env.windowRef), REPD_V973_REFERENCE);
  const receipt = applyRepdCockpitSkin(env.host, env);
  assert.equal(receipt.matchesV973, true);
  assert.deepEqual(receipt.differences, []);
  assert.equal(env.touched.get("--pn-cockpit-solar"), "#ffff00");
  assert.equal(env.touched.get("--pn-cockpit-bess"), "#ffae00");
  assert.equal(env.touched.get("--pn-cockpit-onshore"), "#00ffff");
  assert.equal(env.touched.get("--pn-cockpit-offshore"), "#0066ff");
  assert.equal(env.touched.get("--pn-cockpit-mw"), "#00ff88");
  assert.equal(env.touched.get("--pn-cockpit-bg"), "#000");
  assert.equal(env.touched.size, REPD_ROOT_TOKENS.length + 1);
  assert.deepEqual(REPD_TECH_BADGE_TOKENS, {
    solar: "--solar", bess: "--bess", wind_onshore: "--accent",
    wind_offshore: "--off", interconnector: "--off",
  });
});
test("source palette drift is observed, never silently replaced", () => {
  const altered = { ...REPD_V973_REFERENCE, "--solar": "#123456" };
  const env = fixture(altered);
  const receipt = applyRepdCockpitSkin(env.host, env);
  assert.equal(receipt.matchesV973, false);
  assert.deepEqual(receipt.differences, [
    { name: "--solar", expected: "#ffff00", actual: "#123456" },
  ]);
  // Observe new source values, but integration must explicitly review drift.
  assert.equal(env.touched.get("--pn-cockpit-solar"), "#123456");
});
test("fail closed without canonical REPD source, instead of drawing invented colours", () => {
  const env = fixture();
  env.documentRef.getElementById = () => null;
  assert.throws(() => readRepdSkin(env.documentRef, env.windowRef), /source panel is missing/);
  assert.throws(() => applyRepdCockpitSkin(null, env), /host element/);
});
test("missing required theme tokens cannot be silently guessed", () => {
  const env = fixture({ ...REPD_V973_REFERENCE, "--bess": "" });
  assert.throws(() => readRepdSkin(env.documentRef, env.windowRef), /Missing official REPD skin token --bess/);
  assert.equal(verifyRepdSkin({ ...REPD_V973_REFERENCE, "--bess": "" }).matchesV973, false);
});
test("new CSS uses only scoped custom properties and never restyles existing table", () => {
  // The Spider audit additionally checks the exact full CSS file for forbidden
  // global style selectors; this checks semantic token coverage.
  assert.ok(REPD_ROOT_TOKENS.includes("--accent"));
  assert.ok(REPD_ROOT_TOKENS.includes("--ok"));
});
