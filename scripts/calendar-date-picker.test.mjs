import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

test('공통 날짜 선택기는 윤년과 날짜·시간 값을 표시한다',async()=>{
  const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const {CalendarDatePicker,monthDays}=await vite.ssrLoadModule('/components/ui/calendar-date-picker.tsx');
    assert.equal(monthDays(2024,1).filter(Boolean).length,29);
    assert.equal(monthDays(2025,1).filter(Boolean).length,28);
    const html=renderToString(React.createElement(CalendarDatePicker,{value:'2026-11-02T14:30',mode:'datetime',required:true,label:'시작 날짜',onChange:()=>{}}));
    assert.match(html,/2026년 11월 2일/);
    assert.match(html,/14:30/);
    assert.match(html,/aria-label="시작 날짜"/);
    assert.match(html,/required=""/);
  }finally{await vite.close()}
});
