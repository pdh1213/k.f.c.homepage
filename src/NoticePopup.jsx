import React,{useEffect,useRef} from 'react';

const actionLabels={web:'웹사이트 열기',poll:'설문 보기',announcement:'공지사항 보기',event:'일정 보기'};
export default function NoticePopup({item,index,total,onClose,onAction}){
  const closeRef=useRef(null);
  useEffect(()=>{closeRef.current?.focus()},[item.id]);
  useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose]);
  return <div className="notice-popup-backdrop" role="presentation"><section className="notice-popup-card" role="dialog" aria-modal="true" aria-labelledby="notice-popup-title" aria-describedby="notice-popup-content">
    <div className="notice-popup-icon" aria-hidden="true">✳</div>
    <span className="eyebrow">K.F.C. 공지 · {index+1}/{total}</span>
    <h1 id="notice-popup-title">{item.title}</h1><p id="notice-popup-content">{item.content}</p>
    <div className="notice-popup-actions">{item.linkType!=='none'&&<button className="button primary" onClick={()=>onAction(item)}>{actionLabels[item.linkType]||'자세히 보기'} ↗</button>}<button ref={closeRef} className="button secondary" onClick={onClose}>확인</button></div>
  </section></div>;
}

