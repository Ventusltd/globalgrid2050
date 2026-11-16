import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
export const directory = fileURLToPath(new URL('./', import.meta.url));
export const pins = JSON.parse(await readFile(new URL('./pins.json', import.meta.url), 'utf8'));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const encode = value => new TextEncoder().encode(JSON.stringify(value));
assert.ok(process.env.FIGURES_UI_DIR, 'FIGURES_UI_DIR must identify the pinned external renderer directory');
export const figuresDirectory = resolve(process.env.FIGURES_UI_DIR);
for (const [file, hash] of Object.entries(pins.figures_files)) {
  assert.equal(sha(await readFile(resolve(figuresDirectory, file))), hash, `Pinned FIGURES ${file}`);
}
export const {buildViewModel} = await import(pathToFileURL(resolve(figuresDirectory, 'model.mjs')));
const result = spawnSync(process.env.PYTHON || 'python', ['-B', '-X', 'utf8', '-m', 'automation.news.build_transition_context',
  '--policy', 'automation/news/policy_commitments/sample_ledger.json',
  '--grid', 'automation/news/dc_context/grid-source-fixture.json',
  '--solar', 'automation/news/dc_context/fixtures/solar-context.json', '--as-of', pins.fixture_as_of],
  {cwd: fileURLToPath(new URL('../../../', import.meta.url)), maxBuffer: 17 * 1024 * 1024});
assert.equal(result.status, 0, result.stderr?.toString());
export const raw = new Uint8Array(result.stdout);
assert.equal(sha(raw), pins.fixture_sha256, 'Actual exporter bytes must match accepted receipt');
export const report = JSON.parse(new TextDecoder().decode(raw));
