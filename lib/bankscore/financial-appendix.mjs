import {quarterIncome} from './quarter-income.mjs';
const quarter=p=>/^20\d{2}(03|06|09|12)$/.test(String(p));
const ordinal=p=>Number(String(p).slice(0,4))*4+Number(String(p).slice(4))/3;
const money=x=>Number.isFinite(x)?Math.round(x*100)/100:null;
const labels={totalAssets:'Ativos totais',equity:'Patrimônio líquido',liabilities:'Passivo exigível',loans:'Carteira de crédito',funding:'Captações',netIncomeQuarter:'Resultado do trimestre'};
export function buildFinancialAppendix(snapshot,{codigo,periodo}={}) {
  if(!/^(?:\d{1,12}|C\d{1,12})$/.test(String(codigo))||!quarter(periodo))throw Error('Instituição ou período inválido.');
  if(snapshot?.schemaVersion!==1||snapshot.scope!=='prudential'||snapshot.currency!=='BRL'||snapshot.scale!==1||snapshot.incomeBasis!=='semester_to_date'||!Array.isArray(snapshot.periods))throw Error('Base contábil incompatível.');
  const dates=new Set();for(const p of snapshot.periods){if(!quarter(p.period)||dates.has(p.period))throw Error('Períodos inválidos ou duplicados.');dates.add(p.period);}
  const selected=snapshot.periods.find(p=>String(p.period)===String(periodo));
  const matches=selected?.records.filter(r=>r.code===codigo)||[];
  if(matches.length>1)throw Error('Instituição ambígua.');
  const base={title:'Balanços e evolução trimestral',source:snapshot.source,catalogueUrl:snapshot.catalogueUrl,snapshotAt:snapshot.builtAt,currency:'BRL',scope:'Conglomerados prudenciais e instituições independentes',labels,scoreReady:false};
  if(!matches.length)return {...base,available:false,reason:'Não há balanço correspondente à instituição e ao período contratados nesta base.'};
  const anchor=matches[0];
  const relevant=snapshot.periods.filter(p=>Number(p.period)<=Number(periodo)).sort((a,b)=>b.period-a.period).slice(0,3);
  function lookup(p){const found=p.records.filter(r=>r.internalId===anchor.internalId);if(found.length>1)throw Error('Identidade histórica ambígua.');return found[0]||null;}
  const rows=relevant.map(p=>{
    const record=lookup(p);
    if(!record)return {period:p.period,available:false,values:{},notes:['Instituição não localizada neste período.']};
    const notes=[];const values=Object.fromEntries(Object.keys(labels).map(k=>[k,k==='netIncomeQuarter'?null:money(record.values[k])]));
    const identityConsistent=record.consolidationType===anchor.consolidationType;
    if(!identityConsistent)notes.push('Tipo de consolidação mudou; comparação suspensa.');
    if(record.code!==anchor.code)notes.push('Código exibido pelo BC mudou; vínculo conferido pelo identificador interno do cadastro.');
    if(record.segment!==anchor.segment)notes.push('Segmentação institucional mudou; considerar essa alteração ao comparar os períodos.');
    function income(r,period,documentId){return {institutionCode:anchor.code,period,value:r.values.incomeSemester,currency:'BRL',scale:1,basis:'semester_to_date',scope:'prudential',consolidationId:r.internalId+'|'+r.consolidationType,accountingStandard:'COSIF-2025',sourceUrl:snapshot.catalogueUrl,documentId};}
    let derivation=null;
    try {
      const previous=snapshot.periods.find(x=>Number(x.period)===Number(p.period)-3),prevRecord=previous?lookup(previous):null;
      const calculated=quarterIncome(income(record,p.period,'IFData-'+p.period),prevRecord?income(prevRecord,previous.period,'IFData-'+previous.period):null);
      values.netIncomeQuarter=money(calculated.value);derivation=calculated.derivation;
    }catch{notes.push('Resultado trimestral indisponível: falta base semestral ou trimestre anterior comparável.');}
    return {period:p.period,available:true,code:record.code,name:record.name,internalId:record.internalId,identityConsistent,values,derivation,notes,generationDate:p.generationDate,sources:p.sources};
  });
  const comparable=rows.length===3&&rows.every((r,i)=>r.available&&r.identityConsistent&&(!i||ordinal(rows[i-1].period)-ordinal(r.period)===1));
  const changes={};
  if(comparable)for(const k of Object.keys(labels)){const a=rows[0].values[k],b=rows[1].values[k];changes[k]=a==null||b==null?null:{absolute:money(a-b),percent:b>0?(a-b)/b*100:null};}
  const observations=[];
  if(comparable){
    const equities=rows.map(r=>r.values.equity);
    if(equities.every(x=>x!=null)){
      if(equities[0]<equities[1]&&equities[1]<equities[2])observations.push('O patrimônio líquido diminuiu nas duas comparações consecutivas. A causa exige examinar resultados, distribuições e ajustes patrimoniais.');
      else if(equities[0]>equities[1]&&equities[1]>equities[2])observations.push('O patrimônio líquido aumentou nas duas comparações consecutivas. A expansão, isoladamente, não demonstra menor risco.');
      else observations.push('O patrimônio líquido não apresenta movimento uniforme nos três períodos.');
    }
  }else observations.push('Não foi possível estabelecer três períodos consecutivos com identidade e tipo de consolidação consistentes.');
  if(rows[0]?.values.equity!=null&&rows[0].values.equity<=0)observations.push('O patrimônio líquido informado é nulo ou negativo; é necessário examinar perdas e medidas de recomposição. Isso não determina, por si só, liquidação.');
  if(rows[0]?.values.netIncomeQuarter<0)observations.push('O trimestre mais recente da consulta apresenta prejuízo. Examinar recorrência e causas antes de concluir sobre a situação da instituição.');
  const missing=['Liquidez regulatória e composição dos vencimentos','Inadimplência e cobertura de provisões','Auditoria, notas explicativas e eventos posteriores','Alterações na composição do conglomerado e reapresentações'];
  return {...base,available:true,rows,comparable,changes,observations,missing,
    assessment:'Os dados permitem descrever a evolução contábil apresentada. A cobertura ainda é insuficiente para concluir sobre a conveniência de manter ou investir recursos nesta instituição.',
    limitations:['Esta é uma fotografia dos arquivos do BC coletados na data indicada, sem atualização em tempo real.','A data de geração do relatório do BC não é necessariamente a data original de publicação.','A constância do identificador não comprova que a composição do conglomerado permaneceu idêntica.','O recorte prudencial do IFData pode diferir das demonstrações societárias publicadas pela instituição.'],
    guide:{equity:'Patrimônio líquido: diferença contábil entre ativos e passivos. Não é caixa disponível nem capital regulatório.',totalAssets:'Ativos: recursos e direitos registrados. Crescimento não significa, sozinho, melhora da qualidade.',netIncomeQuarter:'Resultado: lucro ou prejuízo dos três meses. Junho e dezembro foram separados dos acumulados semestrais com o trimestre anterior.',liabilities:'Passivo exigível: obrigações registradas. O total não informa sozinho quando vencem.',loans:'Carteira de crédito: exposição em operações de crédito; o tamanho não informa a qualidade dos devedores.',funding:'Captações: recursos obtidos para financiar operações; exigem análise de custo, concentração e prazo.'}}
}
