import React,{useEffect,useState} from 'react';
import './sun-moon-theme-toggle.css';

export type SunMoonTheme='light'|'dark';
const STORAGE_KEY='kfc-color-theme';
const currentTheme=():SunMoonTheme=>typeof document!=='undefined'&&document.documentElement.classList.contains('dark')?'dark':'light';

export function SunMoonThemeToggle({inline=false}:{inline?:boolean}){
  const [theme,setTheme]=useState<SunMoonTheme>(currentTheme);
  useEffect(()=>{const observer=new MutationObserver(()=>setTheme(currentTheme()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[]);
  const toggle=()=>{const next=theme==='light'?'dark':'light';document.documentElement.classList.toggle('dark',next==='dark');document.documentElement.style.colorScheme=next;try{localStorage.setItem(STORAGE_KEY,next)}catch{}setTheme(next)};
  return <button type="button" role="switch" aria-checked={theme==='dark'} aria-label="나이트 모드" className={'sun-moon-theme-toggle'+(inline?' inline':'')} data-theme={theme} onClick={toggle} title={theme==='dark'?'라이트 모드로 전환':'나이트 모드로 전환'}>
    <span className="theme-glass-track" aria-hidden="true"/>
    <span className="theme-glass-thumb" aria-hidden="true">
      <svg className="theme-sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3.7"/><path d="M12 2.5v2m0 15v2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M2.5 12h2m15 0h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>
      <svg className="theme-moon-icon" viewBox="0 0 24 24" fill="none"><path d="M19.6 16.3A8.2 8.2 0 0 1 7.7 4.4a8.4 8.4 0 1 0 11.9 11.9Z" fill="currentColor"/></svg>
    </span>
  </button>;
}

export default SunMoonThemeToggle;
