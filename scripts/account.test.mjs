import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
import vm from 'node:vm';

test('계정 설정은 본인 프로필만 갱신하고 로그인 정보 변경 시 현재 비밀번호를 확인한다',async()=>{
  const users=[
    {id:1,auth_user_id:'one',auth_email:'one@example.test',username:'original',name:'회원',school:'학교',grade:'1학년',status:'approved',role:'member',site_use_consented_at:'2026-11-22',must_change_password:false,phone:'private'},
    {id:2,auth_user_id:'two',auth_email:'two@example.test',username:'reserved',status:'approved',role:'member'},
  ];
  let password='old-password',temporarySignedOut=0,receive;
  class Profiles {
    filters=[];
    fields=null;
    columns='*';
    select(columns){this.columns=columns;return this}
    update(fields){this.fields=fields;return this}
    eq(key,value){this.filters.push(row=>row[key]===value);return this}
    in(key,values){this.filters.push(row=>values.includes(row[key]));return this}
    not(key,_operator,value){this.filters.push(row=>row[key]!==value);return this}
    limit(){return this}
    single(){return this.result(true)}
    then(resolve,reject){return Promise.resolve(this.result(false)).then(resolve,reject)}
    result(single){
      const rows=users.filter(row=>this.filters.every(filter=>filter(row)));
      if(this.fields?.username&&users.some(user=>user.username===this.fields.username))return {error:{code:'23505'}};
      if(this.fields)rows.forEach(row=>Object.assign(row,this.fields));
      const results=rows.map(row=>this.columns==='*'?row:Object.fromEntries(this.columns.split(',').map(key=>[key,row[key]])));
      return {data:single?results[0]:results};
    }
  }
  const createClient=()=>({
    from(table){assert.equal(table,'users');return new Profiles()},
    auth:{
      async getUser(token){return {data:{user:token==='one'?{id:'one'}:null}}},
      async signInWithPassword(fields){
        return {data:{session:fields.email===users[0].auth_email&&fields.password===password?{access_token:'one',refresh_token:'refresh'}:null}};
      },
      async signOut({scope}){assert.equal(scope,'local');temporarySignedOut++},
      admin:{async updateUserById(id,fields){assert.equal(id,users[0].auth_user_id);password=fields.password;return {error:null}}},
    }
  });
  const source=await readFile(new URL('../supabase/functions/kfc-api/index.ts',import.meta.url),'utf8');
  const {code}=await transformWithEsbuild(source.replace(/^import[^\n]+\n/,''),'index.ts',{loader:'ts'});
  vm.runInNewContext(code,{Deno:{env:{get:()=>undefined},serve:handler=>{receive=handler}},createClient,Response,URL,TextEncoder,atob,console});
  const request=async(path,method='GET',body,token='one')=>{
    const response=await receive(new Request('https://local.test/api/'+path,{
      method,headers:token?{authorization:'Bearer '+token}:{},body:body===undefined?undefined:JSON.stringify(body),
    }));
    return [response.status,await response.json()];
  };
  assert.equal((await request('account/avatars?ids=1','GET',undefined,''))[0],401);
  assert.equal((await request('account','PATCH',{name:''}))[0],400);
  const avatar='data:image/jpeg;base64,/9j//9k=';
  const [saved,profile]=await request('account','PATCH',{id:2,role:'admin',name:'새 이름',school:'새 학교',grade:'2학년',avatarData:avatar});
  assert.equal(saved,200);
  assert.deepEqual([profile.user.id,profile.user.name,profile.user.role,profile.user.school,profile.user.grade,profile.user.avatarData],[1,'새 이름','member','새 학교','2학년',avatar]);
  assert.equal(profile.user.phone,undefined);
  assert.deepEqual((await request('account/avatars?ids=1,2'))[1].avatars,{1:avatar});
  assert.equal((await request('account','PATCH',{name:'새 이름',school:'새 학교',grade:'2학년',avatarData:null}))[1].user.avatarData,null);
  assert.equal((await request('account/username','PATCH',{username:'changed',currentPassword:'incorrect'}))[0],403);
  assert.equal((await request('account/username','PATCH',{username:'reserved',currentPassword:password}))[0],409);
  assert.equal((await request('account/username','PATCH',{username:'changed',currentPassword:password}))[0],200);
  assert.equal((await request('auth/login','POST',{username:'original',password},''))[0],401);
  assert.equal((await request('auth/login','POST',{username:'changed',password},''))[1].user.id,1);
  assert.equal((await request('auth/change-password','POST',{oldPassword:'incorrect',newPassword:'new-password'}))[0],403);
  assert.equal((await request('auth/change-password','POST',{oldPassword:password,newPassword:'new-password'}))[0],200);
  assert.equal((await request('auth/login','POST',{username:'changed',password:'old-password'},''))[0],401);
  assert.equal((await request('auth/login','POST',{username:'changed',password:'new-password'},''))[0],200);
  assert.equal((await request('groups/1/messages','POST',{content:'test'}))[1].code,'CHAT_MOVED');
  assert.equal((await request('direct-chats/1/messages/2/reactions','POST',{emoji:'thumbs up'}))[0],410);
  assert.equal((await request('direct-chats','POST',{memberId:2},''))[0],401);
  assert.equal(temporarySignedOut,3);
});