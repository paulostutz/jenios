"""Build compact, traceable IFData snapshot from collect-statements cache, no DB writes.
Re-run collection into a fresh cache for a new publication. Preserves raw BRL values.
"""
import argparse, json, hashlib, math, re, urllib.parse
from pathlib import Path
from datetime import datetime,timezone
FIELDS={79853:('totalAssets','Ativo Total'),79854:('loans','Carteira de Crédito'),79856:('liabilities','Passivo Exigível'),79857:('funding','Captações'),79858:('equity','Patrimônio Líquido'),79859:('incomeSemester','Lucro Líquido')}
BASE='https://www3.bcb.gov.br/ifdata/rest/'
def build(cache):
    catalogue=json.loads((cache/'catalogue.json').read_text())
    entries=sorted(catalogue,key=lambda x:x['dt'],reverse=True)[:4]
    snapshots=[]
    for entry in entries:
        period=entry['dt'];sources=[]
        def read(name):
            paths=[f['f'] for f in entry['files'] if f['f'].split('/')[-1]==name]
            if len(paths)!=1:raise ValueError('Missing or duplicated catalogue entry')
            p=cache/name;raw=p.read_bytes()
            sources.append({'url':BASE+'arquivos?'+urllib.parse.urlencode({'nomeArquivo':paths[0]}),'sha256':hashlib.sha256(raw).hexdigest(),'retrievedAt':datetime.fromtimestamp(p.stat().st_mtime,timezone.utc).isoformat()})
            return json.loads(raw)
        metadata={x['id']:x for x in read(f'info{period}.json')}
        registration=read(f'cadastro{period}_1009.json')
        reports=[x['trel'] for x in entry['files'] if x.get('trel',{}).get('id')==121]
        if len(reports)!=1:raise ValueError('Missing or duplicated summary')
        report=reports[0];columns={x['ifd']:x for x in report['c']}
        if [x['id'] for x in report['s']]!=[1009]:raise ValueError('Prudential scope changed')
        mapped={};areas={}
        for field,(key,label) in FIELDS.items():
            m=metadata[field]
            if m['td']!=3 or m['n']!=label or columns[field]['fid']!=13:raise ValueError('Mapping changed; review required')
            if m['a'] not in areas:
                rows=read(f"dados{period}_{m['a']}.json")['values'];idx={}
                for r in rows:
                    entity=str(r['e'])
                    if entity in idx:raise ValueError('Duplicate entity')
                    cells={}
                    for cell in r['v']:
                        if cell['i'] in cells:raise ValueError('Duplicate cell')
                        cells[cell['i']]=cell['v']
                    idx[entity]=cells
                areas[m['a']]=idx
            mapped[key]=m
        records=[];seen=set();codes=set()
        for r in registration:
            code=r['c33'];entity=str(r['c0'])
            if not re.fullmatch(r'(?:\d{8}|C\d{1,12})',code):raise ValueError('Unrecognized identity')
            if entity in seen or code in codes:raise ValueError('Ambiguous identity')
            seen.add(entity);codes.add(code)
            values={}
            for key,m in mapped.items():
                raw=areas[m['a']].get(entity,{}).get(m['lid'])
                if raw is not None and (isinstance(raw,bool) or not isinstance(raw,(int,float)) or not math.isfinite(raw)):raw=None
                values[key]=raw
            records.append({'code':code,'internalId':entity,'name':r['c2'],'consolidationType':r['c4'],'segment':r['c3'],'values':values})
        snapshots.append({'period':period,'generationDate':report['ge'],'metadata':mapped,'sources':sources,'records':records})
    return {'schemaVersion':1,'builtAt':datetime.now(timezone.utc).isoformat(),'source':'Banco Central do Brasil — IFData','catalogueUrl':BASE+'relatorios2025a2030','catalogueSha256':hashlib.sha256((cache/'catalogue.json').read_bytes()).hexdigest(),'scope':'prudential','currency':'BRL','scale':1,'incomeBasis':'semester_to_date','periods':snapshots}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    data=build(args.cache);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text('export default '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
    print(json.dumps({'periods':[{'period':x['period'],'institutions':len(x['records'])} for x in data['periods']],'bytes':args.output.stat().st_size}))
