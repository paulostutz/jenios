'use client';
import {useCallback,useEffect,useState} from 'react';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import UltraOwnerState from './UltraOwnerState';
import UltraCommands from './UltraCommands';
export default function JeniosUltraOwnerState(){
 const [owner,setOwner]=useState(null);
 useEffect(()=>{let active=true,rev=0;const current=rev;
  platformSupabase?.auth?.getSession().then(({data})=>{if(active&&current===rev)setOwner(data?.session?.user?.id??null)}).catch(()=>{});
  const sub=platformSupabase?.auth?.onAuthStateChange((_event,session)=>{rev++;if(active)setOwner(session?.user?.id??null)});
  return()=>{active=false;rev++;sub?.data?.subscription?.unsubscribe()};
 },[]);
 const load=useCallback(async signal=>{
  const {data,error}=await platformSupabase.auth.getSession();const session=data?.session;
  if(error||!owner||session?.user?.id!==owner)throw Error('SESSION_CHANGED');
  const r=await fetch('/api/platform/ultra/state',{signal,cache:'no-store',headers:{Authorization:'Bearer '+session.access_token}});
  if(!r.ok)throw Error('STATE_UNAVAILABLE');const state=await r.json();
  const check=await platformSupabase.auth.getUser();if(check.error||check.data?.user?.id!==owner)throw Error('SESSION_CHANGED');return state;
 },[owner]);
 const send=useCallback(async command=>{
  const {data,error}=await platformSupabase.auth.getSession();const session=data?.session;
  if(error||!owner||session?.user?.id!==owner)throw Error('SESSION_CHANGED');
  const response=await fetch('/api/platform/ultra/commands',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(command),signal:AbortSignal.timeout(15000)});
  const check=await platformSupabase.auth.getUser();if(check.error||check.data?.user?.id!==owner)throw Error('SESSION_CHANGED');
  if(!response.ok)throw Error('COMMAND_UNAVAILABLE');return response.json();
 },[owner]);
 return <><UltraCommands key={owner??'signed-out'} platform="jenios" subject={owner} send={send}/><UltraOwnerState platform="jenios" subject={owner} load={load}/></>;
}
