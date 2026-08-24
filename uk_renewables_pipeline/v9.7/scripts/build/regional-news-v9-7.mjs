import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { committedJsonItemsV9_7 } from "../news/adapters/committed-json-v9-7.mjs";
import { CLASSIFIER_VERSION } from "../news/classifier-v9-7.mjs";
import { buildRegionalArtifactsV9_7 } from "../news/ledger-v9-7.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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
  const inputPath = `${repoRoot}${sourceMeta.input}`;
  const inputText = await readFile(inputPath, "utf8");
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
