import React,{useEffect,useState} from 'react';
import './sun-moon-theme-toggle.css';

export type SunMoonTheme='light'|'dark';
const STORAGE_KEY='kfc-color-theme';
const currentTheme=():SunMoonTheme=>document.documentElement.classList.contains('dark')?'dark':'light';

export function SunMoonThemeToggle(){
  const [theme,setTheme]=useState<SunMoonTheme>(currentTheme);
  useEffect(()=>{const observer=new MutationObserver(()=>setTheme(currentTheme()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[]);
  const toggle=()=>{const next=theme==='light'?'dark':'light';document.documentElement.classList.toggle('dark',next==='dark');document.documentElement.style.colorScheme=next;try{localStorage.setItem(STORAGE_KEY,next)}catch{}setTheme(next)};
  return <button type="button" className="sun-moon-theme-toggle" data-theme={theme} onClick={toggle} aria-label={theme==='dark'?'라이트 모드로 전환':'나이트 모드로 전환'} title={theme==='dark'?'라이트 모드':'나이트 모드'}>
    <span className="theme-sky theme-night" aria-hidden="true"><i/><i/><i/><i/><i/></span><span className="theme-sky theme-day" aria-hidden="true"/>
    <span className="theme-body theme-moon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.1 16.2A8.6 8.6 0 0 1 7.8 3.9 8.7 8.7 0 1 0 20.1 16.2Z"/></svg></span>
    <span className="theme-body theme-sun" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span>
  </button>;
}

export default SunMoonThemeToggle;
