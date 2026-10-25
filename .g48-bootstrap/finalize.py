from __future__ import annotations

import base64
import hashlib
import lzma
import shutil
from pathlib import Path
import subprocess

REPO = Path.cwd()
BASE_COMMIT = "dec6ae5965b443ed0b8baabf05f750e33b403067"
EXPECTED_TREE = "c425df0cf0edd2c652212e0f2991a13d3dba9809"
EXPECTED_XZ_SHA256 = "ceb5fd6a4fe417bdf473573dc8685a88602cc9d5204d927bd01f70702d693234"
EXPECTED_PATCH_SHA256 = "e4bca0886cf5bc5df6cb75987610357ca8a63d31377f5dfb8d3029bf411bcb52"
BOOTSTRAP = REPO / ".g48-bootstrap"
WORKFLOWS = (
    ".github/workflows/jenios-g48-bootstrap.yml",
    ".github/workflows/jenios-g48-finalize.yml",
)
FINAL_WORKFLOW = ".github/workflows/jenios-inter-vault-g48.yml"


def run(*args: str, capture: bool = True) -> str:
    r = subprocess.run(args, cwd=REPO, check=True, text=True, stdout=subprocess.PIPE if capture else None)
    return r.stdout.strip() if capture else ""


run("git", "merge-base", "--is-ancestor", BASE_COMMIT, "HEAD")
parts = [BOOTSTRAP / f"patch{i:02d}" for i in range(9)]
if [p.stat().st_size for p in parts] != [10000] * 8 + [9592]:
    raise RuntimeError("G48 patches missing or incomplete")
compressed = base64.b64decode(b"".join(p.read_bytes() for p in parts), validate=True)
if hashlib.sha256(compressed).hexdigest() != EXPECTED_XZ_SHA256:
    raise RuntimeError("G48 compressed checksum mismatch")
patch = lzma.decompress(compressed)
if hashlib.sha256(patch).hexdigest() != EXPECTED_PATCH_SHA256:
    raise RuntimeError("G48 source patch checksum mismatch")
path = Path("/tmp/jenios-g48-certified.patch")
path.write_bytes(patch)
run("git", "apply", "--check", str(path), capture=False)
run("git", "apply", "--index", str(path), capture=False)

# Verify the complete reviewed final state before publishing *any* source.
shutil.rmtree(BOOTSTRAP)
for name in WORKFLOWS:
    (REPO / name).unlink(missing_ok=True)
run("git", "add", "-A", capture=False)
actual = run("git", "write-tree")
print(f"G48_EXACT_TREE: expected={EXPECTED_TREE} actual={actual}")
if actual != EXPECTED_TREE:
    raise RuntimeError("G48 tree mismatch: do not publish")
run("node", "scripts/check-inter-vault-g48.mjs", capture=False)
run("git", "diff", "--cached", "--check", capture=False)

# Reintroduce temporary scaffolding from the current branch solely to avoid
# modifying .github/workflows with a token lacking workflow write permission.
run("git", "restore", "--source=HEAD", "--staged", "--worktree", "--", ".g48-bootstrap", *WORKFLOWS, capture=False)
(REPO / FINAL_WORKFLOW).unlink(missing_ok=True)
run("git", "add", "-A", capture=False)
changed = run("git", "diff", "--cached", "--name-only").splitlines()
if len(changed) != 26 or any(x.startswith(".github/workflows/") or x.startswith(".g48-bootstrap/") for x in changed):
    raise RuntimeError(f"unexpected staged changes: {changed}")
run("git", "diff", "--cached", "--check", capture=False)
run("git", "config", "user.name", "jenios-release-bot", capture=False)
run("git", "config", "user.email", "jenios-release-bot@users.noreply.github.com", capture=False)
run("git", "commit", "-m", "fix(jenios): stage 26 G48 certified non-workflow files", capture=False)
run("git", "push", "origin", "HEAD:fix/jenios-g48-inter-vault-20261025", capture=False)
print("G48_CERTIFIED_26_BLOBS_ON_REMOTE")
