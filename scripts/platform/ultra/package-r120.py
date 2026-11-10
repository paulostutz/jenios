"""Reproducible offline R120 checkpoint. Never include local state or credentials."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
root=Path(__file__).resolve().parents[3]
with ZipFile(root/'public/downloads/jenios-ultra-r119-checkpoint.zip') as previous:
    files={name:previous.read(name) for name in previous.namelist() if name!='INTEGRIDADE.json'}
files['GUIA-R119.md']=files.pop('LEIA-ME.md')
for name in ['binance-auth-fixture-r120.mjs','binance-events-r120.mjs','binance-event-inbox-r120.mjs']:
    path='lib/platform/ultra/client/'+name;files[path]=(root/path).read_bytes()
for name in ['AuthFixture','Events','Inbox']:
    path='tests/platformUltraR120'+name+'.test.mjs';files[path]=(root/path).read_bytes()
files['LEIA-ME.md']=(root/'docs/release/R120-CHECKPOINT-README.md').read_bytes()
for name in ['R120-LOCAL-TRANSPORT.md','R120-EVENT-PROTOCOL.md']:files[name]=(root/'docs/release'/name).read_bytes()
files['INTEGRIDADE.json']=(json.dumps({p:hashlib.sha256(b).hexdigest() for p,b in sorted(files.items())},indent=2)+'\n').encode()
target=root/'public/downloads/jenios-ultra-r120-checkpoint.zip'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
    for path,body in sorted(files.items()):
        info=ZipInfo(path,(2026,11,10,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16;archive.writestr(info,body)
print(json.dumps({'files':len(files),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'nativeValidated':False}))
