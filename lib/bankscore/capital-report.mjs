import { avaliarIndicador, periodoValido } from './laudo-core.mjs';
import { montarLaudo } from './report-core.mjs';
const fields='codigo_instituicao,nome_instituicao,periodo,tipo_instituicao,codigo_indicador,indice_basileia_bruto,indice_basileia_percentual_provisorio,status';
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
export async function loadCapitalReport({db,target}={}) {
  if(!db)fail('Conexão do BankScore não configurada.',503);
  const codigo=String(target?.codigo||''),periodo=String(target?.periodo||'');
  if(!/^(?:\d{1,12}|C\d{1,12})$/.test(codigo)||!periodoValido(periodo))fail('Escolha uma instituição e um período disponíveis.',400);
  try {
    const current=await db.from('jenios_bankscore_homologacao').select(fields).eq('codigo_instituicao',codigo).eq('periodo',Number(periodo)).eq('codigo_indicador','79664').limit(2);
    if(current.error)throw current.error;
    if(!current.data?.length)fail('Instituição sem indicador neste período.',404);
    if(current.data.length!==1)fail('Indicador duplicado: revisão necessária antes da contratação.',409);
    const row=current.data[0],evaluation=avaliarIndicador(row);
    if(!evaluation.valido||String(row.periodo)!==periodo||row.codigo_instituicao!==codigo)fail('Indicador inconsistente: revisão necessária antes da contratação.',409);
    const history=await db.from('jenios_bankscore_homologacao').select(fields).eq('codigo_instituicao',codigo).eq('codigo_indicador','79664').lte('periodo',Number(periodo)).order('periodo',{ascending:false}).limit(9);
    if(history.error)throw history.error;
    const seen=new Set();
    const historico=(history.data||[]).slice(0,8).map(item=>{
      const period=String(item.periodo);
      if(!periodoValido(period)||seen.has(period)||item.codigo_instituicao!==codigo||Number(period)>Number(periodo))fail('Série histórica inconsistente.',409);
      seen.add(period);const result=avaliarIndicador(item);
      return {periodo:item.periodo,percentual:result.valido?result.percentual:null,revisao:result.revisao};
    });
    const report=montarLaudo({codigo,nome:String(row.nome_instituicao||codigo).slice(0,200),periodo:row.periodo,tipo:row.tipo_instituicao,percentual:evaluation.percentual,revisao:evaluation.revisao,status:row.status});
    const prior=historico.find(item=>Number(item.periodo)<Number(periodo)&&item.percentual!==null);
    return {...report,escopo:'Laudo detalhado do indicador de capitalização disponível, com interpretação e histórico. Não é análise financeira completa nem rating de crédito.',historico,historicoLimitado:(history.data||[]).length>8,
      evolucao:prior?{periodoAnterior:prior.periodo,diferencaPontosPercentuais:Number((evaluation.percentual-prior.percentual).toFixed(4))}:null,
      emitidoEm:new Date().toISOString()};
  }catch(error){if(error.status)throw error;fail('Não foi possível conferir os dados do BankScore. Tente novamente.',503);}
}
