import React,{useEffect,useRef,useState} from 'react';
import {api} from './api.js';
import './showroom-chatbot.css';

const TICKETS='kfc-showroom-chatbot-tickets';
const savedTickets=()=>{try{return JSON.parse(localStorage.getItem(TICKETS)||'[]').filter(ticket=>typeof ticket==='string').slice(0,10)}catch{return []}};

export default function ShowroomChatbot(){
  const [open,setOpen]=useState(false),[faqs,setFaqs]=useState([]),[tickets,setTickets]=useState(savedTickets),[replies,setReplies]=useState({}),[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const inputRef=useRef(null),endRef=useRef(null);
  useEffect(()=>{api('/api/showroom/chatbot').then(r=>setFaqs(r.faqs||[])).catch(()=>setError('간편 질문을 불러오지 못했습니다.'))},[]);
  useEffect(()=>{if(open){inputRef.current?.focus();endRef.current?.scrollIntoView({block:'end'})}},[open,messages]);
  const refresh=async()=>{if(!tickets.length)return;try{const results=await Promise.all(tickets.map(async ticket=>{try{return[ticket,await api('/api/showroom/chatbot/questions?ticket='+encodeURIComponent(ticket))]}catch{return[ticket,null]}}));setReplies(Object.fromEntries(results.filter(([,value])=>value)));setError('')}catch{setError('답변 상태를 확인하지 못했습니다.')}};
  useEffect(()=>{if(open)refresh()},[open]);
  const choose=faq=>setMessages(current=>[...current,{type:'question',text:faq.question},{type:'answer',text:faq.answer}]);
  const send=async event=>{event.preventDefault();const value=question.trim();if(!value||busy)return;setBusy(true);setError('');try{const result=await api('/api/showroom/chatbot/questions',{method:'POST',body:{question:value}});setMessages(current=>[...current,{type:'question',text:value},{type:'answer',text:'질문을 관리자에게 전달했어요. 답변이 등록되면 아래에서 확인할 수 있습니다.'}]);const next=[result.ticket,...tickets].slice(0,10);setTickets(next);localStorage.setItem(TICKETS,JSON.stringify(next));setReplies(current=>({...current,[result.ticket]:{question:value,status:'pending',answer:''}}));setQuestion('')}catch(e){setError(e.message||'질문을 전달하지 못했습니다.')}finally{setBusy(false)}};
  return <div className="showroom-chatbot">
    {open&&<section className="showroom-chatbot-panel" role="dialog" aria-label="K.F.C. 챗봇"><header><div><small>K.F.C. SHOWROOM</small><h2>동아리 안내</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="챗봇 닫기">×</button></header>
      <div className="showroom-chatbot-body"><p className="showroom-chatbot-intro">궁금한 내용을 선택하면 바로 알려드릴게요.</p><div className="showroom-chatbot-choices">{faqs.map(faq=><button type="button" key={faq.id} onClick={()=>choose(faq)}>{faq.question} ↗</button>)}</div>
        <div className="showroom-chatbot-messages" aria-live="polite">{messages.map((item,index)=><p key={index} className={item.type}>{item.text}</p>)}</div>
        {tickets.length>0&&<div className="showroom-chatbot-tickets"><div><b>내 질문</b><button type="button" onClick={refresh}>답변 새로고침 ↻</button></div>{tickets.map(ticket=>{const reply=replies[ticket];return reply?<article key={ticket}><strong>{reply.question}</strong><p>{reply.status==='answered'?reply.answer:'관리자 답변을 기다리고 있어요.'}</p></article>:null})}</div>}
        {error&&<p className="showroom-chatbot-error" role="alert">{error}</p>}<div ref={endRef}/>
      </div><form onSubmit={send}><label htmlFor="showroom-chatbot-question">다른 질문하기</label><div><input id="showroom-chatbot-question" ref={inputRef} maxLength={500} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="궁금한 내용을 적어 주세요"/><button disabled={busy||!question.trim()} type="submit">{busy?'전달 중…':'질문 보내기'}</button></div></form></section>}
    <button className="showroom-chatbot-toggle" type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label={open?'챗봇 닫기':'동아리 챗봇 열기'}><span aria-hidden="true">✳</span> 동아리 챗봇</button>
  </div>;
}
