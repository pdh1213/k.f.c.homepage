import React,{useEffect,useState} from 'react';
import packageInfo from '../package.json';
import './release-notes.css';

const version=packageInfo.version;
const notes={
  '3.0.1':[
    'My Projects에서 공동 제작자와 프로젝트 진행 기록을 추가할 수 있습니다.',
    '프로젝트의 진행 중·완료 상태를 정하고 쇼룸에서 확인할 수 있습니다.',
    '프로젝트 신청 화면은 신청 버튼을 누를 때 열립니다.',
    '데모 모드에서 새 프로젝트 기능을 실제 데이터와 분리해 체험할 수 있습니다.'
  ]
};

export default function ReleaseNotes(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{const key='kfc-release-notes-seen-'+version;try{if(window.localStorage.getItem(key))return}catch{return}const timer=window.setTimeout(()=>setOpen(true),2400);return()=>window.clearTimeout(timer)},[]);
  const dismiss=()=>{try{window.localStorage.setItem('kfc-release-notes-seen-'+version,'1')}catch{}setOpen(false)};
  if(!open||!notes[version])return null;
  return <div className="release-notes-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)dismiss()}}><section className="release-notes" role="dialog" aria-modal="true" aria-labelledby="release-notes-title"><span className="release-notes-label">K.F.C. UPDATE</span><h2 id="release-notes-title">새로운 버전 {version}</h2><p>이번 업데이트에서 달라진 점을 알려드릴게요.</p><ul>{notes[version].map(item=><li key={item}>{item}</li>)}</ul><button type="button" className="button primary" onClick={dismiss} autoFocus>확인했어요</button></section></div>;
}
