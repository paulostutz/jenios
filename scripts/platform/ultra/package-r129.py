"""Deterministic offline R129 composition over the unchanged R128 package."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
PREVIOUS = 'public/downloads/jenios-ultra-r128-conciliation.zip'
PREVIOUS_SHA256 = '686449d250345ea692489fafc3436e5ae20e99d84fbf8fd6d154cd51cd7b0ac1'
TARGET = 'public/downloads/jenios-ultra-r129-monthly.zip'
ADDITIONS = (
    'lib/platform/ultra/client/monthly-report-um001.mjs',
    'lib/platform/ultra/fees-um001.mjs',
    'lib/platform/ultra/client/records-monthly-r129.mjs',
    'lib/platform/ultra/client/start-cycle-r129.mjs',
    'lib/platform/ultra/client/session-runtime-r129.mjs',
    'lib/platform/ultra/client/monthly-general-r129.mjs',
    'lib/platform/ultra/client/letter-monthly-r129.mjs',
    'lib/platform/ultra/fixtures/letter-cb016/packages/group-billing/clients/central-billing-client.mjs',
    'lib/platform/ultra/fixtures/letter-cb016/packages/group-billing/candidates/ultra-monthly-um001/monthly-performance.mjs',
    'lib/platform/ultra/fixtures/letter-cb016/README-R129.md',
    'scripts/platform/ultra/qualify-r129.mjs',
    'tests/platformUltraRecordsMonthlyR129.test.mjs',
    'tests/platformUltraR129StartCycle.test.mjs',
    'tests/platformUltraLetterMonthlyR129.test.mjs',
    'tests/platformUltraR129MonthlyJourney.test.mjs',
    'tests/platformUltraMonthlyUM001.test.mjs',
    'tests/ultra-fees-um001.test.mjs',
    'docs/UM001_START_FEE_PREPARATION.md',
    'docs/release/R129-RECORDS-MONTHLY-INTERFACE.md',
    'docs/release/R129-START-CYCLE.md',
    'docs/release/R129-LETTER-MONTHLY.md',
)


def build():
    previous = ROOT / PREVIOUS
    if hashlib.sha256(previous.read_bytes()).hexdigest() != PREVIOUS_SHA256:
        raise ValueError('R128_PACKAGE_CHANGED')
    with ZipFile(previous) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('DUPLICATE_ARCHIVE_PATH')
        files = {p: archive.read(p) for p in names}
    integrity = json.loads(files.pop('INTEGRIDADE.json'))
    if set(files) != set(integrity) or any(hashlib.sha256(b).hexdigest() != integrity[p] for p, b in files.items()):
        raise ValueError('R128_PACKAGE_INTEGRITY_FAILED')
    files['GUIA-R128-CONCILIACAO.md'] = files.pop('LEIA-ME.md')
    for path in ADDITIONS:
        if path in files:
            raise ValueError('ADDITION_REPLACES_ARCHIVED_SOURCE: ' + path)
        files[path] = (ROOT / path).read_bytes()
    files['LEIA-ME.md'] = (ROOT / 'docs/release/R129-INTEGRACAO-MENSAL.md').read_bytes()
    for name in files:
        path = PurePosixPath(name)
        if (path.is_absolute() or '..' in path.parts or not path.parts
                or any(part.startswith('.env') or part in ('node_modules', '__pycache__', '.git') for part in path.parts)
                or path.suffix.lower() in ('.sqlite', '.db', '.dll', '.exe', '.pyc', '.pem', '.key')):
            raise ValueError('UNSAFE_PACKAGE_PATH')
    files['INTEGRIDADE.json'] = (json.dumps({p: hashlib.sha256(b).hexdigest() for p, b in sorted(files.items())}, indent=2) + '\n').encode()
    target = ROOT / TARGET
    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, body in sorted(files.items()):
            info = ZipInfo(name, (2026, 11, 10, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, body)
    return {
        'files': len(files), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size, 'evidenceMode': 'offline_fixture',
        'nativeValidated': False, 'liveExecutionAllowed': False,
        'billingAllowed': False, 'realDebitAllowed': False, 'productionPublished': False,
    }


if __name__ == '__main__':
    print(json.dumps(build()))
