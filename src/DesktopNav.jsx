import React,{useEffect,useState} from 'react';
import {isDesktop} from './desktop.js';

export function DesktopVersion(){
  const [version,setVersion]=useState('');
  useEffect(()=>{if(isDesktop)window.kfcDesktop?.getAppVersion?.().then(setVersion).catch(()=>{})},[]);
  return isDesktop&&version?<span className="desktop-version" aria-label={'Windows 앱 버전 '+version}>Windows 앱 v{version}</span>:null;
}
export function DesktopTabs({items,active,onSelect}){
  if(!isDesktop)return null;
  return <nav className="desktop-top-nav" aria-label="상단 메뉴">
    {items.map(item=><button key={item.key} type="button" className={active===item.key?'active':''} onClick={()=>onSelect(item.key)}>{item.icon&&<span aria-hidden="true">{item.icon}</span>}{item.label}</button>)}
  </nav>;
}

