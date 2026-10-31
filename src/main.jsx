import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import VersionBadge from './VersionBadge.jsx';
import ReleaseNotes from './ReleaseNotes.jsx';
import './styles.css';
import './design.css';
import './depth.css';
import './claude.css';
import './feature24.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /><VersionBadge /><ReleaseNotes /></React.StrictMode>);

