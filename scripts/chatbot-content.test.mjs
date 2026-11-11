import test from 'node:test';
import assert from 'node:assert/strict';
import {findInstantAnswer,safeChatbotLink} from '../src/chatbot-content.js';

test('Windows 앱 다운로드 질문은 서버에 접수하지 않고 안내 답변을 선택한다',()=>{
  const faq={question:'Windows 앱은 어디에서 받나요?',answer:'설치 파일을 내려받으세요.',linkLabel:'다운로드 페이지',linkUrl:'/download'};
  assert.equal(findInstantAnswer([faq],'windows 앱 다운로드 어디서 하나요?'),faq);
  assert.equal(findInstantAnswer([],'윈도우 앱 설치는 어디서 하나요?').linkUrl,'/download');
  assert.equal(findInstantAnswer([],'동아리 모임은 언제 하나요?'),null);
});

test('챗봇 이동 버튼은 안전한 내부 경로와 HTTPS 링크만 사용한다',()=>{
  assert.equal(safeChatbotLink('/download'),'/download');
  assert.equal(safeChatbotLink('https://example.org/info'),'https://example.org/info');
  assert.equal(safeChatbotLink('javascript:alert(1)'),'');
  assert.equal(safeChatbotLink('//example.org'),'');
  assert.equal(safeChatbotLink('http://example.org'),'');
});
