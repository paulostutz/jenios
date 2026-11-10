"""Deterministic public package: explicitly selected code only, never credentials/state."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib, json
root=Path(__file__).resolve().parents[3]
paths=[
 'scripts/platform/ultra/client.mjs','scripts/platform/ultra/terminal_diagnostic.py',
 'lib/platform/ultra/client/plan.mjs','lib/platform/ultra/client/diagnostics.mjs',
 'lib/platform/ultra/client/reporting.mjs','lib/platform/ultra/policy.mjs','lib/platform/ultra/reporting.mjs',
]
files={p:(root/p).read_bytes() for p in paths}
files['LEIA-ME.md']=(root/'docs/release/R116-LOCAL-CLIENT-README.md').read_bytes()
files['INTEGRIDADE.json']=(json.dumps({p:hashlib.sha256(b).hexdigest() for p,b in sorted(files.items())},indent=2)+'\n').encode()
target=root/'public/downloads/jenios-ultra-r116.zip'
target.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
 for path,body in sorted(files.items()):
  info=ZipInfo(path,(2026,11,10,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16
  archive.writestr(info,body)
print(json.dumps({'file':str(target.relative_to(root)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'files':len(files)}))
