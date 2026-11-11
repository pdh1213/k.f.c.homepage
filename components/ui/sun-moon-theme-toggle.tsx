import React,{useEffect,useState} from 'react';
import './sun-moon-theme-toggle.css';

export type SunMoonTheme='light'|'dark';
const STORAGE_KEY='kfc-color-theme';
const currentTheme=():SunMoonTheme=>typeof document!=='undefined'&&document.documentElement.classList.contains('dark')?'dark':'light';

// Adapted from the supplied Apple liquid glass radio switcher for two site themes.
export function SunMoonThemeToggle({inline=false}:{inline?:boolean}){
  const [theme,setTheme]=useState<SunMoonTheme>(currentTheme);
  useEffect(()=>{const observer=new MutationObserver(()=>setTheme(currentTheme()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[]);
  const select=(next:SunMoonTheme)=>{document.documentElement.classList.toggle('dark',next==='dark');document.documentElement.style.colorScheme=next;try{localStorage.setItem(STORAGE_KEY,next)}catch{}setTheme(next)};
  return <fieldset className={'sun-moon-theme-toggle'+(inline?' inline':'')} data-theme={theme} aria-label="화면 모드">
    <legend className="theme-switcher-legend">화면 모드</legend>
    {(['light','dark'] as SunMoonTheme[]).map(option=><label className="theme-switcher-option" key={option} title={option==='light'?'라이트 모드':'나이트 모드'}>
      <input type="radio" name={inline?'showroom-theme':'site-theme'} value={option} checked={theme===option} onChange={()=>select(option)} aria-label={option==='light'?'라이트 모드':'나이트 모드'}/>
      {option==='light'?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.7"/><path d="M12 2.5v2m0 15v2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M2.5 12h2m15 0h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>:<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19.6 16.3A8.2 8.2 0 0 1 7.7 4.4a8.4 8.4 0 1 0 11.9 11.9Z" fill="currentColor"/></svg>}
    </label>)}
    <span className="theme-switcher-glass" aria-hidden="true"/>
  </fieldset>;
}
export default SunMoonThemeToggle;
