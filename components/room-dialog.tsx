import { Plus, Search, UserMinus, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from '@/components/ui/messaging-conversation';
import { errorText, request, type Friend, type Room, type RoomPerson } from '@/lib/chat';

type Props = {
  room?: Room;
  viewer: number;
  friends: Friend[];
  avatars: Record<number, string>;
  close(): void;
  onCreated(id: number): void;
  onChanged(): Promise<void>;
};

export function RoomDialog({ room, viewer, friends, avatars, close, onCreated, onChanged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<RoomPerson[]>();
  const [selected, setSelected] = useState<number[]>([]);
  const [remove, setRemove] = useState<RoomPerson>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const roomId = room?.id;
  const manages = room?.owner_id === viewer;
  const showInvites = !room || manages;
  const availableSlots = Math.max(0, 50 - (room?.member_count ?? 1));

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let cancelled = false;
    if (roomId) void request<{ people: RoomPerson[] }>({ action: 'room-people', room: roomId })
      .then(result => { if (!cancelled) setPeople(result.people); })
      .catch(failure => { if (!cancelled) setError(errorText(failure)); });
    return () => { cancelled = true; };
  }, [roomId]);

  const joined = new Set(people?.map(person => person.id));
  const normalized = query.trim().toLocaleLowerCase();
  const candidates = friends.filter(friend => !friend.blocked && !friend.blocked_by &&
    !joined.has(friend.id) && friend.name.toLocaleLowerCase().includes(normalized));

  function toggle(id: number) {
    setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < availableSlots ? [...ids, id] : ids);
  }

  async function refreshPeople(id: number) {
    const result = await request<{ people: RoomPerson[] }>({ action: 'room-people', room: id });
    setPeople(result.people);
    await onChanged();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || (room && (!manages || selected.length === 0)) || (!room && !title.trim())) return;
    setBusy(true);
    setError('');
    try {
      if (room) {
        await request({ action: 'room-invite', room: room.id, invitees: selected });
        setSelected([]);
        setQuery('');
        await refreshPeople(room.id);
      } else {
        const result = await request<{ id: number }>({ action: 'room-create', title, invitees: selected });
        onCreated(result.id);
      }
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  async function removePerson() {
    if (!room || !remove || busy) return;
    setBusy(true);
    setError('');
    try {
      await request({ action: 'room-remove', room: room.id, user: remove.id });
      setRemove(undefined);
      await refreshPeople(room.id);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="dialog room-dialog" aria-labelledby="room-dialog-title"
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <form onSubmit={save}>
      <div className="room-dialog-heading">
        <div><h2 id="room-dialog-title">{room ? room.title : '채팅방 만들기'}</h2>
          <p>{room ? '참여 중인 동아리원을 확인할 수 있어요.' : '함께 대화할 동아리원을 초대해 보세요.'}</p></div>
        <Button variant="ghost" size="icon" aria-label="닫기" disabled={busy} onClick={close}><X size={18} /></Button>
      </div>
      {!room && <label className="room-name-label">채팅방 이름
        <input value={title} onChange={event => setTitle(event.target.value)} autoFocus required maxLength={60} placeholder="예: 로봇 제작팀" disabled={busy} />
      </label>}
      {room && <div className="room-members">
        <h3><Users size={15} /> 참여 중인 동아리원</h3>
        {!people && !error && <p>참여자를 불러오고 있어요…</p>}
        {people?.map(person => <div className="room-person" key={person.id}>
          <PersonAvatar name={person.name} image={avatars[person.id]} className="size-7" />
          <span>{person.name}{person.id === viewer ? ' (나)' : ''}</span>
          {person.id === room.owner_id && <small>방장</small>}
          {manages && person.id !== viewer && <Button variant="ghost" size="icon" aria-label={`${person.name} 내보내기`} onClick={() => setRemove(person)} disabled={busy}><UserMinus size={15} /></Button>}
        </div>)}
      </div>}
      {remove && <div className="room-remove" role="group" aria-label="참여자 내보내기">
        <p>{remove.name}님을 채팅방에서 내보낼까요?</p>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setRemove(undefined)}>취소</Button>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => void removePerson()}>내보내기</Button>
      </div>}
      {showInvites && (!room || people) && <div className="room-invites">
        <h3><Plus size={15} /> 동아리원 초대 {selected.length > 0 && <small>{selected.length}명 선택</small>}</h3>
        {availableSlots === 0 ? <p>채팅방에는 최대 50명까지 참여할 수 있어요.</p> : <>
          <label className="directory-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="이름으로 검색" aria-label="초대할 동아리원 검색" /></label>
          <div className="invite-list">
            {!candidates.length && <p>초대할 동아리원이 없어요.</p>}
            {candidates.map(person => <label className="room-person invite-person" key={person.id}>
              <PersonAvatar name={person.name} image={avatars[person.id]} className="size-7" />
              <span>{person.name}</span>
              <input type="checkbox" checked={selected.includes(person.id)} onChange={() => toggle(person.id)} disabled={busy || (!selected.includes(person.id) && selected.length >= availableSlots)} />
            </label>)}
          </div>
        </>}
      </div>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button variant="outline" onClick={close} disabled={busy}>{room ? '닫기' : '취소'}</Button>
        {showInvites && <Button type="submit" disabled={busy || (room ? !selected.length : !title.trim())}>
          {busy ? '처리 중…' : room ? '초대하기' : '채팅방 만들기'}
        </Button>}
      </div>
    </form>
  </dialog>;
}
