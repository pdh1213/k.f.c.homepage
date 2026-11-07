import React,{useEffect,useState} from 'react';
import packageInfo from '../package.json';
import './release-notes.css';

const version=packageInfo.version;
const notes={
  '3.0.10':[
    '해·달 화면 모드 버튼을 작게 다듬고 쇼룸 메뉴 안에 배치했습니다.',
    '챗봇을 열어도 화면 모드 버튼이 다른 조작과 겹치지 않습니다.'
  ],
  '3.0.9':[
    '쇼룸 챗봇을 새 카드 디자인으로 바꾸고 간편 질문과 답변 확인을 더 쉽게 만들었습니다.',
    '해·달 버튼으로 나이트 모드와 라이트 모드를 전환할 수 있습니다.',
    '선택한 화면 모드는 다음 방문과 Windows 앱에서도 유지됩니다.'
  ],
  '3.0.8':[
    '쇼룸에서 동아리 챗봇의 간편 질문을 누르면 바로 답변을 볼 수 있습니다.',
    '추가 질문을 보내고 관리자 답변을 확인할 수 있습니다.',
    '관리자는 챗봇 관리에서 질문 답변과 간편 질문을 관리할 수 있습니다.'
  ],
  '3.0.7':[
    '프로젝트 상세에서 관련 작품을 연결하고 바로 살펴볼 수 있습니다.',
    '대회 기록에 참가 프로젝트를 연결해 쇼룸에서 함께 볼 수 있습니다.',
    '데모에서 작품과 대회 연결을 체험할 수 있습니다.'
  ],
  '3.0.6':[
    '쇼룸의 웹앱·로봇 프로젝트 폴더 모서리를 자연스럽게 다듬었습니다.'
  ],
  '3.0.5':[
    '가입 신청이 접수되면 승인 대기 상태를 큰 확인 팝업으로 안내합니다.',
    'Windows 앱의 쇼룸에서는 Windows 앱 설치 메뉴를 숨깁니다.'
  ],
  '3.0.4':[
    '첫 접속 시 동아리 로고가 유리 효과와 함께 나타나는 새 환영 애니메이션을 적용했습니다.',
    '모바일과 Windows 앱에서도 같은 로고 환영 화면을 볼 수 있습니다.'
  ],
  '3.0.3':[
    '일정·설문·프로젝트 기록의 날짜를 같은 달력 팝오버에서 선택할 수 있습니다.',
    '연도와 월을 바로 고르고, 일정에는 시간도 함께 설정할 수 있습니다.',
    '데모 일정과 설문에서도 새 날짜 선택 방식을 체험할 수 있습니다.'
  ],
  '3.0.2':[
    '그룹 채팅과 1:1 대화에서 상대가 메시지를 입력 중일 때 바로 알려줍니다.',
    '입력을 멈추거나 대화방을 나가면 표시가 자동으로 사라집니다.',
    '데모 모드에서도 입력 중 표시를 체험할 수 있습니다.',
    '쇼룸의 별 모양 장식이 모바일에서도 같은 모양으로 표시됩니다.'
  ],
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
