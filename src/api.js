import { createClient } from '@supabase/supabase-js';
const supabaseUrl=(import.meta.env.VITE_SUPABASE_URL||'').trim();
const supabaseKey=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
export const hasSupabaseConfig=/^https:\/\//.test(supabaseUrl)&&Boolean(supabaseKey);
const safeSupabaseUrl=hasSupabaseConfig?supabaseUrl:'https://configuration-missing.supabase.co';
const safeSupabaseKey=hasSupabaseConfig?supabaseKey:'configuration-missing';
export const supabase=createClient(safeSupabaseUrl,safeSupabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export const apiBase=(import.meta.env.VITE_API_BASE_URL||supabaseUrl+'/functions/v1/kfc-api').trim().replace(/\/+$/,'');
export const apiUrl=path=>apiBase+(path.startsWith('/')?path:'/'+path);
const authStorageKey=()=>{try{return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;}catch{return 'supabase.auth.token';}};
export async function logoutCurrentSession(){
 const storageKey=authStorageKey();
 try{await Promise.race([supabase.auth.signOut({scope:'local'}),new Promise(resolve=>setTimeout(resolve,2500))]);}
 finally{try{localStorage.removeItem(storageKey);}catch{}}
}
const groupIdFrom=path=>path.match(/\/api\/groups\/(\d+)/)?.[1];
// Send an update without taking ownership of the screen's WebSocket channel.
async function broadcastChange(topic){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)return;
 const response=await fetch(supabaseUrl.replace(/\/+$/,'')+'/realtime/v1/api/broadcast/'+encodeURIComponent(topic)+'/events/sync?private=true',{
   method:'POST',
   headers:{apikey:supabaseKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({at:Date.now()}),
   signal:AbortSignal.timeout(5000)
 });
 if(!response.ok)throw new Error('실시간 변경 알림을 보내지 못했습니다.');
}

export const publishGroupChange=groupId=>broadcastChange('kfc-group:'+groupId);

export async function api(path,options={}){
 const init={...options,headers:{apikey:supabaseKey,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}};
 if(init.body&&typeof init.body!=='string')init.body=JSON.stringify(init.body);
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.access_token)init.headers={...init.headers,Authorization:'Bearer '+session.access_token};
 const timeout=AbortSignal.timeout(20000);
 init.signal=init.signal?AbortSignal.any([init.signal,timeout]):timeout;
 let response;
 try{response=await fetch(apiUrl(path),init)}
 catch(error){
   if(timeout.aborted)throw new Error('서버 응답이 지연되고 있습니다. 다시 시도해 주세요.');
   if(error.name==='TypeError')throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.');
   throw error;
 }
 const data=await response.json().catch(()=>null);
 if(response.ok&&!data)throw new Error('서버 응답을 읽을 수 없습니다. 다시 시도해 주세요.');
 if(!response.ok){const error=new Error(data?.message||'요청을 처리하지 못했습니다.');error.status=response.status;error.code=data?.code;throw error;}
 if(path==='/api/auth/login'&&data.session)await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
 if(((path.startsWith('/api/executive/')&&options.method&&options.method!=='GET')||(path.match(/^\/api\/admin\/members\/\d+$/)&&options.body&&typeof options.body.isOfficer==='boolean')))publishExecutiveChange().catch(()=>{});
 const groupId=groupIdFrom(path);
 if(groupId&&/\/api\/groups\/\d+\/(messages|events|todos)/.test(path)&&options.method&&options.method!=='GET')publishGroupChange(groupId).catch(()=>{});
 const directId=path.match(/\/api\/direct-chats\/(\d+)\/messages/)?.[1];if(directId&&options.method&&options.method!=='GET')publishDirectChange(directId).catch(()=>{});
 return data;
}
export const fmtDate=(value,options={dateStyle:'medium',timeStyle:'short'})=>{try{return new Intl.DateTimeFormat('ko-KR',options).format(new Date(value));}catch{return value||'';}};
export const localInput=(date=new Date())=>{const pad=n=>String(n).padStart(2,'0');return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes());};

export const publishExecutiveChange=()=>broadcastChange('kfc-executive');
export const publishDirectChange=chatId=>broadcastChange('kfc-direct:'+chatId);

