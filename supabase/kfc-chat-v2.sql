alter table public.kfc_desktop_messages
  add column reply_to bigint references public.kfc_desktop_messages(id) on delete set null,
  add column edited_at timestamptz,
  add column deleted_at timestamptz,
  add column attachment_name text,
  add column attachment_size integer,
  add column attachment_path text;

create table public.kfc_chat_preferences (
  user_id bigint not null references public.users(id) on delete cascade,
  peer_id bigint not null references public.users(id) on delete cascade,
  pinned boolean not null default false,
  muted boolean not null default false,
  blocked boolean not null default false,
  hidden_through bigint not null default 0,
  read_through bigint not null default 0,
  primary key (user_id, peer_id),
  check (user_id <> peer_id)
);

create table public.kfc_chat_presence (
  user_id bigint primary key references public.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  mode text not null default 'online' check (mode in ('online','dnd','offline')),
  typing_peer bigint references public.users(id) on delete set null,
  typing_until timestamptz
);

create table public.kfc_chat_reactions (
  message_id bigint not null references public.kfc_desktop_messages(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','🎉','😮','👀')),
  primary key (message_id, user_id, emoji)
);

create index kfc_chat_reactions_user_idx on public.kfc_chat_reactions (user_id);
create index kfc_desktop_messages_reply_idx on public.kfc_desktop_messages (reply_to) where reply_to is not null;

create table public.kfc_chat_reports (
  id bigint generated always as identity primary key,
  reporter_id bigint not null references public.users(id) on delete cascade,
  peer_id bigint not null references public.users(id) on delete cascade,
  message_id bigint references public.kfc_desktop_messages(id) on delete set null,
  excerpt text,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by bigint references public.users(id) on delete set null
);

alter table public.kfc_chat_preferences enable row level security;
alter table public.kfc_chat_presence enable row level security;
alter table public.kfc_chat_reactions enable row level security;
alter table public.kfc_chat_reports enable row level security;
revoke all on public.kfc_chat_preferences, public.kfc_chat_presence, public.kfc_chat_reactions, public.kfc_chat_reports from public, anon, authenticated;
grant select, insert, update on public.kfc_chat_preferences, public.kfc_chat_presence, public.kfc_chat_reports to service_role;
grant select, insert, delete on public.kfc_chat_reactions to service_role;
grant update on public.kfc_desktop_messages to service_role;
grant usage on sequence public.kfc_chat_reports_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('kfc-chat-attachments', 'kfc-chat-attachments', false, 4194304);

create function public.kfc_chat_pair_lock(a bigint, b bigint)
returns void language sql security invoker set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'kfc_chat/' || least(a,b)::text || '/' || greatest(a,b)::text, 0
  ))
$$;

create function public.kfc_chat_check_block()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  perform public.kfc_chat_pair_lock(new.sender_id, new.recipient_id);
  if exists (
    select 1 from public.kfc_chat_preferences
    where blocked and ((user_id = new.sender_id and peer_id = new.recipient_id)
      or (user_id = new.recipient_id and peer_id = new.sender_id))
  ) then
    raise exception using errcode = 'P0001', message = 'CHAT_BLOCKED';
  end if;
  return new;
end;
$$;

create trigger kfc_chat_block_before_send
  before insert on public.kfc_desktop_messages
  for each row execute function public.kfc_chat_check_block();

create function public.kfc_chat_preferences_update(viewer bigint, peer bigint, field text, enabled boolean, through bigint)
returns void language plpgsql security invoker set search_path = ''
as $$
declare latest bigint;
begin
  if field not in ('pinned','muted','blocked','clear','read') then
    raise exception 'Invalid chat preference';
  end if;
  perform public.kfc_chat_pair_lock(viewer, peer);
  select coalesce(max(id),0) into latest from public.kfc_desktop_messages m
    where (m.sender_id = viewer and m.recipient_id = peer)
       or (m.sender_id = peer and m.recipient_id = viewer);
  insert into public.kfc_chat_preferences (user_id, peer_id) values (viewer, peer) on conflict do nothing;
  update public.kfc_chat_preferences set
    pinned = case when field = 'pinned' then enabled when field = 'clear' then false else pinned end,
    muted = case when field = 'muted' then enabled else muted end,
    blocked = case when field = 'blocked' then enabled else blocked end,
    hidden_through = case when field = 'clear' then latest else hidden_through end,
    read_through = case when field = 'clear' then greatest(read_through, latest)
                         when field = 'read' then greatest(read_through, least(latest, through))
                         else read_through end
  where user_id = viewer and peer_id = peer;
end;
$$;

create function public.kfc_chat_overview(viewer bigint)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  with friends as (
    select u.id, u.name,
      case when coalesce(p.blocked,false) or coalesce(other.blocked,false) then 'offline'
           when activity.seen_at > now() - interval '45 seconds' then activity.mode else 'offline' end as status,
      coalesce(p.pinned,false) as pinned, coalesce(p.muted,false) as muted,
      coalesce(p.blocked,false) as blocked, coalesce(other.blocked,false) as blocked_by,
      coalesce(p.hidden_through,0) as hidden_through, coalesce(p.read_through,0) as read_through
    from public.users u
    left join public.kfc_chat_preferences p on p.user_id = viewer and p.peer_id = u.id
    left join public.kfc_chat_preferences other on other.user_id = u.id and other.peer_id = viewer
    left join public.kfc_chat_presence activity on activity.user_id = u.id
    where u.id <> viewer and u.status = 'approved'
  ),
  chats as (
    select t.peer_id,t.last_id,t.content,t.created_at,
      (select count(*) from public.kfc_desktop_messages m
       where m.sender_id = t.peer_id and m.recipient_id = viewer
         and m.id > f.read_through and m.deleted_at is null) as unread
    from public.kfc_desktop_threads(viewer) t join friends f on f.id = t.peer_id
    where t.last_id > f.hidden_through
  )
  select jsonb_build_object(
    'friends',coalesce((select jsonb_agg(to_jsonb(f) - 'hidden_through' - 'read_through' order by lower(f.name), f.id) from friends f),'[]'::jsonb),
    'chats',coalesce((select jsonb_agg(to_jsonb(c) order by c.last_id desc) from chats c),'[]'::jsonb)
  )
$$;

create function public.kfc_chat_history(viewer bigint, peer bigint, before_id bigint, search_text text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  with preference as (
    select coalesce((select p.hidden_through from public.kfc_chat_preferences p where p.user_id = viewer and p.peer_id = peer),0) as cutoff
  ),
  page as (
    select m.*
    from public.kfc_desktop_messages m cross join preference
    where ((m.sender_id = viewer and m.recipient_id = peer) or (m.sender_id = peer and m.recipient_id = viewer))
      and m.id > cutoff and (before_id is null or m.id < before_id)
      and (search_text is null or (m.deleted_at is null and
        strpos(lower(m.content || ' ' || coalesce(m.attachment_name,'')), lower(search_text)) > 0))
    order by m.id desc
    limit 51
  ),
  items as (
    select m.id, m.sender_id, m.content, m.created_at, m.edited_at, m.deleted_at,
      m.attachment_name, m.attachment_size,
      case when ref.id is not null then jsonb_build_object(
        'id', ref.id, 'sender_id', ref.sender_id, 'content',
        case when ref.deleted_at is null then left(ref.content,140) else '삭제된 메시지입니다.' end
      ) end as quote,
      coalesce((select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'user_id', r.user_id) order by r.emoji,r.user_id)
        from public.kfc_chat_reactions r where r.message_id = m.id and m.deleted_at is null),'[]'::jsonb) as reactions
    from (select * from page order by id desc limit 50) m
    left join public.kfc_desktop_messages ref on ref.id = m.reply_to and
      ((ref.sender_id = viewer and ref.recipient_id = peer) or (ref.sender_id = peer and ref.recipient_id = viewer))
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from items i),'[]'::jsonb),
    'older', (select count(*) > 50 from page),
    'read_through', coalesce((select p.read_through from public.kfc_chat_preferences p where p.user_id = peer and p.peer_id = viewer),0),
    'typing', exists(select 1 from public.kfc_chat_presence a where a.user_id = peer and a.mode = 'online'
      and a.typing_peer = viewer and a.typing_until > now())
      and not exists(select 1 from public.kfc_chat_preferences p where p.blocked and
       ((p.user_id = viewer and p.peer_id = peer) or (p.user_id = peer and p.peer_id = viewer)))
  )
$$;

revoke all on function public.kfc_chat_pair_lock(bigint,bigint), public.kfc_chat_check_block(),
  public.kfc_chat_preferences_update(bigint,bigint,text,boolean,bigint), public.kfc_chat_overview(bigint),
  public.kfc_chat_history(bigint,bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.kfc_chat_pair_lock(bigint,bigint), public.kfc_chat_check_block(),
  public.kfc_chat_preferences_update(bigint,bigint,text,boolean,bigint), public.kfc_chat_overview(bigint),
  public.kfc_chat_history(bigint,bigint,bigint,text) to service_role;
