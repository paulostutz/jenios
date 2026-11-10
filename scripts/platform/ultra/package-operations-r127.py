"""Reproducible, credential-free R127 offline candidate over the verified R126 archive."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
PREVIOUS = 'public/downloads/jenios-ultra-r126-rehearsal.zip'
PREVIOUS_SHA256 = 'b3ed7b33600cfab67cae405eee029996d68a744dfce9d8b56f66d823c45eec7b'
TARGET = 'public/downloads/jenios-ultra-r127-candidate.zip'
ADDITIONS = (
    'lib/platform/connections/profit-protocol-r109.mjs',
    'lib/platform/ultra/client/execution-runtime-r127.mjs',
    'lib/platform/ultra/client/runtime-fixture-r127.mjs',
    'lib/platform/ultra/client/operation-records-r127.mjs',
    'lib/platform/ultra/client/profit-order-journal-r127.mjs',
    'scripts/platform/ultra/qualify-r127.mjs',
    'tests/platformUltraR127Runtime.test.mjs',
    'tests/platformUltraR127Records.test.mjs',
    'tests/platformUltraR127Profit.test.mjs',
    'tests/platformUltraR127Integration.test.mjs',
)
DOCUMENTS = {
    'LEIA-ME.md': 'docs/release/R127-CHECKPOINT-README.md',
    'R127-RUNTIME.md': 'docs/release/R127-RUNTIME.md',
    'R127-RECORDS-INTERFACE.md': 'docs/release/R127-RECORDS-INTERFACE.md',
    'R127-CONNECTORS.md': 'docs/release/R127-CONNECTORS.md',
    'R127-PARALLEL-RECONCILIATION.md': 'docs/release/R127-PARALLEL-RECONCILIATION.md',
}


def build():
    previous = ROOT / PREVIOUS
    if hashlib.sha256(previous.read_bytes()).hexdigest() != PREVIOUS_SHA256:
        raise ValueError('R126_PACKAGE_CHANGED')
    with ZipFile(previous) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('DUPLICATE_ARCHIVE_PATH')
        files = {name: archive.read(name) for name in names}
    integrity = json.loads(files.pop('INTEGRIDADE.json'))
    if set(files) != set(integrity) or any(hashlib.sha256(body).hexdigest() != integrity[path] for path, body in files.items()):
        raise ValueError('R126_PACKAGE_INTEGRITY_FAILED')
    files['GUIA-HISTORICO-R126.md'] = files.pop('LEIA-ME.md')
    for path in ADDITIONS:
        if path in files:
            raise ValueError('ADDITION_REPLACES_INHERITED_SOURCE')
        files[path] = (ROOT / path).read_bytes()
    for destination, source in DOCUMENTS.items():
        if destination in files:
            raise ValueError('DOCUMENT_REPLACES_INHERITED_SOURCE')
        files[destination] = (ROOT / source).read_bytes()
    for path in files:
        pure = PurePosixPath(path)
        if (pure.is_absolute() or '..' in pure.parts
                or any(part.startswith('.env') or part in ('.git', 'node_modules', '__pycache__') for part in pure.parts)
                or pure.suffix.lower() in ('.sqlite', '.db', '.dll', '.exe', '.pyc', '.pem', '.key')):
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
            'bytes': target.stat().st_size, 'evidenceMode': 'offline_fixture', 'nativeValidated': False,
            'liveExecutionAllowed': False, 'externalPaperAllowed': False, 'productionPublished': False,
            'billingAllowed': False, 'accountModel': 'customer_own_account'}


if __name__ == '__main__':
    print(json.dumps(build()))
