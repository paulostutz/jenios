/**
 * Estado da conta fictícia da JENIOS Platform.
 *
 * Isolado por usuário e sessão. A JENIOS Social mantém suas próprias chaves.
 * Não é saldo bancário, extrato de corretora ou valor financeiro confirmado.
 */
export const DEFAULT_SIMULATED_BALANCE=100000;
const prefix='jenios_platform_simulation_v2:';
export const MAX_SIMULATED_BALANCE=100000000;
const owner=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)?value:'guest';
export const simulationBalanceKey=userId=>prefix+owner(userId)+':balance';
export const simulationPauseKey=userId=>prefix+owner(userId)+':paused';

export function readSimulatedBalance(storage,userId){
 try{
  if(!storage?.getItem)return DEFAULT_SIMULATED_BALANCE;
  const raw=storage.getItem(simulationBalanceKey(userId));
  if(raw===null)return DEFAULT_SIMULATED_BALANCE;
  const num=Number(raw);
  return Number.isFinite(num)&&num>=0&&num<=MAX_SIMULATED_BALANCE?num:DEFAULT_SIMULATED_BALANCE;
 }catch{return DEFAULT_SIMULATED_BALANCE;}
}
export function writeSimulatedBalance(storage,userId,value){
 const amount=Number(value);
 if(value===null||value===undefined||typeof value==='string'&&!value.trim()||
    !Number.isFinite(amount)||amount<0||amount>MAX_SIMULATED_BALANCE)return false;
 try{
  if(!storage?.setItem)return false;
  storage.setItem(simulationBalanceKey(userId),String(amount));
  return true;
 }catch{return false;}
}
export function readSimulationPaused(storage,userId){
 try{return storage?.getItem?.(simulationPauseKey(userId))==='true';}
 catch{return false;}
}
export function writeSimulationPaused(storage,userId,paused){
 if(typeof paused!=='boolean')return false;
 try{
  if(!storage?.setItem)return false;
  storage.setItem(simulationPauseKey(userId),String(paused));
  return true;
 }catch{return false;}
}
