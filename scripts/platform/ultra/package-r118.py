"""Reproducible checkpoint package: no SDK, secrets, state or native execution."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
root = Path(__file__).resolve().parents[3]
# Preserve the exact R117 files inside their historical package; add new entrypoints.
with ZipFile(root/'public/downloads/jenios-ultra-r117.zip') as previous:
    files = {name: previous.read(name) for name in previous.namelist() if name != 'INTEGRIDADE.json'}
files['GUIA-R117.md'] = files.pop('LEIA-ME.md')
paths = [
 'lib/platform/ultra/client/execution-ledger.mjs', 'lib/platform/ultra/client/execution-runtime.mjs',
 'lib/platform/ultra/client/fixture-broker.mjs', 'lib/platform/ultra/client/binance-collector.mjs',
 'lib/platform/ultra/client/binance-preflight.mjs', 'lib/platform/ultra/client/mt5-r118-adapter.mjs',
 'lib/platform/ultra/selection.mjs', 'lib/platform/research/robot-r18-ultrafast-foundation.mjs',
 'lib/platform/research/robot-r53-dynamic-asset-selection.mjs',
 'scripts/platform/ultra/qualify-offline.mjs', 'scripts/platform/ultra/collect-r118.mjs',
 'scripts/platform/ultra/mt5_collector_r118.py', 'scripts/platform/ultra/profit_sdk_inventory.py',
 'scripts/platform/ultra/test_profit_sdk_inventory.py', 'scripts/platform/ultra/test_mt5_collector.py',
 'scripts/platform/ultra/test_mt5_collector_r118.py',
 'tests/platformUltraR118Execution.test.mjs', 'tests/platformUltraR118BinanceCollector.test.mjs',
 'tests/platformUltraR118BinancePreflight.test.mjs', 'tests/platformUltraR118CLI.test.mjs'
]
files.update({p: (root/p).read_bytes() for p in paths})
files['LEIA-ME.md'] = (root/'docs/release/R118-CHECKPOINT-README.md').read_bytes()
files['R118-CONNECTOR-EVIDENCE.md'] = (root/'docs/release/R118-CONNECTOR-EVIDENCE.md').read_bytes()
files['INTEGRIDADE.json'] = (json.dumps({p: hashlib.sha256(b).hexdigest() for p,b in sorted(files.items())}, indent=2)+'\n').encode()
target = root/'public/downloads/jenios-ultra-r118-checkpoint.zip'
with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path, body in sorted(files.items()):
        info = ZipInfo(path, (2026,11,10,0,0,0)); info.compress_type = ZIP_DEFLATED; info.external_attr = 0o100644 << 16
        archive.writestr(info, body)
print(json.dumps({'files':len(files),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'nativeValidated':False}))
