"""Publish one evidence commit with an exact-ref lease and no history rewrite."""
import argparse
import re
import subprocess

REF = "refs/heads/pipeline-evidence-data"


def publish(repository, expected_head, remote="origin"):
    if expected_head and not re.fullmatch(r"[0-9a-f]{40}", expected_head):
        raise ValueError("Expected a full restored commit SHA or empty new-branch lease")

    def git(*args):
        return subprocess.run(["git", "-C", str(repository), *args], check=True,
                              capture_output=True, text=True).stdout.strip()

    ancestry = git("rev-list", "--parents", "-n", "1", "HEAD").split()
    # Only a direct successor of the restored state (or a root initial commit)
    # may be published. The lease flag is a CAS, never permission to rewrite.
    if ancestry[1:] != ([expected_head] if expected_head else []):
        raise ValueError("Publication must be one direct successor of restored state")
    return git("push", f"--force-with-lease={REF}:{expected_head}", remote, f"HEAD:{REF}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository")
    parser.add_argument("expected_head")
    args = parser.parse_args()
    publish(args.repository, args.expected_head)
