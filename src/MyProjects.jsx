import React,{useEffect,useState} from 'react';
import {api,supabase} from './api.js';
import './showroom.css';

const empty={kind:'robot',name:'',description:'',instructions:'',webUrl:''};
const statusLabel={pending:'승인 대기',approved:'쇼룸 게시 중',rejected:'반려'};
export default function MyProjects({user,notify}){
  const [form,setForm]=useState(empty),[file,setFile]=useState(null),[projects,setProjects]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null);
  const load=async()=>{try{const r=await api('/api/my-projects');setProjects(r.projects||[])}catch(e){notify(e.message)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const reset=()=>{setForm(empty);setFile(null);setEditing(null);const input=document.getElementById('my-project-image');if(input)input.value=''};
  const edit=project=>{setEditing(project);setForm({kind:project.kind,name:project.name,description:project.description,instructions:project.instructions||'',webUrl:project.webUrl||''});setFile(null);requestAnimationFrame(()=>{document.querySelector('.my-projects-form')?.scrollIntoView({behavior:'instant',block:'start'});document.querySelector('.my-projects-form input[maxlength="120"]')?.focus({preventScroll:true})})};
  const remove=async project=>{if(!window.confirm('「'+project.name+'」 프로젝트를 완전히 삭제할까요?'))return;setBusy(true);try{const r=await api('/api/my-projects/'+project.id,{method:'DELETE'});notify(r.message);if(editing?.id===project.id)reset();await load()}catch(e){notify(e.message||'프로젝트를 삭제하지 못했습니다.')}finally{setBusy(false)}};
  const submit=async e=>{
    e.preventDefault();
    if(!file&&!editing){notify('프로젝트 사진을 선택해 주세요.');return}
    if(file&&(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(file.type)||file.size>10*1024*1024)){notify('JPG, PNG, WebP, GIF, AVIF 사진을 10MB 이하로 올려 주세요.');return}
    if(form.kind==='webapp'){try{const u=new URL(form.webUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error()}catch{notify('웹앱 주소는 https:// 주소로 입력해 주세요.');return}}
    setBusy(true);
    try{
      let path;
      if(file){const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90)||'project.jpg';path='projects/'+user.id+'/'+crypto.randomUUID()+'/'+safe;const result=await supabase.storage.from('project-images').upload(path,file,{upsert:false,contentType:file.type});if(result.error)throw result.error}
      const r=await api('/api/my-projects'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:{...form,...(path?{imagePath:path}:{})}});
      notify(r.message);
      reset();
      await load();
    }catch(error){notify(error.message||'프로젝트를 제출하지 못했습니다.')}finally{setBusy(false)}
  };
  return <div className="my-projects"><section className="welcome-card"><div><div className="eyebrow light">K.F.C. SHOWROOM</div><h1>My Projects</h1><p>내가 만든 로봇과 웹앱을 쇼룸에 소개해 보세요. 관리자 승인 후 공개됩니다.</p></div><div className="welcome-badge"><span className="spark">✳</span><small>CREATE TOGETHER</small></div></section>
    <section className="surface my-projects-form"><div className="section-heading"><div><div className="eyebrow">SUBMIT YOUR WORK</div><h2>{editing?'프로젝트 수정':'프로젝트 승인 신청'}</h2>{editing&&<p className="muted">수정 후 다시 관리자 승인을 받아 쇼룸에 게시됩니다.</p>}</div></div>
      <form className="form-stack" onSubmit={submit}>
        <fieldset className="my-project-type"><legend>프로젝트 종류</legend><label><input type="radio" name="project-kind" checked={form.kind==='robot'} onChange={()=>update('kind','robot')}/> 로봇 프로젝트</label><label><input type="radio" name="project-kind" checked={form.kind==='webapp'} onChange={()=>update('kind','webapp')}/> 웹앱</label></fieldset>
        <label>{form.kind==='robot'?'로봇 이름':'웹앱 이름'}<input required maxLength="120" value={form.name} onChange={e=>update('name',e.target.value)} placeholder={form.kind==='robot'?'로봇 이름을 입력해 주세요':'웹앱 이름을 입력해 주세요'}/></label>
        <label>사진<input id="my-project-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required={!editing} onChange={e=>setFile(e.target.files?.[0]||null)}/><small>{editing?'사진을 바꾸려면 새 파일을 선택해 주세요. · 최대 10MB':'대표 사진 1장 · 최대 10MB'}</small></label>
        <label>간단한 설명<textarea required maxLength="2000" rows="4" value={form.description} onChange={e=>update('description',e.target.value)} placeholder="무엇을 만들었고 어떤 점이 특별한지 소개해 주세요."/></label>
        {form.kind==='webapp'&&<><label>사용방법<textarea required maxLength="3000" rows="4" value={form.instructions} onChange={e=>update('instructions',e.target.value)} placeholder="처음 사용하는 사람이 따라 할 수 있게 적어 주세요."/></label><label>웹 URL<input required type="url" maxLength="2000" value={form.webUrl} onChange={e=>update('webUrl',e.target.value)} placeholder="https://example.com"/></label></>}
        <div className="button-row"><button className="button primary" disabled={busy}>{busy?'저장 중…':editing?'수정 후 재승인 신청':'승인 신청하기 →'}</button>{editing&&<button type="button" className="button subtle" disabled={busy} onClick={reset}>수정 취소</button>}</div>
      </form>
    </section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">MY SUBMISSIONS</div><h2>내 프로젝트</h2></div><span className="count-pill">{projects.length}개</span></div>
      {loading?<div className="empty-state"><b>프로젝트를 불러오고 있어요…</b></div>:projects.length?<div className="my-project-list">{projects.map(project=><article key={project.id}><img src={project.imageUrl} alt={project.name+' 사진'}/><div className="grow"><span className={'status-pill '+project.status}>{statusLabel[project.status]}</span><h3>{project.name}</h3><small>{project.kind==='robot'?'로봇 프로젝트':'웹앱'}</small><p>{project.description}</p>{project.rejectionReason&&<p className="my-project-reason">반려 사유: {project.rejectionReason}</p>}<div className="button-row"><button className="button subtle" type="button" disabled={busy} onClick={()=>edit(project)}>수정</button><button className="button danger-outline" type="button" disabled={busy} onClick={()=>remove(project)}>삭제</button></div></div></article>)}</div>:<div className="empty-state"><b>제출한 프로젝트가 없습니다.</b><small>위 양식에서 첫 작품을 소개해 주세요.</small></div>}
    </section>
  </div>;
}

