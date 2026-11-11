import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import VersionBadge from './VersionBadge.jsx';
import ReleaseNotes from './ReleaseNotes.jsx';
import SunMoonThemeToggle from '../components/ui/sun-moon-theme-toggle.tsx';
import './styles.css';
import './design.css';
import './depth.css';
import './claude.css';
import './feature24.css';
import './theme.css';
import './cursor.css';

try{const saved=localStorage.getItem('kfc-color-theme');document.documentElement.classList.toggle('dark',saved==='dark');document.documentElement.style.colorScheme=saved==='dark'?'dark':'light'}catch{}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /><SunMoonThemeToggle /><VersionBadge /><ReleaseNotes /></React.StrictMode>);

