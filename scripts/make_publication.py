#!/usr/bin/env python3
"""Generate and verify testcode publication manifests from committed bytes.

WHY THIS EXISTS
---------------
Every digest in this repository is taken over git blob content, which is LF,
and GitHub Pages serves those same bytes. `.gitattributes` now pins the working
copy to LF as well, but that file is a recent fix and it did not retroactively
correct manifests whose numbers were recorded on a CRLF checkout. Three such
declarations exist:

    testcode/202609060432/publication.json  source-manifest.json
    testcode/202609150010/publication.json  merged/result.json
    testcode/202609150010/publication.json  runs/local-result.json

Each declares the size and sha256 of the CRLF expansion of a file. A CRLF
expansion is exactly `len(lf) + <number of line endings>` bytes long and has a
wholly unrelated digest, so those three manifests attest bytes that GitHub
Pages has never served.

The durable fix is not to normalise at the point of comparison -- that was
tried, four times, and each fix only covered one caller -- but to stop the
working copy being a source of digests at all. This generator reads bytes from
the object database (`git cat-file blob`), so the numbers it writes are the
numbers that ship, identically on Windows, on a runner, and in a container.
`--check` re-derives every declaration and exits non-zero on any drift.

WHAT IT PRESERVES
-----------------
The archive holds two path conventions (paths relative to the stamp folder, and
paths relative to the repository root) and two shapes for the `files` block (a
list of objects carrying `path`, and an object keyed by path). Rewriting an
archived manifest into one house style would be a large diff that changes files
nobody has touched, and would make `--check` fail on 49 folders that are in
fact correct. So both conventions are inferred from the manifest already
present and reproduced; only the numbers are recomputed.

USAGE
-----
    python scripts/make_publication.py testcode/202609150010
    python scripts/make_publication.py testcode/202609150010 --check
    python scripts/make_publication.py testcode/*/ --check --quiet

Exit status is 0 when every folder is in order, 1 otherwise.

Dependency-free: the standard library, plus the `git` executable that having a
checkout at all already requires.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys

SCHEMA = "globalgrid2050.testcode-publication.v1"
MANIFEST_NAME = "publication.json"

# A manifest cannot declare its own digest: writing the digest changes the
# bytes the digest is of.
SELF_DESCRIBING = {"publication.json"}


class GitError(Exception):
    pass


# --------------------------------------------------------------------------
# git access -- the only source of bytes
# --------------------------------------------------------------------------

def run_git(args, repo_root, binary=False):
    proc = subprocess.run(["git"] + args, cwd=repo_root,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if proc.returncode != 0:
        raise GitError("git %s: %s" % (" ".join(args),
                                       proc.stderr.decode("utf-8", "replace").strip()))
    return proc.stdout if binary else proc.stdout.decode("utf-8")


def repo_root_of(path):
    start = path if os.path.isdir(path) else os.path.dirname(path)
    return os.path.abspath(run_git(["rev-parse", "--show-toplevel"], start).strip())


def committed_bytes(repo_root, rel_path, rev):
    """Bytes of rel_path exactly as git stores them.

    `rev` may be any commit-ish, or the empty string meaning the index -- the
    index form lets a new stamp folder be manifested in the same commit that
    adds it, which is the normal publishing case.
    """
    return run_git(["cat-file", "blob", "%s:%s" % (rev, rel_path)], repo_root, binary=True)


class BatchReader:
    """One `git cat-file --batch` process for a whole folder.

    Spawning a git process per file costs more than reading the files: the
    first version of this script took minutes to sweep the archive on Windows,
    which is long enough that nobody would put it in CI, and a check nobody
    runs prevents nothing.
    """

    def __init__(self, repo_root):
        self.proc = subprocess.Popen(
            ["git", "cat-file", "--batch"], cwd=repo_root,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def read(self, spec):
        self.proc.stdin.write(spec.encode("utf-8") + b"\n")
        self.proc.stdin.flush()
        header = self.proc.stdout.readline().decode("utf-8", "replace").strip()
        parts = header.split()
        if len(parts) < 3 or parts[1] != "blob":
            raise GitError("cat-file --batch: %r -> %r" % (spec, header))
        size = int(parts[2])
        buf = b""
        while len(buf) < size:
            chunk = self.proc.stdout.read(size - len(buf))
            if not chunk:
                raise GitError("cat-file --batch: short read for %r" % spec)
            buf += chunk
        self.proc.stdout.read(1)  # trailing newline git appends
        return buf

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:  # noqa: BLE001
            self.proc.kill()
        finally:
            for s in (self.proc.stdout, self.proc.stderr):
                try:
                    s.close()
                except Exception:  # noqa: BLE001
                    pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


def tracked_files(repo_root, stamp_rel, rev):
    if rev:
        out = run_git(["ls-tree", "-r", "--name-only", rev, "--", stamp_rel], repo_root)
    else:
        out = run_git(["ls-files", "--cached", "--", stamp_rel], repo_root)
    paths = [p.strip() for p in out.replace("\r\n", "\n").split("\n") if p.strip()]
    return sorted(p for p in paths if os.path.basename(p) not in SELF_DESCRIBING)


# --------------------------------------------------------------------------
# reading whatever shape the existing manifest happens to use
# --------------------------------------------------------------------------

# The archive names the path field two ways. Both are read; whichever a
# manifest already uses is the one written back.
PATH_KEYS = ("path", "file")


def entry_path_key(doc):
    f = (doc or {}).get("files")
    if isinstance(f, list):
        for e in f:
            if isinstance(e, dict):
                for k in PATH_KEYS:
                    if e.get(k):
                        return k
    return "path"


def declared_entries(doc):
    """{declared_path: {"bytes": int|None, "sha256": str|None, "_extra": {...}}}.

    `_extra` carries per-entry keys this generator does not derive (an
    `mtime_utc`, say) so that regenerating an archived manifest does not strip
    fields somebody put there on purpose.
    """
    out = {}
    f = (doc or {}).get("files")

    def norm(e, p):
        extra = {k: v for k, v in e.items()
                 if k not in ("bytes", "sha256") and k not in PATH_KEYS}
        return {"bytes": e.get("bytes"),
                "sha256": (e.get("sha256") or "").lower() or None,
                "_extra": extra}

    if isinstance(f, list):
        for e in f:
            if not isinstance(e, dict):
                continue
            p = next((e[k] for k in PATH_KEYS if e.get(k)), None)
            if p:
                out[p] = norm(e, p)
    elif isinstance(f, dict):
        for p, e in f.items():
            if isinstance(e, dict):
                out[p] = norm(e, p)
    return out


def same_declaration(a, b):
    """Digest comparison only -- `_extra` is metadata, not an attestation."""
    return a["bytes"] == b["bytes"] and a["sha256"] == b["sha256"]


def detect_style(doc, stamp_rel):
    """('list'|'dict', 'stamp'|'repo') inferred from the manifest present."""
    f = (doc or {}).get("files")
    shape = "dict" if isinstance(f, dict) else "list"
    paths = list(declared_entries(doc))
    prefix = stamp_rel.rstrip("/") + "/"
    if paths and all(p.startswith(prefix) for p in paths):
        return shape, "repo"
    return shape, "stamp"


def to_declared_path(repo_rel, stamp_rel, path_style):
    if path_style == "repo":
        return repo_rel
    return os.path.relpath(repo_rel, stamp_rel).replace(os.sep, "/")


# --------------------------------------------------------------------------
# building and rendering
# --------------------------------------------------------------------------

def build(repo_root, stamp_rel, rev, existing_doc, shape, path_style, pkey="path"):
    blobs = {}
    rows = []
    with BatchReader(repo_root) as reader:
        for repo_rel in tracked_files(repo_root, stamp_rel, rev):
            blob = reader.read("%s:%s" % (rev, repo_rel))
            blobs[repo_rel] = blob
            rows.append((to_declared_path(repo_rel, stamp_rel, path_style), repo_rel,
                         len(blob), hashlib.sha256(blob).hexdigest()))
    if not rows:
        raise GitError("no tracked files under %s at rev %r" % (stamp_rel, rev or "<index>"))

    # New folders get sorted order, which is deterministic. An existing
    # manifest keeps the order it already has, with any newly tracked file
    # appended in sorted order, so that regenerating a manifest whose digests
    # are already right rewrites nothing at all. A no-op regeneration is what
    # makes it safe to run this over the whole archive.
    prior_entries = declared_entries(existing_doc)
    prior = list(prior_entries)
    if prior:
        rank = {p: i for i, p in enumerate(prior)}
        rows.sort(key=lambda r: (rank.get(r[0], len(rank)), r[0]))

    def extra_for(decl):
        return prior_entries.get(decl, {}).get("_extra") or {}

    if shape == "dict":
        files = {}
        for decl, _repo_rel, n, sha in rows:
            files[decl] = {"bytes": n, "sha256": sha, **extra_for(decl)}
    else:
        files = [{pkey: decl, "bytes": n, "sha256": sha, **extra_for(decl)}
                 for decl, _repo_rel, n, sha in rows]

    doc = {}
    if isinstance(existing_doc, dict):
        # Narrative fields -- name, status, limitations, source commit -- are
        # the point of the manifest and must survive regeneration untouched,
        # in their original order. Only the derived block is recomputed, and
        # no key is added: an archived manifest that has always lacked
        # `schema` should not acquire one merely because its digests were
        # re-verified. Regeneration of a correct manifest is then a no-op.
        # `files` keeps its original position too, so a manifest that carries
        # trailing narrative (`supersedes`, `changes_from_*`) is not reordered.
        for k, v in existing_doc.items():
            doc[k] = files if k == "files" else v
        if "files" not in doc:
            doc["files"] = files
        return doc, blobs, {decl: repo_rel for decl, repo_rel, _n, _s in rows}

    doc["schema"] = SCHEMA
    doc["stamp"] = os.path.basename(stamp_rel)
    doc["files"] = files
    return doc, blobs, {decl: repo_rel for decl, repo_rel, _n, _s in rows}


def render(doc):
    """Deterministic bytes: 2-space indent, LF endings, one trailing newline.

    Emitted as bytes, never through text mode, so the platform's own newline
    translation cannot reintroduce the very defect this script removes.
    """
    text = json.dumps(doc, indent=2, ensure_ascii=False)
    return text.replace("\r\n", "\n").encode("utf-8") + b"\n"


def load_existing(manifest_abs):
    if not os.path.isfile(manifest_abs):
        return None, None
    with open(manifest_abs, "rb") as fh:
        raw = fh.read()
    try:
        return json.loads(raw.decode("utf-8")), raw
    except (ValueError, UnicodeDecodeError):
        return None, raw


# --------------------------------------------------------------------------
# classification -- never guess CRLF, prove it
# --------------------------------------------------------------------------

def crlf_expansion(blob):
    """The bytes a core.autocrlf=true Windows checkout puts on disk."""
    return blob.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")


def classify(declared, actual_bytes, actual_sha, blob=None):
    """Name the cause. CRLF is claimed only when the CRLF digest proves it.

    A byte delta alone is suggestive, not evidence -- a file can equally have
    been edited. The declaration is CRLF-derived if and only if hashing the
    CRLF expansion of the committed blob reproduces the declared sha256.
    """
    db, dsha = declared.get("bytes"), declared.get("sha256")
    if blob is not None:
        crlf = crlf_expansion(blob)
        if dsha == hashlib.sha256(crlf).hexdigest() and (db is None or db == len(crlf)):
            return ("CRLF drift, proven: the CRLF expansion of the committed blob is "
                    "exactly %d bytes (%d LF + %d line endings) and hashes to the "
                    "declared sha256" % (len(crlf), len(blob), len(crlf) - len(blob)))
        if dsha == actual_sha:
            return "digest agrees; only the declared byte count is wrong"
        return ("not a CRLF expansion: the declared digest matches neither the committed "
                "blob nor its CRLF form")
    if isinstance(db, int) and db > actual_bytes and dsha != actual_sha:
        return ("byte count is %d higher than the blob, consistent with a CRLF expansion "
                "of a %d-byte file holding %d line endings; unverified, blob unavailable"
                % (db - actual_bytes, actual_bytes, db - actual_bytes))
    return "cause unclassified"


# --------------------------------------------------------------------------
# the two modes
# --------------------------------------------------------------------------

def process(stamp_dir, rev="HEAD", check=False, strict=False, quiet=False,
            path_style="auto", out=None):
    out = out or sys.stdout
    stamp_abs = os.path.abspath(stamp_dir).rstrip(os.sep)
    repo_root = repo_root_of(stamp_abs)
    stamp_rel = os.path.relpath(stamp_abs, repo_root).replace(os.sep, "/")
    manifest_abs = os.path.join(stamp_abs, MANIFEST_NAME)

    existing_doc, existing_raw = load_existing(manifest_abs)
    shape, inferred = detect_style(existing_doc, stamp_rel)
    style = inferred if path_style == "auto" else path_style

    doc, blobs, decl_to_repo = build(repo_root, stamp_rel, rev, existing_doc, shape, style,
                                     entry_path_key(existing_doc))
    new_raw = render(doc)
    truth = declared_entries(doc)

    if not check:
        if existing_raw == new_raw:
            if not quiet:
                out.write("ok    %s unchanged (%d files)\n" % (stamp_rel, len(truth)))
            return 0
        with open(manifest_abs, "wb") as fh:
            fh.write(new_raw)
        out.write("wrote %s/%s (%d files)\n" % (stamp_rel, MANIFEST_NAME, len(truth)))
        return 0

    if existing_raw is None:
        out.write("DRIFT %s: no %s\n" % (stamp_rel, MANIFEST_NAME))
        return 1
    if existing_doc is None:
        out.write("DRIFT %s: %s is not valid JSON\n" % (stamp_rel, MANIFEST_NAME))
        return 1

    old = declared_entries(existing_doc)
    problems = 0
    lines = []
    for p in sorted(set(old) | set(truth)):
        o, n = old.get(p), truth.get(p)
        if o is None:
            problems += 1
            lines.append("  + %s  tracked but undeclared: %d bytes / %s"
                         % (p, n["bytes"], n["sha256"]))
            continue
        if n is None:
            problems += 1
            lines.append("  - %s  declared but not tracked at %s" % (p, rev or "<index>"))
            continue
        if not same_declaration(o, n):
            problems += 1
            blob = blobs.get(decl_to_repo.get(p))
            lines.append("  ! %s" % p)
            lines.append("      declared %s bytes / %s" % (o["bytes"], o["sha256"]))
            lines.append("      actual   %s bytes / %s" % (n["bytes"], n["sha256"]))
            lines.append("      %s" % classify(o, n["bytes"], n["sha256"], blob))

    formatting_differs = existing_raw != new_raw
    if problems:
        out.write("DRIFT %s\n" % stamp_rel)
        out.write("\n".join(lines) + "\n")
        return 1
    if strict and formatting_differs:
        out.write("DRIFT %s: every digest agrees, but the manifest is not byte-identical "
                  "to the generated form (--strict)\n" % stamp_rel)
        return 1
    if not quiet:
        note = "" if not formatting_differs else "; house formatting differs"
        out.write("ok    %s (%d files%s)\n" % (stamp_rel, len(truth), note))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Publication manifests from committed bytes.")
    ap.add_argument("stamp_dirs", nargs="+", help="testcode/<stamp> folders")
    ap.add_argument("--check", action="store_true",
                    help="verify only; write nothing; exit 1 on any drift")
    ap.add_argument("--strict", action="store_true",
                    help="with --check, also require byte-identical house formatting")
    ap.add_argument("--rev", default="HEAD",
                    help="revision to read bytes from; '' means the git index")
    ap.add_argument("--path-style", choices=("auto", "stamp", "repo"), default="auto",
                    help="declared path convention; auto follows the existing manifest")
    ap.add_argument("--quiet", action="store_true", help="print only drift")
    args = ap.parse_args(argv)

    worst = 0
    for d in args.stamp_dirs:
        if not os.path.isdir(d):
            print("DRIFT %s: not a directory" % d)
            worst = 1
            continue
        try:
            worst = max(worst, process(d, args.rev, args.check, args.strict,
                                       args.quiet, args.path_style))
        except GitError as exc:
            print("ERROR %s: %s" % (d, exc))
            worst = 1
    return worst


if __name__ == "__main__":
    sys.exit(main())
