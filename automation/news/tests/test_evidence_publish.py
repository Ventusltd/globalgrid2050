"""Real local bare-repo races: no network and no production refs."""
import subprocess

import pytest

from automation.news.acquisition.publish import REF, publish


def git(folder, *args):
    return subprocess.run(["git", "-C", str(folder), *args], check=True,
                          capture_output=True, text=True).stdout.strip()


@pytest.fixture
def repos(tmp_path):
    remote, writer = tmp_path / "remote.git", tmp_path / "writer"
    git(tmp_path, "init", "--bare", str(remote))
    git(tmp_path, "init", str(writer))
    git(writer, "config", "user.name", "Synthetic test")
    git(writer, "config", "user.email", "test@example.invalid")
    git(writer, "remote", "add", "origin", str(remote))
    return remote, writer


def commit(writer, label):
    (writer / "evidence.txt").write_text(label)
    git(writer, "add", ".")
    git(writer, "commit", "-m", label)
    return git(writer, "rev-parse", "HEAD")


def test_create_and_direct_successor(repos):
    remote, writer = repos
    first = commit(writer, "initial")
    publish(writer, "")
    second = commit(writer, "weekly")
    publish(writer, first)
    assert git(remote, "rev-parse", REF) == second


def test_concurrent_rollback_is_not_undone(repos):
    remote, writer = repos
    first = commit(writer, "initial")
    publish(writer, "")
    restored = commit(writer, "restored-state")
    publish(writer, first)
    commit(writer, "new-snapshot")
    git(remote, "update-ref", REF, first, restored)  # concurrent owner's rollback
    with pytest.raises(subprocess.CalledProcessError):
        publish(writer, restored)
    assert git(remote, "rev-parse", REF) == first


def test_concurrent_creation_rejected(repos):
    remote, writer = repos
    first = commit(writer, "initial")
    publish(writer, "")
    with pytest.raises(subprocess.CalledProcessError):
        # A different newly-created root cannot replace an existing branch.
        git(writer, "checkout", "--orphan", "other-root")
        commit(writer, "other")
        publish(writer, "")
    assert git(remote, "rev-parse", REF) == first


def test_non_descendant_never_reaches_push(repos):
    remote, writer = repos
    first = commit(writer, "initial")
    publish(writer, "")
    commit(writer, "middle")
    commit(writer, "latest")
    with pytest.raises(ValueError, match="direct successor"):
        publish(writer, first)
    assert git(remote, "rev-parse", REF) == first
