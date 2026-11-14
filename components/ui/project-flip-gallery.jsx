import React,{useEffect,useRef,useState} from 'react';
import RobotModelViewer from '../../src/RobotModelViewer.jsx';
import './project-flip-gallery.css';

export default function ProjectFlipGallery({projects,title,onClose,allProjects=projects,initialProjectId=null}){
  const [active,setActive]=useState(0);
  const [relatedId,setRelatedId]=useState(initialProjectId);
  const [entered,setEntered]=useState(false);
  const [viewerOpen,setViewerOpen]=useState(false);
  const closeRef=useRef(null);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setEntered(true));closeRef.current?.focus();return()=>cancelAnimationFrame(frame)},[]);
  useEffect(()=>{const onKey=event=>{if(event.key==='Escape')onClose();if(projects.length>1&&event.key==='ArrowRight')setActive(index=>(index+1)%projects.length);if(projects.length>1&&event.key==='ArrowLeft')setActive(index=>(index-1+projects.length)%projects.length)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[projects.length,onClose]);
  const selected=allProjects.find(project=>project.id===relatedId)||projects[active];
  useEffect(()=>setViewerOpen(false),[selected?.id]);
  return <div className="project-gallery-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className={'project-gallery '+(entered?'entered':'')} role="dialog" aria-modal="true" aria-label={title}>
      <header className="project-gallery-header"><div><span>K.F.C. SHOWROOM / PROJECTS</span><h2>{title}</h2><p>동아리원이 만든 작품을 카드로 둘러보세요.</p></div><div className="project-gallery-header-actions"><span>{String(projects.length).padStart(2,'0')} PROJECTS</span><button type="button" ref={closeRef} onClick={onClose} aria-label="폴더 닫기">×</button></div></header>
      {selected?<div className="project-gallery-content">
        <div className="project-gallery-stage">
          <div className="project-gallery-rail" role="list" aria-label="프로젝트 카드 목록">{projects.map((project,index)=><div role="listitem" key={project.id}><button type="button" className={'project-gallery-card '+(!relatedId&&active===index?'active':'')} style={{'--card-index':index}} onClick={()=>{setRelatedId(null);setActive(index)}} aria-label={project.name+' 프로젝트 보기'} aria-current={!relatedId&&active===index?'true':undefined}><img src={project.imageUrl} alt=""/><span>{project.name}</span></button></div>)}</div>
          <figure className="project-gallery-hero" key={selected.id}><img src={selected.imageUrl} alt={selected.name+' 사진'}/><figcaption><span>{selected.kind==='robot'?'ROBOT PROJECT':'WEB APP'}</span><strong>{selected.name}</strong></figcaption></figure>
        </div>
        <div className="project-gallery-info" aria-live="polite"><span className="project-gallery-count">{relatedId?'RELATED PROJECT':`${String(active+1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')}`}</span><h3>{selected.name}</h3><p className="project-gallery-author">{selected.kind==='robot'?'로봇 프로젝트':'웹앱'} · {selected.author} · <b>{selected.phase==='completed'?'완료':'진행 중'}</b></p>{selected.collaborators?.length>0&&<p className="project-gallery-collaborators"><b>공동 제작자</b> {selected.collaborators.map(person=>person.name).join(', ')}</p>}<p className="project-gallery-description">{selected.description}</p>{(selected.modelUrl||selected.modelFile)&&<><button className="button secondary" type="button" onClick={()=>setViewerOpen(open=>!open)}>{viewerOpen?'3D 모델 닫기':'로봇 3D로 보기'}</button>{viewerOpen&&<RobotModelViewer file={selected.modelFile} url={selected.modelUrl} title={selected.name+' 3D 모델'}/>}</>}{selected.progressEntries?.length>0&&<section className="project-gallery-progress"><h4>프로젝트 진행 기록</h4><ol>{[...selected.progressEntries].sort((a,b)=>a.date.localeCompare(b.date)).map(entry=><li key={entry.id}><time dateTime={entry.date}>{entry.date}</time><b>{entry.title}</b><p>{entry.content}</p></li>)}</ol></section>}{selected.kind==='webapp'&&<><h4>사용방법</h4><p className="project-gallery-description">{selected.instructions}</p><a className="button primary" href={selected.webUrl} target="_blank" rel="noopener noreferrer">웹앱 열기 ↗</a></>}{selected.relatedProjectIds?.some(id=>allProjects.some(project=>project.id===id))&&<section className="project-gallery-related"><h4>관련 작품</h4><div>{selected.relatedProjectIds.map(id=>allProjects.find(project=>project.id===id)).filter(Boolean).map(project=><button type="button" key={project.id} onClick={()=>setRelatedId(project.id)}>{project.name} ↗</button>)}</div></section>}<p className="project-gallery-hint">왼쪽 카드를 누르거나 ← → 키로 다른 작품을 볼 수 있습니다.</p></div>
      </div>:<div className="project-gallery-empty">아직 게시된 프로젝트가 없습니다.</div>}
    </section>
  </div>;
}

