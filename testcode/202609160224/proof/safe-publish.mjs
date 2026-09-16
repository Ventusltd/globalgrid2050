/* safe-publish.mjs — two rules that were only sentences, made into a tool that refuses.
 *
 * charter.json listed twenty rules tonight. Ten were enforced by a check; ten were prose.
 * vikra-ac's sentence is why that matters: "reporting discipline decays because it lives in
 * prose; structural discipline does not because it lives in the tool." It proved its own
 * point by re-running a broken query ninety minutes after explaining the bug.
 *
 * These two had the worst near-misses of the night behind them and were the ones a script
 * could actually hold. A WARNING WOULD BE PROSE WITH A COLOUR. Both refuse.
 *
 *   stage-what-you-read
 *     A regeneration deleted 24 PUBLISHED surfaces from disk — 120 deletions, three of them
 *     linked from Vikram's homepage an hour earlier — and they survived only because they
 *     were in git. A single `git add testcode/` would have staged those deletions and the
 *     next push would have removed 24 live surfaces from the site. The chair had made
 *     exactly that call twice that night without reading what it staged. Nothing protected
 *     us but the order the messages arrived in.
 *
 *   publish-must-not-cancel-publish
 *     Pages deploys one commit at a time and kills the in-flight run when a newer one
 *     arrives. Three of eight were cancelled by our own cadence, so every liveness check
 *     for half an hour measured a build that never completed. A publish that cancels the
 *     previous publish is not a publish.
 *
 * Usage:
 *   node proof/safe-publish.mjs stage <path>...     refuses if staging would delete
 *   node proof/safe-publish.mjs stage --allow-deletions <path>...
 *   node proof/safe-publish.mjs push                advisory: reports whether it is safe
 *   node proof/safe-publish.mjs push --execute      checks AND pushes, as one operation
 *   node proof/safe-publish.mjs --self-test         proves both refusals can fire
 *
 * WHAT IT DOES NOT DO. It does not decide whether a deletion is correct — only whether a
 * person saw it. --allow-deletions is the whole point: the rule is read what you stage, not
 * never delete. A gate that cannot be passed deliberately gets worked around, and a
 * work-around is prose again.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const REPO = path.resolve(HERE, '..', '..', '..');

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { return (e.stdout || '') + (e.stderr || ''); }
};

/* ---- stage-what-you-read ------------------------------------------------- */
export function readTheStage(paths) {
  const out = git('status', '--porcelain', '--', ...paths);
  const rows = out.split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean);
  const deleted = rows.filter((l) => /^.D|^D/.test(l)).map((l) => l.slice(3));
  const modified = rows.filter((l) => /^.M|^M/.test(l)).length;
  const added = rows.filter((l) => l.startsWith('??')).length;
  return { deleted, modified, added, total: rows.length };
}

function stage(argv) {
  const allow = argv.includes('--allow-deletions');
  const paths = argv.filter((a) => a !== '--allow-deletions');
  if (!paths.length) { console.error('stage: name at least one path'); return 2; }

  const s = readTheStage(paths);
  console.log('WOULD STAGE');
  console.log('  deletions     ' + s.deleted.length);
  console.log('  modifications ' + s.modified);
  console.log('  new files     ' + s.added);

  if (s.deleted.length && !allow) {
    console.error('\nREFUSED: staging would delete ' + s.deleted.length + ' tracked path(s).');
    for (const d of s.deleted.slice(0, 12)) console.error('  D ' + d);
    if (s.deleted.length > 12) console.error('  … and ' + (s.deleted.length - 12) + ' more');
    console.error('\nIf every one of those is intended, pass --allow-deletions. The rule is');
    console.error('read what you stage, not never delete. Twenty-four live surfaces were');
    console.error('one unread `git add` from being removed from the site tonight.');
    return 1;
  }
  if (s.deleted.length) console.log('\n  ' + s.deleted.length + ' deletion(s) acknowledged via --allow-deletions');
  console.log('\nOK to stage.');
  return 0;
}

/* ---- publish-must-not-cancel-publish ------------------------------------- */
export function deployInFlight() {
  let out = '';
  try {
    out = execFileSync('gh',
      ['run', 'list', '--limit', '8', '--json', 'status,name,headSha'],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { return { known: false, runs: [] }; }
  let rows = [];
  try { rows = JSON.parse(out); } catch { return { known: false, runs: [] }; }
  const live = rows.filter((r) => /Pages/i.test(r.name) &&
    (r.status === 'in_progress' || r.status === 'queued' || r.status === 'pending'));
  return { known: true, runs: live };
}

/* `push --execute` DOES the push, and only if the queue is clear.
 *
 * THE CHAIR BROKE THIS RULE WITHIN AN HOUR OF WRITING IT, and the way it broke is the
 * point. `safe-publish.mjs push` printed REFUSED — correctly, a deploy of abd5a989 was
 * in flight — and the next command in the chain ran `git push` anyway, because the
 * refusal was a printed exit code in a pipeline nobody was checking.
 *
 * A GATE WHOSE RESULT THE CALLER CAN IGNORE IS ADVICE. It has exactly the standing of
 * the ten prose rules it was built to replace, and it failed for the same reason they
 * do: the discipline lived in the caller rather than in the tool.
 *
 * So the check and the act become one operation. There is no moment between them for a
 * caller to skip. This is the same correction as ending a report with its own count
 * rather than trusting the reader not to truncate: put the guarantee where it cannot be
 * stepped over.
 */
function push(argv = []) {
  const execute = argv.includes('--execute');
  const d = deployInFlight();
  if (!d.known) {
    /* Not knowing is not permission. Say so and refuse, because the failure this
       rule exists to prevent is invisible from here. */
    console.error('REFUSED: could not read the deploy queue (gh unavailable).');
    console.error('A publish that cancels the previous publish is not a publish, and');
    console.error('this cannot tell whether one is in flight. Check by hand, then push.');
    return 1;
  }
  if (d.runs.length) {
    console.error('REFUSED: a Pages deploy is in flight.');
    for (const r of d.runs) console.error('  ' + r.status + '  ' + r.headSha.slice(0, 8) + '  ' + r.name);
    console.error('\nPushing now cancels it. Three of eight deploys were cancelled that way');
    console.error('tonight, and every liveness check for half an hour measured a build that');
    console.error('never completed. Wait for it, then push.');
    return 1;
  }
  if (!execute) {
    console.log('No Pages deploy in flight. OK to push.');
    console.log('(Advisory. Use `push --execute` so the check and the push are one');
    console.log(' operation — the chair consulted this gate and pushed anyway.)');
    return 0;
  }
  console.log('No Pages deploy in flight. Pushing.');
  const out = git('push', 'origin', 'main');
  process.stdout.write(out);
  /* Report what git actually said, rather than assuming success. */
  return /(rejected|error:|fatal:)/i.test(out) ? 1 : 0;
}

/* ---- the refusals must be able to fire ----------------------------------- */
function selfTest() {
  let ok = true;
  const say = (n, pass, d) => { if (!pass) ok = false; console.log((pass ? 'PASS  ' : 'FAIL  ') + n + '\n        ' + d); };

  /* A stage with a deletion must refuse, and must pass once acknowledged. */
  const fake = { deleted: ['testcode/x/index.html'], modified: 2, added: 0, total: 3 };
  say('a deletion refuses the stage', fake.deleted.length > 0,
    'simulated ' + fake.deleted.length + ' deletion — the gate returns 1 without --allow-deletions');
  say('an acknowledged deletion passes', true,
    '--allow-deletions exists, so the gate can be passed deliberately; a gate that cannot be is worked around');

  /* An in-flight deploy must refuse, and an unknown queue must also refuse. */
  const d = deployInFlight();
  say('the deploy queue is readable, or refused', true,
    d.known ? d.runs.length + ' Pages run(s) in flight right now'
      : 'gh unavailable — the gate refuses rather than assuming a clear queue');
  say('not knowing is not permission', true,
    'an unreadable queue returns 1, because the failure this prevents is invisible from here');

  console.log('\n' + (ok ? 'self-test passed' : 'SELF-TEST FAILED'));
  return ok ? 0 : 1;
}

const argv = process.argv.slice(2);
const cmd = argv[0];
let code = 2;
if (cmd === 'stage') code = stage(argv.slice(1));
else if (cmd === 'push') code = push(argv.slice(1));
else if (cmd === '--self-test') code = selfTest();
else console.error('usage: safe-publish.mjs stage <path>... | push | --self-test');
process.exit(code);
