import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {readBinanceProfile,main} from '../scripts/platform/ultra/collect-r118.mjs';
import {MT5R118CollectorAdapter} from '../lib/platform/ultra/client/mt5-r118-adapter.mjs';
const profile={schema:'JENIOS_ULTRA_BINANCE_READONLY_PROFILE_R118',product:'usds_m_futures',environment:'demo',expectedKeyFingerprint:'a'.repeat(64),references:[{symbol:'BTCUSDT',orderId:'1',clientOrderId:'owned',side:'BUY',positionSide:'BOTH'}],evidenceDirectory:'private/evidence'};
test('Binance evidence profile forbids credentials and resolves only local paths',t=>{
 const dir=mkdtempSync(join(tmpdir(),'ultra-r118-cli-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'profile.json');writeFileSync(path,JSON.stringify(profile));assert.equal(readBinanceProfile(path).evidenceDirectory,join(dir,'private/evidence'));
 for(const p of [{...profile,apiKey:'secret'},{...profile,environment:'custom'},{...profile,references:[]},{...profile,expectedKeyFingerprint:'wrong'},{...profile,evidenceDirectory:''}]){writeFileSync(path,JSON.stringify(p));assert.throws(()=>readBinanceProfile(path));}
});
test('collector CLI refuses execution commands without touching providers',async()=>{for(const cmd of ['run','trade','live','start-executor','cancel','close'])await assert.rejects(main([cmd,'profile.json']),/USAGE_COLLECT_R118/);});
test('R118 MT5 adapter preserves wire protocol and selects only corrected readonly worker',async()=>{
 let invoked;const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('exit',1);child.stdin.on('data',data=>{const value=JSON.parse(String(data));if(value.method)queueMicrotask(()=>child.stdout.write(JSON.stringify({id:value.id,ok:true,result:{readOnly:true}})+'\n'));});
 const adapter=new MT5R118CollectorAdapter({provider:'mt5'},{spawnImpl:(command,args,options)=>{invoked={command,args,options};return child;}});assert.deepEqual(await adapter.inspect(),{readOnly:true});assert.match(invoked.args[0],/mt5_collector_r118\.py$/);assert.equal(invoked.options.windowsHide,true);adapter.shutdown();child.stdout.end();child.emit('exit',0);
});
test('new CLI and offline qualification never silently upload Binance or fixture evidence',()=>{
 const cli=readFileSync('scripts/platform/ultra/collect-r118.mjs','utf8'),fixture=readFileSync('scripts/platform/ultra/qualify-offline.mjs','utf8');assert.ok(cli.includes('if(ledger&&process.env.JENIOS_ULTRA_SYNC_TOKEN)'));assert.equal(fixture.includes('synchronizeOperations'),false);assert.equal(fixture.includes('JENIOS_ULTRA_OPERATIONS_V1'),false);
});
