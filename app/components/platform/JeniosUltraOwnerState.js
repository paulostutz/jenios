'use client';
import {useCallback,useEffect,useState} from 'react';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import UltraOwnerState from './UltraOwnerState';
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
 return <UltraOwnerState platform="jenios" subject={owner} load={load}/>;
}
