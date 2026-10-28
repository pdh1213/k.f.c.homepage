import React,{useEffect,useState} from 'react';
import {api,fmtDate} from './api.js';

const blank={title:'',content:'',linkType:'none',linkUrl:'',targetId:'',active:true};
const labels={none:'연결 없음',web:'웹 링크',poll:'설문 연결',announcement:'공지사항 연결',event:'일정 연결'};
export default function NoticePopupAdmin({notify}){
  const [data,setData]=useState({popups:[],targets:{announcements:[],polls:[],events:[]}}),[form,setForm]=useState(blank),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const load=async()=>{try{setData(await api('/api/admin/notice-popups'));}catch(e){notify(e.message);}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const reset=()=>{setForm(blank);setEditing(null)};
  const submit=async e=>{e.preventDefault();setBusy(true);try{
    const body={...form,targetId:form.targetId?Number(form.targetId):null};
    const r=await api('/api/admin/notice-popups'+(editing?'/'+editing:''),{method:editing?'PATCH':'POST',body});
    notify(r.message);reset();await load();
  }catch(e){notify(e.message)}finally{setBusy(false)}};
  const remove=async item=>{if(!window.confirm('이 공지 팝업을 삭제할까요?'))return;try{const r=await api('/api/admin/notice-popups/'+item.id,{method:'DELETE'});notify(r.message);await load();if(editing===item.id)reset()}catch(e){notify(e.message)}};
  const edit=item=>{setEditing(item.id);setForm({title:item.title,content:item.content,linkType:item.linkType,linkUrl:item.linkUrl||'',targetId:item.targetId||'',active:item.active})};
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const targets=form.linkType==='poll'?data.targets.polls:form.linkType==='announcement'?data.targets.announcements:form.linkType==='event'?data.targets.events:[];
  return <section className="surface popup-admin"><div className="eyebrow">LOGIN NOTICE</div><h1>로그인 공지 팝업</h1><p className="muted">게시 중인 팝업은 회원이 로그인한 뒤 환영 화면 다음에 표시됩니다. 관리자와 데모 화면에는 표시되지 않습니다.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>제목<input required maxLength="160" value={form.title} onChange={e=>change('title',e.target.value)} placeholder="회원에게 보여줄 제목"/></label>
      <label>내용<textarea required maxLength="5000" rows="4" value={form.content} onChange={e=>change('content',e.target.value)} placeholder="공지 내용을 입력해 주세요"/></label>
      <label>버튼 연결<select value={form.linkType} onChange={e=>setForm(f=>({...f,linkType:e.target.value,linkUrl:'',targetId:''}))}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {form.linkType==='web'&&<label>웹 링크<input type="url" required pattern="https://.*" value={form.linkUrl} onChange={e=>change('linkUrl',e.target.value)} placeholder="https://example.com"/></label>}
      {targets.length>0&&<label>연결할 항목<select required value={form.targetId} onChange={e=>change('targetId',e.target.value)}><option value="">선택해 주세요</option>{targets.map(item=><option key={item.id} value={item.id}>{item.title||item.question}{item.start_at?' · '+fmtDate(item.start_at,{dateStyle:'medium'}):''}</option>)}</select></label>}
      {['poll','announcement','event'].includes(form.linkType)&&targets.length===0&&<p className="notice-box">연결할 항목이 없습니다. 먼저 항목을 등록해 주세요.</p>}
      <label className="check-label"><input type="checkbox" checked={form.active} onChange={e=>change('active',e.target.checked)}/>회원 로그인 시 표시</label>
      <div className="button-row"><button className="button primary" disabled={busy||(['poll','announcement','event'].includes(form.linkType)&&!form.targetId)}>{busy?'저장 중…':editing?'팝업 수정':'팝업 만들기'}</button>{editing&&<button type="button" className="button subtle" onClick={reset}>취소</button>}</div>
    </form>
    <div className="popup-admin-list"><h2>등록된 팝업</h2>{loading?<p className="muted">불러오는 중…</p>:data.popups.length?data.popups.map(item=><article className="manage-row" key={item.id}><div className="grow"><b>{item.title}</b><small>{item.active?'게시 중':'숨김'} · {labels[item.linkType]} · {fmtDate(item.createdAt)}</small></div><button className="button subtle" onClick={()=>edit(item)}>수정</button><button className="button danger-outline" onClick={()=>remove(item)}>삭제</button></article>):<p className="muted">등록된 공지 팝업이 없습니다.</p>}</div>
  </section>;
}

