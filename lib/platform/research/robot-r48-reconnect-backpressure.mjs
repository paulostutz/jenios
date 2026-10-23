/**
 * R48 — reconnect storms + rate-limit budget + adaptive backpressure.
 * Extends R47 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR48Controller({
  maxQueue=64,
  requestBudget=20,
  budgetWindowMs=1000,
  maxTaskAgeMs=1200,
  baseBackoffMs=100,
  maxBackoffMs=5000
}={}){
  if(!Number.isSafeInteger(maxQueue)||maxQueue<4||
     !Number.isSafeInteger(requestBudget)||requestBudget<1||
     !Number.isSafeInteger(budgetWindowMs)||budgetWindowMs<100||
     !Number.isSafeInteger(maxTaskAgeMs)||maxTaskAgeMs<1||
     !Number.isSafeInteger(baseBackoffMs)||baseBackoffMs<1||
     !Number.isSafeInteger(maxBackoffMs)||maxBackoffMs<baseBackoffMs)
    fail('R48_INVALID_CONFIG');
  return {
    maxQueue,requestBudget,budgetWindowMs,maxTaskAgeMs,baseBackoffMs,maxBackoffMs,
    queue:[],windowStartMs:0,requestsInWindow:0,
    reconnectEpoch:0,connected:false,
    currentBackoffMs:baseBackoffMs,
    nextRetryAtMs:0,
    droppedOverflow:0,droppedStale:0,rateLimited:0,reconnects:0,
    processed:0,falseAllows:0
  };
}

function rollWindow(c,nowMs){
  if(nowMs-c.windowStartMs>=c.budgetWindowMs){
    c.windowStartMs=nowMs;
    c.requestsInWindow=0;
  }
}

export function beginR48Reconnect(c,{nowMs}={}){
  if(!c||!Number.isSafeInteger(nowMs)||nowMs<0)fail('R48_INVALID_RECONNECT');
  c.connected=false;
  c.reconnectEpoch++;
  c.reconnects++;
  c.queue=[];
  c.currentBackoffMs=Math.min(c.maxBackoffMs,Math.max(c.baseBackoffMs,c.currentBackoffMs*2));
  c.nextRetryAtMs=nowMs+c.currentBackoffMs;
  return Object.freeze({
    reconnectEpoch:c.reconnectEpoch,
    nextRetryAtMs:c.nextRetryAtMs,
    backoffMs:c.currentBackoffMs
  });
}

export function markR48Connected(c,{nowMs}={}){
  if(!c||!Number.isSafeInteger(nowMs)||nowMs<0)fail('R48_INVALID_CONNECTED');
  c.connected=true;
  c.currentBackoffMs=c.baseBackoffMs;
  c.nextRetryAtMs=nowMs;
  c.queue=[];
  return Object.freeze({connected:true,reconnectEpoch:c.reconnectEpoch});
}

export function enqueueR48Task(c,{taskId,createdAtMs,reconnectEpoch,payload=null}={}){
  if(!c||typeof taskId!=='string'||!taskId||
     !Number.isSafeInteger(createdAtMs)||createdAtMs<0||
     !Number.isSafeInteger(reconnectEpoch)||reconnectEpoch<0)
    fail('R48_INVALID_TASK');

  if(reconnectEpoch!==c.reconnectEpoch){
    c.droppedStale++;
    return Object.freeze({queued:false,reason:'R48_STALE_RECONNECT_EPOCH'});
  }
  if(c.queue.length>=c.maxQueue){
    c.droppedOverflow++;
    return Object.freeze({queued:false,reason:'R48_QUEUE_OVERFLOW'});
  }
  c.queue.push(Object.freeze({taskId,createdAtMs,reconnectEpoch,payload}));
  return Object.freeze({queued:true,queueSize:c.queue.length});
}

export function consumeR48Budget(c,{nowMs,cost=1}={}){
  if(!c||!Number.isSafeInteger(nowMs)||nowMs<0||
     !Number.isSafeInteger(cost)||cost<1)fail('R48_INVALID_BUDGET_REQUEST');
  rollWindow(c,nowMs);
  if(c.requestsInWindow+cost>c.requestBudget){
    c.rateLimited++;
    return Object.freeze({allow:false,reason:'R48_RATE_LIMIT_BUDGET_EXHAUSTED'});
  }
  c.requestsInWindow+=cost;
  return Object.freeze({allow:true,remaining:c.requestBudget-c.requestsInWindow});
}

export function drainR48Queue(c,{nowMs,maxItems=16}={}){
  if(!c||!Number.isSafeInteger(nowMs)||nowMs<0||
     !Number.isSafeInteger(maxItems)||maxItems<1)fail('R48_INVALID_DRAIN');
  const out=[];
  let processedNow=0;

  while(c.queue.length>0 && processedNow<maxItems){
    const task=c.queue[0];
    const age=nowMs-task.createdAtMs;
    if(task.reconnectEpoch!==c.reconnectEpoch || age>c.maxTaskAgeMs){
      c.queue.shift();
      c.droppedStale++;
      out.push(Object.freeze({taskId:task.taskId,processed:false,reason:'R48_STALE_TASK_DROPPED'}));
      continue;
    }
    if(!c.connected){
      break;
    }
    const budget=consumeR48Budget(c,{nowMs,cost:1});
    if(!budget.allow)break;
    c.queue.shift();
    c.processed++;
    processedNow++;
    out.push(Object.freeze({taskId:task.taskId,processed:true,ageMs:age}));
  }

  return Object.freeze({
    processedNow,
    remainingQueue:c.queue.length,
    results:Object.freeze(out)
  });
}

export function authorizeR48Decision(c,{nowMs,decisionCreatedAtMs,reconnectEpoch}={}){
  if(!c||!Number.isSafeInteger(nowMs)||nowMs<0||
     !Number.isSafeInteger(decisionCreatedAtMs)||decisionCreatedAtMs<0||
     !Number.isSafeInteger(reconnectEpoch)||reconnectEpoch<0)
    fail('R48_INVALID_DECISION');
  if(!c.connected)return Object.freeze({allow:false,reason:'R48_NOT_CONNECTED'});
  if(reconnectEpoch!==c.reconnectEpoch)return Object.freeze({allow:false,reason:'R48_STALE_RECONNECT_EPOCH'});
  if(nowMs-decisionCreatedAtMs>c.maxTaskAgeMs)return Object.freeze({allow:false,reason:'R48_DECISION_EXPIRED'});
  if(c.queue.length>=Math.ceil(c.maxQueue*0.75))return Object.freeze({allow:false,reason:'R48_BACKPRESSURE_HIGH'});
  return Object.freeze({allow:true});
}

export function runR48Battery(){
  const c=createR48Controller({
    maxQueue:8,requestBudget:3,budgetWindowMs:1000,maxTaskAgeMs:500,baseBackoffMs:100,maxBackoffMs:1600
  });

  const r1=beginR48Reconnect(c,{nowMs:0});
  const r2=beginR48Reconnect(c,{nowMs:50});
  const r3=beginR48Reconnect(c,{nowMs:100});
  const increasingBackoff=r1.backoffMs<r2.backoffMs&&r2.backoffMs<r3.backoffMs;

  const staleEpoch=enqueueR48Task(c,{taskId:'old',createdAtMs:100,reconnectEpoch:r2.reconnectEpoch});
  markR48Connected(c,{nowMs:500});

  for(let i=0;i<8;i++)enqueueR48Task(c,{taskId:'q'+i,createdAtMs:500+i,reconnectEpoch:c.reconnectEpoch});
  const overflow=enqueueR48Task(c,{taskId:'overflow',createdAtMs:510,reconnectEpoch:c.reconnectEpoch});
  const highBackpressure=authorizeR48Decision(c,{nowMs:520,decisionCreatedAtMs:515,reconnectEpoch:c.reconnectEpoch});

  const firstDrain=drainR48Queue(c,{nowMs:550,maxItems:8});
  const budgetStopsDrain=firstDrain.processedNow===3&&firstDrain.remainingQueue>0;

  const staleDecision=authorizeR48Decision(c,{nowMs:1200,decisionCreatedAtMs:500,reconnectEpoch:c.reconnectEpoch});
  const secondDrain=drainR48Queue(c,{nowMs:1200,maxItems:8});
  const staleTasksDropped=secondDrain.results.some(x=>x.reason==='R48_STALE_TASK_DROPPED');

  const oldEpoch=c.reconnectEpoch;
  beginR48Reconnect(c,{nowMs:1300});
  const staleAfterReconnect=enqueueR48Task(c,{taskId:'pre-reconnect',createdAtMs:1290,reconnectEpoch:oldEpoch});
  const disconnectedDecision=authorizeR48Decision(c,{nowMs:1310,decisionCreatedAtMs:1305,reconnectEpoch:c.reconnectEpoch});

  return Object.freeze({
    schema:'JENIOS_R48_BATTERY_V1',
    reconnectBackoffIncreases:increasingBackoff,
    staleReconnectEpochBlocked:staleEpoch.queued===false&&staleEpoch.reason==='R48_STALE_RECONNECT_EPOCH',
    queueOverflowBlocked:overflow.queued===false&&overflow.reason==='R48_QUEUE_OVERFLOW',
    highBackpressureBlocksDecision:highBackpressure.allow===false&&highBackpressure.reason==='R48_BACKPRESSURE_HIGH',
    budgetStopsDrain,
    staleDecisionBlocked:staleDecision.allow===false&&staleDecision.reason==='R48_DECISION_EXPIRED',
    staleTasksDropped,
    reconnectInvalidatesOldWork:staleAfterReconnect.queued===false,
    disconnectedDecisionBlocked:disconnectedDecision.allow===false&&disconnectedDecision.reason==='R48_NOT_CONNECTED',
    pass:increasingBackoff&&staleEpoch.queued===false&&overflow.queued===false&&
      highBackpressure.allow===false&&budgetStopsDrain&&staleDecision.allow===false&&
      staleTasksDropped&&staleAfterReconnect.queued===false&&disconnectedDecision.allow===false,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
