"""Successor editions must preserve the approved compact shell and frozen parent."""
import sys
from pathlib import Path
import pytest
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT / "automation/pipeline_release"))
import new_version

@pytest.mark.parametrize("parent_id,version,next_version", [("202611161757", "V9.28", "V9.29"), ("202611161747", "V9.27", "V9.29"), ("202611162354", "V9.29", "V9.30")])
def test_create_successor_from_real_compact_or_legacy_shell(tmp_path, monkeypatch, parent_id, version, next_version):
    """The approved compact shell has no former giant h1/strong metadata line."""
    source = ROOT / "uk_renewables_pipeline" / parent_id
    parent = tmp_path / parent_id
    (parent / "tests").mkdir(parents=True)
    original = (source / "index.html").read_bytes()
    (parent / "index.html").write_bytes(original)
    suffix = version.removeprefix("V").replace(".", "_")
    for name in (f"run_v{suffix}.sh", f"check_v{suffix}.mjs"):
        (parent / "tests" / name).write_bytes((source / "tests" / name).read_bytes())
    monkeypatch.setattr(new_version, "PIPELINE", tmp_path)
    monkeypatch.setattr(new_version, "load_registry", lambda: {"fixture_owner": "202611132345", "versions": [
        {"id": parent_id, "version": version, "runner": f"tests/run_v{suffix}.sh"}]})
    monkeypatch.setattr(new_version, "tree_hash", lambda _: "f" * 40)
    new_version.create("202611170001", next_version, "Existing source layers", "RELEASE CANDIDATE")
    result = (tmp_path / "202611170001/index.html").read_text(encoding="utf8")
    assert (parent / "index.html").read_bytes() == original
    assert '<a href="../' + parent_id + '/">' in result
    next_suffix = next_version.removeprefix("V").replace(".", "_")
    assert (tmp_path / f"202611170001/tests/run_v{next_suffix}.sh").exists()
    assert (tmp_path / f"202611170001/tests/check_v{next_suffix}.mjs").exists()
    if version in ("V9.28", "V9.29"):
        assert 'data-edition="202611170001"' in result
        assert f'<title>GlobalGrid2050 | Pipeline News {next_version} · 202611170001</title>' in result
        assert f'<small>PIPELINE NEWS · {next_version}</small>' in result
        assert result.count('<section') == 2
        if version == "V9.29":
            assert '<aside' not in result
            navigation = result.split('<nav class="release-links"', 1)[1].split('</nav>', 1)[0]
            assert navigation.count('<a ') == 6
            assert navigation.count('../versions.html') == 1
            assert navigation.count('PREVIOUS EDITION') == 1
    else:
        assert '<h1>UK RENEWABLES PIPELINE 202611170001</h1>' in result
        assert 'V9.29 RELEASE CANDIDATE · REPD Q3 2026' in result

