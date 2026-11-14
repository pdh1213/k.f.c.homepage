import test from 'node:test';
import assert from 'node:assert/strict';
import {findInstantAnswer,findKnowledgeAnswer,safeChatbotLink} from '../src/chatbot-content.js';

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

test('관리자가 학습시킨 표현에만 즉시 답하고 다른 질문은 관리자에게 넘긴다',()=>{
  const item={question:'동아리 정기 모임은 언제인가요?',aliases:['모임 시간은 언제인가요?','정기 활동 요일이 궁금해요'],answer:'토요일 오후입니다.'};
  assert.equal(findKnowledgeAnswer([item],'모임 시간은 언제인가요'),item);
  assert.equal(findKnowledgeAnswer([item],'정기 모임은 언제인가요?'),item);
  assert.equal(findKnowledgeAnswer([item],'가입 승인까지 얼마나 걸려요?'),null);
});

