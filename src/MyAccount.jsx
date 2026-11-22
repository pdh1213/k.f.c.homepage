import React,{useEffect,useMemo,useState} from 'react';
import {api} from './api.js';
import AccountPanel from './AccountPanel.jsx';

export default function MyAccount({user,onUpdate}) {
  async function save(path,method,body){
    const result=await api(path,{method,body});
    if(result.user)onUpdate(result.user);
    return result.message;
  }
  return <AccountPanel profile={user}
    saveProfile={data=>save('/api/account','PATCH',data)}
    saveUsername={data=>save('/api/account/username','PATCH',data)}
    savePassword={data=>save('/api/auth/change-password','POST',data)}/>;
}

export function useAccountAvatars(ids) {
  const key=[...new Set(ids.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].sort((a,b)=>a-b).join(',');
  const [result,setResult]=useState({key:'',avatars:{}});
  const requested=useMemo(()=>key?key.split(','):[],[key]);
  useEffect(()=>{
    if(!requested.length)return;
    const controller=new AbortController();
    const batches=[];
    for(let offset=0;offset<requested.length;offset+=40)batches.push(requested.slice(offset,offset+40).join(','));
    const refresh=async()=>{
      const entries=await Promise.allSettled(batches.map(batch=>api('/api/account/avatars?ids='+encodeURIComponent(batch),{signal:controller.signal})));
      if(controller.signal.aborted)return;
      const loaded=entries.filter(entry=>entry.status==='fulfilled');
      if(loaded.length)setResult({key,avatars:Object.assign({},...loaded.map(entry=>entry.value.avatars))});
    };
    refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
    return()=>{controller.abort();window.clearInterval(timer)};
  },[key,requested]);
  return result.key===key?result.avatars:{};
}
