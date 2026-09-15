#!/usr/bin/env python3
"""Unit tests for scripts/make_publication.py.

The tests build throwaway git repositories rather than mocking git, because the
whole point of the generator is that it reads the object database instead of
the working copy -- a mocked git would test the wrong thing. In particular
`test_crlf_working_copy_does_not_change_the_manifest` reproduces the exact
defect that produced the three bad declarations: a file whose on-disk bytes are
CRLF while its blob is LF. If the generator ever regresses to hashing the disk,
that test fails.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_publication as mp


def git(repo, *args):
    subprocess.run(["git", *args], cwd=repo, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def make_repo(files, stamp="testcode/202601010000"):
    """Create a temp repo containing `files` (repo-relative -> bytes)."""
    root = Path(tempfile.mkdtemp(prefix="mkpub-"))
    git(root, "init", "-q")
    git(root, "config", "user.email", "t@example.invalid")
    git(root, "config", "user.name", "t")
    git(root, "config", "core.autocrlf", "false")
    for rel, blob in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(blob)
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "seed")
    return root, root / stamp


LF_BODY = b'{\n  "a": 1,\n  "b": 2\n}\n'
CRLF_BODY = LF_BODY.replace(b"\n", b"\r\n")


class ManifestGenerationTests(unittest.TestCase):
    def test_writes_declarations_matching_the_committed_blobs(self):
        root, stamp = make_repo({
            "testcode/202601010000/result.json": LF_BODY,
            "testcode/202601010000/README.md": b"hello\n",
        })
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=False, quiet=True))
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        by_path = {e["path"]: e for e in doc["files"]}
        # A folder with no prior manifest gets the archive's dominant
        # convention: paths relative to the stamp folder.
        self.assertEqual({"README.md", "result.json"}, set(by_path))
        self.assertEqual(len(LF_BODY), by_path["result.json"]["bytes"])
        self.assertEqual(hashlib.sha256(LF_BODY).hexdigest(),
                         by_path["result.json"]["sha256"])
        self.assertEqual(mp.SCHEMA, doc["schema"])
        self.assertEqual("202601010000", doc["stamp"])

    def test_manifest_never_declares_itself(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertNotIn("publication.json",
                         [os.path.basename(e["path"]) for e in doc["files"]])

    def test_is_idempotent_byte_for_byte(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        first = (stamp / "publication.json").read_bytes()
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        self.assertEqual(first, (stamp / "publication.json").read_bytes())
        git(root, "add", "-A")
        git(root, "commit", "-q", "-m", "manifest")
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))

    def test_output_has_lf_endings_and_one_trailing_newline(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        raw = (stamp / "publication.json").read_bytes()
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"}\n"))
        self.assertFalse(raw.endswith(b"\n\n"))

    def test_narrative_fields_survive_regeneration(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        (stamp / "publication.json").write_bytes(json.dumps({
            "schema": mp.SCHEMA,
            "stamp": "202601010000",
            "status": "test-only candidate; not promoted",
            "limitations": ["served-byte check pending"],
            "files": [],
        }, indent=2).encode("utf-8") + b"\n")
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertEqual("test-only candidate; not promoted", doc["status"])
        self.assertEqual(["served-byte check pending"], doc["limitations"])
        self.assertEqual(1, len(doc["files"]))


class CheckModeTests(unittest.TestCase):
    def test_check_fails_when_a_declaration_was_hand_edited(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        doc["files"][0]["bytes"] = 999
        (stamp / "publication.json").write_bytes(
            json.dumps(doc, indent=2).encode("utf-8") + b"\n")
        self.assertEqual(1, mp.process(str(stamp), "HEAD", check=True, quiet=True))

    def test_check_fails_when_the_manifest_is_missing(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        self.assertEqual(1, mp.process(str(stamp), "HEAD", check=True, quiet=True))

    def test_check_fails_when_a_tracked_file_is_undeclared(self):
        root, stamp = make_repo({
            "testcode/202601010000/a.txt": b"a\n",
            "testcode/202601010000/b.txt": b"b\n",
        })
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        doc["files"] = [e for e in doc["files"] if not e["path"].endswith("b.txt")]
        (stamp / "publication.json").write_bytes(
            json.dumps(doc, indent=2).encode("utf-8") + b"\n")
        self.assertEqual(1, mp.process(str(stamp), "HEAD", check=True, quiet=True))


class CrlfRegressionTests(unittest.TestCase):
    """The defect this script exists to prevent."""

    def test_crlf_working_copy_does_not_change_the_manifest(self):
        root, stamp = make_repo({"testcode/202601010000/result.json": LF_BODY})
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        clean = (stamp / "publication.json").read_bytes()

        # Simulate a Windows checkout with core.autocrlf=true: the blob stays
        # LF, the file on disk becomes CRLF.
        (stamp / "result.json").write_bytes(CRLF_BODY)
        self.assertNotEqual(LF_BODY, (stamp / "result.json").read_bytes())

        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        self.assertEqual(clean, (stamp / "publication.json").read_bytes())
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))

    def test_a_crlf_derived_declaration_is_detected_and_classified(self):
        root, stamp = make_repo({"testcode/202601010000/result.json": LF_BODY})
        (stamp / "publication.json").write_bytes(json.dumps({
            "schema": mp.SCHEMA,
            "stamp": "202601010000",
            "files": [{
                "path": "testcode/202601010000/result.json",
                "bytes": len(CRLF_BODY),
                "sha256": hashlib.sha256(CRLF_BODY).hexdigest(),
            }],
        }, indent=2).encode("utf-8") + b"\n")
        self.assertEqual(1, mp.process(str(stamp), "HEAD", check=True, quiet=True))
        note = mp.classify(
            {"bytes": len(CRLF_BODY), "sha256": hashlib.sha256(CRLF_BODY).hexdigest()},
            len(LF_BODY), hashlib.sha256(LF_BODY).hexdigest(), LF_BODY,
        )
        self.assertIn("CRLF drift, proven", note)
        self.assertIn(str(LF_BODY.count(b"\n")), note)

    def test_a_plain_wrong_byte_count_is_not_blamed_on_crlf(self):
        note = mp.classify(
            {"bytes": 999, "sha256": hashlib.sha256(LF_BODY).hexdigest()},
            len(LF_BODY), hashlib.sha256(LF_BODY).hexdigest(), LF_BODY,
        )
        self.assertNotIn("CRLF", note)
        self.assertIn("byte count", note)

    def test_an_unrelated_digest_is_not_blamed_on_crlf(self):
        note = mp.classify(
            {"bytes": 40, "sha256": hashlib.sha256(b"something else\n").hexdigest()},
            len(LF_BODY), hashlib.sha256(LF_BODY).hexdigest(), LF_BODY,
        )
        self.assertIn("not a CRLF expansion", note)

    def test_crlf_expansion_arithmetic_is_one_byte_per_line_ending(self):
        self.assertEqual(len(LF_BODY) + LF_BODY.count(b"\n"), len(CRLF_BODY))


class ArchiveShapeTests(unittest.TestCase):
    """The archive holds two path conventions and two `files` shapes.

    A --check that rewrote either would report drift on folders whose digests
    are entirely correct, so both must be inferred and reproduced.
    """

    def _seed(self, files_block):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        (stamp / "publication.json").write_bytes(json.dumps({
            "schema": mp.SCHEMA, "stamp": "202601010000", "files": files_block,
        }, indent=2).encode("utf-8") + b"\n")
        return root, stamp

    def test_stamp_relative_paths_are_preserved(self):
        sha = hashlib.sha256(b"a\n").hexdigest()
        root, stamp = self._seed([{"path": "a.txt", "bytes": 2, "sha256": sha}])
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertEqual(["a.txt"], [e["path"] for e in doc["files"]])

    def test_repo_root_relative_paths_are_preserved(self):
        sha = hashlib.sha256(b"a\n").hexdigest()
        root, stamp = self._seed([{"path": "testcode/202601010000/a.txt",
                                   "bytes": 2, "sha256": sha}])
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertEqual(["testcode/202601010000/a.txt"], [e["path"] for e in doc["files"]])

    def test_dict_keyed_files_block_is_preserved(self):
        sha = hashlib.sha256(b"a\n").hexdigest()
        root, stamp = self._seed({"a.txt": {"bytes": 2, "sha256": sha}})
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertIsInstance(doc["files"], dict)
        self.assertEqual(2, doc["files"]["a.txt"]["bytes"])

    def test_check_passes_on_correct_digests_but_strict_flags_formatting(self):
        sha = hashlib.sha256(b"a\n").hexdigest()
        root, stamp = self._seed({"a.txt": {"sha256": sha, "bytes": 2}})
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))
        self.assertEqual(1, mp.process(str(stamp), "HEAD", check=True, strict=True, quiet=True))

    def test_existing_entry_order_is_preserved_so_regeneration_is_a_no_op(self):
        root, stamp = make_repo({
            "testcode/202601010000/a.txt": b"a\n",
            "testcode/202601010000/z.txt": b"z\n",
        })
        # deliberately unsorted, as several archived manifests are
        (stamp / "publication.json").write_bytes(json.dumps({
            "schema": mp.SCHEMA, "stamp": "202601010000", "files": {
                "z.txt": {"bytes": 2, "sha256": hashlib.sha256(b"z\n").hexdigest()},
                "a.txt": {"bytes": 2, "sha256": hashlib.sha256(b"a\n").hexdigest()},
            },
        }, indent=2).encode("utf-8") + b"\n")
        before = (stamp / "publication.json").read_bytes()
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        self.assertEqual(before, (stamp / "publication.json").read_bytes())
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, strict=True, quiet=True))

    def test_trailing_narrative_keys_keep_their_place(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        (stamp / "publication.json").write_bytes(json.dumps({
            "schema": mp.SCHEMA, "stamp": "202601010000",
            "files": [{"path": "a.txt", "bytes": 2,
                       "sha256": hashlib.sha256(b"a\n").hexdigest()}],
            "supersedes": "202512310000",
        }, indent=2).encode("utf-8") + b"\n")
        before = (stamp / "publication.json").read_bytes()
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        after = (stamp / "publication.json").read_bytes()
        self.assertEqual(before, after)
        self.assertLess(after.index(b'"files"'), after.index(b'"supersedes"'))

    def test_file_keyed_entries_are_read_and_written_back_as_file(self):
        """Two archived manifests name the path field `file`, not `path`.

        Reading only `path` made the generator call 243 correctly declared
        entries undeclared, which is worse than useless in CI.
        """
        root, stamp = self._seed([{"file": "a.txt", "bytes": 2,
                                   "sha256": hashlib.sha256(b"a\n").hexdigest()}])
        self.assertEqual(0, mp.process(str(stamp), "HEAD", check=True, quiet=True))
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertEqual(["a.txt"], [e["file"] for e in doc["files"]])
        self.assertNotIn("path", doc["files"][0])

    def test_unknown_per_entry_keys_survive(self):
        root, stamp = self._seed([{"file": "a.txt", "bytes": 2,
                                   "sha256": hashlib.sha256(b"a\n").hexdigest(),
                                   "mtime_utc": "2026-09-15T01:12:16.382Z"}])
        mp.process(str(stamp), "HEAD", check=False, quiet=True)
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertEqual("2026-09-15T01:12:16.382Z", doc["files"][0]["mtime_utc"])

    def test_path_style_can_be_forced(self):
        sha = hashlib.sha256(b"a\n").hexdigest()
        root, stamp = self._seed([{"path": "a.txt", "bytes": 2, "sha256": sha}])
        mp.process(str(stamp), "HEAD", check=False, quiet=True, path_style="repo")
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        self.assertEqual(["testcode/202601010000/a.txt"], [e["path"] for e in doc["files"]])


class BatchReaderTests(unittest.TestCase):
    def test_batch_read_matches_single_file_read(self):
        blobs = {
            "testcode/202601010000/a.txt": b"a\n",
            "testcode/202601010000/big.bin": bytes(range(256)) * 400,
            "testcode/202601010000/empty.txt": b"",
            "testcode/202601010000/utf8.txt": "café — ünicode\n".encode("utf-8"),
        }
        root, stamp = make_repo(blobs)
        with mp.BatchReader(str(root)) as reader:
            for rel, expected in blobs.items():
                self.assertEqual(expected, reader.read("HEAD:" + rel), rel)
                self.assertEqual(mp.committed_bytes(str(root), rel, "HEAD"),
                                 reader.read("HEAD:" + rel), rel)

    def test_batch_reader_rejects_a_missing_path(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        with mp.BatchReader(str(root)) as reader:
            with self.assertRaises(mp.GitError):
                reader.read("HEAD:testcode/202601010000/nope.txt")


class IndexRevisionTests(unittest.TestCase):
    def test_empty_rev_reads_the_index_so_a_new_stamp_can_be_manifested(self):
        root, stamp = make_repo({"testcode/202601010000/a.txt": b"a\n"})
        (stamp / "new.txt").write_bytes(b"new\n")
        git(root, "add", "-A")  # staged but not committed
        self.assertEqual(0, mp.process(str(stamp), "", check=False, quiet=True))
        doc = json.loads((stamp / "publication.json").read_text(encoding="utf-8"))
        paths = [e["path"] for e in doc["files"]]
        self.assertIn("new.txt", paths)


if __name__ == "__main__":
    unittest.main(verbosity=2)
