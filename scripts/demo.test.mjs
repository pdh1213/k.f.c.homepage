import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

test('데모 화면은 회원 API 없이 예시 화면만 렌더링한다',async()=>{
  const source=fs.readFileSync(new URL('../src/Demo.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:api|fetch|supabase|localStorage)\s*[\.(]/);
  const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const demo=await vite.ssrLoadModule('/src/Demo.jsx');
    const props={go:()=>{},notify:()=>{},open:()=>{},onBack:()=>{}};
    const screens=[
      [demo.default,props,'데모 방문자'],
      [demo.DemoSurveys,props,'응답은 저장되지 않습니다'],
      [demo.DemoGroups,props,'예시 그룹'],
      [demo.DemoChat,{...props,kind:'group'},'실제 연결 없음'],
      [demo.DemoChat,{...props,kind:'direct'},'실제 연결 없음'],
      [demo.DemoCalendar,props,'동아리 일정'],
      [demo.DemoNotices,props,'실제 회원 공지와 분리']
    ];
    for(const [Component,p,expected] of screens){
      const html=renderToString(React.createElement(Component,p));
      assert.ok(html.includes(expected),expected);
    }
  }finally{await vite.close()}
});

