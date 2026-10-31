import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import LiquidNavbar,{NimbusIcons} from '../components/ui/liquid-glass-navbar.tsx';
import GlassFolder from '../components/ui/glass-folder-cards.tsx';
import './showroom.css';

let introSeen=false;
export default function Showroom({go,user}){
  const [data,setData]=useState({projects:[],competitions:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [active,setActive]=useState(0);
  const [intro,setIntro]=useState(()=>!introSeen);
  const navigationTimer=useRef(null);
  useEffect(()=>{if(!intro)return;introSeen=true;const timer=window.setTimeout(()=>setIntro(false),1700);return()=>window.clearTimeout(timer)},[intro]);
  useEffect(()=>()=>window.clearTimeout(navigationTimer.current),[]);
  useEffect(()=>{
    let alive=true;
    api('/api/showroom').then(r=>{if(alive)setData({projects:r.projects||[],competitions:r.competitions||[]})})
      .catch(e=>{if(alive)setError(e.message||'쇼룸을 불러오지 못했습니다.')})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[]);
  const jump=(id,index)=>{window.clearTimeout(navigationTimer.current);setActive(index);document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})};
  const leave=(index,path)=>{window.clearTimeout(navigationTimer.current);setActive(index);navigationTimer.current=window.setTimeout(()=>go(path),650)};
  const items=[
    {label:'Showroom',icon:NimbusIcons.home,fx:'glow'},
    {label:'Projects',icon:NimbusIcons.drop,fx:'drop'},
    {label:'Competitions',icon:NimbusIcons.globe,fx:'spin'},
    {label:user?'Member Space':'Log in',icon:NimbusIcons.user,fx:'wave'},
    {label:'Windows App',icon:NimbusIcons.plane,fx:'plane'}
  ];
  const folders=[{kind:'webapp',title:'웹앱 폴더',subtitle:'WEB APPS',description:'동아리원이 만든 웹앱을 모아 볼 수 있어요.'},{kind:'robot',title:'로봇 프로젝트 폴더',subtitle:'ROBOT PROJECTS',description:'설계하고 제작한 로봇 프로젝트를 살펴보세요.'}];
  const select=(index)=>{
    if(index===0)jump('showroom-intro',index);
    if(index===1)jump('showroom-projects',index);
    if(index===2)jump('showroom-competitions',index);
    if(index===3)leave(index,user?user.role==='admin'?'/admin':'/dashboard':'/login');
    if(index===4)leave(index,'/download');
  };
  return <div className="showroom-portal-scroll">
    {intro&&<div className="kfc-intro" role="status" aria-label="K.F.C. 쇼룸에 오신 것을 환영합니다"><div className="kfc-intro-mark">K.F.C.</div><span>WE ARE K.F.C.</span><button type="button" onClick={()=>setIntro(false)} aria-label="애니메이션 건너뛰기">건너뛰기</button></div>}
      <main className="showroom-main">
        <div className="showroom-nav-wrap"><div className="showroom-brand"><img src="/kfc-logo.png" alt="K.F.C. 동아리 로고"/><b>K.F.C. Showroom</b></div><div className="showroom-nav-scroll"><LiquidNavbar items={items} active={active} onChange={select} tone="light" sound={false}/></div></div>
        <section className="showroom-hero" id="showroom-intro"><div className="showroom-eyebrow">WE ARE K.F.C. · 용인시청소년수련관 로봇동아리</div><h1>아이디어를 만들고,<br/><em>함께 움직입니다.</em></h1><p>K.F.C. 쇼룸에 오신 것을 환영합니다. 동아리원이 만든 로봇과 웹앱, 함께한 대회 경험을 둘러보세요.</p><div className="showroom-hero-actions"><button className="button primary" onClick={()=>jump('showroom-projects',1)}>프로젝트 둘러보기 →</button><button className="button secondary" onClick={()=>select(3)}>{user?'회원 공간으로':'회원 로그인'}</button></div><span className="showroom-orbit" aria-hidden="true">✳</span></section>
        <section className="showroom-activity" aria-label="K.F.C. 활동 분야"><article><span>01 / BUILD</span><h2>로봇 제작</h2><p>아이디어를 설계하고 실제로 움직이는 로봇으로 구현합니다.</p></article><article><span>02 / CREATE</span><h2>웹앱 개발</h2><p>동아리원이 만든 디지털 도구와 사용 경험을 소개합니다.</p></article><article><span>03 / CHALLENGE</span><h2>대회 도전</h2><p>준비 과정과 출전 경험을 함께 기록하고 공유합니다.</p></article></section>        <section className="showroom-section" id="showroom-projects"><div className="showroom-section-head"><div><div className="showroom-eyebrow">OUR WORK</div><h2>우리가 만든 것들</h2><p>사진이 담긴 폴더를 열어 프로젝트를 확인해 보세요.</p></div><span>{data.projects.length} PROJECTS</span></div>
          {loading?<div className="showroom-empty">프로젝트를 불러오고 있어요…</div>:error?<div className="showroom-empty" role="alert">{error}<button className="text-button" onClick={()=>location.reload()}>다시 시도</button></div>:<div className="showroom-project-grid">{folders.map((folder,index)=>{const projects=data.projects.filter(project=>project.kind===folder.kind);return <article className="showroom-project showroom-category" key={folder.kind}><GlassFolder key={folder.kind+'-'+projects.map(p=>p.id).join('-')} label={folder.title} meta={projects.length+' PROJECTS'} image={projects[0]?.imageUrl} files={projects.map(project=>({name:project.name,meta:project.author,image:project.imageUrl}))} action="none" width={Math.min(310,typeof window==='undefined'?310:window.innerWidth-54)} appearDelay={index*120} onFileSelect={(_,fileIndex)=>setSelected(projects[fileIndex])}/><div className="showroom-project-copy"><span>{folder.subtitle} · {projects.length}개</span><h3>{folder.title}</h3><p>{folder.description}</p>{projects.length===0&&<small>아직 게시된 프로젝트가 없습니다.</small>}</div></article>})}</div>}
        </section>
        <section className="showroom-section showroom-competition-section" id="showroom-competitions"><div className="showroom-section-head"><div><div className="showroom-eyebrow">OUR JOURNEY</div><h2>함께한 대회 경험</h2><p>K.F.C.가 도전한 무대를 기록합니다.</p></div></div>
          {data.competitions.length?<div className="showroom-competition-list">{data.competitions.map(c=><article key={c.id}><span className="showroom-year">{c.year}</span><div><h3>{c.title}</h3>{c.result&&<strong>{c.result}</strong>}{c.description&&<p>{c.description}</p>}</div></article>)}</div>:<div className="showroom-empty">대회 경험이 등록되면 이곳에서 소개합니다.</div>}
        </section>
        <footer className="showroom-footer"><img src="/kfc-logo.png" alt=""/><span>K.F.C. · Korea Fun Club</span><button onClick={()=>select(3)}>{user?'회원 공간':'회원 로그인'} →</button></footer>
      </main>
    {selected&&<div className="showroom-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="showroom-modal" role="dialog" aria-modal="true" aria-label={selected.name}><button className="showroom-modal-close" onClick={()=>setSelected(null)} aria-label="닫기">×</button><img src={selected.imageUrl} alt={selected.name+' 사진'}/><div><small>{selected.kind==='robot'?'ROBOT PROJECT':'WEB APP'} · {selected.author}</small><h2>{selected.name}</h2><p>{selected.description}</p>{selected.kind==='webapp'&&<><h3>사용방법</h3><p>{selected.instructions}</p><a className="button primary" href={selected.webUrl} target="_blank" rel="noopener noreferrer">웹앱 열기 ↗</a></>}</div></section></div>}
  </div>;
}


