from __future__ import annotations

import base64
import hashlib
import lzma
import os
from pathlib import Path
import shutil
import subprocess

REPO = Path.cwd()
BASE_COMMIT = "dec6ae5965b443ed0b8baabf05f750e33b403067"
EXPECTED_TREE = "c425df0cf0edd2c652212e0f2991a13d3dba9809"
EXPECTED_XZ_SHA256 = "ceb5fd6a4fe417bdf473573dc8685a88602cc9d5204d927bd01f70702d693234"
EXPECTED_PATCH_SHA256 = "e4bca0886cf5bc5df6cb75987610357ca8a63d31377f5dfb8d3029bf411bcb52"


def run(*args: str, env: dict[str, str] | None = None, capture: bool = True) -> str:
    result = subprocess.run(
        args,
        cwd=REPO,
        env=env,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
    )
    return result.stdout.strip() if capture else ""


run("git", "merge-base", "--is-ancestor", BASE_COMMIT, "HEAD")
parts = [REPO / f".g48-bootstrap/patch{index:02d}" for index in range(9)]
if [part.stat().st_size for part in parts] != [10000] * 8 + [9592]:
    raise RuntimeError("segmentos do patch incompletos")
encoded = b"".join(part.read_bytes() for part in parts)
compressed = base64.b64decode(encoded, validate=True)
if hashlib.sha256(compressed).hexdigest() != EXPECTED_XZ_SHA256:
    raise RuntimeError("checksum XZ divergente")
patch = lzma.decompress(compressed)
if hashlib.sha256(patch).hexdigest() != EXPECTED_PATCH_SHA256:
    raise RuntimeError("checksum do patch divergente")
patch_path = Path("/tmp/jenios-g48-certified.patch")
patch_path.write_bytes(patch)

run("git", "apply", "--check", str(patch_path), capture=False)
run("git", "apply", "--index", str(patch_path), capture=False)
shutil.rmtree(REPO / ".g48-bootstrap")
for workflow in (
    REPO / ".github/workflows/jenios-g48-bootstrap.yml",
    REPO / ".github/workflows/jenios-g48-finalize.yml",
):
    workflow.unlink(missing_ok=True)
run("git", "add", "-A", capture=False)

actual_tree = run("git", "write-tree")
print(f"expected_tree={EXPECTED_TREE}")
print(f"actual_tree={actual_tree}")
if actual_tree != EXPECTED_TREE:
    raise RuntimeError("árvore final divergente")

precommit_env = os.environ.copy()
precommit_env["JENIOS_G48_SKIP_GIT_BASELINE"] = "true"
run("node", "scripts/check-inter-vault-g48.mjs", env=precommit_env, capture=False)
run("git", "diff", "--cached", "--check", capture=False)
run("git", "config", "user.name", "jenios-release-bot", capture=False)
run("git", "config", "user.email", "jenios-release-bot@users.noreply.github.com", capture=False)
run("git", "commit", "-m", "fix(jenios): G48 install isolated Inter Vault and Master setup", capture=False)

if run("git", "rev-parse", "HEAD^{tree}") != EXPECTED_TREE:
    raise RuntimeError("commit final não aponta para a árvore certificada")
run("node", "scripts/check-inter-vault-g48.mjs", capture=False)
run("git", "push", "origin", "HEAD:fix/jenios-g48-inter-vault-20261025", capture=False)
print("G48_CERTIFIED_SOURCE_PUBLISHED")
