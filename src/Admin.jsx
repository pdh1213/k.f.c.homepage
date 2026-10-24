import React,{useEffect,useState} from 'react';
import {api,fmtDate,localInput} from './api.js';

const tabs=[
  ['overview','개요'],['applications','가입 신청'],['members','회원 관리'],['announcements','공지사항'],
  ['events','전체 일정'],['polls','설문 관리'],['groups','그룹 관리'],['security','보안 설정']
];
const stateLabel={pending:'승인 대기',approved:'승인 완료',rejected:'반려'};
export function AccessDenied({go}){return <div className="center-page"><section className="surface access-card"><div className="brand-mark">K</div><h1>접근 권한이 없습니다</h1><p className="muted">관리자만 이 화면을 이용할 수 있습니다.</p><button className="button primary" onClick={()=>go('/dashboard')}>회원 홈으로</button></section></div>;}
export function Toast({message}){return message?<div className="toast" role="status"><span>✓</span>{message}</div>:null;}
function Empty({title,detail}){return <div className="empty-state"><span>✳</span><b>{title}</b>{detail&&<small>{detail}</small>}</div>;}

export function AdminShell({user,go,logout,notify,toast}){
  const [tab,setTab]=useState('overview'),[data,setData]=useState(null),[loading,setLoading]=useState(false),[query,setQuery]=useState('');
  const [security,setSecurity]=useState(null);
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
      security:'/api/admin/security'
    }[which];
    try{const r=await api(url);setData(r);if(which==='security')setSecurity(r);}
    catch(e){notify(e.message);if(e.status===401||e.status===403)go('/');}
    finally{setLoading(false);}
  };
  useEffect(()=>{load(tab,tab==='applications'?'pending':'');},[tab]);
  const select=key=>{setTab(key);setQuery('');setData(null);};
  return <div className="admin-shell">
    <aside className="sidebar admin-sidebar">
      <button className="brand-link" onClick={()=>select('overview')}><span className="brand-mark small">K</span><span>K.F.C.<small>ADMIN CONSOLE</small></span></button>
      <div className="club-label">관리자 메뉴</div><nav>{tabs.map(([key,label])=><button key={key} className={'nav-item '+(tab===key?'active':'')} onClick={()=>select(key)}><span className="nav-icon">{['overview','applications','members','announcements','events','polls','groups','security'].indexOf(key)+1}</span>{label}{key==='applications'&&data?.pending>0&&tab==='overview'&&<i className="nav-count">{data.pending}</i>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={()=>go('/dashboard')}><span className="nav-icon">↗</span>회원 화면</button><div className="user-card"><div className="avatar">{user.name.slice(0,1)}</div><div><b>{user.name}</b><small>관리자</small></div><button className="icon-button" aria-label="로그아웃" onClick={logout}>↗</button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><span className="crumb">K.F.C. / 관리자</span><strong>{tabs.find(t=>t[0]===tab)?.[1]}</strong></div><div className="topbar-right"><span className="shield">✓</span>관리자 인증됨</div></header>
      <div className="page-body admin-body">{loading&&!data?<div className="loading-card">관리자 정보를 불러오고 있어요…</div>:tab==='overview'?<Overview data={data} select={select} refresh={()=>load('overview','')}/>:
        tab==='applications'?<Applications data={data} refresh={()=>load('applications',query||'pending')} notify={notify} query={query} setQuery={setQuery}/>:
        tab==='members'?<Members data={data} refresh={()=>load('members',query)} notify={notify} query={query} setQuery={setQuery}/>:
        tab==='announcements'?<AnnouncementAdmin data={data} refresh={()=>load('announcements','')} notify={notify}/>:
        tab==='events'?<EventAdmin data={data} refresh={()=>load('events','')} notify={notify}/>:
        tab==='polls'?<PollAdmin data={data} refresh={()=>load('polls','')} notify={notify}/>:
        tab==='groups'?<GroupAdmin data={data} refresh={()=>load('groups','')} notify={notify}/>:
        <SecurityAdmin data={security||data} notify={notify} refresh={()=>load('security','')}/>}
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
function Applications({data,refresh,notify,query,setQuery}){
  const [status,setStatus]=useState('pending');
  const changeStatus=async(id,action)=>{
    let reason='';
    if(action==='reject'){reason=window.prompt('반려 사유를 입력해 주세요.','')||'';}
    try{const r=await api('/api/admin/applications/'+id+'/decision',{method:'POST',body:{action,reason}});notify(r.message);refresh();}
    catch(e){notify(e.message);}
  };
  const loadStatus=async(next)=>{setStatus(next);setQuery(next);try{const r=await api('/api/admin/applications?status='+next);setQuery(next);data.applications=r.applications;refresh();}catch(e){notify(e.message);}};
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
  const [search,setSearch]=useState(query),[editing,setEditing]=useState(null);
  const runSearch=async e=>{e.preventDefault();setQuery(search);try{const r=await api('/api/admin/members?q='+encodeURIComponent(search));data.members=r.members;}catch(e){notify(e.message);}refresh();};
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">MEMBER DIRECTORY</div><h1>회원 관리</h1><p className="muted">이 정보는 관리자만 확인할 수 있습니다.</p></div></div>
    <form className="search-form" onSubmit={runSearch}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 아이디, 학교 또는 전화번호 검색"/><button className="button secondary">검색</button></form>
    {data?.members?.length?data.members.map(m=><article className="member-admin-row" key={m.id}><div className="avatar">{m.name.slice(0,1)}</div><div className="member-admin-info"><b>{m.name} <small>@{m.username}</small></b><small>{m.school} · {m.grade} · {m.age}세 · {m.phone}</small></div><span className={'status-pill '+m.status}>{stateLabel[m.status]}</span><button className="button subtle" onClick={()=>setEditing(m)}>수정</button></article>):<Empty title="검색된 회원이 없습니다."/>}
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

function AnnouncementAdmin({data,refresh,notify}){
  const [form,setForm]=useState({title:'',content:'',published:true}),[editing,setEditing]=useState(null);
  const save=async e=>{e.preventDefault();try{await api('/api/admin/announcements'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:form});notify(editing?'공지사항을 수정했습니다.':'공지사항을 등록했습니다.');setForm({title:'',content:'',published:true});setEditing(null);refresh();}catch(e){notify(e.message);}};
  const remove=async a=>{if(!window.confirm('이 공지사항을 삭제할까요?'))return;try{await api('/api/admin/announcements/'+a.id,{method:'DELETE'});notify('공지사항을 삭제했습니다.');refresh();}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">NOTICE EDITOR</div><h1>{editing?'공지사항 수정':'공지사항 작성'}</h1><form className="form-stack" onSubmit={save}><label>제목<input required maxLength="160" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>내용<textarea required rows="5" value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/>회원에게 게시</label><div className="button-row"><button className="button primary">{editing?'수정 저장':'공지 게시'}</button>{editing&&<button type="button" className="button subtle" onClick={()=>{setEditing(null);setForm({title:'',content:'',published:true});}}>취소</button>}</div></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">ALL NOTICES</div><h2>등록된 공지</h2></div><span className="count-pill">{data?.announcements?.length||0}</span></div>{data?.announcements?.length?data.announcements.map(a=><article className="manage-row" key={a.id}><div className="grow"><b>{a.title}</b><small>{a.published?'게시 중':'비공개'} · {fmtDate(a.createdAt)}</small></div><button className="button subtle" onClick={()=>{setEditing(a);setForm({title:a.title,content:a.content,published:a.published});}}>수정</button><button className="button danger-outline" onClick={()=>remove(a)}>삭제</button></article>):<Empty title="작성한 공지사항이 없습니다."/>}</section></div>;
}

function EventAdmin({data,refresh,notify}){
  const [form,setForm]=useState({title:'',description:'',startAt:localInput(),endAt:localInput(new Date(Date.now()+3600000))}),[editing,setEditing]=useState(null);
  const save=async e=>{e.preventDefault();try{await api('/api/admin/events'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:{...form,startAt:new Date(form.startAt).toISOString(),endAt:new Date(form.endAt).toISOString()}});notify(editing?'일정을 수정했습니다.':'일정을 등록했습니다.');setEditing(null);setForm({title:'',description:'',startAt:localInput(),endAt:localInput(new Date(Date.now()+3600000))});refresh();}catch(e){notify(e.message);}};
  const remove=async x=>{if(!window.confirm('이 일정을 삭제할까요?'))return;try{await api('/api/admin/events/'+x.id,{method:'DELETE'});notify('일정을 삭제했습니다.');refresh();}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">CLUB CALENDAR</div><h1>{editing?'일정 수정':'전체 일정 등록'}</h1><form className="form-stack" onSubmit={save}><label>제목<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>상세 내용<textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-grid"><label>시작<input type="datetime-local" required value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/></label><label>종료<input type="datetime-local" required value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></label></div><div className="button-row"><button className="button primary">{editing?'수정 저장':'일정 등록'}</button>{editing&&<button type="button" className="button subtle" onClick={()=>setEditing(null)}>취소</button>}</div></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">SCHEDULE</div><h2>전체 일정</h2></div><span className="count-pill">{data?.events?.length||0}건</span></div>{data?.events?.length?data.events.map(x=><article className="manage-row" key={x.id}><div className="grow"><b>{x.title}</b><small>{fmtDate(x.startAt)}{x.description?' · '+x.description:''}</small></div><button className="button subtle" onClick={()=>{setEditing(x);setForm({title:x.title,description:x.description,startAt:localInput(new Date(x.startAt)),endAt:localInput(new Date(x.endAt))});}}>수정</button><button className="button danger-outline" onClick={()=>remove(x)}>삭제</button></article>):<Empty title="등록된 일정이 없습니다."/>}</section></div>;
}
function PollAdmin({data,refresh,notify}){
  const [question,setQuestion]=useState(''),[options,setOptions]=useState(['','']),[responses,setResponses]=useState(null);
  const create=async e=>{e.preventDefault();try{await api('/api/admin/polls',{method:'POST',body:{question,options:options.filter(x=>x.trim())}});notify('설문을 등록했습니다.');setQuestion('');setOptions(['','']);refresh();}catch(e){notify(e.message);}};
  const toggle=async p=>{try{await api('/api/admin/polls/'+p.id,{method:'PATCH',body:{closed:!p.closed}});notify(p.closed?'설문을 다시 열었습니다.':'설문을 마감했습니다.');refresh();}catch(e){notify(e.message);}};
  const showResponses=async p=>{try{const r=await api('/api/admin/polls/'+p.id+'/responses');setResponses({...r,title:p.question});}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">POLL BUILDER</div><h1>설문 등록</h1><form className="form-stack" onSubmit={create}><label>질문<input required value={question} onChange={e=>setQuestion(e.target.value)}/></label><div className="options-builder"><b>선택 항목</b>{options.map((o,i)=><div className="inline-option" key={i}><input required value={o} onChange={e=>setOptions(options.map((v,j)=>i===j?e.target.value:v))} placeholder={'항목 '+(i+1)}/>{options.length>2&&<button className="icon-button" type="button" aria-label="항목 삭제" onClick={()=>setOptions(options.filter((_,j)=>j!==i))}>×</button>}</div>)}{options.length<10&&<button type="button" className="text-button" onClick={()=>setOptions([...options,''])}>+ 선택 항목 추가</button>}</div><button className="button primary">설문 게시</button></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">POLL STATUS</div><h2>등록된 설문</h2></div></div>{data?.polls?.length?data.polls.map(p=><article className="manage-row poll-manage" key={p.id}><div className="grow"><b>{p.question}</b><small>{p.options.join(' · ')}</small></div><span className={'status-pill '+(p.closed?'rejected':'approved')}>{p.closed?'마감':'진행 중'}</span><button className="button subtle" onClick={()=>showResponses(p)}>응답 보기</button><button className="button secondary" onClick={()=>toggle(p)}>{p.closed?'다시 열기':'마감'}</button></article>):<Empty title="등록된 설문이 없습니다."/>}</section>
    {responses&&<Modal title={'응답 결과 · '+responses.title} close={()=>setResponses(null)}><div className="response-list">{responses.counts.map(c=><div className="result-bar" key={c.index}><span>{c.label}</span><b>{c.count}명</b><i style={{width:Math.max(2,c.count/(responses.responses.length||1)*100)+'%'}}/></div>)}<h3>개별 응답</h3>{responses.responses.length?responses.responses.map((r,i)=><div className="manage-row" key={i}><span>{r.name}</span><b>{r.option}</b></div>):<Empty title="아직 응답이 없습니다."/>}</div></Modal>}
  </div>;
}
function GroupAdmin({data,refresh,notify}){
  const [members,setMembers]=useState([]),[name,setName]=useState(''),[description,setDescription]=useState(''),[chosen,setChosen]=useState({});
  const loadMembers=async()=>{try{const r=await api('/api/admin/members');setMembers(r.members.filter(m=>m.status==='approved'));}catch(e){notify(e.message);}};
  useEffect(()=>{loadMembers();},[]);
  const create=async e=>{e.preventDefault();try{await api('/api/admin/groups',{method:'POST',body:{name,description,memberIds:Object.keys(chosen).filter(k=>chosen[k]).map(Number)}});notify('그룹을 만들었습니다.');setName('');setDescription('');setChosen({});refresh();}catch(e){notify(e.message);}};
  const saveMembers=async g=>{try{const ids=Object.keys(g.editing||{}).filter(k=>g.editing[k]).map(Number);await api('/api/admin/groups/'+g.id+'/members',{method:'PUT',body:{memberIds:ids}});notify('그룹 구성원을 저장했습니다.');refresh();}catch(e){notify(e.message);}};
  const setGroupMember=(group,uid,checked)=>{
    const membersNow=group.members.map(m=>m.id);
    const state={};membersNow.forEach(id=>state[id]=true);state[uid]=checked;
    group.editing=state;refreshGroups();
  };
  const [revision,setRevision]=useState(0);
  const refreshGroups=()=>setRevision(x=>x+1);
  const toggleActive=async g=>{try{await api('/api/admin/groups/'+g.id,{method:'PATCH',body:{active:!g.active}});notify(g.active?'그룹을 종료했습니다.':'그룹을 다시 열었습니다.');refresh();}catch(e){notify(e.message);}};
  const groups=data?.groups||[];
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">NEW TEAM</div><h1>그룹 채팅방 만들기</h1><form className="form-stack" onSubmit={create}><label>그룹 이름<input required maxLength="100" value={name} onChange={e=>setName(e.target.value)}/></label><label>소개<input value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="assign-list"><b>승인 회원 배정</b>{members.length?members.map(m=><label className="check-row" key={m.id}><input type="checkbox" checked={Boolean(chosen[m.id])} onChange={e=>setChosen({...chosen,[m.id]:e.target.checked})}/><span>{m.name}</span><small>@{m.username} · {m.school}</small></label>):<small className="muted">승인된 회원이 없습니다.</small>}</div><button className="button primary">그룹 만들기</button></form></section>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">TEAM ROOMS</div><h2>그룹 관리</h2></div><span className="count-pill">{groups.length}</span></div>{groups.length?groups.map(g=>{const assigned=g.editing||Object.fromEntries(g.members.map(m=>[m.id,true]));return <article className="group-admin-card" key={g.id+'-'+revision}><div className="application-top"><div><h3>{g.name}</h3><span className={'status-pill '+(g.active?'approved':'rejected')}>{g.active?'운영 중':'종료'}</span></div><button className={g.active?'button danger-outline':'button secondary'} onClick={()=>toggleActive(g)}>{g.active?'그룹 종료':'다시 열기'}</button></div><p className="muted">{g.description||'소개가 없습니다.'}</p><details><summary>구성원 배정 · 현재 {g.members.length}명</summary><div className="assign-list compact">{members.map(m=><label className="check-row" key={m.id}><input type="checkbox" checked={Boolean(assigned[m.id])} onChange={e=>setGroupMember(g,m.id,e.target.checked)}/><span>{m.name}</span><small>@{m.username}</small></label>)}</div><button className="button primary" onClick={()=>saveMembers({...g,editing:assigned})}>구성원 저장</button></details></article>;}):<Empty title="등록된 그룹이 없습니다."/>}</section></div>;
}
function SecurityAdmin({data,notify,refresh}){
  const [oldPassword,setOld]=useState(''),[newPassword,setNew]=useState(''),[confirm,setConfirm]=useState('');
  const submit=async e=>{e.preventDefault();if(newPassword!==confirm)return notify('새 비밀번호가 서로 다릅니다.');try{const r=await api('/api/auth/change-password',{method:'POST',body:{oldPassword,newPassword}});notify(r.message);setOld('');setNew('');setConfirm('');refresh();}catch(e){notify(e.message);}};
  return <div className="admin-manager"><section className="surface"><div className="eyebrow">ACCOUNT SECURITY</div><h1>관리자 보안 설정</h1><div className="security-summary"><div><small>관리자 아이디</small><b>{data?.username||'확인 중'}</b></div><div><small>HTTPS</small><b>운영 배포 시 필수</b></div><div><small>초기 비밀번호 변경</small><b>{data?.mustChangePassword?'변경 필요':'변경 완료'}</b></div></div><p className="muted">관리자 비밀번호는 환경 변수에서 초기화하고, 로그인 후 이 화면에서 변경할 수 있습니다.</p></section>
    <section className="surface"><h2>비밀번호 변경</h2><form className="form-stack narrow" onSubmit={submit}><label>현재 비밀번호<input type="password" autoComplete="current-password" required value={oldPassword} onChange={e=>setOld(e.target.value)}/></label><label>새 비밀번호<input type="password" minLength="10" autoComplete="new-password" required value={newPassword} onChange={e=>setNew(e.target.value)} placeholder="10자 이상"/></label><label>새 비밀번호 확인<input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className="button primary">비밀번호 변경</button></form></section></div>;
}
