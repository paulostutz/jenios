'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
import SocialDirect from './SocialDirect';
export default function SocialDirectSession({initialPerson}) {
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 const owner=useRef(null);
 useEffect(()=>{
  let live=true,version=0;
  async function refresh(){
   const v=++version;owner.current=null;setUser(null);setLoading(true);
   try{
    const r=await supabase?.auth.getUser();
    if(live&&v===version){
     const verified=!r?.error&&!r?.data?.user?.is_anonymous?r?.data?.user||null:null;
     owner.current=verified?.id||null;setUser(verified);
    }
   }catch{if(live&&v===version)setUser(null);}
   finally{if(live&&v===version)setLoading(false);}
  }
  void refresh();
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   if(session?.user?.id===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   version++;owner.current=null;setUser(null);setLoading(true);
   setTimeout(()=>{if(live)void refresh();},0);
  });
  return()=>{live=false;version++;sub?.data?.subscription?.unsubscribe();};
 },[]);
 if(loading)return <p role="status">Verificando sua conta…</p>;
 return <SocialDirect user={user} initialPerson={initialPerson} onLogin={()=>{window.location.href='/login';}}/>;
}
