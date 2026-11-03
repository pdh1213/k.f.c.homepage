import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

test('첫 쇼룸 화면이 실제 동아리 로고 리빌과 건너뛰기를 표시한다',async()=>{
  const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const {default:Showroom,showroomItems}=await vite.ssrLoadModule('/src/Showroom.jsx');
    const html=renderToString(React.createElement(Showroom,{go:()=>{},user:null}));
    assert.match(html,/kfc-intro/);
    assert.match(html,/kfc-glass-reveal/);
    assert.match(html,/K\.F\.C\. 동아리 로고/);
    assert.match(html,/애니메이션 건너뛰기/);
    assert.doesNotMatch(html,/21st\.dev/);
    assert.equal(showroomItems(null,true).some(item=>item.label==='Windows App'),false);
    assert.equal(showroomItems(null,false).some(item=>item.label==='Windows App'),true);
  }finally{await vite.close()}
});

test('가입 접수 팝업이 승인 대기를 분명히 안내한다',async()=>{
  const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const {RegistrationSuccess}=await vite.ssrLoadModule('/src/App.jsx');
    const html=renderToString(React.createElement(RegistrationSuccess,{onClose:()=>{}}));
    assert.match(html,/role="dialog"/);
    assert.match(html,/가입 신청이 완료되었습니다/);
    assert.match(html,/승인 대기/);
    assert.match(html,/관리자가 승인한 뒤 로그인/);
    assert.doesNotMatch(html,/<input/);
  }finally{await vite.close()}
});
