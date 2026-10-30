import React,{useEffect,useState} from 'react';
import {api,fmtDate,localInput,supabase} from './api.js';
import NoticePopupAdmin from './NoticePopupAdmin.jsx';
import LiquidNavbar,{NimbusIcons} from '../components/ui/liquid-glass-navbar.tsx';
import './showroom.css';

const tabs=[
  ['overview','개요'],['applications','승인'],['members','회원 관리'],['announcements','공지사항'],
  ['events','전체 일정'],['polls','설문 관리'],['groups','그룹 관리'],['showroom','쇼룸 관리'],['settings','설정']
];
const stateLabel={pending:'승인 대기',approved:'승인 완료',rejected:'반려'};
const liquidAdminLabels={overview:'Overview',applications:'Approvals',members:'Members',announcements:'Notices',events:'Calendar',polls:'Surveys',groups:'Groups',showroom:'Showroom',settings:'Settings'};
export function AccessDenied({go}){return <div className="center-page"><section className="surface access-card"><div className="brand-image large"><img src="/kfc-logo.png" alt="K.F.C. 동아리 로고"/></div><h1>접근 권한이 없습니다</h1><p className="muted">관리자만 이 화면을 이용할 수 있습니다.</p><button className="button primary" onClick={()=>go('/dashboard')}>회원 홈으로</button></section></div>;}
export function Toast({message}){return message?<div className="toast" role="status"><span>✓</span>{message}</div>:null;}
function Empty({title,detail}){return <div className="empty-state"><span>✳</span><b>{title}</b>{detail&&<small>{detail}</small>}</div>;}

export function AdminShell({user,go,logout,notify,toast,blocked}){
  const [tab,setTab]=useState('overview'),[data,setData]=useState(null),[loading,setLoading]=useState(false),[query,setQuery]=useState('');
  const [settings,setSettings]=useState(null);
  const load=async(which=tab,q=query)=>{
    setLoading(true);
    const url={
      overview:'/api/admin/overview',
      applications:'/api/admin/applications?status='+encodeURIComponent(q||'pending'),
      members:'/api/admin/members?q='+encodeURIComponent(q),
      announcements:'/api/admin/announcements',
      events:'/api/admin/events',
      polls:'/api/admin/polls',
      groups:'/api/admin/groups',
      showroom:'/api/admin/competitions',
      settings:'/api/admin/settings'
    }[which];
    try{const r=await api(url);setData(r);if(which==='settings')setSettings(r);}
    catch(e){notify(e.message);if(e.status===401||e.status===403)go('/');}
    finally{setLoading(false);}
  };
  useEffect(()=>{load(tab,tab==='applications'?'pending':'');},[tab]);
  const select=key=>{setTab(key);setQuery('');setData(null);};
  return <div className="admin-shell" inert={blocked}>
    <aside className="sidebar admin-sidebar">
      <button className="brand-link" onClick={()=>select('overview')}><span className="brand-image small"><img src="/kfc-logo.png" alt="K.F.C."/></span><span>K.F.C.<small>ADMIN CONSOLE</small></span></button>
      <div className="club-label">관리자 메뉴</div><nav>{tabs.map(([key,label])=><button key={key} className={'nav-item '+(tab===key?'active':'')} onClick={()=>select(key)}><span className="nav-icon">{['overview','applications','members','announcements','events','polls','groups','showroom','settings'].indexOf(key)+1}</span>{label}{key==='applications'&&data?.pending>0&&tab==='overview'&&<i className="nav-count">{data.pending}</i>}</button>)}</nav>
      <div className="mobile-liquid-nav"><LiquidNavbar items={tabs.map(([key],i)=>({label:liquidAdminLabels[key],icon:[NimbusIcons.home,NimbusIcons.globe,NimbusIcons.drop,NimbusIcons.plane,NimbusIcons.user][i%5],fx:['glow','spin','drop','plane','wave'][i%5]}))} active={tabs.findIndex(([key])=>key===tab)} onChange={index=>select(tabs[index][0])} tone="light" sound={false}/></div>
      <div className="sidebar-bottom"><div className="user-card"><div className="avatar club-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></div><div><b>{user.name}</b><small>관리자</small></div><button className="logout-button" onClick={logout}>로그아웃</button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><span className="crumb">K.F.C. / 관리자</span><strong>{tabs.find(t=>t[0]===tab)?.[1]}</strong></div><div className="topbar-right"><span className="shield">✓</span>관리자 인증됨<button className="topbar-logout" onClick={logout}>로그아웃</button></div></header>
      <div className="desktop-liquid-nav"><LiquidNavbar items={tabs.map(([key],i)=>({label:liquidAdminLabels[key],icon:[NimbusIcons.home,NimbusIcons.globe,NimbusIcons.drop,NimbusIcons.plane,NimbusIcons.user][i%5],fx:['glow','spin','drop','plane','wave'][i%5]}))} active={tabs.findIndex(([key])=>key===tab)} onChange={index=>select(tabs[index][0])} tone="light" sound={false}/></div>
      <div className="page-body admin-body">{loading&&!data?<div className="loading-card">관리자 정보를 불러오고 있어요…</div>:tab==='overview'?<Overview data={data} select={select} refresh={()=>load('overview','')}/>:
        tab==='applications'?<Approvals data={data} refresh={status=>load('applications',status||query||'pending')} notify={notify} query={query} setQuery={setQuery}/>:
        tab==='members'?<Members data={data} refresh={()=>load('members',query)} notify={notify} query={query} setQuery={setQuery}/>:
        tab==='announcements'?<AnnouncementAdmin data={data} refresh={()=>load('announcements','')} notify={notify} user={user}/>:
        tab==='events'?<EventAdmin data={data} refresh={()=>load('events','')} notify={notify}/>:
        tab==='polls'?<PollAdmin data={data} refresh={()=>load('polls','')} notify={notify}/>:
        tab==='groups'?<GroupAdmin data={data} refresh={()=>load('groups','')} notify={notify}/>:
        tab==='showroom'?<CompetitionAdmin data={data} notify={notify} refresh={()=>load('showroom','')}/>:<SettingsAdmin data={settings||data} notify={notify} refresh={()=>load('settings','')}/>}
      </div>
    </main>
    {toast&&<Toast message={toast}/>}
  </div>;
}
function Overview({data,select,refresh}){
  return <div className="dashboard-content"><section className="welcome-card admin-welcome"><div><div className="eyebrow light">ADMIN CONSOLE</div><h1>K.F.C. 운영 센터</h1><p>가입부터 일정과 그룹 운영까지 한곳에서 관리합니다.</p></div><div className="welcome-badge"><div className="spark">⌘</div><small>MANAGE TOGETHER</small></div></section>
    <div className="stats-grid">{[['가입 승인 대기',data?.pending||0,'applications','orange'],['승인 회원',data?.approved||0,'members','blue'],['게시된 공지',data?.announcements||0,'announcements','violet'],['활성 그룹',data?.groups||0,'groups','green']].map(([label,count,key,color])=><button className="stat-card" key={label} onClick={()=>select(key)}><span className={'quick-icon '+color}>✳</span><small>{label}</small><b>{count}</b><span className="text-button">관리하기 →</span></button>)}</div>
    <div className="surface admin-shortcuts"><div className="section-heading"><div><div className="eyebrow">SHORTCUTS</div><h2>자주 쓰는 작업</h2></div><button className="text-button" onClick={refresh}>새로고침 ↻</button></div><div className="shortcut-grid">{[['applications','가입 신청 확인'],['announcements','공지 작성'],['events','일정 등록'],['groups','그룹 만들기']].map(([key,label])=><button className="button secondary" key={key} onClick={()=>select(key)}>{label} →</button>)}</div></div>
  </div>;
}

function Approvals(props){
  const [kind,setKind]=useState('members');
  return <div className="admin-manager"><div className="officer-tabs approval-kind-tabs"><button className={kind==='members'?'active':''} onClick={()=>setKind('members')}>회원 가입 신청</button><button className={kind==='projects'?'active':''} onClick={()=>setKind('projects')}>프로젝트 승인</button></div>{kind==='members'?<MemberApplications {...props}/>:<ProjectApprovals notify={props.notify}/>}</div>;
}
function ProjectApprovals({notify}){
  const [status,setStatus]=useState('pending'),[projects,setProjects]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(null);
  const load=async(next=status)=>{setLoading(true);try{const r=await api('/api/admin/projects?status='+next);setProjects(r.projects||[])}catch(e){notify(e.message)}finally{setLoading(false)}};
  useEffect(()=>{load(status)},[status]);
  const decide=async(project,action)=>{
    let reason='';
    if(action==='reject'){const answer=window.prompt('반려 사유를 입력해 주세요.','');if(answer===null)return;reason=answer}
    setBusy(project.id);
    try{const r=await api('/api/admin/projects/'+project.id+'/decision',{method:'POST',body:{action,reason}});notify(r.message);await load(status)}catch(e){notify(e.message)}finally{setBusy(null)}
  };
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">SHOWROOM APPROVAL</div><h1>프로젝트 승인</h1><p className="muted">승인된 작품만 공개 쇼룸에 게시됩니다.</p></div><span className="count-pill">{projects.length}건</span></div>
    <div className="toolbar"><label>신청 상태<select value={status} onChange={e=>setStatus(e.target.value)}><option value="pending">승인 대기</option><option value="approved">승인 완료</option><option value="rejected">반려</option></select></label><button className="button subtle" onClick={()=>load(status)}>새로고침 ↻</button></div>
    {loading?<div className="empty-state"><b>프로젝트를 불러오고 있어요…</b></div>:projects.length?<div className="approval-project-list">{projects.map(project=><article key={project.id} className="application-card"><div className="approval-project-head"><img src={project.imageUrl} alt={project.name+' 사진'}/><div><span className="eyebrow">{project.kind==='robot'?'ROBOT PROJECT':'WEB APP'}</span><h2>{project.name}</h2><small>{project.author} @{project.username} · {new Date(project.createdAt).toLocaleDateString('ko-KR')}</small></div></div><p>{project.description}</p>{project.kind==='webapp'&&<><p><b>사용방법:</b> {project.instructions}</p><p><b>웹 URL:</b> <a href={project.webUrl} target="_blank" rel="noopener noreferrer">{project.webUrl}</a></p></>}{project.rejectionReason&&<p className="my-project-reason">반려 사유: {project.rejectionReason}</p>}{status==='pending'&&<div className="button-row"><button className="button primary" disabled={busy===project.id} onClick={()=>decide(project,'approve')}>승인 · 쇼룸 게시</button><button className="button danger-outline" disabled={busy===project.id} onClick={()=>decide(project,'reject')}>반려</button></div>}</article>)}</div>:<div className="empty-state"><b>해당 상태의 프로젝트가 없습니다.</b></div>}
  </section>;
}
function CompetitionAdmin({data,notify,refresh}){
  const blank=()=>({title:'',year:new Date().getFullYear(),result:'',description:'',published:true});
  const [form,setForm]=useState(blank),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false);
  const save=async e=>{e.preventDefault();setBusy(true);try{const r=await api('/api/admin/competitions'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:form});notify(r.message);setForm(blank());setEditing(null);refresh()}catch(e){notify(e.message)}finally{setBusy(false)}};
  const remove=async item=>{if(!window.confirm(item.title+' 대회 이력을 삭제할까요?'))return;try{const r=await api('/api/admin/competitions/'+item.id,{method:'DELETE'});notify(r.message);refresh()}catch(e){notify(e.message)}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">K.F.C. SHOWROOM</div><h1>대회 경험 관리</h1><p className="muted">실제 출전 기록을 등록하면 쇼룸에서 외부인에게 소개할 수 있습니다.</p><form className="form-stack" onSubmit={save}><label>대회 이름<input required maxLength="160" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-grid"><label>연도<input type="number" min="2000" max="2100" required value={form.year} onChange={e=>setForm({...form,year:Number(e.target.value)})}/></label><label>결과 또는 참가 부문<input maxLength="160" value={form.result} onChange={e=>setForm({...form,result:e.target.value})} placeholder="예: 로봇 경진 부문 참가"/></label></div><label>활동 내용<textarea rows="4" maxLength="3000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="준비 과정과 경험을 적어 주세요."/></label><label className="check-label"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/>쇼룸에 공개</label><div className="button-row"><button className="button primary" disabled={busy}>{busy?'저장 중…':editing?'수정 저장':'대회 이력 등록'}</button>{editing&&<button type="button" className="button subtle" onClick={()=>{setEditing(null);setForm(blank())}}>취소</button>}</div></form></section>
    <section className="surface"><div className="section-heading"><h2>등록된 대회 경험</h2><span className="count-pill">{data?.competitions?.length||0}건</span></div>{data?.competitions?.length?data.competitions.map(c=><article className="manage-row" key={c.id}><div className="grow"><b>{c.year} · {c.title}</b><small>{c.result||'결과 미입력'} · {c.published?'공개':'비공개'}</small><p>{c.description}</p></div><button className="button subtle" onClick={()=>{setEditing(c);setForm({title:c.title,year:c.year,result:c.result,description:c.description,published:c.published})}}>수정</button><button className="button danger-outline" onClick={()=>remove(c)}>삭제</button></article>):<div className="empty-state"><b>대회 경험이 아직 없습니다.</b></div>}</section></div>;
}

function MemberApplications({data,refresh,notify,query,setQuery}){
  const [status,setStatus]=useState('pending');
  const changeStatus=async(id,action)=>{
    let reason='';
    if(action==='reject'){reason=window.prompt('반려 사유를 입력해 주세요.','')||'';}
    try{const r=await api('/api/admin/applications/'+id+'/decision',{method:'POST',body:{action,reason}});notify(r.message);refresh();}
    catch(e){notify(e.message);}
  };
  const loadStatus=(next)=>{setStatus(next);setQuery(next);refresh(next)};
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">MEMBERSHIP</div><h1>가입 신청</h1><p className="muted">승인 전 신청자는 회원 정보에 접근할 수 없습니다.</p></div><span className="count-pill">{data?.applications?.length||0}명</span></div>
    <div className="toolbar"><label>신청 상태<select value={status} onChange={e=>loadStatus(e.target.value)}><option value="pending">승인 대기</option><option value="approved">승인 완료</option><option value="rejected">반려</option></select></label><button className="button subtle" onClick={refresh}>새로고침 ↻</button></div>
    {data?.applications?.length?data.applications.map(a=><article className="application-card" key={a.id}><div className="application-top"><div><h2>{a.name}<small className="username">@{a.username}</small></h2><span className={'status-pill '+a.status}>{stateLabel[a.status]}</span></div><time>{fmtDate(a.createdAt)}</time></div>
      <div className="private-grid"><div><small>나이</small><b>{a.age}세</b></div><div><small>학교 / 학년</small><b>{a.school} · {a.grade}</b></div><div><small>전화번호</small><b>{a.phone}</b></div></div>
      {a.rejectionReason&&<p className="muted">반려 사유: {a.rejectionReason}</p>}
      {a.status==='pending'&&<div className="button-row"><button className="button primary" onClick={()=>changeStatus(a.id,'approve')}>승인</button><button className="button danger-outline" onClick={()=>changeStatus(a.id,'reject')}>반려</button></div>}
    </article>):<div className="empty-state"><span>✓</span><b>{status==='pending'?'새 가입 신청이 없습니다.':'해당 상태의 신청이 없습니다.'}</b></div>}
  </section>;
}
function Members({data,refresh,notify,query,setQuery}){
  const [search,setSearch]=useState(query),[editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null);
  const runSearch=async e=>{e.preventDefault();setQuery(search);try{const r=await api('/api/admin/members?q='+encodeURIComponent(search));data.members=r.members;}catch(e){notify(e.message);}refresh();};
  const deleteMember=async m=>{if(!window.confirm(m.name+' 회원의 계정을 완전히 삭제할까요? 이 회원의 그룹 메시지·설문 응답과 참여한 1:1 대화방 전체가 삭제됩니다. 공유 일정과 할 일은 작성자 표시 없이 유지됩니다.'))return;setDeleting(m.id);try{const r=await api('/api/admin/members/'+m.id,{method:'DELETE'});notify(r.message);if(editing?.id===m.id)setEditing(null);await refresh()}catch(e){notify(e.message)}finally{setDeleting(null)}};
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">MEMBER DIRECTORY</div><h1>회원 관리</h1><p className="muted">이 정보는 관리자만 확인할 수 있습니다.</p></div></div>
    <form className="search-form" onSubmit={runSearch}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 아이디, 학교 또는 전화번호 검색"/><button className="button secondary">검색</button></form>
    {data?.members?.length?data.members.map(m=><article className="member-admin-row" key={m.id}><div className="avatar">{m.name.slice(0,1)}</div><div className="member-admin-info"><b>{m.name} <small>@{m.username}</small></b><small>{m.school} · {m.grade} · {m.age}세 · {m.phone}</small></div><span className={'status-pill '+m.status}>{stateLabel[m.status]}</span><button className={m.isOfficer?'button danger-outline':'button secondary'} disabled={m.status!=='approved'} onClick={async()=>{try{await api('/api/admin/members/'+m.id,{method:'PATCH',body:{isOfficer:!m.isOfficer}});notify(m.isOfficer?'임원 권한을 해지했습니다.':'임원으로 지정했습니다.');refresh();}catch(e){notify(e.message);}}}>{m.isOfficer?'임원 해지':'임원 지정'}</button><button className="button subtle" onClick={()=>setEditing(m)}>수정</button><button className="button danger-outline" disabled={deleting===m.id} onClick={()=>deleteMember(m)}>{deleting===m.id?'삭제 중…':'삭제'}</button></article>):<Empty title="검색된 회원이 없습니다."/>}
    {editing&&<Modal title="회원 정보 수정" close={()=>setEditing(null)}><MemberEditor member={editing} save={async body=>{try{await api('/api/admin/members/'+editing.id,{method:'PATCH',body});notify('회원 정보를 저장했습니다.');setEditing(null);refresh();}catch(e){notify(e.message);}}}/></Modal>}
  </section>;
}
function MemberEditor({member,save}){
  const [v,setV]=useState({...member});
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();save({...v,age:Number(v.age)});}}>
    <label>이름<input required value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label><div className="form-grid">
    <label>나이<input required type="number" value={v.age} onChange={e=>setV({...v,age:e.target.value})}/></label><label>학교<input required value={v.school} onChange={e=>setV({...v,school:e.target.value})}/></label>
    <label>학년<input required value={v.grade} onChange={e=>setV({...v,grade:e.target.value})}/></label><label>전화번호<input required value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/></label></div>
    <label>회원 상태<select value={v.status} onChange={e=>setV({...v,status:e.target.value})}><option value="pending">승인 대기</option><option value="approved">승인 완료</option><option value="rejected">반려</option></select></label>
    <button className="button primary">저장</button>
  </form>;
}
function Modal({title,close,children}){return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section className="modal-card" role="dialog" aria-modal="true"><div className="section-heading"><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={close}>×</button></div>{children}</section></div>;}

function AnnouncementAdmin({data,refresh,notify,user}){
  const [form,setForm]=useState({title:'',content:'',published:true,imagePaths:[]}),[editing,setEditing]=useState(null),[files,setFiles]=useState([]),[busy,setBusy]=useState(false);
  const reset=()=>{setForm({title:'',content:'',published:true,imagePaths:[]});setFiles([]);setEditing(null);};
  const save=async e=>{e.preventDefault();setBusy(true);try{const uploaded=[];for(const file of files){if(!file.type.startsWith('image/')||file.type==='image/svg+xml'||file.size>10*1024*1024)throw new Error('PNG, JPG, GIF, WebP, AVIF 사진을 장당 10MB까지 첨부할 수 있습니다.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'photo';const path='announcements/'+user.id+'/'+crypto.randomUUID()+'/'+safe;const result=await supabase.storage.from('announcement-images').upload(path,file,{upsert:false,contentType:file.type});if(result.error)throw result.error;uploaded.push(path)}const body={title:form.title,content:form.content,published:form.published,imagePaths:[...form.imagePaths,...uploaded]};await api('/api/admin/announcements'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body});notify(editing?'공지사항을 수정했습니다.':'공지사항을 등록했습니다.');reset();refresh();}catch(e){notify(e.message||'사진을 올리지 못했습니다.')}finally{setBusy(false)}};
  const remove=async a=>{if(!window.confirm('이 공지사항을 삭제할까요?'))return;try{await api('/api/admin/announcements/'+a.id,{method:'DELETE'});notify('공지사항을 삭제했습니다.');refresh();}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">NOTICE EDITOR</div><h1>{editing?'공지사항 수정':'공지사항 작성'}</h1><form className="form-stack" onSubmit={save}><label>제목<input required maxLength="160" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>내용<textarea required rows="5" value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></label><div><label className="button secondary"><input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/>사진 여러 장 첨부</label><small className="muted">최대 8장 · 장당 10MB</small></div>{(form.imagePaths.length>0||files.length>0)&&<div className="notice-photo-grid">{form.imagePaths.map(path=><div key={path}><img src={(data?.announcements||[]).find(a=>a.id===editing?.id)?.images?.find(i=>i.path===path)?.url||''} alt="공지 첨부 사진"/><button type="button" className="icon-button" aria-label="사진 제거" onClick={()=>setForm({...form,imagePaths:form.imagePaths.filter(x=>x!==path)})}>×</button></div>)}{files.map((file,i)=><div key={file.name+i}><img src={URL.createObjectURL(file)} alt={file.name}/><button type="button" className="icon-button" aria-label="사진 제거" onClick={()=>setFiles(files.filter((_,n)=>n!==i))}>×</button></div>)}</div>}<label className="check-label"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/>회원에게 게시</label><div className="button-row"><button className="button primary" disabled={busy}>{busy?'저장 중…':editing?'수정 저장':'공지 게시'}</button>{editing&&<button type="button" className="button subtle" onClick={reset}>취소</button>}</div></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">ALL NOTICES</div><h2>등록된 공지</h2></div><span className="count-pill">{data?.announcements?.length||0}</span></div>{data?.announcements?.length?data.announcements.map(a=><article className="manage-row" key={a.id}><div className="grow"><b>{a.title}</b><small>{a.published?'게시 중':'비공개'} · {fmtDate(a.createdAt)} · 사진 {a.images?.length||0}장</small></div><button className="button subtle" onClick={()=>{setEditing(a);setForm({title:a.title,content:a.content,published:a.published,imagePaths:a.imagePaths||[]});setFiles([]);}}>수정</button><button className="button danger-outline" onClick={()=>remove(a)}>삭제</button></article>):<Empty title="작성한 공지사항이 없습니다."/>}</section></div>;
}

function EventAdmin({data,refresh,notify}){
  const [form,setForm]=useState({title:'',description:'',startAt:localInput(),endAt:localInput(new Date(Date.now()+3600000))}),[editing,setEditing]=useState(null);
  const save=async e=>{e.preventDefault();try{await api('/api/admin/events'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:{...form,startAt:new Date(form.startAt).toISOString(),endAt:new Date(form.endAt).toISOString()}});notify(editing?'일정을 수정했습니다.':'일정을 등록했습니다.');setEditing(null);setForm({title:'',description:'',startAt:localInput(),endAt:localInput(new Date(Date.now()+3600000))});refresh();}catch(e){notify(e.message);}};
  const remove=async x=>{if(!window.confirm('이 일정을 삭제할까요?'))return;try{await api('/api/admin/events/'+x.id,{method:'DELETE'});notify('일정을 삭제했습니다.');refresh();}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">CLUB CALENDAR</div><h1>{editing?'일정 수정':'전체 일정 등록'}</h1><form className="form-stack" onSubmit={save}><label>제목<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>상세 내용<textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-grid"><label>시작<input type="datetime-local" required value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/></label><label>종료<input type="datetime-local" required value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></label></div><div className="button-row"><button className="button primary">{editing?'수정 저장':'일정 등록'}</button>{editing&&<button type="button" className="button subtle" onClick={()=>setEditing(null)}>취소</button>}</div></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">SCHEDULE</div><h2>전체 일정</h2></div><span className="count-pill">{data?.events?.length||0}건</span></div>{data?.events?.length?data.events.map(x=><article className="manage-row" key={x.id}><div className="grow"><b>{x.title}</b><small>{fmtDate(x.startAt)}{x.description?' · '+x.description:''}</small></div><button className="button subtle" onClick={()=>{setEditing(x);setForm({title:x.title,description:x.description,startAt:localInput(new Date(x.startAt)),endAt:localInput(new Date(x.endAt))});}}>수정</button><button className="button danger-outline" onClick={()=>remove(x)}>삭제</button></article>):<Empty title="등록된 일정이 없습니다."/>}</section></div>;
}
function PollAdmin({data,refresh,notify}){
  const blank=()=>({id:crypto.randomUUID(),title:'',type:'single_choice',required:true,helpText:'',options:['',''],scaleMin:1,scaleMax:5,minLabel:'',maxLabel:''});
  const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[questions,setQuestions]=useState([blank()]),[responses,setResponses]=useState(null);
  const types={short_text:'단답형',paragraph:'장문형',single_choice:'객관식(하나 선택)',multiple_choice:'체크박스(복수 선택)',dropdown:'드롭다운',linear_scale:'선형 배율',date:'날짜'};
  const choices=['single_choice','multiple_choice','dropdown'];
  const update=(id,patch)=>setQuestions(xs=>xs.map(q=>q.id===id?{...q,...patch}:q));
  const create=async e=>{e.preventDefault();try{await api('/api/admin/polls',{method:'POST',body:{question:title,description,questions:questions.map(q=>({...q,options:choices.includes(q.type)?q.options.filter(x=>x.trim()):undefined}))}});notify('설문을 등록했습니다.');setTitle('');setDescription('');setQuestions([blank()]);refresh();}catch(e){notify(e.message);}};
  const toggle=async p=>{try{await api('/api/admin/polls/'+p.id,{method:'PATCH',body:{closed:!p.closed}});notify(p.closed?'설문을 다시 열었습니다.':'설문을 마감했습니다.');refresh();}catch(e){notify(e.message);}};
  const remove=async p=>{if(!window.confirm('설문과 모든 응답을 완전히 삭제할까요? 되돌릴 수 없습니다.'))return;try{await api('/api/admin/polls/'+p.id,{method:'DELETE'});notify('설문과 응답을 삭제했습니다.');if(responses?.id===p.id)setResponses(null);refresh();}catch(e){notify(e.message);}};
  const showResponses=async p=>{try{const r=await api('/api/admin/polls/'+p.id+'/responses');setResponses({...r,id:p.id,title:p.question});}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">POLL BUILDER</div><h1>설문 만들기</h1><form className="form-stack" onSubmit={create}><label>설문 제목<input required maxLength="240" value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 다음 모임 일정 조사"/></label><label>설문 설명<textarea rows="2" maxLength="3000" value={description} onChange={e=>setDescription(e.target.value)} placeholder="설문 안내를 입력해 주세요"/></label>
  {questions.map((q,i)=><article className="surface poll-question-editor" key={q.id}><div className="section-heading"><h3>질문 {i+1}</h3>{questions.length>1&&<button type="button" className="button danger-outline" onClick={()=>setQuestions(xs=>xs.filter(x=>x.id!==q.id))}>질문 삭제</button>}</div><label>질문<input required maxLength="240" value={q.title} onChange={e=>update(q.id,{title:e.target.value})} placeholder="질문을 입력해 주세요"/></label><label>질문 형식<select value={q.type} onChange={e=>update(q.id,{type:e.target.value})}>{Object.entries(types).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>설명(선택)<input maxLength="2000" value={q.helpText} onChange={e=>update(q.id,{helpText:e.target.value})} placeholder="질문 아래에 표시할 설명"/></label>
  {choices.includes(q.type)&&<div className="options-builder"><b>선택 항목</b>{q.options.map((o,j)=><div className="inline-option" key={j}><input required maxLength="240" value={o} onChange={e=>update(q.id,{options:q.options.map((v,k)=>j===k?e.target.value:v)})} placeholder={'항목 '+(j+1)}/>{q.options.length>2&&<button type="button" className="icon-button" aria-label="항목 삭제" onClick={()=>update(q.id,{options:q.options.filter((_,k)=>k!==j)})}>×</button>}</div>)}{q.options.length<30&&<button type="button" className="text-button" onClick={()=>update(q.id,{options:[...q.options,'']})}>+ 선택 항목 추가</button>}</div>}
  {q.type==='linear_scale'&&<div className="form-grid"><label>최솟값<select value={q.scaleMin} onChange={e=>update(q.id,{scaleMin:Number(e.target.value)})}><option value="0">0</option><option value="1">1</option></select></label><label>최댓값<select value={q.scaleMax} onChange={e=>update(q.id,{scaleMax:Number(e.target.value)})}>{[2,3,4,5,6,7,8,9,10].map(n=><option key={n}>{n}</option>)}</select></label><label>최솟값 설명<input value={q.minLabel} onChange={e=>update(q.id,{minLabel:e.target.value})} placeholder="전혀 그렇지 않음"/></label><label>최댓값 설명<input value={q.maxLabel} onChange={e=>update(q.id,{maxLabel:e.target.value})} placeholder="매우 그렇다"/></label></div>}
  <label className="check-label"><input type="checkbox" checked={q.required} onChange={e=>update(q.id,{required:e.target.checked})}/>필수 질문</label></article>)}
  <div className="button-row"><button type="button" className="button secondary" disabled={questions.length>=30} onClick={()=>setQuestions(xs=>[...xs,blank()])}>+ 질문 추가</button><button className="button primary">설문 게시</button></div></form></section>
  <section className="surface"><div className="section-heading"><div><div className="eyebrow">POLL STATUS</div><h2>등록된 설문</h2></div></div>{data?.polls?.length?data.polls.map(p=><article className="manage-row poll-manage" key={p.id}><div className="grow"><b>{p.question}</b><small>{p.questions?.length?`${p.questions.length}개 질문 · ${p.description||''}`:(p.options||[]).join(' · ')}</small></div><span className={'status-pill '+(p.closed?'rejected':'approved')}>{p.closed?'마감':'진행 중'}</span><button className="button subtle" onClick={()=>showResponses(p)}>응답 보기</button><button className="button secondary" onClick={()=>toggle(p)}>{p.closed?'다시 열기':'마감'}</button><button className="button danger-outline" onClick={()=>remove(p)}>완전 삭제</button></article>):<Empty title="등록된 설문이 없습니다."/>}</section>
  {responses&&<Modal title={'응답 결과 · '+responses.title} close={()=>setResponses(null)}><div className="response-list">{responses.questions?.map(q=><section className="response-question" key={q.id}><h3>{q.title}</h3>{q.counts?.length?q.counts.map(c=><div className="result-bar" key={c.label}><span>{c.label}</span><b>{c.count}명</b><i style={{width:Math.max(2,c.count/(responses.responses.length||1)*100)+'%'}}/></div>):<p className="muted">응답 {responses.responses.filter(r=>r.answers?.[q.id]!==undefined).length}건</p>}</section>)}{responses.counts?.map(c=><div className="result-bar" key={c.index}><span>{c.label}</span><b>{c.count}명</b></div>)}<h3>개별 응답</h3>{responses.responses.length?responses.responses.map((r,i)=><article className="manage-row" key={i}><span>{r.name}</span><div>{r.answers?Object.entries(r.answers).map(([id,v])=><p key={id}><b>{responses.questions?.find(q=>q.id===id)?.title||'응답'}</b><br/>{Array.isArray(v)?v.join(', '):String(v)}</p>):<b>{r.option}</b>}</div></article>):<Empty title="아직 응답이 없습니다."/>}</div></Modal>}
  </div>;
}
function GroupAdmin({data,refresh,notify}){
  const [members,setMembers]=useState([]),[name,setName]=useState(''),[description,setDescription]=useState(''),[chosen,setChosen]=useState({}),[editing,setEditing]=useState({});
  const loadMembers=async()=>{try{const r=await api('/api/admin/members');setMembers(r.members.filter(m=>m.status==='approved'));}catch(e){notify(e.message);}};
  useEffect(()=>{loadMembers();},[]);
  const create=async e=>{e.preventDefault();try{await api('/api/admin/groups',{method:'POST',body:{name,description,memberIds:Object.keys(chosen).filter(k=>chosen[k]).map(Number)}});notify('그룹을 만들었습니다.');setName('');setDescription('');setChosen({});refresh();}catch(e){notify(e.message);}};
  const saveMembers=async g=>{try{const ids=Object.keys(g.editing||{}).filter(k=>g.editing[k]).map(Number);await api('/api/admin/groups/'+g.id+'/members',{method:'PUT',body:{memberIds:ids}});notify('그룹 구성원을 저장했습니다.');refresh();}catch(e){notify(e.message);}};
  const setGroupMember=(group,uid,checked)=>{
    setEditing(current=>{const existing=current[group.id]||Object.fromEntries(group.members.map(m=>[m.id,true]));return {...current,[group.id]:{...existing,[uid]:checked}};});
  };
  const [revision,setRevision]=useState(0);
  const refreshGroups=()=>setRevision(x=>x+1);
  const toggleActive=async g=>{try{await api('/api/admin/groups/'+g.id,{method:'PATCH',body:{active:!g.active}});notify(g.active?'그룹을 종료했습니다.':'그룹을 다시 열었습니다.');refresh();}catch(e){notify(e.message);}};
  const deleteGroup=async g=>{if(!window.confirm('그룹과 모든 대화, 일정, 할 일을 완전히 삭제할까요? 되돌릴 수 없습니다.'))return;try{await api('/api/admin/groups/'+g.id,{method:'DELETE'});notify('그룹과 관련 자료를 모두 삭제했습니다.');refresh();}catch(e){notify(e.message);}};
  const groups=data?.groups||[];
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">NEW TEAM</div><h1>그룹 채팅방 만들기</h1><form className="form-stack" onSubmit={create}><label>그룹 이름<input required maxLength="100" value={name} onChange={e=>setName(e.target.value)}/></label><label>소개<input value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="assign-list"><b>승인 회원 배정</b>{members.length?members.map(m=><label className="check-row" key={m.id}><input type="checkbox" checked={Boolean(chosen[m.id])} onChange={e=>setChosen({...chosen,[m.id]:e.target.checked})}/><span>{m.name}</span><small>@{m.username} · {m.school}</small></label>):<small className="muted">승인된 회원이 없습니다.</small>}</div><button className="button primary">그룹 만들기</button></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">TEAM ROOMS</div><h2>그룹 관리</h2></div><span className="count-pill">{groups.length}</span></div>{groups.length?groups.map(g=>{const assigned=editing[g.id]||Object.fromEntries(g.members.map(m=>[m.id,true]));return <article className="group-admin-card" key={g.id+'-'+revision}><div className="application-top"><div><h3>{g.name}</h3><span className={'status-pill '+(g.active?'approved':'rejected')}>{g.active?'운영 중':'종료'}</span></div><div className="button-row"><button className={g.active?'button danger-outline':'button secondary'} onClick={()=>toggleActive(g)}>{g.active?'그룹 종료':'다시 열기'}</button><button className="button danger-outline" onClick={()=>deleteGroup(g)}>완전 삭제</button></div></div><p className="muted">{g.description||'소개가 없습니다.'}</p><details><summary>구성원 배정 · 현재 {g.members.length}명</summary><div className="assign-list compact">{members.map(m=><label className="check-row" key={m.id}><input type="checkbox" checked={Boolean(assigned[m.id])} onChange={e=>setGroupMember(g,m.id,e.target.checked)}/><span>{m.name}</span><small>@{m.username}</small></label>)}</div><button className="button primary" onClick={async()=>{await saveMembers({...g,editing:assigned});setEditing(current=>{const next={...current};delete next[g.id];return next;});}}>구성원 저장</button></details></article>;}):<Empty title="등록된 그룹이 없습니다."/>}</section></div>;
}
function SettingsAdmin({data,notify,refresh}){
  const [switching,setSwitching]=useState(false);
  const toggleDemo=async()=>{setSwitching(true);try{const r=await api('/api/admin/settings',{method:'PATCH',body:{demoEnabled:!data?.demoEnabled}});notify(r.message);await refresh();}catch(e){notify(e.message);}finally{setSwitching(false);}};
  const [oldPassword,setOld]=useState(''),[newPassword,setNew]=useState(''),[confirm,setConfirm]=useState('');
  const submit=async e=>{e.preventDefault();if(newPassword!==confirm)return notify('새 비밀번호가 서로 다릅니다.');try{const r=await api('/api/auth/change-password',{method:'POST',body:{oldPassword,newPassword}});notify(r.message);setOld('');setNew('');setConfirm('');refresh();}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">SITE SETTINGS</div><h1>서비스 설정</h1><div className="setting-row"><div><h2>데모 모드</h2><p className="muted">방문자가 예시 공지·설문·채팅을 둘러볼 수 있습니다. 실제 회원 정보와 대화는 연결되지 않습니다.</p><span className={'status-pill '+(data?.demoEnabled?'approved':'rejected')}>{data?.demoEnabled?'켜짐 · 로그인 화면에 표시':'꺼짐 · 로그인 화면에서 숨김'}</span></div><button type="button" className={data?.demoEnabled?'button danger-outline':'button primary'} onClick={toggleDemo} disabled={switching||!data}>{switching?'저장 중…':data?.demoEnabled?'데모 모드 끄기':'데모 모드 켜기'}</button></div></section><NoticePopupAdmin notify={notify}/><section className="surface"><div className="eyebrow">ACCOUNT SECURITY</div><h1>계정 보안</h1><div className="security-summary"><div><small>관리자 아이디</small><b>{data?.username||'확인 중'}</b></div><div><small>HTTPS</small><b>운영 배포 시 필수</b></div><div><small>초기 비밀번호 변경</small><b>{data?.mustChangePassword?'변경 필요':'변경 완료'}</b></div></div><p className="muted">관리자 비밀번호는 환경 변수에서 초기화하고, 로그인 후 이 화면에서 변경할 수 있습니다.</p></section>
    <section className="surface"><h2>비밀번호 변경</h2><form className="form-stack narrow" onSubmit={submit}><label>현재 비밀번호<input type="password" autoComplete="current-password" required value={oldPassword} onChange={e=>setOld(e.target.value)}/></label><label>새 비밀번호<input type="password" minLength="10" autoComplete="new-password" required value={newPassword} onChange={e=>setNew(e.target.value)} placeholder="10자 이상"/></label><label>새 비밀번호 확인<input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className="button primary">비밀번호 변경</button></form></section></div>;
}



