from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def capacity(feature: dict[str, Any]) -> float:
    value = (feature.get("properties") or {}).get("capacity")
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class Gate:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []
        self.metrics: dict[str, Any] = {}

    def require(self, name: str, actual: Any, expected: Any) -> None:
        passed = actual == expected
        self.checks.append({"name": name, "passed": passed, "actual": actual, "expected": expected})

    def require_true(self, name: str, condition: bool, detail: str = "") -> None:
        self.checks.append({"name": name, "passed": bool(condition), "detail": detail})

    @property
    def passed(self) -> bool:
        return all(check["passed"] for check in self.checks)


def check_files(root: Path, contract: dict[str, Any], gate: Gate) -> None:
    readme = root / contract["governing_readme"]["path"]
    gate.require("governing README SHA-256", sha256(readme), contract["governing_readme"]["sha256"])
    text = readme.read_text(encoding="utf-8")
    for phrase in contract["required_readme_phrases"]:
        gate.require_true(f"README phrase: {phrase}", phrase in text)

    for group in ("historical_files", "immutable_fixture_files"):
        for relative, expected in contract[group].items():
            path = root / relative
            gate.require_true(f"file exists: {relative}", path.is_file())
            if path.is_file():
                gate.require(f"file SHA-256: {relative}", sha256(path), expected)

    for relative in contract["runtime_data_paths"]:
        gate.require_true(f"runtime source exists: {relative}", (root / relative).is_file())


def check_legacy_workflows(root: Path, contract: dict[str, Any], gate: Gate) -> None:
    for relative in contract["manual_only_legacy_workflows"]:
        path = root / relative
        gate.require_true(f"manual-only workflow exists: {relative}", path.is_file())
        if not path.is_file():
            continue
        triggers: list[str] = []
        inside_on = False
        for line in path.read_text(encoding="utf-8").splitlines():
            if line == "on:":
                inside_on = True
                continue
            if inside_on and line and not line.startswith(" "):
                break
            if inside_on and line.startswith("  ") and not line.startswith("    ") and line.rstrip().endswith(":"):
                triggers.append(line.strip()[:-1])
        gate.require(f"manual-only workflow triggers: {relative}", triggers, ["workflow_dispatch"])


def check_legacy_universe(root: Path, contract: dict[str, Any], fixtures: dict[str, Any], gate: Gate) -> None:
    master = load_json(root / contract["fixture_roles"]["v5_geojson"])
    features = master.get("features") or []
    display = []
    for feature in features:
        props = feature.get("properties") or {}
        if capacity(feature) >= 1 and props.get("tech") in {"solar", "solar_roof", "bess", "wind"}:
            display.append(feature)

    def count_tech(names: set[str]) -> int:
        return sum(1 for feature in display if (feature.get("properties") or {}).get("tech") in names)

    raw_solar = sum(
        1 for feature in features
        if (feature.get("properties") or {}).get("tech") in {"solar", "solar_roof"} and capacity(feature) > 49
    )
    raw_bess_gt99 = sum(
        1 for feature in features
        if (feature.get("properties") or {}).get("tech") == "bess" and capacity(feature) > 99
    )
    raw_bess_gt100 = sum(
        1 for feature in features
        if (feature.get("properties") or {}).get("tech") == "bess" and capacity(feature) > 100
    )
    actual = {
        "legacy_features": len(features),
        "legacy_display_total": len(display),
        "legacy_display_solar": count_tech({"solar", "solar_roof"}),
        "legacy_display_bess": count_tech({"bess"}),
        "legacy_display_wind": count_tech({"wind"}),
        "v5_raw_solar_gt49": raw_solar,
        "v5_raw_bess_gt99": raw_bess_gt99,
        "v5_raw_bess_gt100": raw_bess_gt100,
        "v5_bess_gt99_minus_gt100": raw_bess_gt99 - raw_bess_gt100,
    }
    for key, value in actual.items():
        gate.require(key, value, fixtures[key])
    gate.metrics.update(actual)


def check_v5_news(root: Path, contract: dict[str, Any], fixtures: dict[str, Any], gate: Gate) -> None:
    news = load_json(root / contract["fixture_roles"]["v5_news"])
    actual = {
        "v5_eligible_projects": news.get("eligible_projects"),
        "v5_headlines": news.get("headline_count"),
        "v5_lookback_days": news.get("lookback_days"),
    }
    gate.require("V5 item array count", len(news.get("items") or []), fixtures["v5_headlines"])
    for key, value in actual.items():
        gate.require(key, value, fixtures[key])
    gate.metrics.update(actual)


def check_v6_identity(root: Path, contract: dict[str, Any], gate: Gate) -> None:
    identity = load_json(root / contract["fixture_roles"]["v6_identity"])
    records = identity.get("records") or []
    by_ref = {str(record.get("repd_ref")): record for record in records}
    gate.require("V6 identity record count", len(records), contract["universe_fixtures"]["v6_identity_records"])
    gate.require("V6 unique REPD Ref count", len(by_ref), contract["universe_fixtures"]["v6_identity_records"])
    gate.require("canonical sentinel record count", len(contract["canonical_sentinels"]), contract["canonical_sentinel_counts"]["repd_records"])
    sentinel_developments = {item["gg_development_id"] for item in contract["canonical_sentinels"]}
    gate.require("canonical sentinel development count", len(sentinel_developments), contract["canonical_sentinel_counts"]["developments"])

    bess = [record for record in records if record.get("technology") == "Battery"]
    bess_gt99 = sum(float(record.get("capacity_mw") or 0) > 99 for record in bess)
    bess_gt100 = sum(float(record.get("capacity_mw") or 0) > 100 for record in bess)
    q2_thresholds = {
        "v7_q2_bess_gt99": bess_gt99,
        "v7_q2_bess_gt100": bess_gt100,
        "v7_q2_bess_gt99_minus_gt100": bess_gt99 - bess_gt100,
    }
    for key, value in q2_thresholds.items():
        gate.require(key, value, contract["universe_fixtures"][key])
    gate.metrics.update(q2_thresholds)

    for expected in contract["canonical_sentinels"]:
        ref = expected["repd_ref"]
        actual = by_ref.get(ref)
        gate.require_true(f"canonical sentinel exists: {ref}", actual is not None)
        if actual is None:
            continue
        fields = {
            "site_name": expected["site_name"],
            "technology": expected["technology"],
            "capacity_mw": expected["capacity_mw"],
            "status": expected["status"],
            "gg_development_id": expected["gg_development_id"],
            "planning_application_reference": expected["planning_reference"],
        }
        for field, value in fields.items():
            gate.require(f"REPD {ref} {field}", actual.get(field), value)
        in_scope = expected["capacity_mw"] > (49 if expected["technology"] == "Solar Photovoltaics" else 99)
        gate.require_true(f"canonical sentinel in V7 utility scope: {ref}", in_scope)


def check_v6_projects(root: Path, contract: dict[str, Any], fixtures: dict[str, Any], gate: Gate) -> None:
    payload = load_json(root / contract["fixture_roles"]["v6_projects"])
    gate.require("V6 project count", payload.get("project_count"), fixtures["v6_project_records"])
    gate.require("V6 solar count", payload.get("solar_count"), fixtures["v6_solar_records"])
    gate.require("V6 BESS count", payload.get("bess_count"), fixtures["v6_bess_records"])
    array_json = json.dumps(payload.get("projects") or [], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    array_sha = hashlib.sha256(array_json.encode("utf-8")).hexdigest()
    gate.require("V6 declared project-array SHA-256", payload.get("projects_sha256"), contract["hash_semantics"]["major_projects_v6_projects_array_sha256"])
    gate.require("V6 recomputed project-array SHA-256", array_sha, contract["hash_semantics"]["major_projects_v6_projects_array_sha256"])
    gate.require("V6 fixture file SHA-256 semantics", sha256(root / contract["fixture_roles"]["v6_projects"]), contract["hash_semantics"]["major_projects_v6_file_sha256"])


def check_phase(root: Path, contract: dict[str, Any], phase: str, gate: Gate) -> None:
    index_path = root / contract["release_baseline"]["index_path"]
    if phase == "pre":
        gate.require("release baseline index SHA-256", sha256(index_path), contract["release_baseline"]["index_sha256"])
        return

    for relative in contract["v7_1_required_files"]:
        gate.require_true(f"V7.1 required file: {relative}", (root / relative).is_file())
    manifest_path = root / "uk_renewables_pipeline/v7/data/build_manifest.json"
    if manifest_path.is_file():
        manifest = load_json(manifest_path)
        gate.require("manifest version", manifest.get("version"), "7.1")
        gate.require("manifest feature", manifest.get("feature"), contract["feature"])
        gate.require("manifest North Star result", manifest.get("north_star"), "PASS")
    index_text = index_path.read_text(encoding="utf-8")
    gate.require_true("V7.1 external stylesheet", 'href="styles/v7.css"' in index_text)
    gate.require_true("V7.1 module entrypoint", 'type="module" src="scripts/app.js"' in index_text)
    gate.require_true("V7.1 has no inline style block", "<style>" not in index_text)


def run_gate(root: Path, contract: dict[str, Any], phase: str) -> Gate:
    gate = Gate()
    check_files(root, contract, gate)
    check_legacy_workflows(root, contract, gate)
    fixtures = contract["universe_fixtures"]
    check_legacy_universe(root, contract, fixtures, gate)
    check_v5_news(root, contract, fixtures, gate)
    check_v6_identity(root, contract, gate)
    check_v6_projects(root, contract, fixtures, gate)
    check_phase(root, contract, phase, gate)
    return gate
