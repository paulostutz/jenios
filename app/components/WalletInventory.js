'use client';
export default function WalletInventory({inventory}){
  if(!inventory)return null;
  return <section><h3>Tokens encontrados na carteira</h3>
    <p>{inventory.available?(inventory.complete?'Leitura do índice concluída':'Inventário parcial'):'Inventário indisponível'}</p>
    {inventory.scope&&<p>{inventory.scope}</p>}
    {inventory.summary&&<p>{inventory.summary.issuerMatches} contratos correspondem ao catálogo de emissores · {inventory.summary.symbolMismatches} com símbolo semelhante e endereço diferente · {inventory.summary.unreferenced} sem referência no catálogo limitado. Essas contagens não são uma divisão entre patrimônio verdadeiro e falso.</p>}
    {inventory.warnings?.map(item=><p key={item} style={{color:'#92400e'}}>{item}</p>)}
    {inventory.available&&<><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}><thead><tr>{['Contrato / mint','Saldo','Identidade'].map(label=><th key={label} style={{padding:10}}>{label}</th>)}</tr></thead><tbody>{inventory.tokens.map(token=><tr key={token.address} style={{borderTop:'1px solid #ddd'}}><td style={{padding:10,maxWidth:220,overflowWrap:'anywhere'}}><strong>{token.symbol||'Símbolo não confirmado'}</strong><br/>{token.address}</td><td style={{padding:10,overflowWrap:'anywhere'}}>{token.amount===null?token.rawBalance+' unidades brutas':token.amount}</td><td style={{padding:10}}>{token.authenticity.label}{token.authenticity.source&&<p><a href={token.authenticity.source} target="_blank" rel="noopener noreferrer">Fonte do emissor</a></p>}</td></tr>)}</tbody></table></div>{!inventory.tokens.length&&<p>Nenhum saldo positivo retornado neste inventário. Isso não descreve ativos fora da cobertura da fonte.</p>}</>}
    <p>Não somamos quantidades de tokens diferentes nem classificamos um saldo como falso apenas pelo símbolo. Correspondência com emissor não garante liquidez, preço, saque ou titularidade.</p>
  </section>;
}
