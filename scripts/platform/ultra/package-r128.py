"""Deterministic union of both pinned R127 archives; no credentials or runtime state."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
PREVIOUS = (
 ('public/downloads/jenios-ultra-r127-session.zip', '93704beac4503e1736728b34e93eca5e0444509d07e3febac34f3226fbebf500', 'GUIA-R127-SESSAO.md'),
 ('public/downloads/jenios-ultra-r127-candidate.zip', 'd37cdd7604b476496496517b89a4fc6eb03687cde675762f61d859e9db9a1b15', 'GUIA-R127-OPERACOES.md'),
)
ADDITIONS = ('lib/platform/ultra/client/session-runtime-r128.mjs', 'scripts/platform/ultra/qualify-r128.mjs', 'tests/platformUltraR128Conciliation.test.mjs')
TARGET = 'public/downloads/jenios-ultra-r128-conciliation.zip'


def build():
    files = {}
    for path, expected_hash, guide in PREVIOUS:
        previous = ROOT / path
        if hashlib.sha256(previous.read_bytes()).hexdigest() != expected_hash:
            raise ValueError('R127_PACKAGE_CHANGED')
        with ZipFile(previous) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise ValueError('DUPLICATE_ARCHIVE_PATH')
            incoming = {p: archive.read(p) for p in names}
        integrity = json.loads(incoming.pop('INTEGRIDADE.json'))
        if set(incoming) != set(integrity) or any(hashlib.sha256(body).hexdigest() != integrity[p] for p, body in incoming.items()):
            raise ValueError('R127_PACKAGE_INTEGRITY_FAILED')
        incoming[guide] = incoming.pop('LEIA-ME.md')
        for p, body in incoming.items():
            if p in files and files[p] != body:
                raise ValueError('R127_ARCHIVES_CONFLICT: ' + p)
            files[p] = body
    for p in ADDITIONS:
        if p in files:
            raise ValueError('ADDITION_REPLACES_ARCHIVED_SOURCE')
        files[p] = (ROOT / p).read_bytes()
    files['LEIA-ME.md'] = (ROOT / 'docs/release/R128-CONCILIACAO.md').read_bytes()
    for p in files:
        path = PurePosixPath(p)
        if (path.is_absolute() or '..' in path.parts or not path.parts
            or any(part.startswith('.env') or part in ('node_modules', '__pycache__', '.git') for part in path.parts)
            or path.suffix.lower() in ('.sqlite', '.db', '.dll', '.exe', '.pyc', '.pem', '.key')):
            raise ValueError('UNSAFE_PACKAGE_PATH')
    files['INTEGRIDADE.json'] = (json.dumps({p: hashlib.sha256(b).hexdigest() for p, b in sorted(files.items())}, indent=2) + '\n').encode()
    target = ROOT / TARGET
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for p, body in sorted(files.items()):
            info = ZipInfo(p, (2026, 11, 10, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, body)
    return {'files': len(files), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size,
            'evidenceMode': 'offline_fixture', 'nativeValidated': False, 'liveExecutionAllowed': False, 'productionPublished': False}


if __name__ == '__main__':
    print(json.dumps(build()))
