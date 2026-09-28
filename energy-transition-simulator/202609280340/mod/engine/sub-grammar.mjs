// COPIED UNCHANGED from world/v12 sub-grammar.mjs at v12 commit 3adcee9 (file last changed fda2061). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// sub-grammar.mjs: the typed words for the journey's first step (go substation 132 · next substation), kept out of
// cmd-grammar.mjs (as repd-grammar.mjs is) so that file stays under the line cap. The words themselves are read by
// journey.mjs parseJourney; this file only turns its answer into a command. cmd-grammar.mjs asks parseSubCommand(line)
// BEFORE parseRepd: "next substation" would otherwise be refused by the REPD words ("next takes solar, bess or roof").

import { parseJourney } from './journey.mjs';

// A further 'go' entry for help and search (as REPD_COMMANDS adds its own).
export const SUB_COMMANDS = Object.freeze([
  { verb: 'go', usage: 'go substation 132  ·  next substation', words: 'fly substation journey kv next nearest compound fence' }
]);

/** parseSubCommand(line) -> null | { ok: true, verb: 'go', act: 'journey', set: {}, arg, line } | { ok: false, why, line } */
export function parseSubCommand(line) {
  const j = parseJourney(line);
  if (!j) return null;
  const text = String(line).trim();
  return j.error ? { ok: false, why: j.error, line: text } : { ok: true, verb: 'go', set: {}, act: 'journey', arg: j, line: text };
}
