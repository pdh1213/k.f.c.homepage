import { createClient } from '@supabase/supabase-js';
const supabaseUrl=import.meta.env.VITE_SUPABASE_URL||'';
const supabaseKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
export const supabase=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export const apiBase=(import.meta.env.VITE_API_BASE_URL||supabaseUrl+'/functions/v1/kfc-api').trim().replace(/\/+$/,'');
export const apiUrl=path=>apiBase+(path.startsWith('/')?path:'/'+path);
const authStorageKey=()=>{try{return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;}catch{return 'supabase.auth.token';}};
export async function logoutCurrentSession(){
 const storageKey=authStorageKey();
 try{await Promise.race([supabase.auth.signOut({scope:'local'}),new Promise(resolve=>setTimeout(resolve,2500))]);}
 finally{try{localStorage.removeItem(storageKey);}catch{}}
}
const groupIdFrom=path=>path.match(/\/api\/groups\/(\d+)/)?.[1];
export async function publishGroupChange(groupId){
 const {data:{session}}=await supabase.auth.getSession();if(!session)return;
 const channel=supabase.channel('kfc-group:'+groupId,{config:{private:true}});
 await new Promise(resolve=>channel.subscribe(status=>{if(status==='SUBSCRIBED')resolve();}));
 await channel.send({type:'broadcast',event:'sync',payload:{at:Date.now()}});
 await supabase.removeChannel(channel);
}
export async function api(path,options={}){
 const init={...options,headers:{apikey:supabaseKey,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}};
 if(init.body&&typeof init.body!=='string')init.body=JSON.stringify(init.body);
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.access_token)init.headers={...init.headers,Authorization:'Bearer '+session.access_token};
 const response=await fetch(apiUrl(path),init),data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.message||'요청을 처리하지 못했습니다.');error.status=response.status;error.code=data.code;throw error;}
 if(path==='/api/auth/login'&&data.session)await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
 const groupId=groupIdFrom(path);
 if(groupId&&/\/api\/groups\/\d+\/(messages|events|todos)/.test(path)&&options.method&&options.method!=='GET')publishGroupChange(groupId).catch(()=>{});
 return data;
}
export const fmtDate=(value,options={dateStyle:'medium',timeStyle:'short'})=>{try{return new Intl.DateTimeFormat('ko-KR',options).format(new Date(value));}catch{return value||'';}};
export const localInput=(date=new Date())=>{const pad=n=>String(n).padStart(2,'0');return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes());};

