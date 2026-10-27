/**
 * R47 — market-data freshness fencing after reconnect / handoff.
 * Extends R46 without modifying prior certified controls.
 * Synthetic/offline only. No real or external Paper execution.
 */

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function createR47FeedState({maxAgeMs=750,minConsecutiveFresh=2}={}){
  if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||
     !Number.isSafeInteger(minConsecutiveFresh)||minConsecutiveFresh<1||minConsecutiveFresh>10)
    fail('R47_INVALID_CONFIG');
  return {
    maxAgeMs,
    minConsecutiveFresh,
    connectionGeneration:0,
    sourceEpoch:null,
    lastSequence:null,
    lastExchangeTsMs:null,
    lastAuthoritySeenMs:null,
    freshStreak:0,
    ready:false,
    boundFencingToken:null,
    reconnects:0,
    staleBlocks:0,
    sequenceBlocks:0,
    sourceEpochBlocks:0,
    fenceBlocks:0
  };
}

export function beginR47Connection(feed,{sourceEpoch,fencingToken}={}){
  if(!feed||!Number.isSafeInteger(sourceEpoch)||sourceEpoch<1||
     !Number.isSafeInteger(fencingToken)||fencingToken<1) fail('R47_INVALID_CONNECTION');
  feed.connectionGeneration++;
  feed.sourceEpoch=sourceEpoch;
  feed.lastSequence=null;
  feed.lastExchangeTsMs=null;
  feed.lastAuthoritySeenMs=null;
  feed.freshStreak=0;
  feed.ready=false;
  feed.boundFencingToken=fencingToken;
  feed.reconnects++;
  return Object.freeze({
    connectionGeneration:feed.connectionGeneration,
    sourceEpoch,
    fencingToken,
    ready:false
  });
}

export function ingestR47MarketData(feed,{
  sourceEpoch,sequence,exchangeTsMs,authorityNowMs,fencingToken
}={}){
  if(!feed||!Number.isSafeInteger(sourceEpoch)||sourceEpoch<1||
     !Number.isSafeInteger(sequence)||sequence<1||
     !Number.isSafeInteger(exchangeTsMs)||exchangeTsMs<0||
     !Number.isSafeInteger(authorityNowMs)||authorityNowMs<0||
     !Number.isSafeInteger(fencingToken)||fencingToken<1) fail('R47_INVALID_MARKET_EVENT');

  const ageMs=authorityNowMs-exchangeTsMs;
  if(fencingToken!==feed.boundFencingToken){
    feed.ready=false;feed.freshStreak=0;feed.fenceBlocks++;
    return Object.freeze({accepted:false,ready:false,reason:'R47_FENCING_TOKEN_MISMATCH',ageMs});
  }
  if(sourceEpoch!==feed.sourceEpoch){
    feed.ready=false;feed.freshStreak=0;feed.sourceEpochBlocks++;
    return Object.freeze({accepted:false,ready:false,reason:'R47_SOURCE_EPOCH_MISMATCH',ageMs});
  }
  if(ageMs<0||ageMs>feed.maxAgeMs){
    feed.ready=false;feed.freshStreak=0;feed.staleBlocks++;
    return Object.freeze({accepted:false,ready:false,reason:'R47_STALE_MARKET_DATA',ageMs});
  }
  if(feed.lastSequence!==null && sequence!==feed.lastSequence+1){
    feed.ready=false;feed.freshStreak=0;feed.sequenceBlocks++;
    return Object.freeze({accepted:false,ready:false,reason:'R47_SEQUENCE_GAP',ageMs});
  }
  if(feed.lastExchangeTsMs!==null && exchangeTsMs<feed.lastExchangeTsMs){
    feed.ready=false;feed.freshStreak=0;feed.staleBlocks++;
    return Object.freeze({accepted:false,ready:false,reason:'R47_NON_MONOTONIC_EXCHANGE_TIME',ageMs});
  }

  feed.lastSequence=sequence;
  feed.lastExchangeTsMs=exchangeTsMs;
  feed.lastAuthoritySeenMs=authorityNowMs;
  feed.freshStreak++;
  feed.ready=feed.freshStreak>=feed.minConsecutiveFresh;
  return Object.freeze({
    accepted:true,
    ready:feed.ready,
    reason:feed.ready?null:'R47_FRESH_CONFIRMATION_PENDING',
    ageMs,
    freshStreak:feed.freshStreak
  });
}

export function authorizeR47Decision(feed,{authorityNowMs,fencingToken,sourceEpoch}={}){
  if(!feed||!Number.isSafeInteger(authorityNowMs)||authorityNowMs<0||
     !Number.isSafeInteger(fencingToken)||fencingToken<1||
     !Number.isSafeInteger(sourceEpoch)||sourceEpoch<1) fail('R47_INVALID_DECISION_CHECK');

  if(fencingToken!==feed.boundFencingToken){
    feed.ready=false;feed.fenceBlocks++;
    return Object.freeze({allow:false,reason:'R47_FENCING_TOKEN_MISMATCH'});
  }
  if(sourceEpoch!==feed.sourceEpoch){
    feed.ready=false;feed.sourceEpochBlocks++;
    return Object.freeze({allow:false,reason:'R47_SOURCE_EPOCH_MISMATCH'});
  }
  if(!feed.ready||feed.lastExchangeTsMs===null){
    return Object.freeze({allow:false,reason:'R47_FEED_NOT_READY'});
  }
  const ageMs=authorityNowMs-feed.lastExchangeTsMs;
  if(ageMs<0||ageMs>feed.maxAgeMs){
    feed.ready=false;feed.freshStreak=0;feed.staleBlocks++;
    return Object.freeze({allow:false,reason:'R47_STALE_MARKET_DATA',ageMs});
  }
  return Object.freeze({allow:true,ageMs});
}

export function rotateR47LeaderFence(feed,{newFencingToken}={}){
  if(!feed||!Number.isSafeInteger(newFencingToken)||newFencingToken<1) fail('R47_INVALID_FENCE_ROTATION');
  feed.boundFencingToken=newFencingToken;
  feed.ready=false;
  feed.freshStreak=0;
  return Object.freeze({boundFencingToken:newFencingToken,ready:false});
}

export function runR47Battery(){
  const feed=createR47FeedState({maxAgeMs:750,minConsecutiveFresh:2});
  beginR47Connection(feed,{sourceEpoch:10,fencingToken:5});

  const first=ingestR47MarketData(feed,{
    sourceEpoch:10,sequence:100,exchangeTsMs:1000,authorityNowMs:1100,fencingToken:5
  });
  const second=ingestR47MarketData(feed,{
    sourceEpoch:10,sequence:101,exchangeTsMs:1200,authorityNowMs:1250,fencingToken:5
  });
  const decision1=authorizeR47Decision(feed,{authorityNowMs:1300,fencingToken:5,sourceEpoch:10});

  const stale=ingestR47MarketData(feed,{
    sourceEpoch:10,sequence:102,exchangeTsMs:1200,authorityNowMs:2100,fencingToken:5
  });

  beginR47Connection(feed,{sourceEpoch:11,fencingToken:5});
  const oldEpoch=ingestR47MarketData(feed,{
    sourceEpoch:10,sequence:200,exchangeTsMs:2200,authorityNowMs:2250,fencingToken:5
  });
  const fresh1=ingestR47MarketData(feed,{
    sourceEpoch:11,sequence:1,exchangeTsMs:2300,authorityNowMs:2350,fencingToken:5
  });
  const gap=ingestR47MarketData(feed,{
    sourceEpoch:11,sequence:3,exchangeTsMs:2400,authorityNowMs:2450,fencingToken:5
  });

  beginR47Connection(feed,{sourceEpoch:12,fencingToken:5});
  ingestR47MarketData(feed,{sourceEpoch:12,sequence:1,exchangeTsMs:2500,authorityNowMs:2550,fencingToken:5});
  ingestR47MarketData(feed,{sourceEpoch:12,sequence:2,exchangeTsMs:2600,authorityNowMs:2650,fencingToken:5});
  const preHandoff=authorizeR47Decision(feed,{authorityNowMs:2700,fencingToken:5,sourceEpoch:12});

  rotateR47LeaderFence(feed,{newFencingToken:6});
  const staleFenceDecision=authorizeR47Decision(feed,{authorityNowMs:2720,fencingToken:5,sourceEpoch:12});
  const oldFenceData=ingestR47MarketData(feed,{
    sourceEpoch:12,sequence:3,exchangeTsMs:2730,authorityNowMs:2740,fencingToken:5
  });

  beginR47Connection(feed,{sourceEpoch:13,fencingToken:6});
  const post1=ingestR47MarketData(feed,{
    sourceEpoch:13,sequence:1,exchangeTsMs:2800,authorityNowMs:2840,fencingToken:6
  });
  const post2=ingestR47MarketData(feed,{
    sourceEpoch:13,sequence:2,exchangeTsMs:2860,authorityNowMs:2890,fencingToken:6
  });
  const finalDecision=authorizeR47Decision(feed,{authorityNowMs:2920,fencingToken:6,sourceEpoch:13});

  return Object.freeze({
    schema:'JENIOS_R47_BATTERY_V1',
    initialRequiresTwoFreshSnapshots:first.ready===false&&second.ready===true,
    initialDecisionAllowed:decision1.allow===true,
    staleSnapshotBlocked:stale.accepted===false&&stale.reason==='R47_STALE_MARKET_DATA',
    oldSourceEpochBlocked:oldEpoch.accepted===false&&oldEpoch.reason==='R47_SOURCE_EPOCH_MISMATCH',
    sequenceGapBlocksReadiness:gap.accepted===false&&gap.reason==='R47_SEQUENCE_GAP',
    freshAfterReconnectMustReconfirm:fresh1.ready===false,
    preHandoffDecisionAllowed:preHandoff.allow===true,
    staleLeaderDecisionBlocked:staleFenceDecision.allow===false&&staleFenceDecision.reason==='R47_FENCING_TOKEN_MISMATCH',
    oldFenceMarketDataBlocked:oldFenceData.accepted===false&&oldFenceData.reason==='R47_FENCING_TOKEN_MISMATCH',
    newLeaderMustResync:post1.ready===false&&post2.ready===true,
    finalDecisionAllowed:finalDecision.allow===true,
    pass:first.ready===false&&second.ready===true&&decision1.allow===true&&
      stale.accepted===false&&oldEpoch.accepted===false&&gap.accepted===false&&
      fresh1.ready===false&&preHandoff.allow===true&&staleFenceDecision.allow===false&&
      oldFenceData.accepted===false&&post1.ready===false&&post2.ready===true&&finalDecision.allow===true,
    noExecution:true,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
    ordersSent:0,paperOrdersSent:0
  });
}
