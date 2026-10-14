// Limited mainnet registry from issuer documentation, checked 2026-10-14.
export const REGISTRY_CHECKED_AT = '2026-10-14';
const tether = 'https://tether.to/en/supported-protocols/';
const circle = 'https://developers.circle.com/stablecoins/usdc-contract-addresses';
export const TOKEN_REGISTRY = Object.freeze([
  ['ethereum','USDT','Tether','0xdac17f958d2ee523a2206206994597c13d831ec7',tether],
  ['avalanche','USDT','Tether','0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',tether],
  ['tron','USDT','Tether','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',tether],
  ['solana','USDT','Tether','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',tether],
  ['ethereum','USDC','Circle','0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',circle],
  ['base','USDC','Circle','0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',circle],
  ['polygon','USDC','Circle','0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',circle],
  ['arbitrum','USDC','Circle','0xaf88d065e77c8cC2239327C5EDb3A432268e5831',circle],
  ['avalanche','USDC','Circle','0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',circle],
  ['solana','USDC','Circle','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',circle],
].map(([network,symbol,issuer,address,source])=>Object.freeze({network,symbol,issuer,address,source,checkedAt:REGISTRY_CHECKED_AT})));
const canonical = (network,address) => /^0x/i.test(address) && !['tron','solana'].includes(network) ? address.toLowerCase() : address;
export function identifyToken(network,address,{onChain=null,symbol=null}={}) {
  const entry=TOKEN_REGISTRY.find(token=>token.network===network && canonical(network,token.address)===canonical(network,address));
  if(entry) return {status:onChain===true?'issuer_address_match':'issuer_address_match_chain_unconfirmed',label:onChain===true?'Endereço corresponde ao publicado pelo emissor':'Endereço oficial no catálogo; rede ainda não confirmada',token:entry.symbol,issuer:entry.issuer,source:entry.source,registryCheckedAt:entry.checkedAt,limitedRegistry:true};
  const claim=String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const knownOnNetwork=TOKEN_REGISTRY.some(token=>token.network===network&&token.symbol===claim);
  return {status:knownOnNetwork?'symbol_address_mismatch':'not_in_reference_registry',label:knownOnNetwork?'Símbolo semelhante, mas endereço diferente da referência do emissor':'Não consta no catálogo limitado de referência; autenticidade inconclusiva',claimedSymbol:symbol||null,registryCheckedAt:REGISTRY_CHECKED_AT,limitedRegistry:true};
}
export function decodeAbiString(hex) {
  if(typeof hex!=='string'||!/^0x[0-9a-f]*$/i.test(hex)||hex.length>32770)return null;
  const bytes=Buffer.from(hex.slice(2),'hex');
  if(bytes.length===32)return bytes.toString('utf8').replace(/\0+$/g,'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,120)||null;
  if(bytes.length<64)return null;
  const offset=Number(BigInt('0x'+bytes.subarray(0,32).toString('hex')));
  if(!Number.isSafeInteger(offset)||offset<32||offset%32!==0||offset+32>bytes.length)return null;
  const length=Number(BigInt('0x'+bytes.subarray(offset,offset+32).toString('hex')));
  if(!Number.isSafeInteger(length)||length<0||length>1024||offset+32+length>bytes.length)return null;
  return bytes.subarray(offset+32,offset+32+length).toString('utf8').replace(/[\x00-\x1f\x7f]/g,'').slice(0,120)||null;
}
