"use client";
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {supabase} from '../../../lib/supabase';
import {assistantPath} from '../../../lib/assistant/contracts.mjs';
import s from './AssistantEntry.module.css';
export default function AssistantEntry(){
 const path=usePathname(),[signed,setSigned]=useState(false);
 useEffect(()=>{let live=true,revision=0;const ticket=revision;setSigned(false);Promise.resolve(supabase?.auth.getSession()).then(r=>{if(live&&ticket===revision)setSigned(Boolean(!r?.error&&r?.data?.session?.user?.id&&!r.data.session.user.is_anonymous));}).catch(()=>{});
 const sub=supabase?.auth.onAuthStateChange((_event,session)=>{revision++;if(live)setSigned(Boolean(session?.user?.id&&!session.user.is_anonymous));});return()=>{live=false;sub?.data?.subscription?.unsubscribe();};},[]);
 if(!signed||!assistantPath(path)||path==='/platform/assistente')return null;
 return <a className={s.entry} href="/platform/assistente" aria-label="Abrir atendimento Gênio ou Gênia"><span aria-hidden="true">J</span>Gênio / Gênia · Ajuda</a>;
}