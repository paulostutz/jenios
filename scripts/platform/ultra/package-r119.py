"""Reproducible R119 protocol-sandbox checkpoint, preserving the R118 payload."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
root = Path(__file__).resolve().parents[3]
with ZipFile(root/'public/downloads/jenios-ultra-r118-checkpoint.zip') as previous:
    files = {name: previous.read(name) for name in previous.namelist() if name != 'INTEGRIDADE.json'}
files['GUIA-R118.md'] = files.pop('LEIA-ME.md')
paths = [
 'lib/platform/ultra/client/binance-action-journal-r119.mjs',
 'lib/platform/ultra/client/binance-durable-adapter-r119.mjs',
 'lib/platform/ultra/client/binance-futures-preflight-r119.mjs',
 'lib/platform/ultra/client/binance-futures-protocol-r119.mjs',
 'lib/platform/ultra/client/binance-protocol-sandbox-r119.mjs',
 'lib/platform/ultra/client/binance-spot-protocol-r119.mjs',
 'tests/platformUltraR119DurableAdapter.test.mjs',
 'tests/platformUltraR119FuturesProtocol.test.mjs',
 'tests/platformUltraR119SpotProtocol.test.mjs'
]
files.update({p:(root/p).read_bytes() for p in paths})
files['LEIA-ME.md'] = (root/'docs/release/R119-CHECKPOINT-README.md').read_bytes()
for name in ['R119-SPOT-PROTOCOL.md','R119-FUTURES-PROTOCOL.md']:
    files[name] = (root/'docs/release'/name).read_bytes()
files['INTEGRIDADE.json'] = (json.dumps({p:hashlib.sha256(b).hexdigest() for p,b in sorted(files.items())},indent=2)+'\n').encode()
target=root/'public/downloads/jenios-ultra-r119-checkpoint.zip'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
    for path,body in sorted(files.items()):
        info=ZipInfo(path,(2026,11,10,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16
        archive.writestr(info,body)
print(json.dumps({'files':len(files),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'nativeValidated':False}))
