'use client';
import {useEffect,useState} from 'react';
const cache=new Map(),running=new Map();
async function read(path,force=false){
 const saved=cache.get(path);
 if(!force&&saved&&Date.now()-saved.at<60000)return saved.data;
 if(running.has(path))return running.get(path);
 const task=(async()=>{
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw Error('Atualização indisponível.');
  const data=await response.json();cache.set(path,{at:Date.now(),data});return data;
 })();
 running.set(path,task);try{return await task;}finally{running.delete(path);}
}
export default function useTrendsData(path='/api/tendencias'){
 const [data,setData]=useState(()=>cache.get(path)?.data||null),[loading,setLoading]=useState(!cache.has(path)),[error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;
  async function refresh(){if(document.hidden)return;try{const d=await read(path,revision>0);if(live){setData(d);setError('');}}catch{if(live)setError('Não foi possível atualizar agora.');}finally{if(live)setLoading(false);}}
  refresh();const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
  return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[path,revision]);
 return {data,loading,error,refresh:()=>{setLoading(true);setRevision(n=>n+1);}};
}
