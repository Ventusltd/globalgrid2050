"""Shared helpers for the Pipeline News release train (standard library only)."""
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PIPELINE = ROOT / "uk_renewables_pipeline"
REGISTRY = HERE / "registry.json"
SKIP_PARTS = {"__pycache__", "node_modules"}


def walk(folder: Path):
    """Relative paths of every release file, sorted, as the runners walk them."""
    out = []
    for path in folder.rglob("*"):
        if not path.is_file() or path.suffix == ".pyc" or SKIP_PARTS & set(path.parts):
            continue
        out.append(path.relative_to(folder).as_posix())
    return sorted(out)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def tree_hash(version_id: str, root: Path = ROOT) -> str:
    """Git tree hash of the bytes ON DISK of one version folder (same method as the runners)."""
    rel = f"uk_renewables_pipeline/{version_id}"
    files = [f"{rel}/{p}" for p in walk(root / rel)]
    with tempfile.TemporaryDirectory() as scratch:
        env = dict(os.environ, GIT_DIR=f"{scratch}/objects.git", GIT_WORK_TREE=str(root), GIT_INDEX_FILE=f"{scratch}/index")
        subprocess.run(["git", "init", "-q", "--bare", f"{scratch}/objects.git"], check=True, env={k: v for k, v in os.environ.items() if not k.startswith("GIT_")})
        subprocess.run(["git", "-C", str(root), "-c", "core.autocrlf=false", "-c", "core.fileMode=true", "update-index", "--add", "-z", "--stdin"],
                       input=("\0".join(files) + "\0").encode("utf-8"), check=True, env=env)
        # Windows cannot recover executable bits from disk. Preserve tracked
        # modes; new release runners are executable by the release contract.
        if os.name == "nt":
            tracked = subprocess.run(["git", "-C", str(root), "ls-files", "-s", "-z", "--", rel],
                                     check=True, capture_output=True).stdout
            modes = {entry.split(b"\t", 1)[1].decode(): entry.split(b" ", 1)[0].decode()
                     for entry in tracked.split(b"\0") if entry}
            for path in files:
                mode = modes.get(path, "100755" if re_runner(path) else "100644")
                subprocess.run(["git", "update-index", "--chmod=" + ("+x" if mode == "100755" else "-x"), path],
                               check=True, env=env, cwd=root)
        return subprocess.run(["git", "write-tree", f"--prefix={rel}/"], check=True, env=env, capture_output=True, text=True).stdout.strip()


def re_runner(path):
    import re
    return bool(re.search(r"/tests/run_v9_\d+\.sh$", path))


def data_digest(folder: Path) -> str:
    """One hash over every file under data/ (path and sha256), to compare a version with its parent."""
    h = hashlib.sha256()
    for rel in walk(folder / "data"):
        h.update(f"{rel} {sha256(folder / 'data' / rel)}\n".encode())
    return h.hexdigest()


def load_registry():
    return json.loads(REGISTRY.read_text())


def save_registry(reg):
    REGISTRY.write_text(json.dumps(reg, indent=1, ensure_ascii=False) + "\n")
