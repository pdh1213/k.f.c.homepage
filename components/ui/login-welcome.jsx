import React,{useEffect,useRef,useState} from 'react';
import ParticleTitle from './particle-title.tsx';
import {pickWelcomeMessage} from './welcome-messages.js';

export default function LoginWelcome({onComplete}){
  const [leaving,setLeaving]=useState(false);
  const [message]=useState(()=>pickWelcomeMessage());
  const callback=useRef(onComplete);
  const finished=useRef(false);
  useEffect(()=>{callback.current=onComplete;},[onComplete]);
  const finish=()=>setLeaving(true);
  useEffect(()=>{
    // A canvas or device failure must never block an authenticated user.
    const fallback=window.setTimeout(()=>setLeaving(true),6500);
    return()=>window.clearTimeout(fallback);
  },[]);
  useEffect(()=>{
    if(!leaving)return;
    const timer=window.setTimeout(()=>{
      if(!finished.current){finished.current=true;callback.current();}
    },window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:240);
    return()=>window.clearTimeout(timer);
  },[leaving]);
  return <main className={'login-welcome'+(leaving?' is-leaving':'')} aria-label="로그인 환영" role="status" aria-live="polite">
    <ParticleTitle text={message} onComplete={finish}/>
  </main>;
}
