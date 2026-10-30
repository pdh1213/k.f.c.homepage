import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import GlyphPortal from '../components/ui/glyph-portal.tsx';
import LiquidNavbar,{NimbusIcons} from '../components/ui/liquid-glass-navbar.tsx';
import GlassFolder from '../components/ui/glass-folder-cards.tsx';
import './showroom.css';

export default function Showroom({go,user}){
  const root=useRef(null);
  const [data,setData]=useState({projects:[],competitions:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [active,setActive]=useState(0);
  useEffect(()=>{
    let alive=true;
    api('/api/showroom').then(r=>{if(alive)setData({projects:r.projects||[],competitions:r.competitions||[]})})
      .catch(e=>{if(alive)setError(e.message||'쇼룸을 불러오지 못했습니다.')})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[]);
  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setTimeout(()=>{
      const shell=root.current,content=shell?.querySelector('[data-gp-content]');
      if(shell&&content){const top=content.getBoundingClientRect().top-shell.getBoundingClientRect().top+shell.scrollTop;shell.scrollTo({top,behavior:'smooth'})}
    },520);
    return()=>window.clearTimeout(timer);
  },[]);
  const jump=(id,index)=>{setActive(index);document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})};
  const items=[
    {label:'쇼룸',icon:NimbusIcons.home,fx:'glow'},
    {label:'프로젝트',icon:NimbusIcons.drop,fx:'drop'},
    {label:'대회 경험',icon:NimbusIcons.globe,fx:'spin'},
    {label:user?'회원 공간':'로그인',icon:NimbusIcons.user,fx:'wave'},
    {label:'Windows 앱',icon:NimbusIcons.plane,fx:'plane'}
  ];
  const select=(index)=>{
    if(index===0)jump('showroom-intro',index);
    if(index===1)jump('showroom-projects',index);
    if(index===2)jump('showroom-competitions',index);
    if(index===3)go(user?user.role==='admin'?'/admin':'/dashboard':'/login');
    if(index===4)go('/download');
  };
  return <div className="showroom-portal-scroll" ref={root}>
    <GlyphPortal word="K.F.C." focusChar="F" interactive={false} scrollLength={1.15} fontWeight={900} enterLabel="K.F.C. 쇼룸으로 이동"
      style={{'--gp-paper':'#f9f8f5','--gp-ink':'#171716','--gp-field':'#181715','--gp-foreground':'#faf9f5'}}
      background={<div className="showroom-field"/>}
      front={<div className="portal-frontbar"><div className="portal-front-brand"><img src="/kfc-logo.png" alt=""/><span>K.F.C.</span><small>ROBOTICS CLUB · YONGIN</small></div></div>}>
      <main className="showroom-main" data-gp-content>
        <div className="showroom-nav-wrap"><div className="showroom-brand"><img src="/kfc-logo.png" alt="K.F.C. 동아리 로고"/><b>K.F.C. Showroom</b></div><div className="showroom-nav-scroll"><LiquidNavbar items={items} active={active} onChange={select} tone="light" sound={false}/></div></div>
        <section className="showroom-hero" id="showroom-intro"><div className="showroom-eyebrow">WE ARE K.F.C. · 용인시청소년수련관 로봇동아리</div><h1>아이디어를 만들고,<br/><em>함께 움직입니다.</em></h1><p>K.F.C. 쇼룸에 오신 것을 환영합니다. 동아리원이 만든 로봇과 웹앱, 함께한 대회 경험을 둘러보세요.</p><div className="showroom-hero-actions"><button className="button primary" onClick={()=>jump('showroom-projects',1)}>프로젝트 둘러보기 →</button><button className="button secondary" onClick={()=>go(user?'/dashboard':'/login')}>{user?'회원 공간으로':'회원 로그인'}</button></div><span className="showroom-orbit" aria-hidden="true">✳</span></section>
        <section className="showroom-activity" aria-label="K.F.C. 활동 분야"><article><span>01 / BUILD</span><h2>로봇 제작</h2><p>아이디어를 설계하고 실제로 움직이는 로봇으로 구현합니다.</p></article><article><span>02 / CREATE</span><h2>웹앱 개발</h2><p>동아리원이 만든 디지털 도구와 사용 경험을 소개합니다.</p></article><article><span>03 / CHALLENGE</span><h2>대회 도전</h2><p>준비 과정과 출전 경험을 함께 기록하고 공유합니다.</p></article></section>        <section className="showroom-section" id="showroom-projects"><div className="showroom-section-head"><div><div className="showroom-eyebrow">OUR WORK</div><h2>우리가 만든 것들</h2><p>사진이 담긴 폴더를 열어 프로젝트를 확인해 보세요.</p></div><span>{data.projects.length} PROJECTS</span></div>
          {loading?<div className="showroom-empty">프로젝트를 불러오고 있어요…</div>:error?<div className="showroom-empty" role="alert">{error}<button className="text-button" onClick={()=>location.reload()}>다시 시도</button></div>:data.projects.length?<div className="showroom-project-grid">{data.projects.map((project,index)=><article className="showroom-project" key={project.id}><GlassFolder label={project.name} meta={project.kind==='robot'?'ROBOT PROJECT':'WEB APP'} image={project.imageUrl} files={[{name:'자세히 보기',meta:project.kind==='robot'?'로봇 프로젝트':'웹앱 소개',image:project.imageUrl}]} action="none" width={Math.min(310,typeof window==='undefined'?310:window.innerWidth-54)} appearDelay={index*90} onFileSelect={()=>setSelected(project)}/><div className="showroom-project-copy"><span>{project.kind==='robot'?'로봇':'웹앱'} · {project.author}</span><h3>{project.name}</h3><p>{project.description}</p><button className="text-button" onClick={()=>setSelected(project)}>자세히 보기 ↗</button></div></article>)}</div>:<div className="showroom-empty">아직 게시된 프로젝트가 없습니다. 동아리원의 첫 작품을 기다려 주세요.</div>}
        </section>
        <section className="showroom-section showroom-competition-section" id="showroom-competitions"><div className="showroom-section-head"><div><div className="showroom-eyebrow">OUR JOURNEY</div><h2>함께한 대회 경험</h2><p>K.F.C.가 도전한 무대를 기록합니다.</p></div></div>
          {data.competitions.length?<div className="showroom-competition-list">{data.competitions.map(c=><article key={c.id}><span className="showroom-year">{c.year}</span><div><h3>{c.title}</h3>{c.result&&<strong>{c.result}</strong>}{c.description&&<p>{c.description}</p>}</div></article>)}</div>:<div className="showroom-empty">대회 경험이 등록되면 이곳에서 소개합니다.</div>}
        </section>
        <footer className="showroom-footer"><img src="/kfc-logo.png" alt=""/><span>K.F.C. · Korea Fun Club</span><button onClick={()=>go('/login')}>회원 로그인 →</button></footer>
      </main>
    </GlyphPortal>
    {selected&&<div className="showroom-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="showroom-modal" role="dialog" aria-modal="true" aria-label={selected.name}><button className="showroom-modal-close" onClick={()=>setSelected(null)} aria-label="닫기">×</button><img src={selected.imageUrl} alt={selected.name+' 사진'}/><div><small>{selected.kind==='robot'?'ROBOT PROJECT':'WEB APP'} · {selected.author}</small><h2>{selected.name}</h2><p>{selected.description}</p>{selected.kind==='webapp'&&<><h3>사용방법</h3><p>{selected.instructions}</p><a className="button primary" href={selected.webUrl} target="_blank" rel="noopener noreferrer">웹앱 열기 ↗</a></>}</div></section></div>}
  </div>;
}



