import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

test('첫 쇼룸 화면이 실제 동아리 로고 리빌과 건너뛰기를 표시한다',async()=>{
  const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const Showroom=(await vite.ssrLoadModule('/src/Showroom.jsx')).default;
    const html=renderToString(React.createElement(Showroom,{go:()=>{},user:null}));
    assert.match(html,/kfc-intro/);
    assert.match(html,/kfc-glass-reveal/);
    assert.match(html,/K\.F\.C\. 동아리 로고/);
    assert.match(html,/애니메이션 건너뛰기/);
    assert.doesNotMatch(html,/21st\.dev/);
  }finally{await vite.close()}
});
