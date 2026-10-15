import {createHash} from 'node:crypto';
import {identifyToken,decodeAbiString} from './token-registry.mjs';
const ids={ethereum:1,bsc:56,polygon:137,arbitrum:42161,base:8453,avalanche:43114};
const programs=['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const base58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function exactAmount(raw,decimals){
  if(typeof raw!=='string'||!/^\d{1,78}$/.test(raw)||!Number.isInteger(decimals)||decimals<0||decimals>36)return null;
  const digits=BigInt(raw).toString().padStart(decimals+1,'0');
  return decimals ? digits.slice(0,-decimals)+'.'+digits.slice(-decimals) : digits;
}
export function tronHex(address){
  if(typeof address!=='string'||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address))throw Error('Invalid TRON address');
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let value=0n;
  for(const char of address)value=value*58n+BigInt(alphabet.indexOf(char));
  const hex=value.toString(16).padStart(50,'0');if(hex.length!==50||!hex.startsWith('41'))throw Error('Invalid TRON address');
  const bytes=Buffer.from(hex,'hex'),digest=createHash('sha256').update(createHash('sha256').update(bytes.subarray(0,21)).digest()).digest();
  if(!digest.subarray(0,4).equals(bytes.subarray(21)))throw Error('Invalid TRON checksum');
  return hex.slice(0,42);
}
const label=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').slice(0,100):null;
function entry(network,address,raw,decimals=null,symbol=null){
  return {address,rawBalance:BigInt(raw).toString(),decimals,amount:exactAmount(raw,decimals),symbol:label(symbol),authenticity:identifyToken(network,address,{onChain:true,symbol:label(symbol)})};
}
export async function walletInventory(input,{fetchImpl=fetch,env=process.env}={}){
  const started=Date.now(),tokens=[],warnings=[];let complete=false;
  async function json(url,body,headers={}){
    if(Date.now()-started>15000)throw Error('time budget');
    const response=await fetchImpl(url,{method:body?'POST':'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok)throw Error('source failed');
    const data=await response.json();if(!data||typeof data!=='object')throw Error('invalid source');return data;
  }
  async function rpc(url,method,params){const data=await json(url,{jsonrpc:'2.0',id:1,method,params});if(data.error||!Object.hasOwn(data,'result'))throw Error('invalid rpc');return data.result;}
  try{
    if(input.type!=='wallet')throw Error('wallet only');
    if(ids[input.network]){
      const url=env[input.network.toUpperCase()+'_RPC_URL'];
      if(!url)throw Error('indexed provider required');
      const chain=await rpc(url,'eth_chainId',[]);if(typeof chain!=='string'||!/^0x[0-9a-f]+$/i.test(chain)||BigInt(chain)!==BigInt(ids[input.network]))throw Error('wrong chain');
      let pageKey;const pages=new Set(),contracts=new Set();
      for(let page=0;page<3;page++){
        const result=await rpc(url,'alchemy_getTokenBalances',[input.identifier,'erc20',{maxCount:100,...(pageKey?{pageKey}:{})}]);
        if(result?.address?.toLowerCase()!==input.identifier.toLowerCase()||!Array.isArray(result.tokenBalances)||result.tokenBalances.length>100)throw Error('inconsistent wallet');
        for(const item of result.tokenBalances){
          if(!/^0x[0-9a-f]{40}$/i.test(item.contractAddress||'')||!/^0x[0-9a-f]{1,64}$/i.test(item.tokenBalance||'')||item.error)throw Error('invalid balance');
          const address=item.contractAddress.toLowerCase();if(contracts.has(address))throw Error('duplicate balance');contracts.add(address);
          if(BigInt(item.tokenBalance)>0n)tokens.push(entry(input.network,address,BigInt(item.tokenBalance).toString()));
        }
        if(!result.pageKey){complete=true;break;}
        if(typeof result.pageKey!=='string'||result.pageKey.length>1000||pages.has(result.pageKey))throw Error('invalid pagination');
        pageKey=result.pageKey;pages.add(pageKey);
      }
      // Metadata is optional and untrusted. Bound calls and retain exact raw units.
      for(const token of tokens.slice(0,10)){
        try{const metadata=await rpc(url,'alchemy_getTokenMetadata',[token.address]);token.symbol=label(metadata?.symbol);token.decimals=Number.isInteger(metadata?.decimals)&&metadata.decimals>=0&&metadata.decimals<=36?metadata.decimals:null;token.amount=exactAmount(token.rawBalance,token.decimals);token.authenticity=identifyToken(input.network,token.address,{onChain:true,symbol:token.symbol});}catch{warnings.push('Metadados não disponíveis para parte dos contratos; unidades brutas preservadas.');break;}
      }
    }else if(input.network==='solana'){
      const url=env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
      if(await rpc(url,'getGenesisHash',[])!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('wrong cluster');
      const accounts=new Set(),byMint=new Map();
      for(const programId of programs){
        const result=await rpc(url,'getTokenAccountsByOwner',[input.identifier,{programId},{encoding:'jsonParsed',commitment:'finalized'}]);
        if(!Array.isArray(result?.value)||result.value.length>500)throw Error('account limit or bad response');
        for(const item of result.value){
          const info=item.account?.data?.parsed?.info,amount=info?.tokenAmount;
          if(!base58.test(item.pubkey||'')||accounts.has(item.pubkey)||item.account?.owner!==programId||item.account?.data?.parsed?.type!=='account'||info?.owner!==input.identifier||!base58.test(info?.mint||'')||!/^\d{1,78}$/.test(amount?.amount||'')||!Number.isInteger(amount.decimals)||amount.decimals<0||amount.decimals>36)throw Error('inconsistent token account');
          accounts.add(item.pubkey);const previous=byMint.get(info.mint);if(previous&&previous.decimals!==amount.decimals)throw Error('inconsistent decimals');
          byMint.set(info.mint,{raw:(previous?.raw||0n)+BigInt(amount.amount),decimals:amount.decimals});
        }
      }
      for(const [mint,balance] of byMint)if(balance.raw>0n)tokens.push(entry('solana',mint,balance.raw.toString(),balance.decimals));
      complete=true;
    }else if(input.network==='tron'){
      const walletHex=tronHex(input.identifier),headers=env.TRON_PRO_API_KEY?{'TRON-PRO-API-KEY':env.TRON_PRO_API_KEY}:{};
      // Fixed mainnet origin: no accidental comparison of testnet tokens to mainnet registry.
      const base='https://api.trongrid.io';
      const data=await json(base+'/v1/accounts/'+encodeURIComponent(input.identifier)+'?only_confirmed=true',null,headers);
      if(data.success!==true||!Array.isArray(data.data)||data.data.length!==1||data.data[0]?.address?.toLowerCase()!==walletHex||!Array.isArray(data.data[0]?.trc20))throw Error('unavailable token index');
      const rows=data.data[0].trc20;if(rows.length>300)throw Error('balance limit');const seen=new Set();
      for(const row of rows){
        const pairs=Object.entries(row);if(pairs.length!==1)throw Error('invalid balance');
        const [address,raw]=pairs[0];tronHex(address);if(seen.has(address)||typeof raw!=='string'||!/^\d{1,78}$/.test(raw))throw Error('invalid balance');seen.add(address);
        if(BigInt(raw)>0n)tokens.push(entry('tron',address,raw));
      }
      complete=true;
      for(const token of tokens.slice(0,10)){
        try{
          const call=async(selector)=>{const data=await json(base+'/walletsolidity/triggerconstantcontract',{owner_address:input.identifier,contract_address:token.address,function_selector:selector,visible:true},headers);if(data.result?.result!==true||!Array.isArray(data.constant_result)||!data.constant_result[0])throw Error('metadata');return data.constant_result[0];};
          const decimals=await call('decimals()');if(!/^[0-9a-f]{64}$/i.test(decimals))throw Error('metadata');const n=Number(BigInt('0x'+decimals));token.decimals=Number.isInteger(n)&&n>=0&&n<=36?n:null;token.amount=exactAmount(token.rawBalance,token.decimals);
          token.symbol=decodeAbiString('0x'+await call('symbol()'));token.authenticity=identifyToken('tron',token.address,{onChain:true,symbol:token.symbol});
        }catch{warnings.push('Parte dos tokens TRC-20 está em unidades brutas, sem metadados confirmados.');break;}
      }
    }else return {available:false,complete:false,tokens:[],warnings:['Inventário de tokens não se aplica ou não está disponível para esta rede.']};
    if(!complete)warnings.push('Limite de paginação atingido; inventário parcial.');
    if(tokens.some(item=>item.amount===null))warnings.push('Alguns saldos têm apenas unidades brutas; não compare quantidades entre contratos.');
    const summary={issuerMatches:0,symbolMismatches:0,unreferenced:0};
    for(const token of tokens){if(token.authenticity.status==='issuer_address_match')summary.issuerMatches++;else if(token.authenticity.status==='symbol_address_mismatch')summary.symbolMismatches++;else summary.unreferenced++;}
    return {available:true,complete,tokens,summary,warnings:[...new Set(warnings)],scope:'Saldos retornados pelo índice/RPC da rede selecionada; exclui ativos nativos, outras redes e ativos omitidos pelo provedor. Contas SPL podem incluir NFTs e extensões; não classifica fungibilidade ou restrições de transferência. complete refere-se à leitura dos resultados disponíveis, não à autenticidade ou à cobertura universal.'};
  }catch{return {available:false,complete:false,tokens:[],warnings:['Inventário indisponível ou resposta inconsistente. Não foi concluída a enumeração dos tokens; isso não significa saldo zero ou tokens falsos.']};}
}
