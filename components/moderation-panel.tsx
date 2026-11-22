import { ArrowDownToLine, ChevronLeft, ChevronRight, Eye, FileText, MessageCircle, RefreshCw, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CodeMessage } from '@/components/ui/code-message';
import { ChatError, day, errorText, request, size, time, value, type Message } from '@/lib/chat';

type Entry = { kind: 'direct' | 'room'; key: string; title: string; updated_at: string };
type Catalog = { entries: Entry[]; more: boolean };
type ReadMessage = Pick<Message, 'id' | 'sender_id' | 'sender_name' | 'content' | 'code_language' |
  'created_at' | 'edited_at' | 'deleted_at' | 'attachment_name' | 'attachment_size'> & {
  quote?: { id: number; sender_name?: string; content: string };
};
type Transcript = { messages: ReadMessage[]; older: boolean };
const pageSize = 40;

export function ModerationPanel() {
  const [entries, setEntries] = useState<Catalog>();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState<Entry>();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setEntries(undefined);
    setError('');
    void request<Catalog>({ action: 'monitor-catalog', query, offset })
      .then(result => { if (!cancelled) setEntries(result); })
      .catch(failure => { if (!cancelled) setError(errorText(failure)); });
    return () => { cancelled = true; };
  }, [offset, query, reload]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    setQuery(search.trim());
    setReload(current => current + 1);
  }

  return <section className="monitor-panel" aria-label="관리자 대화 열람">
    <header className="monitor-banner">
      <ShieldCheck size={20} /><div><h1>대화 열람</h1><p>1:1 대화와 채팅방을 확인할 수 있습니다. 메시지 열람과 첨부 파일 다운로드는 기록에 남습니다.</p></div>
    </header>
    <div className="monitor-workspace">
      <aside className="monitor-rooms" aria-label="전체 대화 목록">
        <form onSubmit={submit} className="monitor-search">
          <label className="directory-search"><Search size={16} /><input aria-label="채팅방 또는 이름 검색" value={search}
            maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="채팅방 또는 이름 검색" /></label>
          <Button size="icon" variant="outline" aria-label="전체 대화 검색" type="submit"><Search size={16} /></Button>
          <Button size="icon" variant="outline" aria-label="목록 새로고침" onClick={() => setReload(current => current + 1)}><RefreshCw size={15} /></Button>
        </form>
        <div className="monitor-entries">
          {error && <p className="monitor-state error-text" role="alert">{error}</p>}
          {!entries && !error && <p className="monitor-state">대화 목록을 불러오고 있어요…</p>}
          {entries?.entries.length === 0 && <p className="monitor-state">{query ? '검색 결과가 없습니다.' : '열람할 대화가 없습니다.'}</p>}
          {entries?.entries.map(entry => <button type="button" className={`directory-row${selection?.key === entry.key ? ' active' : ''}`}
            aria-pressed={selection?.key === entry.key} key={entry.key} onClick={() => setSelection(entry)}>
            <span className="room-avatar size-9">{entry.kind === 'room' ? <UsersRound size={18} /> : <MessageCircle size={18} />}</span>
            <span className="row-text"><strong>{entry.title}</strong><small>{entry.kind === 'room' ? '그룹 채팅방' : '1:1 대화'} · {time(entry.updated_at)}</small></span>
          </button>)}
        </div>
        {(offset > 0 || entries?.more) && <div className="monitor-pagination">
          <Button size="sm" variant="outline" onClick={() => setOffset(current => Math.max(0, current - pageSize))} disabled={offset === 0}><ChevronLeft size={15} /> 이전</Button>
          <Button size="sm" variant="outline" onClick={() => setOffset(current => current + pageSize)} disabled={!entries?.more}>다음 <ChevronRight size={15} /></Button>
        </div>}
      </aside>
      {selection ? <MonitorTranscript key={selection.key} entry={selection} /> :
        <div className="workspace-empty"><span><Eye size={29} /></span><h2>열람할 대화를 선택해 주세요.</h2></div>}
    </div>
  </section>;
}

function MonitorTranscript({ entry }: { entry: Entry }) {
  const [review] = useState(() => crypto.randomUUID());
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<Transcript>();
  const [error, setError] = useState('');
  const [olderBusy, setOlderBusy] = useState(false);
  const [downloadId, setDownloadId] = useState<number>();
  const [live, setLive] = useState(true);
  const latestFilter = useRef(query);
  const viewport = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const anchor = useRef<{ oldHeight: number; oldTop: number } | undefined>(undefined);
  const key = entry.key;
  const queryHistory = (filter: string, before?: number) =>
    request<Transcript>({ action: 'monitor-history', key, review, query: filter, before });

  useEffect(() => {
    let cancelled = false;
    let timer: number;
    async function poll(manual: boolean) {
      if (manual || document.hasFocus()) {
        try {
          const incoming = await queryHistory(query);
          if (cancelled) return;
          setError('');
          setHistory(previous => {
            if (!previous || query || !incoming.messages.length) return incoming;
            const min = incoming.messages[0].id;
            const overlaps = incoming.messages.some(message => message.id <= (previous.messages.at(-1)?.id ?? 0));
            const earlier = overlaps ? previous.messages.filter(message => message.id < min) : [];
            return { messages: [...earlier, ...incoming.messages], older: earlier.length ? previous.older : incoming.older };
          });
        } catch (failure) {
          if (cancelled) return;
          if (failure instanceof ChatError && (failure.status === 403 || failure.status === 404)) setHistory(undefined);
          setError(errorText(failure));
        }
      }
      if (!cancelled && live && !query) timer = window.setTimeout(() => void poll(false), 8000);
    }
    latestFilter.current = query;
    void poll(true);
    return () => { cancelled = true; window.clearTimeout(timer); };
  // The request is scoped to the selected entry and this review window.
  }, [key, review, query, revision, live]);

  useEffect(() => {
    const scroll = viewport.current;
    if (!scroll) return;
    if (anchor.current) {
      scroll.scrollTop = anchor.current.oldTop + scroll.scrollHeight - anchor.current.oldHeight;
      anchor.current = undefined;
    } else if (atBottom.current) scroll.scrollTop = scroll.scrollHeight;
  }, [history?.messages.length, history?.messages.at(-1)?.id]);

  async function older() {
    const first = history?.messages[0]?.id;
    if (!first || olderBusy) return;
    setOlderBusy(true);
    setError('');
    const currentFilter = query;
    try {
      const response = await queryHistory(currentFilter, first);
      if (latestFilter.current !== currentFilter) return;
      const scroll = viewport.current;
      if (scroll) anchor.current = { oldHeight: scroll.scrollHeight, oldTop: scroll.scrollTop };
      setHistory(previous => {
        const items = new Map([...response.messages, ...(previous?.messages ?? [])].map(message => [message.id, message]));
        return { messages: [...items.values()].sort((a, b) => a.id - b.id), older: response.older };
      });
    } catch (failure) { setError(errorText(failure)); }
    finally { setOlderBusy(false); }
  }

  async function download(message: ReadMessage) {
    const bridge = window.kfcChat?.monitorDownload;
    if (!bridge) return;
    setDownloadId(message.id);
    setError('');
    try { value(await bridge(key, message.id, review)); }
    catch (failure) { setError(errorText(failure)); }
    finally { setDownloadId(undefined); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setHistory(undefined);
    setQuery(search.trim());
    atBottom.current = !search.trim();
    setRevision(current => current + 1);
  }

  return <section className="monitor-transcript" aria-label={`${entry.title} 대화 열람`}>
    <header className="monitor-transcript-header">
      <div><h2>{entry.title}</h2><small>{entry.kind === 'direct' ? '1:1 대화' : '그룹 채팅방'} · 읽기 전용</small></div>
      <Button size="sm" variant="outline" aria-pressed={live} onClick={() => setLive(enabled => !enabled)}>{live ? '자동 갱신 켬' : '자동 갱신 끔'}</Button>
      <Button size="icon" variant="outline" aria-label="대화 새로고침" onClick={() => setRevision(current => current + 1)}><RefreshCw size={16} /></Button>
    </header>
    <form className="transcript-search" onSubmit={submit}>
      <Search size={16} /><input aria-label="열람 중인 대화에서 검색" placeholder="이 대화의 메시지 검색" value={search}
        maxLength={100} onChange={event => setSearch(event.target.value)} />
      <Button type="submit" size="sm" variant="outline">검색</Button>
    </form>
    {error && <p className="monitor-error error-text" role="alert">{error}</p>}
    <div ref={viewport} className="monitor-messages" onScroll={event => {
      const scroll = event.currentTarget;
      atBottom.current = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 52;
    }}>
      {!history && !error && <p className="monitor-state">대화를 불러오고 있어요…</p>}
      {history?.older && <Button className="load-older" size="sm" variant="outline" onClick={() => void older()} disabled={olderBusy}>이전 메시지 불러오기</Button>}
      {history?.messages.length === 0 && <p className="monitor-state">{query ? '검색 결과가 없습니다.' : '아직 메시지가 없습니다.'}</p>}
      {history?.messages.map((message, index, list) => {
        const date = day(message.created_at);
        const differentDay = !index || day(list[index - 1].created_at) !== date;
        return <div key={message.id}>
          {differentDay && <div className="date-divider"><span>{date}</span></div>}
          <article className="monitor-message">
            <header><b>{message.sender_name ?? '동아리원'}</b><time dateTime={message.created_at}>{time(message.created_at)}</time>{message.edited_at && !message.deleted_at && <small>수정됨</small>}</header>
            {message.quote && <blockquote>{message.quote.sender_name ?? '동아리원'} · {message.quote.content}</blockquote>}
            {message.code_language && !message.deleted_at ?
              <CodeMessage key={message.content} code={message.content} language={message.code_language} /> :
              <p className={message.deleted_at ? 'deleted' : ''}>{message.content}</p>}
            {message.attachment_name && <button type="button" className="attachment-tile" disabled={downloadId != null} onClick={() => void download(message)}>
              <FileText size={17} /><span><b>{message.attachment_name}</b><small>{size(message.attachment_size ?? 0)}</small></span><ArrowDownToLine size={15} />
            </button>}
          </article>
        </div>;
      })}
    </div>
  </section>;
}
