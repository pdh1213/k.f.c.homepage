import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

test('관리자 공지 화면은 공지 데이터만 받아도 목록과 작성 양식을 그린다',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {AnnouncementAdmin}=await vite.ssrLoadModule('/src/Admin.jsx');
    const props={user:{id:1},refresh:()=>{},notify:()=>{}};
    const notices=[{id:7,title:'검증용 공지',content:'안내',createdAt:'2026-11-21T00:00:00.000Z',published:true,images:[]}];
    const html=renderToString(React.createElement(AnnouncementAdmin,{...props,data:{announcements:notices}}));
    assert.match(html,/공지사항 작성/);
    assert.match(html,/검증용 공지/);
    assert.match(html,/사진 여러 장 첨부/);
  }finally{
    await vite.close();
  }
});

