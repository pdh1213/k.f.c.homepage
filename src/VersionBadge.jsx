import React,{useEffect,useState} from 'react';
import packageInfo from '../package.json';

export default function VersionBadge(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const update=event=>{
      const pageScroll=window.scrollY||document.documentElement.scrollTop||0;
      const nestedScroll=event?.target instanceof Element?event.target.scrollTop:0;
      setVisible(pageScroll>120||nestedScroll>120);
    };
    update();
    window.addEventListener('scroll',update,true);
    return()=>window.removeEventListener('scroll',update,true);
  },[]);
  return <div className={'site-version'+(visible?' visible':'')} aria-hidden={!visible}>v{packageInfo.version}</div>;
}

