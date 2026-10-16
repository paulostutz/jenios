import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const paths=[
 'package.json', 'app/api/jenios-pay/health/route.js',
 'app/api/jenios-pay/inter/diagnostico/route.js',
 'lib/jenios-pay/inter.js', 'supabase/migrations/20261012_jenios_pay_v1.sql',
 'app/api/jenios-pay/status/route.js'
];
let failed=false;
for (const file of paths) {
 const ok=fs.existsSync(path.join(root,file));
 console.log(`${ok?'OK':'FALTA'} ${file}`);
 if(!ok) failed=true;
}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
console.log('Next.js declarado:',pkg.dependencies?.next??'nao encontrado');
console.log('Transacoes reais: NAO habilitadas por este pacote');
if(failed) process.exitCode=1;
