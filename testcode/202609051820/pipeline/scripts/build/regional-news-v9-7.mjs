import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { committedJsonItemsV9_7 } from "../news/adapters/committed-json-v9-7.mjs";
import { CLASSIFIER_VERSION } from "../news/classifier-v9-7.mjs";
import { buildRegionalArtifactsV9_7 } from "../news/ledger-v9-7.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const execFileAsync = promisify(execFile);
const FULL_COMMIT = /^[0-9a-f]{40}$/;
const SAFE_REPO_PATH = /^[A-Za-z0-9._/-]+$/;
const MAX_PINNED_INPUT_BYTES = 16 * 1024 * 1024;

export function pinnedInputObjectV9_7(sourceMeta) {
  if (sourceMeta?.kind !== "committed-json-snapshot") {
    throw new Error("V9.7 enabled source must be a committed-json-snapshot");
  }
  if (!FULL_COMMIT.test(sourceMeta.input_commit || "")) {
    throw new Error("V9.7 source input_commit must be one full lowercase Git commit SHA");
  }
  const input = sourceMeta.input;
  const segments = typeof input === "string" ? input.split("/") : [];
  if (
    typeof input !== "string"
    || !SAFE_REPO_PATH.test(input)
    || input.startsWith("/")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("V9.7 source input must be a safe repository-relative path");
  }
  return `${sourceMeta.input_commit}:${input}`;
}

export async function readPinnedInputV9_7(repoRoot, sourceMeta) {
  const object = pinnedInputObjectV9_7(sourceMeta);
  try {
    const { stdout: objectType } = await execFileAsync(
      "git", ["-C", repoRoot, "cat-file", "-t", sourceMeta.input_commit], { encoding: "utf8" },
    );
    if (objectType.trim() !== "commit") {
      throw new Error(`pinned object is ${objectType.trim()}, not a commit`);
    }
    await execFileAsync(
      "git", ["-C", repoRoot, "merge-base", "--is-ancestor", sourceMeta.input_commit, "HEAD"],
      { encoding: "utf8" },
    );
    const { stdout } = await execFileAsync(
      "git", ["-C", repoRoot, "cat-file", "blob", object],
      { encoding: null, maxBuffer: MAX_PINNED_INPUT_BYTES },
    );
    return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  } catch (error) {
    throw new Error(`V9.7 could not read pinned input ${object}: ${error.message}`);
  }
}

async function main() {
  const releaseRoot = fileURLToPath(new URL("../../", import.meta.url));
  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const contractPath = `${releaseRoot}contracts/regional-news-sources.v9.7.json`;
  const registryPath = `${releaseRoot}contracts/news-module-registry.v9.7.json`;
  const [sourceContractText, moduleRegistryText] = await Promise.all([
    readFile(contractPath, "utf8"),
    readFile(registryPath, "utf8"),
  ]);
  const sourceContract = JSON.parse(sourceContractText);
  const moduleRegistry = JSON.parse(moduleRegistryText);
  const sourceMeta = sourceContract.adapters.find((adapter) => adapter.enabled);
  const inputBytes = await readPinnedInputV9_7(repoRoot, sourceMeta);
  const inputText = inputBytes.toString("utf8");
  const input = JSON.parse(inputText);
  const items = committedJsonItemsV9_7(input, sourceMeta);
  const { regional, ledger, telemetry } = buildRegionalArtifactsV9_7(items, sourceMeta);
  const regionalText = `${JSON.stringify(regional, null, 2)}\n`;
  const ledgerText = `${JSON.stringify(ledger, null, 2)}\n`;
  const manifest = {
    schema: "globalgrid2050.regional-news-manifest.v9.7",
    release: "9.7",
    snapshot_at: sourceContract.snapshot_at,
    classifier_version: CLASSIFIER_VERSION,
    source_adapter: sourceMeta,
    modules: moduleRegistry.modules,
    telemetry,
    hashes: {
      source_contract_sha256: sha256(sourceContractText),
      module_registry_sha256: sha256(moduleRegistryText),
      input_sha256: sha256(inputText),
      regional_news_sha256: sha256(regionalText),
      decision_ledger_sha256: sha256(ledgerText),
    },
  };
  const outputDir = `${releaseRoot}data/v9.7`;
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(`${outputDir}/regional_news.json`, regionalText),
    writeFile(`${outputDir}/regional_decisions.json`, ledgerText),
    writeFile(`${outputDir}/regional_manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  process.stdout.write(`V9.7 regional build: ${telemetry.accepted_count}/${telemetry.input_count} accepted; ${JSON.stringify(telemetry.by_region)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
