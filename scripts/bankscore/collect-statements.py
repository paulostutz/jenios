"""Read-only IFData 2025+ staging. No database writes or automatic publication."""
import argparse, concurrent.futures, hashlib, json, re, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime, timezone
BASE='https://www3.bcb.gov.br/ifdata/rest/'
FIELDS={79853:'totalAssets',79858:'equity',79859:'netIncomeSemester'}
def read(url,cache):
    if cache.exists(): raw=cache.read_bytes()
    else:
        with urllib.request.urlopen(url,timeout=60) as response: raw=response.read(40_000_001)
        if len(raw)>40_000_000: raise ValueError('Source exceeds size limit')
        json.loads(raw)
        cache.write_bytes(raw)
    return json.loads(raw),{'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'retrievedAt':datetime.fromtimestamp(cache.stat().st_mtime,timezone.utc).isoformat()}
def collect(code,directory):
    directory.mkdir(parents=True,exist_ok=True)
    catalogue,origin=read(BASE+'relatorios2025a2030',directory/'catalogue.json')
    periods=sorted([x for x in catalogue if re.fullmatch(r'20\d{2}(03|06|09|12)',str(x.get('dt','')))],key=lambda x:x['dt'],reverse=True)[:4]
    if len({x['dt'] for x in periods})!=len(periods): raise ValueError('Duplicate periods')
    def period(item):
        p=item['dt']; paths=[x['f'] for x in item['files']]
        def file(name):
            matches=[f for f in paths if f.split('/')[-1]==name]
            if len(matches)!=1: raise ValueError('Missing/duplicate source '+name)
            return read(BASE+'arquivos?'+urllib.parse.urlencode({'nomeArquivo':matches[0]}),directory/name)
        registrations,regsource=file(f'cadastro{p}_1009.json')
        matches=[r for r in registrations if r.get('c33')==code]
        if len(matches)!=1: raise ValueError(f'{p}: identity not uniquely resolved: {code}')
        institution=matches[0]
        info,infosource=file(f'info{p}.json'); metadata={x['id']:x for x in info}
        reports=[x['trel'] for x in item['files'] if x.get('trel',{}).get('id')==121]
        if len(reports)!=1: raise ValueError('Summary report missing')
        report=reports[0]; columns={x['ifd']:x for x in report['c']}
        values={}; sources=[regsource,infosource]; area_cache={}
        for field,name in FIELDS.items():
            m=metadata[field]
            if m['td']!=3 or columns[field]['fid']!=13: raise ValueError('Field/formatter changed; review required')
            area=m['a']
            if area not in area_cache:
                area_cache[area],s=file(f'dados{p}_{area}.json');sources.append(s)
            entities=[r for r in area_cache[area]['values'] if str(r['e'])==str(institution['c0'])]
            if len(entities)!=1: raise ValueError('Missing/duplicate entity data')
            cells=[r['v'] for r in entities[0]['v'] if r['i']==m['lid']]
            if len(cells)>1: raise ValueError('Duplicate metric')
            # Raw values retained; official renderer fid=13 divides by 1000 for display.
            values[name]={'raw':cells[0] if cells else None,'metadata':m,'formatter':13}
        return {'period':p,'institutionCode':code,'institutionName':institution['c2'],'internalId':institution['c0'],'scope':'prudential','consolidationType':institution['c4'],'reportGenerationDate':report['ge'],'reportNotes':report['rp'],'values':values,'sources':sources,'reviewed':False}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: result=list(pool.map(period,periods))
    return {'catalogue':origin,'latestCataloguePeriod':periods[0]['dt'] if periods else None,'institutionCode':code,'statements':result,'readyForPublication':False,'notice':'Staging only: reconcile identity, raw units, restatements and accounting scope before publication.'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--institution',required=True);parser.add_argument('--cache',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);a=parser.parse_args()
    if not re.fullmatch(r'(?:\d{8}|C\d{1,12})',a.institution):parser.error('Invalid institution code')
    result=collect(a.institution,a.cache)
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'output':str(a.output),'periods':[x['period'] for x in result['statements']],'readyForPublication':False}))
