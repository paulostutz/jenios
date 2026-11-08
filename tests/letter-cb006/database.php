<?php
declare(strict_types=1);
$pdo=new PDO('pgsql:host=127.0.0.1;port=55440;dbname=postgres','billing_test','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec(file_get_contents(__DIR__.'/fixture.sql'));$pdo->exec(file_get_contents(dirname(__DIR__,2).'/db/letter-billing-cb006.sql'));
$user='a1111111-1111-4111-8111-111111111111';$platform='b1111111-1111-4111-8111-111111111111';$other='a2222222-2222-4222-8222-222222222222';$passed=0;
function ok(bool $v,string $name):void{global$passed;if(!$v)throw new RuntimeException('FAIL '.$name);$passed++;echo 'PASS '.$name."\n";}
function refused(Closure $f,string $name):void{try{$f();}catch(PDOException){ok(true,$name);return;}ok(false,$name);}
function rpc(string $action,array $data=[],?string $actor=null,?string $link=null):array{global$pdo,$user,$platform;$s=$pdo->prepare('select public.jenios_letter_billing_cb006(?::uuid,?,?::jsonb,?::uuid)');$s->execute([$actor??$user,$action,json_encode($data?:new stdClass()),$link??$platform]);return json_decode($s->fetchColumn(),true,512,JSON_THROW_ON_ERROR);}
ok(rpc('status')['available']===false,'empty configuration blocks issuance');
$pdo->exec("INSERT INTO jenios_letter_cb006.config(receiver_id,enabled,expires_at) VALUES('e1111111-1111-4111-8111-111111111111',true,now()+interval '1 day')");
refused(fn()=>rpc('quote',['product_code'=>'platform-global-crypto'],$other),'platform identity requires verified explicit link');
refused(fn()=>rpc('quote',['product_code'=>'third-party-report']),'third party product cannot collect through Letter');
$offer=rpc('quote',['product_code'=>'platform-global-crypto'])['offer'];ok($offer['amount_cents']===14990,'approved product catalogue price retained');
$payer=['name'=>'Fictício','taxpayer_id'=>'52998224725','email'=>'fixture@example.invalid','person_type'=>'FISICA','phone'=>'11999999999','address'=>['street'=>'Rua Fictícia','number'=>'1','district'=>'Teste','city'=>'Teste','state'=>'SP','zip'=>'12345678']];
$input=['request_key'=>'d1111111-1111-4111-8111-111111111111','offer'=>$offer,'payer'=>$payer,'accept'=>true];
refused(fn()=>rpc('prepare',[...$input,'accept'=>false]),'explicit purchase consent required');
refused(fn()=>rpc('prepare',[...$input,'offer'=>[...$offer,'amount_cents'=>1]]),'browser cannot alter price');
$o=rpc('prepare',$input);ok(rpc('prepare',$input)['id']===$o['id'],'same purchase key returns original order');
refused(fn()=>rpc('prepare',[...$input,'request_key'=>'d2222222-2222-4222-8222-222222222222']),'second pending purchase blocked');
refused(fn()=>rpc('read',['order_id'=>$o['id']],$other),'other buyer cannot read invoice');
$claim=['order_id'=>$o['id'],'operation_key'=>'jenios:'.$o['id'],'phase'=>'prepare','fingerprint'=>str_repeat('a',64)];ok(rpc('claim',$claim)['created']===true,'reserve precedes remote request');ok(rpc('claim',$claim)['created']===false,'lost reply cannot reserve a duplicate');
refused(fn()=>rpc('claim',[...$claim,'fingerprint'=>str_repeat('c',64)]),'different payload conflicts with reservation');
$id='f1111111-1111-4111-8111-111111111111';rpc('journal',['order_id'=>$o['id'],'operation_key'=>$claim['operation_key'],'phase'=>'prepare','state'=>'confirmed','invoice_id'=>$id]);
$receipt=[...$o['input'],'schema_version'=>1,'id'=>$id,'product'=>'jenios','company_id'=>'letter-franqueadora','purpose'=>'jenios_platform_subscription','legal_entity_id'=>'br:cnpj:57255607000130','receiver_id'=>'e1111111-1111-4111-8111-111111111111','state'=>'paid','verified_paid'=>true,'proof_sha256'=>str_repeat('b',64),'confirmed_at'=>gmdate('Y-m-d\TH:i:s\Z')];
foreach(['amount_cents'=>1,'receiver_id'=>'e2222222-2222-4222-8222-222222222222','customer_id'=>$other,'company_id'=>'other','period_end'=>'2030-01-01T00:00:00Z']as$k=>$v)refused(fn()=>rpc('receipt',['order_id'=>$o['id'],'receipt'=>[...$receipt,$k=>$v]]),'receipt binding '.$k);
refused(fn()=>rpc('receipt',['order_id'=>$o['id'],'receipt'=>[...$receipt,'verified_paid'=>false]]),'unverified payment cannot release access');
ok(rpc('receipt',['order_id'=>$o['id'],'receipt'=>$receipt])['access_applied']===true,'verified Letter receipt grants native subscription');
ok(rpc('receipt',['order_id'=>$o['id'],'receipt'=>$receipt])['replayed']===true,'replayed receipt cannot extend period');
ok(rpc('status',['scope'=>'platform'])['access']['productCode']==='platform-global-crypto','existing platform access reads central entitlement');
ok(rpc('status',['scope'=>'university'])['access']===null,'separate product access remains separate');
refused(fn()=>rpc('quote',['product_code'=>'social-university-monthly']),'included university cannot be charged again');
$pdo->exec("UPDATE public.jenios_pay_orders SET status='refunded' WHERE id='{$o['id']}'");ok(rpc('status')['access']===null,'refund revokes subscription access');
ok($pdo->query("SELECT status FROM public.jenios_pay_entitlements WHERE order_id='{$o['id']}'")->fetchColumn()==='revoked','refund revokes corresponding entitlement');
ok(rpc('read',['order_id'=>$o['id']])['state']==='paid','refund preserves verified financial history');
refused(fn()=>$pdo->exec('DELETE FROM jenios_letter_cb006.orders'),'financial orders cannot be deleted');
refused(fn()=>$pdo->exec("UPDATE jenios_letter_cb006.orders SET input='{}'"),'original financial identity cannot change');
$offer2=rpc('quote',['product_code'=>'social-university-monthly'])['offer'];$o2=rpc('prepare',[...$input,'request_key'=>'d3333333-3333-4333-8333-333333333333','offer'=>$offer2]);
$pdo->exec("UPDATE public.jenios_pay_orders SET status='cancelled' WHERE id='{$o2['id']}'");
$r2=[...$receipt,...$o2['input'],'id'=>'f2222222-2222-4222-8222-222222222222','purpose'=>'jenios_subscription'];
ok(rpc('receipt',['order_id'=>$o2['id'],'receipt'=>$r2])['access_applied']===false,'late paid receipt cannot undo cancellation');
ok($pdo->query("SELECT has_function_privilege('authenticated','public.jenios_letter_billing_cb006(uuid,text,jsonb,uuid)','EXECUTE')")->fetchColumn()===false,'browser role cannot call privileged receipt RPC');
ok($pdo->query("SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='jenios_letter_cb006' AND relkind='r'")->fetchColumn()===true,'private billing tables enforce RLS');
echo json_encode(['passed'=>$passed,'bank_network_calls'=>0,'database'=>'isolated-postgresql'])."\n";
