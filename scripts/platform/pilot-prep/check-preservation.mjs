import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='4559d2ace3ac0cd4c95db55c67b7a7b671dece31';
const allowed=/^(lib\/platform\/pilot-prep\/[^/]+\.mjs|scripts\/platform\/pilot-prep\/[^/]+\.mjs|tests\/platformPilotPrep\.test\.mjs|docs\/platform\/B149-B154-[A-Z-]+\.md|\.github\/workflows\/jenios-b1(?:50-public-readonly|54-pilot-preparation)\.yml)$/;
const lines=execFileSync('git',['diff','--no-renames','--name-status',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const line of lines){const [status,path]=line.split('\t');assert.equal(status,'A','No B148 file may change: '+line);assert.ok(allowed.test(path),'Unreviewed path: '+path);}
assert.ok(lines.length>0);console.log('B154_ADDITIVE_PRESERVATION_PASS='+lines.length+'; every B148 tracked byte preserved; no private core uploaded');
