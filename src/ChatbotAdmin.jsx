import React,{useState} from 'react';
import {api,supabase} from './api.js';
import './chatbot-admin.css';
import ChatbotKnowledgeAdmin from './ChatbotKnowledgeAdmin.jsx';

const blank=()=>({question:'',answer:'',sortOrder:0,active:true,imagePath:'',imageUrl:'',linkLabel:'',linkUrl:''});
const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif']);
async function uploadImage(file,userId){
  if(!imageTypes.has(file.type)||file.size>5*1024*1024)throw new Error('사진은 JPG, PNG, WebP, GIF, AVIF 형식으로 5MB까지 올릴 수 있습니다.');
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90)||'photo';
  const path=`chatbot/${userId}/${crypto.randomUUID()}/${safe}`;
  const result=await supabase.storage.from('chatbot-images').upload(path,file,{upsert:false,contentType:file.type});
  if(result.error)throw result.error;
  return path;
}
function RichFields({value,change,file,onFile}){
  return <div className="chatbot-rich-fields">
    <div className="form-grid"><label>버튼 이름<input maxLength={80} value={value.linkLabel||''} onChange={e=>change({linkLabel:e.target.value})} placeholder="예: Windows 앱 다운로드"/></label><label>이동 URL<input maxLength={500} value={value.linkUrl||''} onChange={e=>change({linkUrl:e.target.value})} placeholder="/download 또는 https://..."/></label></div>
    <p className="small muted">사이트 안의 주소는 /download처럼 입력하고, 외부 주소는 HTTPS로 입력하세요.</p>
    <label>답변 사진<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={e=>onFile(e.target.files?.[0]||null)}/></label>
    {file&&<small>새 사진: {file.name}</small>}
    {value.imageUrl&&!file&&<img className="chatbot-admin-image" src={value.imageUrl} alt="현재 답변 사진"/>}
    {(value.imagePath||file)&&<button type="button" className="button subtle" onClick={()=>{onFile(null);change({imagePath:'',imageUrl:''})}}>사진 제거</button>}
  </div>;
}
export default function ChatbotAdmin({data,notify,refresh,user}){
  const [form,setForm]=useState(blank),[editing,setEditing]=useState(null),[faqFile,setFaqFile]=useState(null),[answers,setAnswers]=useState({}),[answerFiles,setAnswerFiles]=useState({}),[busy,setBusy]=useState(false),[knowledgeSeed,setKnowledgeSeed]=useState(null);
  const faqs=data?.faqs||[],questions=(data?.questions||[]).filter(item=>item.status==='pending');
  const saveFaq=async event=>{event.preventDefault();setBusy(true);try{const imagePath=faqFile?await uploadImage(faqFile,user.id):form.imagePath;const r=await api('/api/admin/chatbot/faqs'+(editing?'/'+editing:''),{method:editing?'PATCH':'POST',body:{...form,imagePath}});notify(r.message);setEditing(null);setForm(blank());setFaqFile(null);await refresh()}catch(e){notify(e.message)}finally{setBusy(false)}};
  const editFaq=faq=>{setEditing(faq.id);setForm({...faq});setFaqFile(null);document.querySelector('.chatbot-admin-form')?.scrollIntoView({behavior:'smooth'})};
  const deleteFaq=async faq=>{if(!window.confirm('「'+faq.question+'」 간편 질문을 삭제할까요?'))return;try{const r=await api('/api/admin/chatbot/faqs/'+faq.id,{method:'DELETE'});notify(r.message);await refresh()}catch(e){notify(e.message)}};
  const draftFor=item=>answers[item.id]||{answer:item.answer||'',imagePath:item.imagePath||'',imageUrl:item.imageUrl||'',linkLabel:item.linkLabel||'',linkUrl:item.linkUrl||''};
  const changeAnswer=(id,patch)=>setAnswers(current=>({...current,[id]:{...(current[id]||draftFor(questions.find(item=>item.id===id))),...patch}}));
  const answerQuestion=async item=>{const draft=draftFor(item);if(!draft.answer.trim()){notify('답변을 입력해 주세요.');return}setBusy(true);try{const file=answerFiles[item.id];const imagePath=file?await uploadImage(file,user.id):draft.imagePath;const r=await api('/api/admin/chatbot/questions/'+item.id,{method:'PATCH',body:{...draft,imagePath}});notify(r.message);setAnswerFiles(current=>({...current,[item.id]:null}));await refresh()}catch(e){notify(e.message)}finally{setBusy(false)}};
  const promote=item=>{const draft=draftFor(item);setEditing(null);setForm({...blank(),question:item.question,answer:draft.answer,sortOrder:faqs.length*10+10,linkLabel:draft.linkLabel,linkUrl:draft.linkUrl,imagePath:draft.imagePath,imageUrl:draft.imageUrl});setFaqFile(null);document.querySelector('.chatbot-admin-form')?.scrollIntoView({behavior:'smooth'})};
  return <div className="admin-manager chatbot-admin"><section className="surface"><div className="section-heading"><div><div className="eyebrow">SHOWROOM CHATBOT</div><h1>추가 질문</h1><p className="muted">쇼룸 방문자의 질문에 답변하고 사진과 이동 버튼을 함께 보여줄 수 있습니다.</p></div><span className="count-pill">대기 {questions.filter(item=>item.status==='pending').length}건</span></div>
    {questions.length?<div className="chatbot-admin-list">{questions.map(item=>{const draft=draftFor(item);return <article key={item.id}><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {item.status==='answered'?'답변 완료':'답변 대기'}</small><h3>{item.question}</h3><label>답변<textarea rows="3" maxLength={3000} value={draft.answer} onChange={e=>changeAnswer(item.id,{answer:e.target.value})} placeholder="방문자에게 보여줄 답변을 입력해 주세요"/></label><RichFields value={draft} change={patch=>changeAnswer(item.id,patch)} file={answerFiles[item.id]} onFile={file=>setAnswerFiles(current=>({...current,[item.id]:file}))}/><div className="button-row"><button className="button primary" type="button" disabled={busy} onClick={()=>answerQuestion(item)}>답변 완료</button><button className="button subtle" type="button" onClick={()=>promote(item)}>간편 질문으로 등록</button><button className="button subtle" type="button" onClick={()=>setKnowledgeSeed({question:item.question,answer:draft.answer,linkLabel:draft.linkLabel,linkUrl:draft.linkUrl})}>답변 지식으로 등록</button></div></article>})}</div>:<div className="empty-state"><b>접수된 추가 질문이 없습니다.</b></div>}</section>
    <section className="surface chatbot-admin-form"><div className="section-heading"><div><div className="eyebrow">QUICK ANSWERS</div><h2>간편 질문 관리</h2><p className="muted">버튼, 사진, URL을 넣어 방문자가 바로 필요한 화면으로 이동하게 할 수 있습니다.</p></div></div><form className="form-stack" onSubmit={saveFaq}><label>질문<input required maxLength={180} value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/></label><label>답변<textarea required rows="4" maxLength={3000} value={form.answer} onChange={e=>setForm({...form,answer:e.target.value})}/></label><RichFields value={form} change={patch=>setForm(current=>({...current,...patch}))} file={faqFile} onFile={setFaqFile}/><div className="form-grid"><label>표시 순서<input type="number" value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})}/></label><label className="check-label"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>쇼룸에 표시</label></div><div className="button-row"><button className="button primary" disabled={busy}>{editing?'수정 저장':'간편 질문 추가'}</button>{editing&&<button className="button subtle" type="button" onClick={()=>{setEditing(null);setForm(blank());setFaqFile(null)}}>취소</button>}</div></form>
      <div className="chatbot-admin-list">{faqs.map(faq=><article key={faq.id}><small>순서 {faq.sortOrder} · {faq.active?'표시 중':'숨김'}</small><h3>{faq.question}</h3><p>{faq.answer}</p>{faq.imageUrl&&<img className="chatbot-admin-image" src={faq.imageUrl} alt="답변 사진"/>}{faq.linkUrl&&<small>{faq.linkLabel} → {faq.linkUrl}</small>}<div className="button-row"><button className="button subtle" onClick={()=>editFaq(faq)}>수정</button><button className="button danger-outline" onClick={()=>deleteFaq(faq)}>삭제</button></div></article>)}</div></section><ChatbotKnowledgeAdmin data={data} notify={notify} refresh={refresh} seed={knowledgeSeed}/></div>;
}

