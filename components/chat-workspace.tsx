import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bell, BellOff, ChevronRight, CircleHelp, Flag, LogOut, MessageCircle, Moon, Pin, Search, Settings2, Sun, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageConversation, { PersonAvatar, StatusBadge } from '@/components/ui/messaging-conversation';
import { ChatError, errorText, request, STATUS_TEXT, time, type History, type Overview, type Report, type Status } from '@/lib/chat';

type Theme = 'light' | 'dark';
type Tab = 'chats' | 'friends' | 'reports';
type Props = { initial: Overview; theme: Theme; setTheme(theme: Theme): void; onLogout(message?: string): void };

function savedSetting<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const saved = localStorage.getItem(key) as T;
    return allowed.includes(saved) ? saved : fallback;
  } catch { return fallback; }
}

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* preferences still work for this session */ }
}

export function ChatWorkspace({ initial, theme, setTheme, onLogout }: Props) {
  const [overview, setOverview] = useState(initial);
  const [active, setActive] = useState<number>();
  const [tab, setTab] = useState<Tab>(initial.chats.length ? 'chats' : 'friends');
  const [filter, setFilter] = useState('');
  const [mode, setMode] = useState<Status>(() => savedSetting('kfc-chat-presence', 'online', ['online', 'dnd', 'offline']));
  const [notices, setNotices] = useState(() => savedSetting('kfc-chat-notices', 'yes', ['yes', 'no']) === 'yes');
  const [connection, setConnection] = useState('');
  const [focused, setFocused] = useState(document.hasFocus());
  const [histories, setHistories] = useState<Record<number, History>>({});
  const [avatars, setAvatars] = useState<Record<number, string>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [reports, setReports] = useState<Report[]>();
  const [reportError, setReportError] = useState('');
  const [reviewing, setReviewing] = useState<number>();
  const overviewRef = useRef(initial);
  const live = useRef(true);
  const epochs = useRef(new Map<number, number>());
  const historyRequests = useRef(new Map<number, number>());
  const overviewRequest = useRef(0);
  const avatarIds = useRef(new Set<number>());
  const onLogoutRef = useRef(onLogout);
  const peer = overview.friends.find(person => person.id === active);
  const self = overview.self;

  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);
  useEffect(() => () => { live.current = false; }, []);
  useEffect(() => {
    const gotFocus = () => setFocused(true);
    const lostFocus = () => setFocused(false);
    window.addEventListener('focus', gotFocus);
    window.addEventListener('blur', lostFocus);
    const unsubscribe = window.kfcChat?.onOpenPeer(id => { setActive(id); setTab('chats'); setFilter(''); });
    return () => {
      unsubscribe?.();
      window.removeEventListener('focus', gotFocus);
      window.removeEventListener('blur', lostFocus);
    };
  }, []);

  const syncOverview = useCallback(async () => {
    const stamp = ++overviewRequest.current;
    try {
      const result = await request<Overview>({ action: 'overview', mode });
      if (!live.current || stamp !== overviewRequest.current) return;
      const last = overviewRef.current;
      overviewRef.current = result;
      setOverview(result);
      setConnection('');
      if (notices && mode === 'online') {
        const old = new Map(last.chats.map(thread => [thread.peer_id, thread]));
        for (const thread of result.chats) {
          const person = result.friends.find(friend => friend.id === thread.peer_id);
          if (person && !person.muted && !person.blocked && thread.unread > 0 &&
              thread.last_id > (old.get(thread.peer_id)?.last_id ?? 0) &&
              thread.unread > (old.get(thread.peer_id)?.unread ?? 0)) {
            void window.kfcChat?.notify(person.id, person.name);
          }
        }
      }
    } catch (error) {
      if (!live.current || stamp !== overviewRequest.current) return;
      if (error instanceof ChatError && [401, 403].includes(error.status)) onLogoutRef.current(error.message);
      else setConnection(errorText(error));
    }
  }, [mode, notices]);

  const syncHistory = useCallback(async (id: number, before?: number) => {
    const epoch = epochs.current.get(id) ?? 0;
    const sequence = (historyRequests.current.get(id) ?? 0) + 1;
    if (!before) historyRequests.current.set(id, sequence);
    try {
      const next = await request<History>({ action: 'history', peer: id, before });
      if (!live.current || (epochs.current.get(id) ?? 0) !== epoch ||
        (!before && historyRequests.current.get(id) !== sequence)) return;
      setHistories(current => {
        const previous = current[id];
        if (!previous) return { ...current, [id]: next };
        if (before) {
          const byId = new Map([...next.messages, ...previous.messages].map(message => [message.id, message]));
          return { ...current, [id]: { ...previous, messages: [...byId.values()].sort((a, b) => a.id - b.id), older: next.older } };
        }
        const earliest = next.messages[0]?.id ?? 0;
        const overlap = next.messages.some(message => message.id <= (previous.messages.at(-1)?.id ?? 0));
        const earlier = overlap ? previous.messages.filter(message => message.id < earliest) : [];
        return { ...current, [id]: { ...next, messages: [...earlier, ...next.messages],
          older: earlier.length ? previous.older : next.older } };
      });
    } catch (error) {
      if (!live.current) return;
      if (error instanceof ChatError && error.status === 401) onLogoutRef.current(error.message);
      else if (before) throw error;
      else if (error instanceof ChatError && error.status === 404) setActive(current => current === id ? undefined : current);
      else setConnection(errorText(error));
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number;
    async function tick() {
      await Promise.all([syncOverview(), active && tab !== 'reports' ? syncHistory(active) : undefined]);
      if (!stopped) timer = window.setTimeout(tick, 2800);
    }
    void tick();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [active, tab, syncOverview, syncHistory]);

  useEffect(() => {
    if (active && !overview.friends.some(person => person.id === active)) setActive(undefined);
    const ids = [self.id, ...overview.friends.map(person => person.id)].filter(id => !avatarIds.current.has(id)).slice(0, 24);
    if (!ids.length) return;
    ids.forEach(id => avatarIds.current.add(id));
    void request<{ people: { id: number; avatar_data: string | null }[] }>({ action: 'avatars', ids }).then(result => {
      if (!live.current) return;
      const available = Object.fromEntries(result.people.filter(person => person.avatar_data?.startsWith('data:image/jpeg;base64,'))
        .map(person => [person.id, person.avatar_data!]));
      setAvatars(current => ({ ...current, ...available }));
    }).catch(() => { ids.forEach(id => avatarIds.current.delete(id)); });
  }, [active, overview.friends, self.id]);

  async function refreshReports() {
    try {
      const result = await request<{ reports: Report[] }>({ action: 'reports' });
      setReports(result.reports);
      setReportError('');
    } catch (error) { setReportError(errorText(error)); }
  }

  async function review(id: number) {
    setReviewing(id);
    try { await request({ action: 'review', id }); await refreshReports(); }
    catch (error) { setReportError(errorText(error)); }
    finally { setReviewing(undefined); }
  }

  const rowList = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    const listed = overview.friends.filter(person => person.name.toLocaleLowerCase().includes(query));
    const threads = new Map(overview.chats.map(thread => [thread.peer_id, thread]));
    return listed.map(person => ({ person, thread: threads.get(person.id) }))
      .filter(row => tab !== 'chats' || row.thread)
      .sort((a, b) => tab === 'chats' ? Number(b.person.pinned) - Number(a.person.pinned) ||
        (b.thread?.last_id ?? 0) - (a.thread?.last_id ?? 0) : a.person.name.localeCompare(b.person.name, 'ko'));
  }, [overview.chats, overview.friends, tab, filter]);
  const unread = overview.chats.reduce((count, thread) => count + thread.unread, 0);

  function changeTab(next: Tab) {
    setTab(next);
    setFilter('');
    if (next === 'reports') void refreshReports();
  }

  function updateMode(next: Status) {
    setMode(next);
    save('kfc-chat-presence', next);
  }

  return <main className="desktop-shell">
    <aside className="rail" aria-label="앱 메뉴">
      <div className="rail-brand" title="K.F.C. Chat"><MessageCircle size={22} /></div>
      <nav className="rail-main">
        <button type="button" className={tab === 'chats' ? 'active' : ''} aria-current={tab === 'chats' ? 'page' : undefined} aria-label="채팅" title="채팅" onClick={() => changeTab('chats')}><MessageCircle size={20} />{unread > 0 && <i />}</button>
        <button type="button" className={tab === 'friends' ? 'active' : ''} aria-current={tab === 'friends' ? 'page' : undefined} aria-label="친구" title="친구" onClick={() => changeTab('friends')}><Users size={20} /></button>
        {self.moderator && <button type="button" className={tab === 'reports' ? 'active' : ''} aria-current={tab === 'reports' ? 'page' : undefined} aria-label="신고 관리" title="신고 관리" onClick={() => changeTab('reports')}><Flag size={19} /></button>}
      </nav>
      <div className="rail-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" title="설정" aria-label="설정"><Settings2 size={20} /></button></DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuItem onSelect={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}{theme === 'light' ? '나이트 모드' : '라이트 모드'}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setNotices(!notices); save('kfc-chat-notices', notices ? 'no' : 'yes'); }}>{notices ? <BellOff size={16} /> : <Bell size={16} />}{notices ? 'Windows 알림 끄기' : 'Windows 알림 켜기'}</DropdownMenuItem>
            <DropdownMenuSeparator className="ui-menu-divider" />
            <DropdownMenuItem onSelect={() => void window.kfcChat?.update()}><CircleHelp size={16} />업데이트 확인</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void window.kfcChat?.openClub()}><ArrowUpRight size={16} />동아리 홈페이지</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onLogout()}><LogOut size={16} />로그아웃</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
    <section className="directory" aria-label="동아리원과 대화 목록">
      <header className="directory-header">
        <div className="directory-brand">K.F.C. Chat</div>
        <div className="directory-title">
          <h1>{tab === 'friends' ? '친구' : tab === 'reports' ? '신고 관리' : '채팅'}</h1>
          {tab === 'friends' && <span>{overview.friends.length}</span>}
          {tab === 'chats' && unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
        </div>
        {tab !== 'reports' && <label className="directory-search"><Search size={17} /><input aria-label="친구 이름 검색" value={filter} onChange={event => setFilter(event.target.value)} placeholder="이름으로 검색" /></label>}
      </header>
      {tab !== 'reports' && <ScrollArea className="directory-list" aria-label={tab === 'friends' ? '친구 목록' : '채팅 목록'}>
        {rowList.length === 0 && <div className="empty-list"><p>{filter ? '검색 결과가 없습니다.' : tab === 'chats' ? '아직 대화가 없습니다.' : '목록에 표시할 친구가 없습니다.'}</p>
          {tab === 'chats' && !filter && <Button variant="outline" size="sm" onClick={() => changeTab('friends')}>친구 목록 열기 <ChevronRight size={14} /></Button>}</div>}
        {rowList.map(({ person, thread }) => <button type="button" className={`directory-row${active === person.id ? ' active' : ''}`}
          aria-pressed={active === person.id} onClick={() => setActive(person.id)} key={person.id}>
          <span className="row-avatar"><PersonAvatar name={person.name} image={avatars[person.id]} /><StatusBadge status={person.status} /></span>
          <span className="row-text"><strong>{person.name}{person.pinned && <Pin size={13} />}{person.muted && <BellOff size={13} />}</strong>
            <small>{tab === 'chats' ? thread?.content : person.blocked ? '차단됨' : STATUS_TEXT[person.status]}</small></span>
          {tab === 'chats' && thread && <span className="row-meta"><time>{time(thread.created_at)}</time>{thread.unread > 0 && <b>{thread.unread > 99 ? '99+' : thread.unread}</b>}</span>}
        </button>)}
      </ScrollArea>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className="account-control">
          <PersonAvatar name={self.name} image={avatars[self.id]} className="size-9" /><span><b>{self.name}</b><small><StatusBadge status={mode} />{STATUS_TEXT[mode]}</small></span><ChevronRight size={15} />
        </button></DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          {(Object.keys(STATUS_TEXT) as Status[]).map(status => <DropdownMenuItem key={status} onSelect={() => updateMode(status)}><StatusBadge status={status} />{STATUS_TEXT[status]}{mode === status ? ' ✓' : ''}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
    <section className="main-pane" aria-label="메신저">
      {connection && <div className="connection" role="status">{connection}</div>}
      {tab === 'reports' && self.moderator ? <div className="reports">
        <h2>접수된 신고</h2><p>신고 사유와 신고한 메시지를 확인할 수 있습니다.</p>
        {reportError && <p className="error-text" role="alert">{reportError}</p>}
        {!reports && !reportError && <p>신고 목록을 확인하고 있어요…</p>}
        {reports?.length === 0 && <p>아직 접수된 신고가 없습니다.</p>}
        {reports?.map(report => <article className="report-card" key={report.id}>
          <div><b>{report.reported?.name ?? '회원'}</b><small>{report.reporter?.name ?? '회원'}님의 신고 · {new Date(report.created_at).toLocaleString('ko-KR')}</small></div>
          <p>{report.reason}</p>{report.excerpt && <blockquote>{report.excerpt}</blockquote>}
          {report.reviewed_at ? <small>확인 완료</small> : <Button variant="outline" size="sm" disabled={reviewing != null} onClick={() => void review(report.id)}>확인 완료로 표시</Button>}
        </article>)}
      </div> : peer ? <MessageConversation key={peer.id} self={self} peer={peer} avatars={avatars}
        history={histories[peer.id]} canRead={focused} draft={drafts[peer.id] ?? ''}
        setDraft={text => setDrafts(current => ({ ...current, [peer.id]: text }))}
        older={before => syncHistory(peer.id, before)}
        refresh={async () => { await Promise.all([syncHistory(peer.id), syncOverview()]); }}
        markRead={id => request({ action: 'preference', peer: peer.id, field: 'read', through: id })
          .then(async () => { await syncOverview(); return true; }).catch(() => false)}
        onCleared={() => {
          epochs.current.set(peer.id, (epochs.current.get(peer.id) ?? 0) + 1);
          setHistories(current => {
            const next = { ...current };
            delete next[peer.id];
            return next;
          });
          setDrafts(current => ({ ...current, [peer.id]: '' }));
        }} /> : <div className="workspace-empty">
          <span><MessageCircle size={30} /></span><h2>대화를 시작해 보세요.</h2><p>친구나 최근 채팅을 선택하면 여기에 대화가 열립니다.</p>
          {tab !== 'friends' && <Button variant="outline" onClick={() => changeTab('friends')}>친구 목록 열기 <ChevronRight size={16} /></Button>}
        </div>}
    </section>
  </main>;
}
