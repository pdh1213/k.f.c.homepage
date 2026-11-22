import React,{useEffect,useRef,useState} from 'react';
import './account.css';

export function AccountAvatar({src,name='',className=''}) {
  const [broken,setBroken]=useState(false);
  useEffect(()=>setBroken(false),[src]);
  return <span className={`account-avatar ${className}`} title={name||undefined} aria-hidden="true">
    {src&&!broken?<img src={src} alt="" onError={()=>setBroken(true)}/>:<svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8.2" r="3.4"/>
      <path d="M4.8 20a7.2 6.3 0 0 1 14.4 0z"/>
    </svg>}
  </span>;
}

async function preparePhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){
    throw new Error('JPG, PNG, WebP 사진을 8MB 이하로 선택해 주세요.');
  }
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    if(!bitmap.width||!bitmap.height)throw Error();
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=160;
    const context=canvas.getContext('2d');
    const side=Math.min(bitmap.width,bitmap.height);
    context.fillStyle='#ffffff';
    context.fillRect(0,0,160,160);
    context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,160,160);
    for(const quality of [0.78,0.65,0.5]){
      const photo=canvas.toDataURL('image/jpeg',quality);
      if(photo.length<=32791)return photo;
    }
    throw new Error('사진을 줄일 수 없습니다.');
  }catch{
    throw new Error('사진을 읽을 수 없습니다. 다른 파일을 선택해 주세요.');
  }finally{
    bitmap?.close();
  }
}

const blankSecurity={username:'',currentPassword:'',newPassword:'',confirmPassword:''};

export default function AccountPanel({profile,saveProfile,saveUsername,savePassword,demo=false}) {
  const {name,school,grade,avatarData,username}=profile;
  const [details,setDetails]=useState({name:name||'',school:school||'',grade:grade||'',avatarData:avatarData||null});
  const [login,setLogin]=useState(blankSecurity);
  const [password,setPassword]=useState(blankSecurity);
  const [busy,setBusy]=useState('');
  const [preparing,setPreparing]=useState(false);
  const [feedback,setFeedback]=useState(null);
  const photoInput=useRef(null);

  useEffect(()=>{
    setDetails({name:name||'',school:school||'',grade:grade||'',avatarData:avatarData||null});
  },[name,school,grade,avatarData]);
  const changeDetail=(key,value)=>setDetails(current=>({...current,[key]:value}));

  async function choosePhoto(event){
    const file=event.currentTarget.files?.[0];
    if(!file)return;
    event.currentTarget.value='';
    setPreparing(true);
    setFeedback(null);
    try{changeDetail('avatarData',await preparePhoto(file))}
    catch(error){setFeedback({section:'profile',error:true,text:error.message})}
    finally{setPreparing(false)}
  }

  async function submit(event,section,action){
    event.preventDefault();
    if(busy)return;
    setBusy(section);
    setFeedback(null);
    try{
      const message=await action();
      setFeedback({section,text:message});
    }catch(error){
      setFeedback({section,error:true,text:error.message||'저장하지 못했습니다. 다시 시도해 주세요.'});
    }finally{setBusy('')}
  }

  const status=section=>feedback?.section===section&&<p className={feedback.error?'notice-box':'account-success'} role={feedback.error?'alert':'status'}>{feedback.text}</p>;
  return <div className="account-page">
    <header><h1>My account</h1><p className="muted">프로필과 로그인 정보를 관리하세요.</p></header>
    {demo&&<p className="notice-box">데모 초기 비밀번호는 <strong>demo-pass-32</strong>입니다. 입력한 정보는 이 화면에서만 사용됩니다.</p>}
    <section className="surface">
      <h2>프로필</h2>
      <form className="form-stack" onSubmit={event=>submit(event,'profile',()=>{
        const {avatarData:photo,...fields}=details;
        return saveProfile(photo===(avatarData||null)?fields:{...fields,avatarData:photo});
      })}>
        <div className="account-photo">
          <AccountAvatar src={details.avatarData} name={details.name}/>
          <div className="button-row">
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="프로필 사진 파일" className="visually-hidden" onChange={choosePhoto}/>
            <button type="button" className="button secondary" disabled={preparing||!!busy} onClick={()=>photoInput.current?.click()}>{preparing?'사진을 준비하는 중…':'프로필 사진 선택'}</button>
            {details.avatarData&&<button type="button" className="button subtle" disabled={preparing||!!busy} onClick={()=>changeDetail('avatarData',null)}>기본 사진으로</button>}
          </div>
        </div>
        <label>이름<input required maxLength={40} autoComplete="name" value={details.name} onChange={e=>changeDetail('name',e.target.value)}/></label>
        <div className="form-grid">
          <label>학교<input required maxLength={80} value={details.school} onChange={e=>changeDetail('school',e.target.value)}/></label>
          <label>학년<input required maxLength={30} value={details.grade} onChange={e=>changeDetail('grade',e.target.value)}/></label>
        </div>
        {status('profile')}
        <button className="button primary" disabled={!!busy||preparing}>{busy==='profile'?'저장 중…':'프로필 저장'}</button>
      </form>
    </section>
    <div className="account-security">
      <section className="surface">
        <h2>아이디 변경</h2><p className="muted">현재 아이디 <strong>{username}</strong></p>
        <form className="form-stack" onSubmit={event=>submit(event,'username',async()=>{
          const message=await saveUsername({username:login.username.trim().toLowerCase(),currentPassword:login.currentPassword});
          setLogin(blankSecurity);
          return message;
        })}>
          <label>새 아이디<input required minLength={4} maxLength={20} pattern="[A-Za-z0-9_]{4,20}" autoComplete="username" value={login.username} onChange={e=>setLogin({...login,username:e.target.value})}/><small>영문, 숫자, 밑줄 4~20자</small></label>
          <label>현재 비밀번호<input required type="password" autoComplete="current-password" value={login.currentPassword} onChange={e=>setLogin({...login,currentPassword:e.target.value})}/></label>
          {status('username')}
          <button className="button primary" disabled={!!busy}>{busy==='username'?'변경 중…':'아이디 변경'}</button>
        </form>
      </section>
      <section className="surface">
        <h2>비밀번호 변경</h2>
        <form className="form-stack" onSubmit={event=>submit(event,'password',async()=>{
          if(password.newPassword!==password.confirmPassword)throw new Error('새 비밀번호가 서로 다릅니다.');
          if(new TextEncoder().encode(password.newPassword).length>72)throw new Error('새 비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.');
          const message=await savePassword({oldPassword:password.currentPassword,newPassword:password.newPassword});
          setPassword(blankSecurity);
          return message;
        })}>
          <input type="text" className="visually-hidden" tabIndex={-1} aria-hidden="true" autoComplete="username" name="username" value={username||''} readOnly/>
          <label>현재 비밀번호<input required type="password" autoComplete="current-password" value={password.currentPassword} onChange={e=>setPassword({...password,currentPassword:e.target.value})}/></label>
          <label>새 비밀번호<input required minLength={10} maxLength={72} type="password" autoComplete="new-password" value={password.newPassword} onChange={e=>setPassword({...password,newPassword:e.target.value})}/></label>
          <label>새 비밀번호 확인<input required type="password" autoComplete="new-password" value={password.confirmPassword} onChange={e=>setPassword({...password,confirmPassword:e.target.value})}/></label>
          {status('password')}
          <button className="button primary" disabled={!!busy}>{busy==='password'?'변경 중…':'비밀번호 변경'}</button>
        </form>
      </section>
    </div>
  </div>;
}
