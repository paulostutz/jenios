from __future__ import annotations

import base64
import json
import lzma
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile

REPO = Path.cwd()
BASE_COMMIT = "dec6ae5965b443ed0b8baabf05f750e33b403067"
BASE_TREE = "1adba07a869ecd798455bd0805e50a9d5500b58d"
EXPECTED_TREE = "c425df0cf0edd2c652212e0f2991a13d3dba9809"
SOURCE_REF = "origin/fix/jenios-g48-inter-vault-final-20261025"
CHUNK_SHAS = [
    "6a95d16a503056e82d69d682b53f16298fa4895d",
    "84f41748072e560bf8d929b0c4b682013a8ab6e3",
    "33378a7a5154b9603a506a1616eaff29d78f8711",
    "2ad88c84ea46a50d6e40b9b20ba3d77308d612cd",
    "812a4a9682e839d742a24e614d915349f5f0f2cb",
    "72ec3ad1c820909f04cc6aa3761f51133e999540",
    "dd7a6560c9d1361df6bface18abacbca7878a4f7",
]
BASELINE_PATH = Path("docs/platform/G48-INTEGRATION-BASELINE.json")
REVIEWED_PATH = Path("docs/platform/G48-REVIEWED-CHANGES.json")
EXPECTED_BASELINE_BLOB = "d98099421ca03db6f6f101c37271c23050dc4631"
EXPECTED_REVIEWED_BLOB = "30559b9ccb308e11bdf2cdf781fa34cc941efde9"


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


def git_blob(path: str | Path) -> str:
    return run("git", "hash-object", str(path))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_extract(archive: tarfile.TarFile, expected_files: int) -> list[str]:
    members = archive.getmembers()
    files: list[str] = []
    for member in members:
        path = PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts or ".git" in path.parts:
            raise RuntimeError(f"caminho inseguro: {member.name}")
        if member.issym() or member.islnk():
            raise RuntimeError(f"link recusado: {member.name}")
        if member.isfile():
            files.append(member.name)
    if len(files) != expected_files:
        raise RuntimeError(f"quantidade inesperada de arquivos: {len(files)}")
    archive.extractall(REPO, filter="data")
    return files


run("git", "merge-base", "--is-ancestor", BASE_COMMIT, "HEAD")
encoded = bytearray()
for index, expected_sha in enumerate(CHUNK_SHAS):
    object_name = f"{SOURCE_REF}:.g48-bootstrap/chunk{index:02d}"
    actual_sha = run("git", "rev-parse", object_name)
    if actual_sha != expected_sha:
        raise RuntimeError(f"chunk {index:02d} divergente: {actual_sha}")
    encoded.extend(subprocess.check_output(["git", "show", object_name], cwd=REPO))

functional_tar = Path("/tmp/jenios-g48-functional.tar")
functional_tar.write_bytes(lzma.decompress(base64.b64decode(bytes(encoded))))
with tarfile.open(functional_tar, "r:") as archive:
    payload_paths = safe_extract(archive, 25)

base_blobs: dict[str, str] = {}
for line in run("git", "ls-tree", "-r", "--full-tree", BASE_COMMIT).splitlines():
    metadata, path = line.split("\t", 1)
    _mode, kind, sha = metadata.split(" ", 2)
    if kind == "blob" and path not in payload_paths:
        base_blobs[path] = sha
write_json(
    BASELINE_PATH,
    {"baseCommit": BASE_COMMIT, "baseTree": BASE_TREE, "blobs": base_blobs},
)
if git_blob(BASELINE_PATH) != EXPECTED_BASELINE_BLOB:
    raise RuntimeError("manifesto de baseline divergente")

reviewed_paths = sorted(payload_paths + [str(BASELINE_PATH)])
reviewed_blobs = {path: git_blob(path) for path in reviewed_paths}
write_json(REVIEWED_PATH, {"baseCommit": BASE_COMMIT, "reviewedBlobs": reviewed_blobs})
if git_blob(REVIEWED_PATH) != EXPECTED_REVIEWED_BLOB:
    raise RuntimeError("manifesto de mudanças divergente")

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
