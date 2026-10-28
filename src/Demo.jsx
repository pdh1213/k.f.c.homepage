import React,{useEffect,useRef,useState} from 'react';
import GroupChat from '../components/ui/group-chat.tsx';
import {isDesktop} from './desktop.js';
import './demo.css';

const fmtDate=(value,options={dateStyle:'medium',timeStyle:'short'})=>{try{return new Intl.DateTimeFormat('ko-KR',options).format(new Date(value))}catch{return value||''}};

const menu=[
  {id:'home',label:'홈',icon:'⌂'},
  {id:'announcements',label:'공지사항',icon:'▤'},
  {id:'calendar',label:'동아리 일정',icon:'▦'},
  {id:'surveys',label:'설문',icon:'☑'},
  {id:'groups',label:'그룹 채팅',icon:'◉'}
];
const notices=[
  {id:'demo-notice-1',title:'[데모] 첫 로봇 프로젝트 안내',content:'이 공지는 데모 모드 전용 예시입니다. 실제 동아리 공지사항이나 회원 계정에는 표시되지 않습니다.\n\n프로젝트 아이디어를 나누고, 역할을 정한 뒤 작은 시제품부터 함께 만들어 보세요.',createdAt:new Date(Date.now()-86400000).toISOString()},
  {id:'demo-notice-2',title:'[데모] 팀 활동 준비물',content:'노트북, 아이디어 스케치, 만들고 싶은 로봇에 대한 호기심을 준비해 주세요. 이 내용은 체험용이며 실제 일정과 관계없습니다.',createdAt:new Date(Date.now()-172800000).toISOString()}
];
const upcoming=(days,hour=14)=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(hour,0,0,0);return d.toISOString()};
const events=[
  {id:'demo-event-1',title:'[데모] 로봇 아이디어 회의',description:'예시 일정 · 만들고 싶은 로봇을 이야기해요.',startAt:upcoming(3),endAt:upcoming(3,16)},
  {id:'demo-event-2',title:'[데모] 시제품 만들기',description:'예시 일정 · 부품을 조립하고 동작을 시험해요.',startAt:upcoming(10),endAt:upcoming(10,16)}
];
const group={id:'demo-group',name:'[데모] 아이디어 제작팀',description:'예시 구성원만 보이는 체험 채팅방',members:[{id:'demo-self',name:'데모 방문자'},{id:'demo-a',name:'예시 팀원 A'},{id:'demo-b',name:'예시 팀원 B'}]};
const direct={id:'demo-direct',name:'예시 팀원 A',memberId:'demo-a'};
const initialGroupMessages=[
  {id:'demo-g-1',userId:'demo-a',name:'예시 팀원 A',text:'안녕하세요! 어떤 로봇을 만들어 보고 싶나요?',createdAt:new Date(Date.now()-3600000).toISOString()},
  {id:'demo-g-2',userId:'demo-b',name:'예시 팀원 B',text:'저는 길을 찾아가는 로봇이 재미있을 것 같아요 🚀',createdAt:new Date(Date.now()-3000000).toISOString(),attachments:[{name:'K.F.C. 예시 이미지.png',type:'image/png',size:24000,url:'/kfc-logo.png',isImage:true}]},
  {id:'demo-g-3',userId:'demo-self',name:'데모 방문자',text:'좋아요! 역할을 나눠서 아이디어를 정리해 봐요.',createdAt:new Date(Date.now()-2400000).toISOString()}
];
const initialDirectMessages=[
  {id:'demo-d-1',userId:'demo-a',name:'예시 팀원 A',text:'안녕하세요! 이 대화는 데모용 예시입니다.',createdAt:new Date(Date.now()-1800000).toISOString()},
  {id:'demo-d-2',userId:'demo-a',name:'예시 팀원 A',text:'실제 회원에게 메시지가 전송되거나 수신되지 않아요.',createdAt:new Date(Date.now()-1500000).toISOString()}
];

export default function DemoShell({go,blocked=false}){
  const [section,setSection]=useState('home'),[room,setRoom]=useState(null),[notice,setNotice]=useState('');
  const noticeTimer=useRef(0);
  useEffect(()=>()=>window.clearTimeout(noticeTimer.current),[]);
  const notify=message=>{setNotice(message);window.clearTimeout(noticeTimer.current);noticeTimer.current=window.setTimeout(()=>setNotice(''),4000)};
  const navigate=id=>{setSection(id);setRoom(null);window.scrollTo(0,0)};
  return <div className="app-shell demo-shell" inert={blocked}>
    <aside className="sidebar">
      <button className="brand-link" onClick={()=>navigate('home')}><span className="brand-image small"><img src="/kfc-logo.png" alt="K.F.C."/></span><span>K.F.C.<small>DEMO SPACE</small></span></button>
      <div className="club-label">데모 전용 화면</div>
      <nav>{menu.map(item=><button key={item.id} className={'nav-item '+(section===item.id?'active':'')} onClick={()=>navigate(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="sidebar-bottom">{!isDesktop&&<button className="nav-item" onClick={()=>go('/download')}><span className="nav-icon">↓</span>Windows 앱</button>}<div className="user-card"><div className="avatar club-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></div><div><b>데모 방문자</b><small>체험용 계정</small></div><button className="logout-button" onClick={()=>go('/')}>데모 종료</button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><span className="crumb">K.F.C. / 데모</span><strong>{menu.find(item=>item.id===section)?.label}</strong></div><div className="topbar-right"><span className="brand-image small topbar-logo"><img src="/kfc-logo.png" alt="K.F.C."/></span><span className="demo-top-label">데모 모드</span><button className="topbar-logout" onClick={()=>go('/')}>데모 종료</button></div></header>
      <div className="page-body"><div className="demo-banner" role="status"><b>데모 모드</b><span>모든 내용은 예시입니다. 실제 회원 정보나 채팅과 연결되지 않으며 입력한 내용은 저장되지 않습니다.</span><button onClick={()=>go('/')}>로그인 화면으로 ↗</button></div>
        {section==='home'?<DemoHome navigate={navigate} openGroup={()=>{setSection('groups');setRoom('group')}}/>:section==='announcements'?<DemoNotices/>:section==='calendar'?<DemoCalendar/>:section==='surveys'?<DemoSurveys notify={notify}/>:room?<DemoRoom kind={room} onBack={()=>setRoom(null)} notify={notify}/>:<DemoGroups open={setRoom}/>}
      </div>
    </main>
    {notice&&<div className="toast" role="status"><span>i</span>{notice}</div>}
  </div>;
}
function DemoHome({navigate,openGroup}){
  return <div className="dashboard-content"><section className="welcome-card"><div><div className="eyebrow light">K.F.C. DEMO</div><h1>안녕하세요! <span>데모 방문자</span>님!</h1><p>동아리 홈페이지의 기능을 예시 콘텐츠로 살펴보세요.</p></div><div className="welcome-badge"><div className="spark">✳</div><small>BUILD TOGETHER</small></div></section>
    <div className="quick-grid"><button className="quick-card" onClick={()=>navigate('announcements')}><span className="quick-icon orange">▤</span><b>새 공지사항</b><strong>{notices.length}</strong><small>공지 확인하기 →</small></button><button className="quick-card" onClick={()=>navigate('calendar')}><span className="quick-icon blue">▦</span><b>예정된 일정</b><strong>{events.length}</strong><small>달력 보기 →</small></button><button className="quick-card" onClick={()=>navigate('groups')}><span className="quick-icon violet">◉</span><b>내 그룹</b><strong>1</strong><small>대화 둘러보기 →</small></button></div>
    <div className="content-grid"><section className="surface"><div className="section-heading"><div><div className="eyebrow">UPDATES</div><h2>최근 공지사항</h2></div><button className="text-button" onClick={()=>navigate('announcements')}>전체 보기 →</button></div>{notices.map(item=><article className="list-row" key={item.id}><span className="row-dot"/><div><b>{item.title}</b><small>{fmtDate(item.createdAt,{dateStyle:'long'})}</small></div></article>)}</section><section className="surface"><div className="section-heading"><div><div className="eyebrow">UP NEXT</div><h2>다가오는 일정</h2></div><button className="text-button" onClick={()=>navigate('calendar')}>달력 보기 →</button></div>{events.map(item=><article className="event-row" key={item.id}><div className="date-chip"><b>{new Date(item.startAt).getDate()}</b><small>{new Date(item.startAt).toLocaleDateString('ko-KR',{month:'short'})}</small></div><div><b>{item.title}</b><small>{fmtDate(item.startAt,{timeStyle:'short'})}</small></div></article>)}</section></div>
    <section className="surface"><div className="section-heading"><div><div className="eyebrow">YOUR TEAMS</div><h2>내 그룹</h2></div></div><button className="group-card" onClick={openGroup}><span className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></span><span><b>{group.name}</b><small>예시 팀원 3명 · 데모 대화</small></span><span className="row-arrow">→</span></button></section>
  </div>;
}
export function DemoNotices(){
  const [selected,setSelected]=useState(null);
  if(selected)return <div className="surface detail-surface"><button className="text-button" onClick={()=>setSelected(null)}>← 공지 목록</button><div className="eyebrow">DEMO NOTICE</div><h1>{selected.title}</h1><small className="muted">{fmtDate(selected.createdAt)}</small><hr/><p className="long-text">{selected.content}</p></div>;
  return <section className="surface"><div className="section-heading"><div><div className="eyebrow">DEMO NOTICE</div><h1>공지사항</h1><p className="muted">실제 회원 공지와 분리된 예시 목록입니다.</p></div><span className="count-pill">{notices.length}건</span></div>{notices.map(item=><button className="announcement-row" key={item.id} onClick={()=>setSelected(item)}><span className="notice-symbol">D</span><span className="grow"><b>{item.title}</b><small>{item.content.slice(0,85)}…</small></span><time>{fmtDate(item.createdAt,{dateStyle:'medium'})}</time><span className="row-arrow">↗</span></button>)}</section>;
}
export function DemoCalendar(){
  const [month,setMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)}),[selected,setSelected]=useState(null);
  const year=month.getFullYear(),mon=month.getMonth(),days=new Date(year,mon+1,0).getDate(),offset=(new Date(year,mon,1).getDay()+6)%7;
  const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{const d=i-offset+1;return d>0&&d<=days?d:null});
  const onDay=e=>{const d=new Date(e.startAt);return d.getFullYear()===year&&d.getMonth()===mon?d.getDate():null};
  const visible=selected?events.filter(e=>onDay(e)===selected):events.filter(e=>new Date(e.startAt)>=new Date());
  return <div className="surface"><div className="section-heading"><div><div className="eyebrow">DEMO CALENDAR</div><h1>동아리 일정</h1></div><div className="calendar-controls"><button className="icon-button" aria-label="이전 달" onClick={()=>{setMonth(new Date(year,mon-1,1));setSelected(null)}}>‹</button><b>{year}년 {mon+1}월</b><button className="icon-button" aria-label="다음 달" onClick={()=>{setMonth(new Date(year,mon+1,1));setSelected(null)}}>›</button></div></div><div className="calendar-grid">{['월','화','수','목','금','토','일'].map(d=><div className="weekday" key={d}>{d}</div>)}{cells.map((day,i)=><button key={i} className={'calendar-day '+(day?'':'empty')+(day&&selected===day?' chosen':'')} disabled={!day} onClick={()=>setSelected(day)}><span>{day||''}</span>{day&&events.filter(e=>onDay(e)===day).map(e=><i className="calendar-dot" key={e.id}>{e.title}</i>)}</button>)}</div><div className="calendar-detail"><div className="eyebrow">{selected?'선택한 날짜':'UPCOMING'}</div>{visible.length?visible.map(e=><article className="event-detail" key={e.id}><span className="event-bar"/><div><b>{e.title}</b><small>{fmtDate(e.startAt)} · {e.description}</small></div></article>):<div className="empty-state"><b>이 날짜에는 예시 일정이 없습니다.</b></div>}</div></div>;
}
export function DemoSurveys({notify}){
  const [answers,setAnswers]=useState({goal:'',areas:[],idea:'',scale:0,date:''}),[submitted,setSubmitted]=useState(false);
  const areas=['센서','디자인','코딩','제작'];
  const update=(key,value)=>{setAnswers(v=>({...v,[key]:value}));setSubmitted(false)};
  const submit=e=>{e.preventDefault();if(!answers.goal||!answers.areas.length||!answers.idea.trim()||!answers.scale){notify('필수 질문에 답해 주세요.');return}setSubmitted(true);notify('데모 설문 체험을 완료했습니다. 응답은 저장되지 않았습니다.')};
  return <section className="surface demo-survey"><div className="section-heading"><div><div className="eyebrow">DEMO SURVEY</div><h1>설문</h1><p className="muted">다양한 질문 형식을 체험해 보세요. 제출해도 응답은 저장되지 않습니다.</p></div></div><form className="form-stack" onSubmit={submit}><article className="poll-card"><span className="poll-tag">예시 설문</span><h2>우리 팀의 다음 로봇 아이디어</h2><p className="muted">원하는 주제와 참여하고 싶은 활동을 선택해 보세요.</p>
    <div className="poll-question-answer"><h3>1. 어떤 로봇을 만들어 보고 싶나요? <em>· 필수</em></h3><div className="poll-options">{['길을 찾는 로봇','물건을 옮기는 로봇','사람을 돕는 로봇'].map(x=><label className={'radio-row '+(answers.goal===x?'chosen':'')} key={x}><input type="radio" name="demo-goal" checked={answers.goal===x} onChange={()=>update('goal',x)}/><span>{x}</span></label>)}</div></div>
    <div className="poll-question-answer"><h3>2. 관심 있는 활동을 모두 선택해 주세요 <em>· 필수</em></h3><div className="poll-options">{areas.map(x=><label className={'radio-row '+(answers.areas.includes(x)?'chosen':'')} key={x}><input type="checkbox" checked={answers.areas.includes(x)} onChange={e=>update('areas',e.target.checked?[...answers.areas,x]:answers.areas.filter(y=>y!==x))}/><span>{x}</span></label>)}</div></div>
    <div className="poll-question-answer"><h3>3. 아이디어를 한 문장으로 적어 주세요 <em>· 필수</em></h3><input className="poll-text-answer" maxLength="150" value={answers.idea} onChange={e=>update('idea',e.target.value)} placeholder="예: 장애물을 피해 달리는 로봇"/></div>
    <div className="poll-question-answer"><h3>4. 이번 프로젝트가 얼마나 기대되나요? <em>· 필수</em></h3><div className="scale-answer"><span>조금</span>{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name="demo-scale" checked={answers.scale===n} onChange={()=>update('scale',n)}/>{n}</label>)}<span>매우</span></div></div>
    <div className="poll-question-answer"><h3>5. 선호하는 모임 날짜가 있나요?</h3><input className="poll-text-answer" type="date" value={answers.date} onChange={e=>update('date',e.target.value)}/></div>
    <button className="button secondary">응답 체험하기</button>{submitted&&<p className="demo-result" role="status">체험 완료! 이 응답은 서버나 다른 회원에게 저장·전달되지 않았습니다.</p>}</article></form></section>;
}
export function DemoGroups({open}){
  return <div className="demo-groups"><section className="surface"><div className="section-heading"><div><div className="eyebrow">DEMO TEAM</div><h1>그룹 채팅</h1><p className="muted">예시 그룹과 1:1 대화를 둘러보세요. 실제 회원 채팅방과 연결되지 않습니다.</p></div></div><button className="group-card" onClick={()=>open('group')}><span className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></span><span><b>{group.name}</b><small>{group.description}</small></span><span className="row-arrow">→</span></button></section><section className="surface"><div className="section-heading"><div><div className="eyebrow">DEMO DIRECT</div><h2>1:1 대화</h2></div></div><button className="group-card" onClick={()=>open('direct')}><span className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></span><span><b>{direct.name}</b><small>가상의 팀원과 대화 화면 체험</small></span><span className="row-arrow">→</span></button></section></div>;
}
export function DemoRoom({kind,onBack,notify}){
  const [tab,setTab]=useState('chat'),[todos,setTodos]=useState([{id:1,title:'로봇 아이디어 스케치',done:true},{id:2,title:'센서 동작 알아보기',done:false}]),[todoTitle,setTodoTitle]=useState(''),[newEvent,setNewEvent]=useState(''),[extraEvents,setExtraEvents]=useState([]);
  const isDirect=kind==='direct',title=isDirect?direct.name:group.name;
  const addTodo=e=>{e.preventDefault();if(!todoTitle.trim())return;setTodos(v=>[...v,{id:Date.now(),title:todoTitle.trim(),done:false}]);setTodoTitle('');notify('데모 화면에서만 할 일이 추가되었습니다.')};
  const addEvent=e=>{e.preventDefault();if(!newEvent.trim())return;setExtraEvents(v=>[...v,{id:Date.now(),title:newEvent.trim(),startAt:upcoming(7),description:'데모에서 추가한 일정'}]);setNewEvent('');notify('데모 화면에서만 일정이 추가되었습니다.')};
  return <div className="room-layout"><div className="room-heading"><button className="text-button" onClick={onBack}>← {isDirect?'대화 목록':'그룹 목록'}</button><div className="room-title"><div className="group-avatar"><img src="/kfc-logo.png" alt="K.F.C."/></div><div><h1>{title}</h1><small>{isDirect?'가상의 팀원과 나누는 예시 대화':group.description}</small></div></div><span className="demo-room-label">데모 전용</span></div>
    {!isDirect&&<div className="room-tabs">{[['chat','대화'],['schedule','그룹 일정'],['todos','공동 할 일'],['people','구성원']].map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</div>}
    {tab==='chat'||isDirect?<DemoChat key={kind} kind={kind} notify={notify}/>:
      tab==='schedule'?<div className="room-panel"><section className="surface inset"><div className="section-heading"><div><div className="eyebrow">DEMO SCHEDULE</div><h2>그룹 일정</h2></div></div>{[events[0],...extraEvents].map(e=><article className="event-detail" key={e.id}><span className="event-bar"/><div><b>{e.title}</b><small>{fmtDate(e.startAt)} · {e.description}</small></div></article>)}<form className="todo-add" onSubmit={addEvent}><input value={newEvent} onChange={e=>setNewEvent(e.target.value)} maxLength="100" placeholder="데모 일정 제목"/><button className="button secondary">일정 체험</button></form><p className="small muted">입력한 일정은 새로고침하면 사라집니다.</p></section></div>:
      tab==='todos'?<div className="room-panel"><section className="surface inset"><div className="section-heading"><div><div className="eyebrow">DEMO TASKS</div><h2>공동 할 일</h2></div><span className="count-pill">{todos.filter(t=>!t.done).length}개 남음</span></div><form className="todo-add" onSubmit={addTodo}><input value={todoTitle} onChange={e=>setTodoTitle(e.target.value)} maxLength="120" placeholder="새 할 일 체험"/><button className="button primary">추가</button></form>{todos.map(t=><div className={'todo-row '+(t.done?'done':'')} key={t.id}><label><input type="checkbox" checked={t.done} onChange={()=>setTodos(v=>v.map(x=>x.id===t.id?{...x,done:!x.done}:x))}/><span>{t.title}</span></label><small>데모</small></div>)}<p className="small muted">변경 사항은 이 화면에서만 보이며 저장되지 않습니다.</p></section></div>:
      <div className="room-panel"><section className="surface inset"><div className="section-heading"><div><div className="eyebrow">DEMO MEMBERS</div><h2>구성원</h2></div></div><div className="member-chips">{group.members.map(m=><div className="member-chip" key={m.id}><span className="avatar">{m.name.slice(-1)}</span><b>{m.name}</b></div>)}</div><p className="small muted">모두 가상 예시 사용자입니다.</p></section></div>}
  </div>;
}
export function DemoChat({kind,notify}){
  const isDirect=kind==='direct',members=isDirect?[group.members[0],group.members[1]]:group.members;
  const [messages,setMessages]=useState(isDirect?initialDirectMessages:initialGroupMessages),[content,setContent]=useState(''),[reply,setReply]=useState(null);
  const react=(id,emoji)=>setMessages(list=>list.map(m=>{if(m.id!==id)return m;const reactions=[...(m.reactions||[])],i=reactions.findIndex(r=>r.emoji===emoji);if(i>=0){if(reactions[i].mine){reactions[i]={...reactions[i],count:reactions[i].count-1,mine:false};if(reactions[i].count===0)reactions.splice(i,1)}else reactions[i]={...reactions[i],count:reactions[i].count+1,mine:true}}else reactions.push({emoji,count:1,mine:true});return {...m,reactions}}));
  const send=e=>{e.preventDefault();notify('데모모드에서는 문자 수신이 제한되어 있어요. 실제 회원에게 전송되지 않습니다.')};
  return <GroupChat messages={messages} channel={isDirect?direct.name:group.name} members={members} currentUserId="demo-self" connected={false} connectionLabel="데모 전용 · 실제 연결 없음" notice={<span>예시 대화입니다. 입력한 메시지는 저장되거나 누구에게도 전달되지 않습니다.</span>} onReply={setReply} onReact={react} composer={<div className="chat-compose-wrap">{reply&&<div className="reply-compose"><span><b>{reply.name}에게 답장 체험</b><small>{reply.text||'첨부 파일'}</small></span><button type="button" className="icon-button" aria-label="답장 취소" onClick={()=>setReply(null)}>×</button></div>}<form className="chat-compose" onSubmit={send}><button type="button" className="chat-attach-button" aria-label="데모 파일 첨부 제한" onClick={()=>notify('데모 모드에서는 파일을 전송할 수 없습니다.')}>＋</button><input aria-label="데모 메시지" value={content} onChange={e=>setContent(e.target.value)} maxLength="2000" placeholder="메시지를 입력해 체험해 보세요"/><button className="button primary" type="submit">보내기 ↑</button></form></div>}/>;
}

