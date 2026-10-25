/** G46 approved sale prices. Internal consumption retains its historical 2x
 * denomination; the commercial price is 3x the purchased provider capacity. */
export const PRO_ADDON_TERMS='jenios-pro-addons-3x-20261024';
export const PRO_ADDON_PACKS=Object.freeze([500,1000,2000,5000,10000].map(cents=>
 Object.freeze({code:'ia-'+cents,providerCapacityBrlCents:cents,priceCents:cents*3})));
export function proAddonPack(code){return PRO_ADDON_PACKS.find(pack=>pack.code===code)||null;}
export function proAddonAmounts(code,fxBrlMicrosPerUsd){
 const pack=proAddonPack(code);
 if(!pack||!Number.isSafeInteger(fxBrlMicrosPerUsd)||fxBrlMicrosPerUsd<1_000_000||fxBrlMicrosPerUsd>100_000_000)
  throw Object.assign(Error('Pacote ou câmbio inválido.'),{status:400,code:'INVALID_PACK'});
 const providerCapacityNanoUsd=Number(BigInt(pack.providerCapacityBrlCents)*10_000_000_000_000n/BigInt(fxBrlMicrosPerUsd));
 return {...pack,providerCapacityNanoUsd,retailNanoUsd:providerCapacityNanoUsd*2};
}
export function validProAddonCatalog(offer){
 return offer?.termsVersion===PRO_ADDON_TERMS&&offer.baseCurrency==='BRL'&&offer.baseAmountMinor===null&&
  Array.isArray(offer.packs)&&offer.packs.length===PRO_ADDON_PACKS.length&&
  PRO_ADDON_PACKS.every((pack,i)=>Object.keys(pack).every(key=>offer.packs[i]?.[key]===pack[key]));
}
