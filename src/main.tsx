import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MessageCircle, MoveRight } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ChatWorkspace } from '@/components/chat-workspace';
import { errorText, request, value, type Overview } from '@/lib/chat';
import './styles.css';

type Theme = 'light' | 'dark';
function getTheme(): Theme {
  try { return localStorage.getItem('kfc-chat-theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

function App() {
  const [overview, setOverview] = useState<Overview>();
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [expired, setExpired] = useState('');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('kfc-chat-theme', theme); } catch { /* theme is still applied */ }
  }, [theme]);

  if (!window.kfcChat) return <main className="no-app"><h1>Windows 앱에서 이용해 주세요.</h1><a href="https://kfcchat.vercel.app/">설치 안내 ↗</a></main>;
  return overview ? <ChatWorkspace initial={overview} theme={theme} setTheme={setTheme}
    onLogout={message => {
      setOverview(undefined);
      setExpired(message || '');
      void window.kfcChat?.logout();
    }} /> : <Login onLogin={setOverview} expired={expired} />;
}

function Login({ onLogin, expired }: { onLogin(value: Overview): void; expired: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn(event: FormEvent) {
    event.preventDefault();
    const bridge = window.kfcChat;
    if (busy || !bridge || !username.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      value(await bridge.login(username.trim(), password));
      setPassword('');
      onLogin(await request<Overview>({ action: 'overview', mode: 'online' }));
    } catch (failure) {
      setError(errorText(failure));
      setPassword('');
    } finally { setBusy(false); }
  }

  return <main className="login-layout">
    <aside className="login-brand">
      <div className="brand-sign"><span className="brand-symbol"><MessageCircle size={23} strokeWidth={2.1} /></span><span>K.F.C. <em>Chat</em></span></div>
      <div className="login-intro"><p>용인시청소년수련관 로봇동아리</p><h1>동아리 친구들과<br />이야기를 이어가세요.</h1><span>모임 소식부터 오늘의 작업까지.</span></div>
      <span className="login-footer">K.F.C. 로봇동아리</span>
    </aside>
    <div className="login-pane">
      <section className="login-card" aria-labelledby="login-title">
        <h2 id="login-title">로그인</h2>
        <p>동아리 홈페이지에 등록한 계정으로 로그인해 주세요.</p>
        <form onSubmit={signIn}>
          <label>로그인 아이디<input autoComplete="username" autoFocus maxLength={80} required value={username} onChange={event => setUsername(event.target.value)} placeholder="아이디를 입력해 주세요" /></label>
          <label>비밀번호<input type="password" autoComplete="current-password" maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} placeholder="비밀번호를 입력해 주세요" /></label>
          <Button type="submit" disabled={busy}>{busy ? '확인 중…' : '로그인'}<MoveRight size={18} /></Button>
        </form>
        {(error || expired) && <p className="login-error" role="status">{error || expired}</p>}
        <button className="club-text-link" type="button" onClick={() => void window.kfcChat?.openClub()}>동아리 홈페이지 열기 <ArrowUpRight size={14} /></button>
      </section>
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
