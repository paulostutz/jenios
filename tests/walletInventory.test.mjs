import test from 'node:test';
import assert from 'node:assert/strict';
import {walletInventory,exactAmount,tronHex} from '../lib/crypto/wallet-inventory.mjs';
import {TOKEN_REGISTRY} from '../lib/crypto/token-registry.mjs';
const wallet='0x1111111111111111111111111111111111111111';
const contract=TOKEN_REGISTRY.find(item=>item.network==='ethereum'&&item.symbol==='USDC').address;
const input={network:'ethereum',type:'wallet',identifier:wallet};
const response=result=>({ok:true,json:async()=>({result})});
test('amount formatting preserves precision beyond Number and never invents decimals',()=>{
  assert.equal(exactAmount('9007199254740993123456',6),'9007199254740993.123456');
  assert.equal(exactAmount('1',6),'0.000001');assert.equal(exactAmount('100',0),'100');
  assert.equal(exactAmount('1',null),null);assert.equal(exactAmount('-1',6),null);
});
test('EVM enumerates all pages and compares address, not symbol, with issuer',async()=>{
  let pages=0;const result=await walletInventory(input,{env:{ETHEREUM_RPC_URL:'https://rpc.test/secret'},fetchImpl:async(url,options)=>{
    assert.equal(options.redirect,'error');const body=JSON.parse(options.body);
    if(body.method==='eth_chainId')return response('0x1');
    if(body.method==='alchemy_getTokenBalances'){pages++;return response({address:wallet,tokenBalances:[{contractAddress:pages===1?contract:'0x2222222222222222222222222222222222222222',tokenBalance:'0xf4240'}],...(pages===1?{pageKey:'next'}:{})});}
    return response({symbol:'USDC',decimals:6});
  }});
  assert.equal(pages,2);assert.equal(result.complete,true);assert.equal(result.tokens[0].amount,'1.000000');
  assert.equal(result.tokens[0].authenticity.status,'issuer_address_match');assert.equal(result.tokens[1].authenticity.status,'symbol_address_mismatch');
  assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('EVM without index-capable configured provider is explicitly unavailable',async()=>{
  let calls=0;const result=await walletInventory(input,{env:{},fetchImpl:async()=>{calls++;}});
  assert.equal(calls,0);assert.equal(result.available,false);assert.equal(result.complete,false);
});
test('wrong EVM network and another wallet response fail closed',async()=>{
  for(const wrongChain of [true,false]){const result=await walletInventory(input,{env:{ETHEREUM_RPC_URL:'https://rpc.test'},fetchImpl:async(url,options)=>JSON.parse(options.body).method==='eth_chainId'?response(wrongChain?'0x38':'0x1'):response({address:'0x2222222222222222222222222222222222222222',tokenBalances:[]})});assert.equal(result.available,false);assert.deepEqual(result.tokens,[]);}
});
test('EVM repeated pagination and malformed balance never become a complete inventory',async()=>{
  for(const malformed of [true,false]){let page=0;const result=await walletInventory(input,{env:{ETHEREUM_RPC_URL:'https://rpc.test'},fetchImpl:async(url,options)=>{
    if(JSON.parse(options.body).method==='eth_chainId')return response('0x1');page++;
    return response({address:wallet,tokenBalances:[{contractAddress:'0x'+String(page).repeat(40),tokenBalance:malformed?'invalid':'0x1'}],pageKey:'repeat'});
  }});assert.equal(result.available,false);assert.deepEqual(result.tokens,[]);}
});
test('Solana enumerates both token programs, aggregates owner accounts exactly and keeps unknown tokens inconclusive',async()=>{
  const owner=TOKEN_REGISTRY.find(item=>item.network==='solana'&&item.symbol==='USDC').address;
  let count=0;const result=await walletInventory({network:'solana',type:'wallet',identifier:owner},{env:{},fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);if(body.method==='getGenesisHash')return response('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
    count++;return response({value:count===1?[1,2].map((n)=>({pubkey:String(n).repeat(32),account:{owner:body.params[1].programId,data:{parsed:{type:'account',info:{owner,mint:'3'.repeat(32),tokenAmount:{amount:'9007199254740993',decimals:6}}}}}})):[]});
  }});
  assert.equal(count,2);assert.equal(result.complete,true);assert.equal(result.tokens.length,1);assert.equal(result.tokens[0].amount,'18014398509.481986');assert.equal(result.tokens[0].authenticity.status,'not_in_reference_registry');
});
test('Solana account belonging to another owner and wrong cluster are rejected',async()=>{
  const owner='1'.repeat(32);
  for(const wrongCluster of [true,false]){const result=await walletInventory({network:'solana',type:'wallet',identifier:owner},{env:{},fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);if(body.method==='getGenesisHash')return response(wrongCluster?'devnet':'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
    return response({value:[{pubkey:'2'.repeat(32),account:{owner:body.params[1].programId,data:{parsed:{type:'account',info:{owner:'3'.repeat(32),mint:'4'.repeat(32),tokenAmount:{amount:'1',decimals:6}}}}}}]});
  }});assert.equal(result.available,false);}
});
test('TRON checksum rejects copied or malformed addresses',()=>{
  const address=TOKEN_REGISTRY.find(item=>item.network==='tron').address;
  assert.equal(tronHex(address),'41a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  assert.throws(()=>tronHex(address.slice(0,-1)+'1'));
});
test('TRON index requires exact wallet and retains balance when metadata fails without claiming decimals',async()=>{
  const address=TOKEN_REGISTRY.find(item=>item.network==='tron').address;
  const result=await walletInventory({network:'tron',type:'wallet',identifier:address},{env:{TRON_PRO_API_KEY:'secret'},fetchImpl:async(url,options)=>{
    assert.equal(new URL(url).origin,'https://api.trongrid.io');assert.equal(options.headers['TRON-PRO-API-KEY'],'secret');
    return {ok:true,json:async()=>options.method==='GET'?{success:true,data:[{address:tronHex(address),trc20:[{[address]:'1000000'}]}]}:{result:{result:false}}};
  }});
  assert.equal(result.available,true);assert.equal(result.tokens[0].rawBalance,'1000000');assert.equal(result.tokens[0].amount,null);assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('TRON wrong wallet and missing token index are unavailable rather than empty-success',async()=>{
  const address=TOKEN_REGISTRY.find(item=>item.network==='tron').address;
  for(const row of [{address:'41'+'0'.repeat(40),trc20:[]},{address:tronHex(address)}]){const result=await walletInventory({network:'tron',type:'wallet',identifier:address},{env:{},fetchImpl:async()=>({ok:true,json:async()=>({success:true,data:[row]})})});assert.equal(result.available,false);assert.equal(result.complete,false);}
});
test('Bitcoin does not invent a fungible-token inventory',async()=>{
  const result=await walletInventory({network:'bitcoin',type:'wallet',identifier:'unused'});assert.equal(result.available,false);assert.deepEqual(result.tokens,[]);
});
