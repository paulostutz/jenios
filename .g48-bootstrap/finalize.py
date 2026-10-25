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
REVIEWED_BLOBS = {
    ".github/workflows/jenios-inter-vault-g48.yml": "482d651d38500316027fc3ef12a8f9a2dcfe55f9",
    "app/admin/cobrancas/page.js": "45c69c3fba052e47fe685081566c394078765d65",
    "app/api/admin/inter/setup/route.js": "1d5b59c81399439a795f45bc727539209661a797",
    "app/components/InterAdminPanel.js": "17c519a10ba0d173d3e4a48c3df5040a7a8ac361",
    "app/components/InterSetupForm.js": "fd5c37ee0a374d9f9ad45eed6d6e291b445f69de",
    "docs/platform/G48-INTEGRATION-BASELINE.json": "d98099421ca03db6f6f101c37271c23050dc4631",
    "docs/platform/G48-INTER-VAULT-CHECKPOINT.md": "d799ad80e2449d0951a820efd52e114ee059ff05",
    "lib/assistant/pro-topups.mjs": "4a64f1937161dbdec2d5aa10a4492e1687266adc",
    "lib/assistant/university-subscription.mjs": "bf806c88374a201415cddcad477743b3219dea0f",
    "lib/pay/gateway.mjs": "3ecc0153641d26653f6961a80f5cb7550dbc4822",
    "lib/pay/inter-material.mjs": "436cc0116ab13727bd89d36cd2414f085a44632b",
    "lib/pay/inter-pix.mjs": "972e844bd114da995fe0694670aad0965e68dda2",
    "lib/pay/inter-vault.mjs": "8d3c4756dd105ec69b7e67cf94d4f5359863aad3",
    "lib/pay/pix-status.mjs": "5e349b067aaf95c099c5126f06321c152b2f73e6",
    "lib/platform/monthly-billing.mjs": "18fb19799830c9297d86560bc7e22b7fc9d68f6a",
    "scripts/check-inter-vault-g48.mjs": "d028a12f3280f17e0122f6dbb8b2f6adff4349d0",
    "scripts/test-inter-vault-g48-postgres.mjs": "f9e038ddb662d24d1ee4799b141e0e8f8778a88c",
    "supabase/migrations/20261025013000_jenios_g48_inter_vault_setup.sql": "010398868d518a8551aaf0cbe5a9e1b05b0bc937",
    "tests/interPix.test.mjs": "d959c2654ee1f95bb390f5bc5e67742a484de935",
    "tests/jeniosGeniosQuotaG45.test.mjs": "e1e033574b2617f6335c7bbf8888f244d02a893d",
    "tests/jeniosInterSetupG48.test.mjs": "edff2ca614dfdf12b6851a927ce1cd0c17d6a3c8",
    "tests/jeniosProTopupsB146.test.mjs": "4915e0abf2dcbe0454de3fe9d914d1083987b429",
    "tests/jeniosUniversityMonthlyB147.test.mjs": "71387498e809063a818fee5f18eb714bc6d0822a",
    "tests/paymentActivationR44.test.mjs": "f47358a4349d82cc4938d4789ffbd63c0c8bb9f5",
    "tests/platformMonthlyG47.test.mjs": "a31a2d0079a2146f8fbbc29e966d633a32b51a4f",
    "tests/sql/jenios_inter_setup_g48_regression.sql": "087ec6d6c6a17eef25c59a0adccbbf0c9db79a1a",
}


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
write_json(BASELINE_PATH, {"baseCommit": BASE_COMMIT, "baseTree": BASE_TREE, "blobs": base_blobs})
if git_blob(BASELINE_PATH) != EXPECTED_BASELINE_BLOB:
    raise RuntimeError("manifesto de baseline divergente")

if sorted(REVIEWED_BLOBS) != list(REVIEWED_BLOBS):
    raise RuntimeError("mapa certificado fora de ordem")
for path, expected_blob in REVIEWED_BLOBS.items():
    actual_blob = git_blob(path)
    if actual_blob != expected_blob:
        raise RuntimeError(f"blob divergente em {path}: {actual_blob} != {expected_blob}")
write_json(REVIEWED_PATH, {"baseCommit": BASE_COMMIT, "reviewedBlobs": REVIEWED_BLOBS})
if git_blob(REVIEWED_PATH) != EXPECTED_REVIEWED_BLOB:
    raise RuntimeError("manifesto de mudanças divergente")

shutil.rmtree(REPO / ".g48-bootstrap")
for workflow in (REPO / ".github/workflows/jenios-g48-bootstrap.yml", REPO / ".github/workflows/jenios-g48-finalize.yml"):
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
