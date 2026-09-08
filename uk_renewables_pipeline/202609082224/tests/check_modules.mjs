import assert from "node:assert/strict";

import { state } from "../scripts/core/state.js";
import { escapeHtml, isFinanceEvent, normaliseProject, titleCase } from "../scripts/core/utils.js";
import { startPlugins } from "../scripts/core/plugin-host.js";
import { signalForProject } from "../scripts/plugins/newspaper.js";

assert.equal(normaliseProject("Beacon Fen & Energy Park"), "beacon fen and energy park");
assert.equal(titleCase("UNDER CONSTRUCTION"), "Under Construction");
assert.equal(escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
assert.equal(isFinanceEvent("financial close"), true);
assert.equal(isFinanceEvent("PROJECT UPDATE"), false);

state.newsItems = [
  { project: "Beacon Fen Energy Park", event: "CONSENT", published: "2026-08-01" },
  { project: "Beacon Fen Energy Park", event: "OPERATIONAL", published: "2026-08-02" },
  { project: "Coalburn II", event: "FINANCIAL CLOSE", published: "2026-08-03" },
  { project: "Cleve Hill", event: "ACQUISITION", published: "2026-08-04" },
];

assert.deepEqual(signalForProject("Beacon Fen Energy Park"), {
  label: "APPROVED*", cls: "approved", note: "headline 2026-08-01",
});
assert.deepEqual(signalForProject("Coalburn II"), {
  label: "FINANCED*", cls: "finance", note: "headline 2026-08-03",
});
assert.deepEqual(signalForProject("Cleve Hill"), {
  label: "M&A*", cls: "finance", note: "headline 2026-08-04",
});
assert.deepEqual(signalForProject("No Headline Project"), {
  label: "—", cls: "none", note: "no matched headline",
});

const order = [];
assert.deepEqual(startPlugins([
  { id: "one", start: () => order.push("one") },
  { id: "two", dependsOn: ["one"], start: () => order.push("two") },
]), ["one", "two"]);
assert.deepEqual(order, ["one", "two"]);
assert.throws(
  () => startPlugins([{ id: "two", dependsOn: ["one"], start() {} }]),
  /unmet dependencies/,
);

console.log("V7.1 module contract: PASS");
