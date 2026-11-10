"""Reproducible R125 offline candidate. Never inspect terminals or include local state."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
PREVIOUS = 'public/downloads/jenios-ultra-r120-checkpoint.zip'
PREVIOUS_SHA256 = 'aab4770c8be26fd5097f598a6ff0489e3a993096f907a09037517613fd974a30'
TARGET = 'public/downloads/jenios-ultra-r125-candidate.zip'
ADDITIONS = (
    'lib/platform/ultra/client/workspace-report.mjs',
    'lib/platform/ultra/client/plan-r125.mjs',
    'lib/platform/ultra/client/report-r125.mjs',
    'lib/platform/ultra/policy-r125.mjs',
    'lib/platform/ultra/routes-r125.mjs',
    'lib/platform/ultra/scope-r125.mjs',
    'scripts/platform/ultra/client-r125.mjs',
    'scripts/platform/ultra/mt5_readiness_r125.py',
    'scripts/platform/ultra/test_mt5_readiness_r125.py',
)
DOCUMENTS = {
    'LEIA-ME.md': 'docs/release/R125-CHECKPOINT-README.md',
    'R125-GENIAL-MT5.md': 'docs/release/R125-GENIAL-MT5.md',
}


def build():
    previous_path = ROOT / PREVIOUS
    if hashlib.sha256(previous_path.read_bytes()).hexdigest() != PREVIOUS_SHA256:
        raise ValueError('R120_PACKAGE_CHANGED')
    with ZipFile(previous_path) as previous:
        names = previous.namelist()
        if len(names) != len(set(names)):
            raise ValueError('DUPLICATE_ARCHIVE_PATH')
        files = {name: previous.read(name) for name in names}
    expected = json.loads(files.pop('INTEGRIDADE.json'))
    if set(files) != set(expected) or any(hashlib.sha256(body).hexdigest() != expected[path] for path, body in files.items()):
        raise ValueError('R120_PACKAGE_INTEGRITY_FAILED')
    files['GUIA-R120.md'] = files.pop('LEIA-ME.md')
    for path in ADDITIONS:
        if path in files:
            raise ValueError('ADDITION_REPLACES_ARCHIVED_SOURCE')
        files[path] = (ROOT / path).read_bytes()
    for destination, source in DOCUMENTS.items():
        if destination in files:
            raise ValueError('DOCUMENT_REPLACES_ARCHIVED_SOURCE')
        files[destination] = (ROOT / source).read_bytes()
    for path in files:
        parts = PurePosixPath(path).parts
        if (not parts or PurePosixPath(path).is_absolute() or '..' in parts
                or any(part.startswith('.env') or part in ('node_modules', '__pycache__', '.git') for part in parts)
                or PurePosixPath(path).suffix.lower() in ('.sqlite', '.db', '.dll', '.exe', '.pyc', '.pem', '.key')):
            raise ValueError('UNSAFE_PACKAGE_PATH')
    files['INTEGRIDADE.json'] = (json.dumps({p: hashlib.sha256(b).hexdigest() for p, b in sorted(files.items())}, indent=2) + '\n').encode()
    target = ROOT / TARGET
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path, body in sorted(files.items()):
            info = ZipInfo(path, (2026, 11, 10, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, body)
    return {'files': len(files), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'bytes': target.stat().st_size, 'candidateStatus': 'unvalidated_offline_candidate',
            'nativeValidated': False, 'liveExecutionAllowed': False, 'productionPublished': False}


if __name__ == '__main__':
    print(json.dumps(build()))
