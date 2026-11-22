import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowUp, Bell, BellOff, Check, CheckCheck, Copy, FileText, Flag, MessageCircle, MoreHorizontal, MoreVertical, Paperclip, Pencil, Pin, Reply, Search, SmilePlus, Trash2, UserMinus2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { day, EMOJI, errorText, request, size, STATUS_TEXT, time, value, type Account, type Attachment, type Friend, type History, type Message, type Quote } from '@/lib/chat';

export function PersonAvatar({ name, image, className }: { name: string; image?: string; className?: string }) {
  return <Avatar className={cn('person-avatar', className)}>
    {image && <AvatarImage className="size-full object-cover" src={image} alt="" />}
    <AvatarFallback>{Array.from(name.trim())[0] || 'K'}</AvatarFallback>
  </Avatar>;
}

export function StatusBadge({ status }: { status: Friend['status'] }) {
  return <span className={cn('presence-dot', status)} aria-label={STATUS_TEXT[status]} />;
}

type Preference = 'pinned' | 'muted' | 'blocked' | 'clear';
type Confirm = { type: 'clear' } | { type: 'block' } | { type: 'delete'; message: Message } | { type: 'report'; message?: Message };
type Props = {
  self: Account;
  peer: Friend;
  avatars: Record<number, string>;
  history: History | undefined;
  canRead: boolean;
  draft: string;
  setDraft(text: string): void;
  refresh(): Promise<void>;
  older(before: number): Promise<void>;
  markRead(id: number): Promise<boolean>;
  onCleared(): void;
  className?: string;
};

function UserActions({ peer, onPreference, onConfirm }: {
  peer: Friend; onPreference(field: Preference, enabled: boolean): void; onConfirm(confirm: Confirm): void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="대화 옵션"><MoreVertical size={17} /></Button></DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onSelect={() => onPreference('pinned', !peer.pinned)}><Pin size={15} />{peer.pinned ? '상단 고정 해제' : '채팅 상단에 고정'}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onPreference('muted', !peer.muted)}>{peer.muted ? <Bell size={15} /> : <BellOff size={15} />}{peer.muted ? '알림 켜기' : '이 대화 알림 끄기'}</DropdownMenuItem>
      <DropdownMenuSeparator className="ui-menu-divider" />
      <DropdownMenuItem className="menu-danger" onSelect={() => peer.blocked ? onPreference('blocked', false) : onConfirm({ type: 'block' })}>
        <UserMinus2 size={15} />{peer.blocked ? '차단 해제' : '대화 상대 차단'}
      </DropdownMenuItem>
      <DropdownMenuItem className="menu-danger" onSelect={() => onConfirm({ type: 'clear' })}><Trash2 size={15} />내 대화 목록에서 지우기</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onConfirm({ type: 'report' })}><Flag size={15} />대화 상대 신고</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function MessageActions({ mine, onReply, onCopy, onEdit, onDelete, onReport }: {
  mine: boolean; onReply(): void; onCopy(): void; onEdit(): void; onDelete(): void; onReport(): void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button className="message-action" variant="ghost" size="icon" aria-label="메시지 옵션"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onSelect={onReply}><Reply size={15} />답장</DropdownMenuItem>
      <DropdownMenuItem onSelect={onCopy}><Copy size={15} />복사</DropdownMenuItem>
      {mine ? <>
        <DropdownMenuItem onSelect={onEdit}><Pencil size={15} />수정</DropdownMenuItem>
        <DropdownMenuItem className="menu-danger" onSelect={onDelete}><Trash2 size={15} />모두에게서 삭제</DropdownMenuItem>
      </> : <DropdownMenuItem onSelect={onReport}><Flag size={15} />메시지 신고</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function ActionDialog({ action, peer, close, submit }: {
  action: Confirm; peer: Friend; close(): void; submit(reason: string): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const title = { clear: '내 대화 목록에서 지울까요?', block: '대화 상대를 차단할까요?', delete: '메시지를 삭제할까요?', report: '신고 사유를 알려 주세요.' }[action.type];
  const description = {
    clear: '지금까지의 대화가 내 화면에서 지워집니다. 상대방의 대화는 유지됩니다.',
    block: `${peer.name}님과 새 메시지를 주고받을 수 없게 됩니다. 대화 옵션에서 차단을 해제할 수 있어요.`,
    delete: '내 화면과 상대방 화면에 삭제된 메시지로 표시됩니다.',
    report: '신고 사유와 선택한 메시지는 동아리 관리자에게 전달됩니다.',
  }[action.type];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || (action.type === 'report' && !reason.trim())) return;
    setBusy(true);
    setError('');
    try { await submit(reason); close(); }
    catch (failure) { setError(errorText(failure)); setBusy(false); }
  }

  return <dialog ref={dialog} className="dialog" aria-labelledby="action-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <form onSubmit={onSubmit}>
      <h2 id="action-title">{title}</h2><p>{description}</p>
      {action.type === 'report' && <textarea aria-label="신고 사유" placeholder="어떤 일이 있었는지 입력해 주세요." required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button variant="outline" autoFocus={action.type !== 'report'} disabled={busy} onClick={close}>취소</Button>
        <Button type="submit" variant={action.type === 'report' ? 'default' : 'destructive'} disabled={busy}>
          {busy ? '처리 중…' : { clear: '대화 지우기', block: '차단', delete: '삭제', report: '신고 보내기' }[action.type]}
        </Button>
      </div>
    </form>
  </dialog>;
}

export default function MessageConversation({ self, peer, avatars, history, canRead, draft, setDraft, refresh, older, markRead, onCleared, className }: Props) {
  const [quote, setQuote] = useState<Quote>();
  const [editing, setEditing] = useState<Message>();
  const [editText, setEditText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState<Confirm>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<History>();
  const [searching, setSearching] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const lastRead = useRef(0);
  const typingMode = useRef(canRead);
  const keepBottom = useRef(true);
  const restoreAnchor = useRef<{ height: number; top: number } | null>(null);
  const pending = useRef<{ content: string; file: Attachment | null; quote?: number; id: string } | null>(null);
  const latest = history?.messages.at(-1)?.id;
  const blocked = peer.blocked || peer.blocked_by;
  const visible = results ?? history;
  const canMark = !results && canRead && atBottom;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (restoreAnchor.current) {
      element.scrollTop = restoreAnchor.current.top + element.scrollHeight - restoreAnchor.current.height;
      restoreAnchor.current = null;
    } else if (!results && keepBottom.current) element.scrollTop = element.scrollHeight;
  }, [visible?.messages.length, latest, results, history?.typing]);

  useEffect(() => {
    typingMode.current = canRead;
    if (latest && canMark && latest > lastRead.current) {
      lastRead.current = latest;
      void markRead(latest).then(success => {
        if (!success && lastRead.current === latest) lastRead.current = 0;
      });
    }
  }, [latest, canMark, canRead, markRead]);

  async function command(input: { action: string; [key: string]: unknown }) {
    return request({ peer: peer.id, ...input });
  }

  async function perform(run: () => Promise<unknown>, success?: string) {
    setNotice('');
    try { await run(); if (success) setNotice(success); }
    catch (error) { setNotice(errorText(error)); }
  }

  async function preference(field: Preference, enabled: boolean) {
    await command({ action: 'preference', field, enabled });
    if (field === 'clear') {
      setQuote(undefined); setEditing(undefined); setAttachment(null); setResults(undefined);
      lastRead.current = 0;
      onCleared();
    }
    await refresh();
  }

  async function confirm(reason: string) {
    if (!action) return;
    if (action.type === 'clear') await preference('clear', true);
    if (action.type === 'block') await preference('blocked', true);
    if (action.type === 'delete') {
      await command({ action: 'delete', id: action.message.id });
      if (editing?.id === action.message.id) setEditing(undefined);
      if (quote?.id === action.message.id) setQuote(undefined);
      if (results) setResults(previous => previous && { ...previous, messages: previous.messages.filter(item => item.id !== action.message.id) });
      await refresh();
    }
    if (action.type === 'report') {
      await command({ action: 'report', id: action.message?.id, reason });
      setNotice('신고가 접수되었습니다.');
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const content = (editing ? editText : draft).trim();
    if (busy || blocked || (!content && (editing || !attachment))) return;
    if (Array.from(content).length > 2000) { setNotice('메시지는 2,000자 이내로 입력해 주세요.'); return; }
    setBusy(true);
    setNotice('');
    try {
      if (editing) {
        await command({ action: 'edit', id: editing.id, content });
        if (results) setResults(undefined);
        setEditing(undefined);
      } else {
        if (pending.current?.content !== content || pending.current.file !== attachment || pending.current.quote !== quote?.id) {
          pending.current = { content, file: attachment, quote: quote?.id, id: crypto.randomUUID() };
        }
        await command({ action: 'send', content, quote: quote?.id, attachment, requestId: pending.current.id });
        pending.current = null;
        setDraft('');
        setQuote(undefined);
        setAttachment(null);
        setResults(undefined);
        keepBottom.current = true;
        setAtBottom(true);
      }
      await refresh();
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); composer.current?.focus(); }
  }

  function changeDraft(text: string) {
    if (editing) { setEditText(text); return; }
    setDraft(text);
    if (text.trim() && typingMode.current && Date.now() - lastTyping.current > 3300) {
      lastTyping.current = Date.now();
      void command({ action: 'typing' }).catch(() => {});
    }
  }

  async function chooseFile() {
    const bridge = window.kfcChat;
    if (!bridge) return;
    await perform(async () => {
      const selected = value(await bridge.pickFile());
      if (selected) setAttachment(selected);
    });
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      const next = await request<History>({ action: 'search', peer: peer.id, query });
      setResults(next);
      if (viewport.current) viewport.current.scrollTop = 0;
    } catch (error) { setNotice(errorText(error)); }
    finally { setSearching(false); }
  }

  async function loadOlder() {
    if (!history?.messages[0] || loadingOlder) return;
    setLoadingOlder(true);
    const element = viewport.current;
    if (element) restoreAnchor.current = { height: element.scrollHeight, top: element.scrollTop };
    try { await older(history.messages[0].id); }
    catch (error) { restoreAnchor.current = null; setNotice(errorText(error)); }
    finally { setLoadingOlder(false); }
  }

  const groups = useMemo(() => {
    let currentDay = '';
    return (visible?.messages ?? []).map(message => {
      const label = day(message.created_at);
      const divider = label !== currentDay ? label : null;
      currentDay = label;
      return { message, divider };
    });
  }, [visible?.messages]);

  return <Card className={cn('conversation-card', className)} aria-label={`${peer.name}님과의 대화`}>
    <CardHeader className="conversation-header">
      <div className="conversation-person">
        <PersonAvatar name={peer.name} image={avatars[peer.id]} className="size-11" />
        <div><h1>{peer.name}</h1><span><StatusBadge status={peer.status} />{STATUS_TEXT[peer.status]}</span></div>
      </div>
      <div className="conversation-tools">
        <Button variant={searchOpen ? 'default' : 'outline'} size="icon" aria-label="대화 내용 검색" aria-pressed={searchOpen}
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) { setResults(undefined); keepBottom.current = true; } }}><Search size={17} /></Button>
        <UserActions peer={peer} onPreference={(field, enabled) => void perform(() => preference(field, enabled))} onConfirm={setAction} />
      </div>
    </CardHeader>
    {searchOpen && <form className="transcript-search" onSubmit={search}>
      <Search size={16} aria-hidden="true" /><input autoFocus value={query} maxLength={100} onChange={event => setQuery(event.target.value)} aria-label="메시지 검색어" placeholder="대화에서 검색" />
      <Button variant="outline" size="sm" type="submit" disabled={searching || !query.trim()}>{searching ? '검색 중…' : '검색'}</Button>
      {results && <span role="status">{results.messages.length}{results.older ? '+' : ''}건</span>}
    </form>}
    <CardContent className="transcript-content">
      <ScrollArea className="transcript" ref={viewport} aria-label="대화 기록" role="log" aria-live="off"
        onScroll={event => {
          const target = event.currentTarget;
          const bottom = target.scrollHeight - target.clientHeight - target.scrollTop < 52;
          keepBottom.current = bottom;
          setAtBottom(bottom);
        }}>
        <div className="transcript-inner">
          {!visible && <p className="transcript-empty">대화를 불러오고 있어요…</p>}
          {visible && !groups.length && <div className="transcript-empty"><MessageCircle size={28} /><strong>{results ? '검색 결과가 없습니다.' : '대화를 시작해 보세요.'}</strong>
            <p>{results ? '다른 검색어를 입력해 주세요.' : `${peer.name}님에게 첫 메시지를 보내 보세요.`}</p></div>}
          {!results && history?.older && <Button className="load-older" variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? '불러오는 중…' : '이전 메시지 불러오기'}</Button>}
          {groups.map(({ message, divider }) => {
            const mine = message.sender_id === self.id;
            const person = mine ? self : peer;
            const reactions = EMOJI.map(emoji => ({
              emoji, responses: message.reactions.filter(reaction => reaction.emoji === emoji),
            })).filter(reaction => reaction.responses.length);
            const react = (emoji: string) => perform(async () => {
              await command({ action: 'react', id: message.id, emoji, enabled: !message.reactions.some(entry => entry.user_id === self.id && entry.emoji === emoji) });
              if (results) setResults(undefined);
              await refresh();
            });
            return <div key={message.id}>
              {divider && <div className="date-divider"><span>{divider}</span></div>}
              <div className={cn('message-row group', mine && 'mine')}>
                <PersonAvatar name={person.name} image={avatars[person.id]} className="size-8" />
                <div className="message-body">
                  <div className={cn('message-bubble', message.deleted_at && 'deleted')}>
                    {message.quote && !message.deleted_at && <blockquote><b>{message.quote.sender_id === self.id ? '나' : peer.name}에게 답장</b><span>{message.quote.content}</span></blockquote>}
                    <span>{message.content}</span>
                    {message.attachment_name && <button type="button" className="attachment-tile"
                      onClick={() => void perform(async () => { const bridge = window.kfcChat; if (bridge) value(await bridge.download(peer.id, message.id)); })}>
                      <FileText size={18} /><span><b>{message.attachment_name}</b><small>{size(message.attachment_size ?? 0)}</small></span><ArrowDownToLine size={15} />
                    </button>}
                  </div>
                  {reactions.length > 0 && <div className="reaction-list">{reactions.map(({ emoji, responses }) => {
                    const selected = responses.some(entry => entry.user_id === self.id);
                    return <button type="button" key={emoji} aria-pressed={selected} onClick={() => void react(emoji)}>{emoji} {responses.length}</button>;
                  })}</div>}
                  <div className="message-meta">
                    <time dateTime={message.created_at}>{time(message.created_at)}</time>
                    {message.edited_at && !message.deleted_at && <span>수정됨</span>}
                    {mine && !message.deleted_at && (message.id <= (history?.read_through ?? 0) ? <CheckCheck size={15} aria-label="읽음" /> : <Check size={14} aria-label="보냄" />)}
                    {!message.deleted_at && <div className="message-controls">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button className="message-action" variant="ghost" size="icon" aria-label="이모지 반응"><SmilePlus size={15} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="emoji-menu">{EMOJI.map(emoji => <DropdownMenuItem key={emoji} onSelect={() => void react(emoji)}>{emoji}</DropdownMenuItem>)}</DropdownMenuContent>
                      </DropdownMenu>
                      <MessageActions mine={mine} onReply={() => { setQuote(message); setEditing(undefined); composer.current?.focus(); }}
                        onCopy={() => void perform(() => window.kfcChat?.copy(message.content) ?? Promise.resolve(), '메시지를 복사했어요.')}
                        onEdit={() => { setEditing(message); setQuote(undefined); setEditText(message.content); composer.current?.focus(); }}
                        onDelete={() => setAction({ type: 'delete', message })} onReport={() => setAction({ type: 'report', message })} />
                    </div>}
                  </div>
                </div>
              </div>
            </div>;
          })}
          {!results && history?.typing && <p className="typing-status" role="status">{peer.name}님이 입력하고 있어요…</p>}
        </div>
      </ScrollArea>
      {!atBottom && !results && <Button className="jump-bottom" variant="outline" size="sm" onClick={() => {
        if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
      }}>최근 메시지 ↓</Button>}
    </CardContent>
    <form className="composer" onSubmit={send}>
      {notice && <p className="composer-notice" role="status">{notice}</p>}
      {(quote || editing) && <div className="compose-context">
        {editing ? <Pencil size={16} /> : <Reply size={16} />}
        <span><b>{editing ? '메시지 수정' : `${quote?.sender_id === self.id ? '나' : peer.name}에게 답장`}</b><small>{(editing ?? quote)?.content}</small></span>
        <Button variant="ghost" size="icon" aria-label="취소" onClick={() => { setQuote(undefined); setEditing(undefined); }}><X size={17} /></Button>
      </div>}
      {attachment && !editing && <div className="compose-context"><Paperclip size={16} /><span><b>{attachment.name}</b><small>{size(attachment.size)}</small></span>
        <Button variant="ghost" size="icon" aria-label="첨부 제거" onClick={() => setAttachment(null)}><X size={17} /></Button></div>}
      <div className="compose-row">
        <Button variant="outline" size="icon" aria-label="파일 첨부" onClick={() => void chooseFile()} disabled={busy || blocked || Boolean(editing)}><Paperclip size={19} /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="이모지 넣기" disabled={busy || blocked}><SmilePlus size={18} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent className="emoji-menu" side="top" align="start">{EMOJI.map(emoji => <DropdownMenuItem key={emoji} onSelect={() => {
            const field = composer.current;
            const current = editing ? editText : draft;
            const start = field?.selectionStart ?? current.length;
            const end = field?.selectionEnd ?? start;
            changeDraft(current.slice(0, start) + emoji + current.slice(end));
            requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + emoji.length, start + emoji.length); });
          }}>{emoji}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
        <textarea ref={composer} value={editing ? editText : draft} maxLength={4000} rows={2} aria-label="메시지 입력"
          disabled={blocked} readOnly={busy} placeholder={blocked ? '현재 이 상대에게 메시지를 보낼 수 없습니다.' : '메시지를 입력해 주세요.'}
          onChange={event => changeDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault(); void send();
            }
          }} />
        <Button type="submit" size="icon" aria-label={editing ? '수정 저장' : '메시지 보내기'} title={editing ? '수정 저장' : '메시지 보내기'}
          disabled={busy || blocked || !(editing ? editText.trim() : draft.trim() || attachment)}>{editing ? <Check size={20} /> : <ArrowUp size={20} />}</Button>
      </div>
    </form>
    {action && <ActionDialog action={action} peer={peer} submit={confirm} close={() => setAction(undefined)} />}
  </Card>;
}
