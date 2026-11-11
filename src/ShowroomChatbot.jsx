import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import {MessageLoading} from '../components/ui/message-loading.tsx';
import {findInstantAnswer,safeChatbotLink} from './chatbot-content.js';
import './showroom-chatbot.css';

const TICKETS='kfc-showroom-chatbot-tickets';
const EXAMPLES=['K.F.C.는 어떤 활동을 하나요?','프로젝트는 어디서 볼 수 있나요?','동아리에 어떻게 참여하나요?'];
const savedTickets=()=>{try{return JSON.parse(localStorage.getItem(TICKETS)||'[]').filter(ticket=>typeof ticket==='string').slice(0,10)}catch{return []}};
const Icon=({name})=>{
  const common={width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
  if(name==='refresh')return <svg {...common}><path d="M20 11a8 8 0 1 0-2.3 6.7"/><path d="M20 4v7h-7"/></svg>;
  if(name==='plus')return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
  if(name==='up')return <svg {...common}><path d="M12 19V5m-7 7 7-7 7 7"/></svg>;
  return <svg {...common}><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3-.5L4 21l1.5-4.5a8.5 8.5 0 1 1 14.5-5"/><path d="M8 11.5h8"/></svg>;
};

function Answer({item,go}){const url=safeChatbotLink(item.linkUrl);return <div className="showroom-chatbot-answer"><p>{item.text}</p>{item.imageUrl&&<img src={item.imageUrl} alt="챗봇 답변 사진" loading="lazy"/>}{url&&<a className="showroom-chatbot-action" href={url} target={url.startsWith('/')?undefined:'_blank'} rel={url.startsWith('/')?undefined:'noopener noreferrer'} onClick={url.startsWith('/')&&go?e=>{e.preventDefault();go(url)}:undefined}>{item.linkLabel||'자세히 보기'} <span aria-hidden="true">↗</span></a>}</div>}
export default function ShowroomChatbot({go}){
  const [open,setOpen]=useState(false),[faqs,setFaqs]=useState([]),[tickets,setTickets]=useState(savedTickets),[replies,setReplies]=useState({}),[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[showChoices,setShowChoices]=useState(true),[typed,setTyped]=useState('');
  const inputRef=useRef(null),endRef=useRef(null);
  useEffect(()=>{api('/api/showroom/chatbot').then(r=>setFaqs(r.faqs||[])).catch(()=>setError('간편 질문을 불러오지 못했습니다.'))},[]);
  useEffect(()=>{if(open&&messages.length)endRef.current?.scrollIntoView({block:'end',behavior:'smooth'})},[open,messages]);
  useEffect(()=>{if(!open)return;let prompt=0,position=0,deleting=false;let timer;const tick=()=>{const value=EXAMPLES[prompt];position+=deleting?-1:1;setTyped(value.slice(0,Math.max(0,position)));if(!deleting&&position>=value.length){deleting=true;timer=setTimeout(tick,2200)}else if(deleting&&position<=0){deleting=false;prompt=(prompt+1)%EXAMPLES.length;timer=setTimeout(tick,650)}else timer=setTimeout(tick,deleting?25:55)};timer=setTimeout(tick,400);return()=>clearTimeout(timer)},[open]);
  const refresh=async()=>{if(!tickets.length)return;try{const results=await Promise.all(tickets.map(async ticket=>{try{return[ticket,await api('/api/showroom/chatbot/questions?ticket='+encodeURIComponent(ticket))]}catch{return[ticket,null]}}));setReplies(Object.fromEntries(results.filter(([,value])=>value)));setError('')}catch{setError('답변 상태를 확인하지 못했습니다.')}};
  useEffect(()=>{if(open)refresh()},[open]);
  const choose=(faq,asked=faq.question)=>{setMessages(current=>[...current,{type:'question',text:asked},{type:'answer',text:faq.answer,imageUrl:faq.imageUrl,linkLabel:faq.linkLabel,linkUrl:faq.linkUrl}]);setShowChoices(false)};
  const reset=()=>{setMessages([]);setQuestion('');setShowChoices(true);setError('')};
  const send=async event=>{event.preventDefault();const value=question.trim();if(!value||busy)return;const instant=findInstantAnswer(faqs,value);if(instant){choose(instant,value);setQuestion('');return}setBusy(true);setError('');try{const result=await api('/api/showroom/chatbot/questions',{method:'POST',body:{question:value}});setMessages(current=>[...current,{type:'question',text:value},{type:'answer',text:'질문을 관리자에게 전달했어요. 답변이 등록되면 아래에서 확인할 수 있습니다.'}]);const next=[result.ticket,...tickets].slice(0,10);setTickets(next);localStorage.setItem(TICKETS,JSON.stringify(next));setReplies(current=>({...current,[result.ticket]:{question:value,status:'pending',answer:''}}));setQuestion('')}catch(e){setError(e.message||'질문을 전달하지 못했습니다.')}finally{setBusy(false)}};
  return <div className="showroom-chatbot">
    {open&&<section className="showroom-chatbot-panel" role="dialog" aria-label="K.F.C. 챗봇"><header><div><h2>K.F.C. 챗봇</h2><p>동아리에 대해 무엇이든 물어보세요.</p></div><div className="showroom-chatbot-header-actions"><button type="button" onClick={reset} title="대화 초기화" aria-label="대화 초기화"><Icon name="refresh"/></button><button type="button" onClick={()=>setOpen(false)} title="챗봇 닫기" aria-label="챗봇 닫기">×</button></div></header>
      <div className="showroom-chatbot-body">
        {!messages.length&&<div className="showroom-chatbot-empty"><span className="showroom-chatbot-empty-icon"><Icon name="message"/></span><h3>안녕하세요, 반가워요!</h3><p>K.F.C. 로봇동아리에 대해<br/>궁금한 것을 알려드릴게요.</p></div>}
        {showChoices&&faqs.length>0&&<div className="showroom-chatbot-choices"><span>간편 질문</span>{faqs.map(faq=><button type="button" key={faq.id} onClick={()=>choose(faq)}>{faq.question}<span aria-hidden="true">↗</span></button>)}</div>}
        <div className="showroom-chatbot-messages" aria-live="polite">{messages.map((item,index)=>item.type==='answer'?<Answer key={index} item={item} go={go}/>:<p key={index} className="question">{item.text}</p>)}</div>
        {tickets.length>0&&<div className="showroom-chatbot-tickets"><div><b>내 질문 답변</b><button type="button" onClick={refresh}><Icon name="refresh"/> 새로고침</button></div>{tickets.map(ticket=>{const reply=replies[ticket];return reply?<article key={ticket}><strong>{reply.question}</strong>{reply.status==='answered'?<Answer item={{text:reply.answer,...reply}} go={go}/>:<p>관리자 답변을 기다리고 있어요.</p>}</article>:null})}</div>}
        {error&&<p className="showroom-chatbot-error" role="alert">{error}</p>}<div ref={endRef}/>
      </div>
      <form onSubmit={send}><label className="visually-hidden" htmlFor="showroom-chatbot-question">다른 질문하기</label><div className="showroom-chatbot-composer"><textarea id="showroom-chatbot-question" ref={inputRef} maxLength={500} rows={2} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form.requestSubmit()}}} placeholder={typed||'궁금한 내용을 적어 주세요'}/><div className="showroom-chatbot-compose-actions"><button type="button" className="showroom-chatbot-plus" onClick={()=>setShowChoices(v=>!v)} aria-label="간편 질문 보기" aria-expanded={showChoices} title="간편 질문 보기"><Icon name="plus"/></button><button type="submit" className="showroom-chatbot-send" disabled={busy||!question.trim()} aria-label={busy?'전달 중':'질문 보내기'} title="질문 보내기">{busy?<MessageLoading/>:<Icon name="up"/>}</button></div></div></form>
    </section>}
    <button className="showroom-chatbot-toggle" type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label={open?'챗봇 닫기':'동아리 챗봇 열기'}><Icon name="message"/> 동아리 챗봇</button>
  </div>;
}
