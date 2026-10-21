import test from 'node:test';import assert from 'node:assert/strict';
import {assessPrivateBackupProof} from '../lib/platform/launch/b219-backup-recovery-manifest.mjs';
const atMs=1792530000000;
const stores=['risk','dispatch','audit'].map((kind,i)=>({kind,contentSha256:String(i+1).repeat(64),capturedAtMs:atMs-1000,encrypted:true,repositoryExported:false}));
test('B219 metadata cannot claim actual completed restore',()=>{const r=assessPrivateBackupProof({stores,atMs,restoreDrill:{isolatedEnvironment:true,operatorReviewed:true,sqliteIntegrityChecked:true,noOrderExecution:true}});assert.equal(r.classification,'REQUIRES_INDEPENDENT_RESTORE_ACCEPTANCE');assert.equal(r.independentBackupVerified,false);});
test('B219 stale or unencrypted recovery is NO_GO',()=>{const r=assessPrivateBackupProof({stores:[{...stores[0],encrypted:false},...stores.slice(1)],atMs});assert.equal(r.classification,'NO_GO_BACKUP_RECOVERY');});
test('B219 rejected duplicate databases/false repository exports',()=>{
 assert.throws(()=>assessPrivateBackupProof({stores:[stores[0],stores[0],stores[2]],atMs}),/B219_INVALID_BACKUP_RECORD/);
 assert.throws(()=>assessPrivateBackupProof({stores:[{...stores[0],repositoryExported:true},...stores.slice(1)],atMs}),/B219_INVALID_BACKUP_RECORD/);
});
