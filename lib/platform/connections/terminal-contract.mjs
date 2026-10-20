/** B159 validates an offline terminal report. This is not a connected or attested terminal. */
const providers=['profit','mt5','ctrader','ibkr'];
export function inspectTerminalReport(report,expected){
 const deny=code=>({ok:false,code,connected:false,liveExecution:false,verifiedByProvider:false});
 if(!report||typeof report!=='object'||Array.isArray(report)||!expected||typeof expected!=='object')return deny('INVALID_REPORT');
 const keys=['provider','environment','accountReference','terminalVersion','observedAtMs','readOnly','positionCount','pendingOrderCount'];
 if(Object.keys(report).some(k=>!keys.includes(k))||Object.keys(expected).some(k=>!['provider','accountReference','nowMs'].includes(k)))return deny('UNKNOWN_FIELD');
 if(!providers.includes(report.provider)||report.provider!==expected.provider)return deny('WRONG_PROVIDER');
 if(report.environment!=='demo'&&report.environment!=='paper')return deny('LIVE_ACCOUNT_DISABLED');
 if(typeof expected.accountReference!=='string'||!/^[A-Za-z0-9._:-]{1,80}$/.test(expected.accountReference)||report.accountReference!==expected.accountReference)return deny('ACCOUNT_MISMATCH');
 if(report.readOnly!==true)return deny('READ_ONLY_REQUIRED');
 if(!Number.isSafeInteger(expected.nowMs)||!Number.isSafeInteger(report.observedAtMs)||report.observedAtMs<0||report.observedAtMs>expected.nowMs||expected.nowMs-report.observedAtMs>30000)return deny('STALE_REPORT');
 if(typeof report.terminalVersion!=='string'||!/^[A-Za-z0-9._ -]{1,50}$/.test(report.terminalVersion)||!['positionCount','pendingOrderCount'].every(k=>Number.isSafeInteger(report[k])&&report[k]>=0&&report[k]<=10000))return deny('INVALID_REPORT');
 return {ok:true,contractValid:true,provider:report.provider,environment:report.environment,hasExposure:report.positionCount>0||report.pendingOrderCount>0,connected:false,liveExecution:false,verifiedByProvider:false,reason:'Formato do relato validado; assinatura do fornecedor, transporte autenticado e conector instalado ainda não comprovados.'};
}
