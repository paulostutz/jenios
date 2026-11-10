"""Explicit public monitoring package; no credentials, state or execution engine."""
from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[3]
paths=[
 'scripts/platform/ultra/client.mjs','scripts/platform/ultra/terminal_diagnostic.py','scripts/platform/ultra/operations.mjs','scripts/platform/ultra/mt5_worker.py',
 'lib/platform/ultra/client/plan.mjs','lib/platform/ultra/client/diagnostics.mjs','lib/platform/ultra/client/reporting.mjs','lib/platform/ultra/policy.mjs','lib/platform/ultra/reporting.mjs',
 'lib/platform/ultra/operation.mjs','lib/platform/ultra/client/journal.mjs','lib/platform/ultra/client/operation-ledger.mjs','lib/platform/ultra/client/operation-export.mjs','lib/platform/ultra/client/mt5-adapter.mjs','lib/platform/ultra/client/sync.mjs']
files={p:(root/p).read_bytes() for p in paths};files['LEIA-ME.md']=(root/'docs/release/R117-OPERATIONS-README.md').read_bytes();files['DIAGNOSTICO-R116.md']=(root/'docs/release/R116-LOCAL-CLIENT-README.md').read_bytes()
files['INTEGRIDADE.json']=(json.dumps({p:hashlib.sha256(b).hexdigest() for p,b in sorted(files.items())},indent=2)+'\n').encode()
target=root/'public/downloads/jenios-ultra-r117.zip'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
 for path,body in sorted(files.items()):
  info=ZipInfo(path,(2026,11,10,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,body)
print(json.dumps({'files':len(files),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}))
