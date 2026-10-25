import React,{useEffect,useMemo,useRef,useState} from 'react';
import {api,apiUrl,supabase,fmtDate,localInput,logoutCurrentSession} from './api.js';
import {AdminShell,AccessDenied,Toast} from './Admin.jsx';
import GlyphPortal from '../components/ui/glyph-portal.tsx';
import '../components/ui/auth-portal.css';
import GroupChat from '../components/ui/group-chat.tsx';

const menu=[
  {path:'/dashboard',label:'홈',icon:'⌂'},
  {path:'/announcements',label:'공지사항',icon:'▤'},
  {path:'/calendar',label:'동아리 일정',icon:'▦'},
  {path:'/surveys',label:'설문',icon:'☑'},
  {path:'/groups',label:'그룹 채팅',icon:'◉'},
];
const statusText={pending:'승인 대기',approved:'승인 완료',rejected:'반려'};

export default function App(){
  const [user,setUser]=useState(undefined),[path,setPath]=useState(location.pathname),[toast,setToast]=useState('');
  const notify=(message)=>{setToast(message);window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>setToast(''),3600);};
  const go=(next)=>{history.pushState({},'',next);setPath(next);window.scrollTo(0,0);};
  useEffect(()=>{const onPop=()=>setPath(location.pathname);window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
  const userRequestRef=useRef(0);
  const refreshUser=async()=>{const requestId=++userRequestRef.current;try{const r=await api('/api/auth/me');if(userRequestRef.current===requestId)setUser(r.user);}catch{if(userRequestRef.current===requestId)setUser(null);}};
  useEffect(()=>{refreshUser();},[]);
  const logout=async()=>{userRequestRef.current++;try{await logoutCurrentSession();}catch{}finally{setUser(null);go('/');notify('로그아웃했습니다.');}};
  if(user===undefined)return <div className="boot"><span className="brand-image small"><img src="/kfc-logo.png" alt="K.F.C."/></span><span>연결을 확인하고 있어요…</span></div>;
  if(path==='/download')return <DownloadPage go={go} notify={notify}/>;
  if(!user)return <AuthScreen go={go} onLogin={(u)=>{userRequestRef.current++;setUser(u);go(u.role==='admin'?'/admin':'/dashboard');}} notify={notify}/>;
  if(user.mustChangePassword)return <PasswordScreen user={user} done={refreshUser} logout={logout} notify={notify}/>;
  if(user.role==='admin'){
    if(path!=='/admin')go('/admin');
    return <AdminShell user={user} go={go} logout={logout} notify={notify} toast={toast}/>;
  }
  if(path==='/admin')return <AccessDenied go={go}/>;
  return <MemberShell user={user} go={go} logout={logout} notify={notify} toast={toast}/>;
}

function AuthScreen({go,onLogin,notify}){
  const [mode,setMode]=useState('login'),[busy,setBusy]=useState(false);
  const [login,setLogin]=useState({username:'',password:''});
  const [form,setForm]=useState({name:'',age:'',school:'',grade:'',phone:'',username:'',password:''});
  const [notice,setNotice]=useState(''); const portalRef=useRef(null);
  const change=(key,value)=>setForm(v=>({...v,[key]:value}));
  useEffect(()=>{const root=portalRef.current;if(!root||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setTimeout(()=>{const content=root.querySelector('[data-gp-content]');if(content){const y=content.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop;root.scrollTo({top:y,behavior:'smooth'});}},420);
    const stopAutoAdvance=()=>window.clearTimeout(timer);
    root.addEventListener('wheel',stopAutoAdvance,{once:true,passive:true});root.addEventListener('touchstart',stopAutoAdvance,{once:true,passive:true});root.addEventListener('pointerdown',stopAutoAdvance,{once:true,passive:true});
    return()=>{window.clearTimeout(timer);root.removeEventListener('wheel',stopAutoAdvance);root.removeEventListener('touchstart',stopAutoAdvance);root.removeEventListener('pointerdown',stopAutoAdvance);};
  },[]);
  const submitLogin=async e=>{e.preventDefault();setBusy(true);setNotice('');try{const r=await api('/api/auth/login',{method:'POST',body:login});onLogin(r.user);}catch(err){setNotice(err.message);}finally{setBusy(false);}};
  const submitRegister=async e=>{e.preventDefault();setBusy(true);setNotice('');try{const r=await api('/api/auth/register',{method:'POST',body:form});setNotice(r.message+' 신청 상태는 승인 대기입니다.');setMode('login');setLogin({username:form.username,password:''});notify('가입 신청이 접수되었습니다.');}catch(err){setNotice(err.message);}finally{setBusy(false);}};
  return <div className="login-portal-scroll" ref={portalRef} tabIndex={-1}>
    <GlyphPortal word="K.F.C." focusChar="F" interactive={false} scrollLength={1.2} fontWeight={900} enterLabel="로그인 창으로 이동"
      style={{"--gp-paper":"#f3f7f6","--gp-ink":"#14232d","--gp-field":"#122a35","--gp-foreground":"#f5fbfa"}}
      background={<div className="portal-field-bg"/>}
      front={<div className="portal-frontbar"><div className="portal-front-brand"><img src="/kfc-logo.png" alt=""/><span>K.F.C.</span><small>용인시청소년수련관 로봇동아리</small></div><button type="button" onClick={()=>go('/download')}>Windows 앱 안내 ↗</button></div>}>
      <main className="auth-portal-content"><section className="auth-portal-card">
        <div className="portal-login-brand"><img src="/kfc-logo.png" alt="K.F.C. 동아리 로고"/><div><b>K.F.C.</b><small>ROBOTICS CLUB · YONGIN</small></div></div>
        <div className="eyebrow">{mode==='login'?'MEMBER ACCESS':'JOIN THE CLUB'}</div><h1>{mode==='login'?'다시 만나 반가워요':'가입 신청'}</h1>
        <p className="muted">{mode==='login'?'아이디와 비밀번호를 입력해 주세요.':'회원 정보를 작성하면 관리자 승인 후 이용할 수 있어요.'}</p>
        <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setNotice('');}}>로그인</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setNotice('');}}>회원 가입 신청</button></div>
        {notice&&<div className="notice-box" role="status">{notice}</div>}
        {mode==='login'?<form onSubmit={submitLogin} className="form-stack"><label>로그인 아이디<input autoComplete="username" required value={login.username} onChange={e=>setLogin({...login,username:e.target.value})} placeholder="아이디를 입력해 주세요"/></label>
          <label>비밀번호<input type="password" autoComplete="current-password" required value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} placeholder="비밀번호를 입력해 주세요"/></label><button className="button primary full" disabled={busy}>{busy?'확인 중…':'로그인'} <span>→</span></button>
        </form>:<form onSubmit={submitRegister} className="form-stack signup-form"><div className="form-grid"><label>이름<input required maxLength="40" value={form.name} onChange={e=>change('name',e.target.value)} placeholder="홍길동"/></label>
          <label>나이<input required type="number" min="8" max="99" value={form.age} onChange={e=>change('age',e.target.value)} placeholder="15"/></label><label>학교<input required maxLength="80" value={form.school} onChange={e=>change('school',e.target.value)} placeholder="학교 이름"/></label><label>학년<input required maxLength="30" value={form.grade} onChange={e=>change('grade',e.target.value)} placeholder="예: 중학교 2학년"/></label></div>
          <label>전화번호<input required type="tel" value={form.phone} onChange={e=>change('phone',e.target.value)} placeholder="010-1234-5678"/></label><label>로그인 아이디<input required minLength="4" maxLength="20" autoComplete="username" value={form.username} onChange={e=>setForm(v=>({...v,username:e.target.value}))} placeholder="영문, 숫자, 밑줄 4~20자"/></label>
          <label>비밀번호<input required type="password" minLength="10" maxLength="128" autoComplete="new-password" value={form.password} onChange={e=>change('password',e.target.value)} placeholder="10자 이상"/></label><button className="button primary full" disabled={busy}>{busy?'접수 중…':'가입 신청하기'} <span>→</span></button>
        </form>}
        <div className="auth-footnote">가입 신청은 관리자의 승인 후 로그인할 수 있습니다.</div><a className="auth-windows-link" href="/download" onClick={e=>{e.preventDefault();go('/download');}}>Windows 앱 안내 ↗</a>
      </section><div className="portal-footer">© K.F.C. Robotics Club · 용인시청소년수련관</div></main>
    </GlyphPortal>
  </div>;
}
function PasswordScreen({user,done,logout,notify}){
  const [oldPassword,setOld]=useState(''),[newPassword,setNew]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState('');
  const submit=async e=>{
    e.preventDefault();setError('');
    if(newPassword!==confirm)return setError('새 비밀번호가 서로 다릅니다.');
    try{const r=await api('/api/auth/change-password',{method:'POST',body:{oldPassword,newPassword}});notify(r.message);await done();}
    catch(e){setError(e.message);}
  };
  return <div className="center-page"><div className="password-card">
    <div className="brand-image large"><img src="/kfc-logo.png" alt="K.F.C. 동아리 로고"/></div><div className="eyebrow">SECURITY CHECK</div><h1>비밀번호를 변경해 주세요</h1>
    <p className="muted">{user.name}님, 안전한 이용을 위해 첫 로그인 비밀번호를 변경해야 합니다.</p>
    {error&&<div className="error-box">{error}</div>}
    <form className="form-stack" onSubmit={submit}>
      <label>현재 비밀번호<input type="password" autoComplete="current-password" required value={oldPassword} onChange={e=>setOld(e.target.value)}/></label>
      <label>새 비밀번호<input type="password" autoComplete="new-password" minLength="10" required value={newPassword} onChange={e=>setNew(e.target.value)} placeholder="10자 이상"/></label>
      <label>새 비밀번호 확인<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
      <button className="button primary full">변경하고 계속하기</button>
    </form><button className="text-button" onClick={logout}>로그아웃</button>
  </div></div>;
}

function DownloadPage({go,notify}){
  const [status,setStatus]=useState(null);
  useEffect(()=>{api('/api/download-status').then(setStatus).catch(()=>setStatus({available:false}));},[]);
  return <div className="download-page">
    <header className="public-header"><button className="brand-link" onClick={()=>go('/')}><span className="brand-image small"><img src="/kfc-logo.png" alt="K.F.C."/></span>K.F.C.</button><span className="eyebrow">WINDOWS APP</span></header>
    <main className="download-content"><div className="download-icon">▣</div><div className="eyebrow">K.F.C. DESKTOP</div><h1>Windows에서도<br/>함께 만들어요.</h1>
      <p className="muted">홈페이지와 같은 계정, 공지사항, 일정, 그룹 채팅을 사용하는 Windows 앱입니다.</p>
      {status===null?<div className="download-state">Windows 앱 파일 확인 중…</div>:status.installerAvailable?
        <a className="button primary download-button" href={status.installerUrl}>Windows 설치 파일 다운로드 <span>↓</span></a>:status.portableAvailable?
        <><a className="button primary download-button" href={status.portableUrl}>Windows 앱 다운로드 (.zip) <span>↓</span></a><p className="small muted">압축을 푼 뒤 폴더의 K.F.C. 로봇동아리.exe를 실행해 주세요.</p></>:
        <div className="notice-box">Windows 앱 파일이 아직 게시되지 않았습니다. 관리자가 빌드 파일을 배포하면 이곳에서 다운로드할 수 있습니다.</div>}
      <div className="download-steps"><div><b>01</b><span>{status?.portableAvailable&&!status?.installerAvailable?'압축 파일 풀기':'설치 파일 실행'}</span></div><div><b>02</b><span>서버 주소 입력</span></div><div><b>03</b><span>회원 계정으로 로그인</span></div></div>
      <button className="text-button" onClick={()=>go('/')}>← 로그인 화면으로 돌아가기</button>
      {status?.message&&<p className="small muted">{status.message}</p>}
    </main>
  </div>;
}

function MemberShell({user,go,logout,notify,toast}){
  const [section,setSection]=useState(()=>menu.find(m=>m.path===location.pathname)?.path||'/dashboard');
  const [announcements,setAnnouncements]=useState([]),[events,setEvents]=useState([]),[polls,setPolls]=useState([]),[groups,setGroups]=useState([]);
  const [loading,setLoading]=useState(true),[selectedGroup,setSelectedGroup]=useState(null);
  const load=async({quiet=false}={})=>{
    if(!quiet)setLoading(true);
    const results=await Promise.allSettled([api('/api/announcements'),api('/api/events'),api('/api/polls'),api('/api/groups')]);
    const [a,e,p,g]=results;
    if(a.status==='fulfilled')setAnnouncements(a.value.announcements||[]);
    if(e.status==='fulfilled')setEvents(e.value.events||[]);
    if(p.status==='fulfilled')setPolls(p.value.polls||[]);
    if(g.status==='fulfilled')setGroups(g.value.groups||[]);
    const failed=results.find(x=>x.status==='rejected');if(failed&&!quiet)notify(failed.reason?.message||'일부 정보를 불러오지 못했습니다.');
    if(!quiet)setLoading(false);
  };
  useEffect(()=>{load();const refresh=()=>{if(document.visibilityState==='visible')load({quiet:true});};const timer=window.setInterval(refresh,12000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
  const navigate=path=>{setSection(path);setSelectedGroup(null);go(path);};
  const groupOpen=(g)=>{setSelectedGroup(g);setSection('/groups');history.pushState({},'','/groups');};
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand-link" onClick={()=>navigate('/dashboard')}><span className="brand-image small"><img src="/kfc-logo.png" alt="K.F.C."/></span><span>K.F.C.<small>ROBOTICS CLUB</small></span></button>
      <div className="club-label">MEMBER SPACE</div>
      <nav>{menu.map(m=><button key={m.path} className={section===m.path?'nav-item active':'nav-item'} onClick={()=>navigate(m.path)}><span className="nav-icon">{m.icon}</span>{m.label}{m.path==='/groups'&&groups.length>0&&<i className="nav-count">{groups.length}</i>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={()=>go('/download')}><span className="nav-icon">↓</span>Windows 앱</button><div className="user-card"><div className="avatar club-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></div><div><b>{user.name}</b><small>승인 회원</small></div><button className="icon-button" aria-label="로그아웃" title="로그아웃" onClick={logout}>↗</button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><span className="crumb">K.F.C. / {menu.find(m=>m.path===section)?.label||'홈'}</span><strong>회원 공간</strong></div><div className="topbar-right"><span className="brand-image small topbar-logo"><img src="/kfc-logo.png" alt="K.F.C."/></span><span className="live-dot"/>온라인</div></header>
      <div className="page-body">
        {loading?<div className="loading-card">회원 정보를 불러오고 있어요…</div>:selectedGroup?
          <GroupRoom group={selectedGroup} user={user} onBack={()=>setSelectedGroup(null)} notify={notify}/>:
          section==='/dashboard'?<Dashboard user={user} announcements={announcements} events={events} groups={groups} open={navigate} groupOpen={groupOpen}/>:
          section==='/announcements'?<Announcements announcements={announcements}/>:
          section==='/calendar'?<Calendar events={events}/>:
          section==='/surveys'?<Surveys polls={polls} refresh={load} notify={notify}/>:
          <Groups groups={groups} open={groupOpen}/>}
      </div>
    </main>
    {toast&&<Toast message={toast}/>}
  </div>;
}

function Dashboard({user,announcements,events,groups,open,groupOpen}){
  const upcoming=events.filter(e=>new Date(e.endAt)>=new Date()).slice(0,4);
  return <div className="dashboard-content">
    <section className="welcome-card"><div><div className="eyebrow light">멤버 대시보드</div><h1>안녕하세요! <span>{user.name}</span>님!</h1><p>오늘도 함께 만들고 배우는 K.F.C.에 오신 걸 환영해요.</p></div><div className="welcome-badge"><div className="spark">✳</div><small>BUILD TOGETHER</small></div></section>
    <div className="quick-grid">
      <button className="quick-card" onClick={()=>open('/announcements')}><span className="quick-icon orange">▤</span><b>새 공지사항</b><strong>{announcements.length}</strong><small>공지 확인하기 →</small></button>
      <button className="quick-card" onClick={()=>open('/calendar')}><span className="quick-icon blue">▦</span><b>예정된 일정</b><strong>{upcoming.length}</strong><small>달력 보기 →</small></button>
      <button className="quick-card" onClick={()=>open('/groups')}><span className="quick-icon violet">◉</span><b>내 그룹</b><strong>{groups.length}</strong><small>대화 참여하기 →</small></button>
    </div>
    <div className="content-grid">
      <section className="surface"><div className="section-heading"><div><div className="eyebrow">UPDATES</div><h2>최근 공지사항</h2></div><button className="text-button" onClick={()=>open('/announcements')}>전체 보기 →</button></div>
        {announcements.length?announcements.slice(0,3).map(a=><article className="list-row" key={a.id}><span className="row-dot"/><div><b>{a.title}</b><small>{fmtDate(a.createdAt,{dateStyle:'long'})}</small></div><span className="row-arrow">↗</span></article>):<Empty title="등록된 공지사항이 없습니다."/>}
      </section>
      <section className="surface"><div className="section-heading"><div><div className="eyebrow">UP NEXT</div><h2>다가오는 일정</h2></div><button className="text-button" onClick={()=>open('/calendar')}>달력 보기 →</button></div>
        {upcoming.length?upcoming.map(e=><article className="event-row" key={e.id}><div className="date-chip"><b>{new Date(e.startAt).getDate()}</b><small>{new Date(e.startAt).toLocaleDateString('ko-KR',{month:'short'})}</small></div><div><b>{e.title}</b><small>{fmtDate(e.startAt,{timeStyle:'short'})}</small></div></article>):<Empty title="예정된 일정이 없습니다."/>}
      </section>
    </div>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">YOUR TEAMS</div><h2>내 그룹</h2></div><button className="text-button" onClick={()=>open('/groups')}>모두 보기 →</button></div>
      {groups.length?<div className="group-cards">{groups.slice(0,3).map(g=><button className="group-card" key={g.id} onClick={()=>groupOpen(g)}><span className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></span><span><b>{g.name}</b><small>{g.members.length}명의 팀원 · 새 메시지 확인</small></span><span className="row-arrow">→</span></button>)}</div>:<Empty title="아직 배정된 그룹이 없습니다."/>}
    </section>
  </div>;
}

function Announcements({announcements}){
  const [selected,setSelected]=useState(null);
  if(selected)return <div className="surface detail-surface"><button className="text-button" onClick={()=>setSelected(null)}>← 공지 목록</button><div className="eyebrow">NOTICE</div><h1>{selected.title}</h1><small className="muted">{fmtDate(selected.createdAt)}</small><hr/><p className="long-text">{selected.content}</p></div>;
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">CLUB NOTICE</div><h1>공지사항</h1></div><span className="count-pill">{announcements.length}건</span></div>
    {announcements.length?announcements.map(a=><button key={a.id} className="announcement-row" onClick={()=>setSelected(a)}><span className="notice-symbol">N</span><span className="grow"><b>{a.title}</b><small>{a.content.slice(0,90)}{a.content.length>90?'…':''}</small></span><time>{fmtDate(a.createdAt,{dateStyle:'medium'})}</time><span className="row-arrow">↗</span></button>):<Empty title="등록된 공지사항이 없습니다."/>}
  </section>;
}

function Calendar({events}){
  const [month,setMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1);});
  const [selected,setSelected]=useState(null);
  const year=month.getFullYear(),mon=month.getMonth();
  const first=new Date(year,mon,1),days=new Date(year,mon+1,0).getDate(),offset=(first.getDay()+6)%7;
  const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{const day=i-offset+1;return day>0&&day<=days?day:null;});
  const eventDay=e=>{const d=new Date(e.startAt);return d.getFullYear()===year&&d.getMonth()===mon?d.getDate():null;};
  const dayEvents=selected?events.filter(e=>new Date(e.startAt).toDateString()===new Date(year,mon,selected).toDateString()):[];
  return <div className="surface"><div className="section-heading"><div><div className="eyebrow">CLUB CALENDAR</div><h1>동아리 일정</h1></div><div className="calendar-controls"><button className="icon-button" aria-label="이전 달" onClick={()=>{setMonth(new Date(year,mon-1,1));setSelected(null);}}>‹</button><b>{year}년 {mon+1}월</b><button className="icon-button" aria-label="다음 달" onClick={()=>{setMonth(new Date(year,mon+1,1));setSelected(null);}}>›</button></div></div>
    <div className="calendar-grid">{['월','화','수','목','금','토','일'].map(x=><div className="weekday" key={x}>{x}</div>)}{cells.map((day,i)=><button key={i} className={'calendar-day '+(day?'':'empty')+(selected===day?' chosen':'')} disabled={!day} onClick={()=>setSelected(day)}><span>{day||''}</span>{day&&events.filter(e=>eventDay(e)===day).slice(0,2).map(e=><i className="calendar-dot" title={e.title} key={e.id}>{e.title}</i>)}</button>)}</div>
    <div className="calendar-detail"><div className="eyebrow">{selected?year+'년 '+(mon+1)+'월 '+selected+'일':'UPCOMING'}</div>
      {selected?dayEvents.length?dayEvents.map(e=><EventDetail key={e.id} event={e}/>):<Empty title="선택한 날짜에 일정이 없습니다."/>:
        events.filter(e=>new Date(e.endAt)>=new Date()).slice(0,5).map(e=><EventDetail key={e.id} event={e}/>)}
    </div>
  </div>;
}
function EventDetail({event}){return <article className="event-detail"><span className="event-bar"/><div><b>{event.title}</b><small>{fmtDate(event.startAt)}{event.description?' · '+event.description:''}</small></div></article>;}
function Empty({title,detail}){return <div className="empty-state"><span>✳</span><b>{title}</b>{detail&&<small>{detail}</small>}</div>;}

function Surveys({polls,refresh,notify}){
  const [selected,setSelected]=useState({});
  const vote=async poll=>{
    if(selected[poll.id]===undefined)return notify('응답 항목을 선택해 주세요.');
    try{await api('/api/polls/'+poll.id+'/vote',{method:'POST',body:{optionIndex:Number(selected[poll.id])}});notify('설문 응답을 저장했습니다.');refresh();}
    catch(e){notify(e.message);}
  };
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">YOUR VOICE</div><h1>설문</h1></div><span className="count-pill">{polls.length}건</span></div>
    {polls.length?polls.map(p=><article className="poll-card" key={p.id}><div className="poll-top"><span className="poll-tag">{p.closed?'마감':'참여 가능'}</span><small>{fmtDate(p.createdAt,{dateStyle:'medium'})}</small></div><h2>{p.question}</h2><div className="poll-options">{p.options.map((o,i)=><label className={'radio-row '+(p.myVote===i?'chosen':'')} key={i}><input type="radio" name={'poll-'+p.id} disabled={p.closed||p.myVote!==null} checked={p.myVote===i||selected[p.id]===i} onChange={()=>setSelected({...selected,[p.id]:i})}/><span>{o}</span>{p.myVote===i&&<small>내 응답</small>}</label>)}</div>
      {p.myVote===null&&!p.closed?<button className="button secondary" onClick={()=>vote(p)}>응답 제출</button>:<span className="muted small">{p.closed?'마감된 설문입니다.':'응답이 저장되었습니다.'}</span>}</article>):<Empty title="진행 중인 설문이 없습니다."/>}
  </section>;
}

function Groups({groups,open}){
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">TEAM SPACE</div><h1>그룹 채팅</h1><p className="muted">관리자가 배정한 그룹에서만 대화할 수 있습니다.</p></div><span className="count-pill">{groups.length}개 그룹</span></div>
    {groups.length?<div className="group-cards">{groups.map(g=><button className="group-card large" key={g.id} onClick={()=>open(g)}><span className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></span><span><b>{g.name}</b><small>{g.description||'함께 이야기하고 계획을 세워 보세요.'}</small><small>{g.members.map(m=>m.name).join(' · ')||'팀원'} · {g.members.length}명</small></span><span className="row-arrow">→</span></button>)}</div>:<Empty title="아직 배정된 그룹이 없습니다." detail="관리자가 그룹에 초대하면 이곳에 표시됩니다."/>}
  </section>;
}

function GroupRoom({group,user,onBack,notify}){
  const [tab,setTab]=useState('chat'),[messages,setMessages]=useState([]),[events,setEvents]=useState([]),[todos,setTodos]=useState([]);
  const [connected,setConnected]=useState(false),[content,setContent]=useState(''),[busy,setBusy]=useState(false);
  const [todoTitle,setTodoTitle]=useState(''),[editingTodo,setEditingTodo]=useState(null),[eventForm,setEventForm]=useState({title:'',description:'',startAt:localInput(),endAt:localInput(new Date(Date.now()+3600000))});
  const endRef=useRef(null),base='/api/groups/'+group.id;
  const sync=async()=>{
    try{
      const [m,e,t]=await Promise.all([api(base+'/messages'),api(base+'/events'),api(base+'/todos')]);
      setMessages(m.messages);setEvents(e.events);setTodos(t.todos);
    }catch(err){notify(err.message);}
  };
  useEffect(()=>{
    let live=true;
    const channel=supabase.channel('kfc-group:'+group.id,{config:{private:true}})
      .on('broadcast',{event:'sync'},()=>{if(live)sync();})
      .subscribe(status=>{setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED')sync();});
    sync();const refresh=()=>{if(live&&document.visibilityState==='visible')sync();};const timer=window.setInterval(refresh,12000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
    return()=>{live=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);setConnected(false);supabase.removeChannel(channel);};
  },[group.id]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);
  const send=async e=>{
    e.preventDefault();if(!content.trim()||busy)return;setBusy(true);
    try{await api(base+'/messages',{method:'POST',body:{content}});setContent('');await sync();}
    catch(e){notify(e.message);}
    finally{setBusy(false);}
  };
  const addTodo=async e=>{e.preventDefault();if(!todoTitle.trim())return;
    try{await api(base+'/todos',{method:'POST',body:{title:todoTitle}});setTodoTitle('');await sync();}
    catch(e){notify(e.message);}
  };
  const addEvent=async e=>{e.preventDefault();
    try{await api(base+'/events',{method:'POST',body:{...eventForm,startAt:new Date(eventForm.startAt).toISOString(),endAt:new Date(eventForm.endAt).toISOString()}});setEventForm({...eventForm,title:'',description:''});await sync();notify('그룹 일정을 추가했습니다.');}
    catch(e){notify(e.message);}
  };
  const toggleTodo=async t=>{try{await api(base+'/todos/'+t.id,{method:'PATCH',body:{done:!t.done}});await sync();}catch(e){notify(e.message);}};
  const deleteTodo=async t=>{try{await api(base+'/todos/'+t.id,{method:'DELETE'});await sync();}catch(e){notify(e.message);}};
  const saveTodo=async e=>{e.preventDefault();if(!editingTodo?.title?.trim())return;try{await api(base+'/todos/'+editingTodo.id,{method:'PATCH',body:{title:editingTodo.title,done:editingTodo.done}});setEditingTodo(null);await sync();notify('할 일을 수정했습니다.');}catch(err){notify(err.message);}};
  return <div className="room-layout">
    <div className="room-heading"><button className="text-button" onClick={onBack}>← 그룹 목록</button><div className="room-title"><div className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></div><div><h1>{group.name}</h1><small>{group.members.length}명의 팀원 · {group.description||'K.F.C. 그룹 공간'}</small></div></div><div className="room-presence"><i className={connected?'live-dot':'offline-dot'}/>{connected?'실시간 연결됨':'다시 연결 중'}</div></div>
    <div className="room-tabs">{[['chat','대화'],['schedule','그룹 일정'],['todos','공동 할 일'],['people','구성원']].map(([k,label])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{label}</button>)}</div>
    {tab==='chat'?<GroupChat messages={messages.map(m=>({id:m.id,userId:String(m.userId),name:m.name,text:m.content,createdAt:m.createdAt}))} channel={group.name} members={group.members.map(m=>({id:String(m.id),name:m.name}))} currentUserId={String(user.id)} connected={connected} connectionLabel={connected?'실시간 연결됨':'연결 복구 중 · 기록 동기화 중'} footerRef={endRef} composer={<form className="chat-compose" onSubmit={send}><input aria-label="메시지" value={content} onChange={e=>setContent(e.target.value)} maxLength="2000" placeholder="메시지를 입력해 주세요…"/><button className="button primary" disabled={!content.trim()||busy}>보내기 ↑</button></form>} />:
    tab==='schedule'?<div className="room-panel"><section className="surface inset"><div className="section-heading"><div><div className="eyebrow">TEAM SCHEDULE</div><h2>그룹 일정</h2></div></div>
      {events.length?events.map(e=><EventDetail key={e.id} event={e}/>):<Empty title="그룹 일정이 없습니다."/>}
      <form className="inline-form" onSubmit={addEvent}><h3>일정 추가</h3><label>제목<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label><label>상세 내용<input value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><div className="form-grid"><label>시작<input type="datetime-local" required value={eventForm.startAt} onChange={e=>setEventForm({...eventForm,startAt:e.target.value})}/></label><label>종료<input type="datetime-local" required value={eventForm.endAt} onChange={e=>setEventForm({...eventForm,endAt:e.target.value})}/></label></div><button className="button secondary">그룹 일정 저장</button></form>
    </section></div>:
    tab==='todos'?<div className="room-panel"><section className="surface inset"><div className="section-heading"><div><div className="eyebrow">TEAM TASKS</div><h2>공동 할 일</h2></div><span className="count-pill">{todos.filter(t=>!t.done).length}개 남음</span></div>
      <form className="todo-add" onSubmit={addTodo}><input value={todoTitle} onChange={e=>setTodoTitle(e.target.value)} maxLength="120" placeholder="새 할 일을 적어 주세요"/><button className="button primary">추가</button></form>
      {todos.length?todos.map(t=>editingTodo?.id===t.id?<form className="todo-row todo-edit-row" key={t.id} onSubmit={saveTodo}><input aria-label="할 일 제목 수정" value={editingTodo.title} onChange={e=>setEditingTodo({...editingTodo,title:e.target.value})}/><button className="button secondary">저장</button><button type="button" className="text-button" onClick={()=>setEditingTodo(null)}>취소</button></form>:<div className={'todo-row '+(t.done?'done':'')} key={t.id}><label><input type="checkbox" checked={t.done} onChange={()=>toggleTodo(t)}/><span>{t.title}</span></label><small>{fmtDate(t.updatedAt,{dateStyle:'short'})}</small><button className="text-button" aria-label="할 일 수정" onClick={()=>setEditingTodo({id:t.id,title:t.title,done:t.done})}>수정</button><button className="icon-button" aria-label="할 일 삭제" onClick={()=>deleteTodo(t)}>×</button></div>):<Empty title="공동 할 일이 없습니다."/>}
    </section></div>:
    <div className="surface inset"><div className="eyebrow">TEAM MEMBERS</div><h2>그룹 구성원</h2><div className="member-chips">{group.members.map(m=><div className="member-chip" key={m.id}><span className="avatar">{m.name.slice(0,1)}</span><b>{m.name}</b>{m.id===user.id&&<small>나</small>}</div>)}</div></div>}
  </div>;
}

