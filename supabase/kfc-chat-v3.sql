create table public.kfc_chat_rooms (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  owner_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.kfc_chat_room_members (
  room_id bigint not null references public.kfc_chat_rooms(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  visible_after bigint not null default 0,
  read_through bigint not null default 0,
  pinned boolean not null default false,
  muted boolean not null default false,
  primary key (room_id, user_id)
);

create index kfc_chat_rooms_owner_idx on public.kfc_chat_rooms(owner_id);
create index kfc_chat_room_members_user_idx on public.kfc_chat_room_members(user_id, room_id);
alter table public.kfc_chat_rooms enable row level security;
alter table public.kfc_chat_room_members enable row level security;
revoke all on public.kfc_chat_rooms, public.kfc_chat_room_members from public, anon, authenticated;
grant select, insert, update on public.kfc_chat_rooms to service_role;
grant select, insert, update, delete on public.kfc_chat_room_members to service_role;
grant usage on sequence public.kfc_chat_rooms_id_seq to service_role;

alter table public.kfc_desktop_messages
  alter column recipient_id drop not null,
  add column room_id bigint references public.kfc_chat_rooms(id) on delete cascade,
  add column code_language text,
  drop constraint kfc_desktop_messages_content_check,
  add constraint kfc_chat_message_target check ((recipient_id is null) <> (room_id is null)),
  add constraint kfc_chat_message_content check (
    (code_language is null and char_length(content) between 1 and 2000) or
    (code_language is not null and code_language in ('text','javascript','typescript','python','cpp','c','csharp','java','json','bash','html','css','sql','rust','arduino','lua')
     and char_length(content) between 1 and 12000)
  );

create index kfc_chat_room_messages_idx on public.kfc_desktop_messages(room_id, id desc) where room_id is not null;

alter table public.kfc_chat_presence
  add column typing_room bigint references public.kfc_chat_rooms(id) on delete set null;
create index kfc_chat_presence_typing_room_idx on public.kfc_chat_presence(typing_room) where typing_room is not null;

create function public.kfc_chat_room_lock(room bigint)
returns void language sql security invoker set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kfc_chat_room/' || room::text, 0))
$$;

create or replace function public.kfc_chat_check_block()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.room_id is not null then
    perform public.kfc_chat_room_lock(new.room_id);
    if not exists (select 1 from public.kfc_chat_room_members
                   where room_id = new.room_id and user_id = new.sender_id) then
      raise exception using errcode = 'P0001', message = 'CHAT_ROOM_FORBIDDEN';
    end if;
    return new;
  end if;
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

create or replace function public.kfc_desktop_threads(viewer bigint)
returns table (peer_id bigint, last_id bigint, content text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select distinct on (peer_id)
    case when m.sender_id = viewer then m.recipient_id else m.sender_id end as peer_id,
    m.id as last_id, case when m.code_language is null then m.content else '코드 메시지 · ' || m.code_language end, m.created_at
  from public.kfc_desktop_messages m
  where m.room_id is null and (m.sender_id = viewer or m.recipient_id = viewer)
  order by peer_id, m.id desc
$$;

create function public.kfc_chat_check_invite(viewer bigint, invitees bigint[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if cardinality(invitees) > 49 or exists (
    select 1 from unnest(invitees) as invite(id)
    where invite.id is null or invite.id = viewer
       or not exists (select 1 from public.users u where u.id = invite.id and u.status = 'approved')
       or exists (select 1 from public.kfc_chat_preferences p where p.blocked and
            ((p.user_id = viewer and p.peer_id = invite.id) or (p.user_id = invite.id and p.peer_id = viewer)))
  ) then
    raise exception using errcode = 'P0001', message = 'CHAT_INVALID_INVITE';
  end if;
end;
$$;

create function public.kfc_chat_room_create(viewer bigint, room_title text, invitees bigint[])
returns bigint language plpgsql security invoker set search_path = ''
as $$
declare room_key bigint;
begin
  perform public.kfc_chat_check_invite(viewer, invitees);
  insert into public.kfc_chat_rooms(title, owner_id) values (btrim(room_title), viewer) returning id into room_key;
  insert into public.kfc_chat_room_members(room_id, user_id)
    select room_key, id from unnest(array_append(invitees, viewer)) as invited(id) on conflict do nothing;
  return room_key;
end;
$$;

create function public.kfc_chat_room_members_update(viewer bigint, room bigint, invitees bigint[], remove_id bigint, leaving boolean)
returns void language plpgsql security invoker set search_path = ''
as $$
declare room_owner bigint; new_owner bigint; last_visible bigint;
begin
  perform public.kfc_chat_room_lock(room);
  if not exists (select 1 from public.kfc_chat_room_members where room_id = room and user_id = viewer) then
    raise exception using errcode = 'P0001', message = 'CHAT_ROOM_FORBIDDEN';
  end if;
  select coalesce(r.owner_id, (select user_id from public.kfc_chat_room_members
    where room_id = room order by joined_at,user_id limit 1)) into room_owner
  from public.kfc_chat_rooms r where r.id = room;

  if leaving then
    delete from public.kfc_chat_room_members where room_id = room and user_id = viewer;
    if room_owner = viewer then
      select m.user_id into new_owner from public.kfc_chat_room_members m join public.users u on u.id=m.user_id
        where m.room_id = room and u.status='approved' order by m.joined_at,m.user_id limit 1;
      update public.kfc_chat_rooms set owner_id = new_owner where id = room;
    end if;
    return;
  end if;
  if room_owner is distinct from viewer then
    raise exception using errcode = 'P0001', message = 'CHAT_ROOM_OWNER_REQUIRED';
  end if;
  if remove_id is not null and remove_id <> viewer then
    delete from public.kfc_chat_room_members where room_id = room and user_id = remove_id;
    return;
  end if;
  perform public.kfc_chat_check_invite(viewer, invitees);
  if (select count(*) from public.kfc_chat_room_members m where m.room_id = room) +
     (select count(distinct id) from unnest(invitees) as invite(id) where not exists
        (select 1 from public.kfc_chat_room_members m where m.room_id = room and m.user_id = invite.id)) > 50 then
    raise exception using errcode = 'P0001', message = 'CHAT_ROOM_LIMIT';
  end if;
  select coalesce(max(id),0) into last_visible from public.kfc_desktop_messages where room_id = room;
  insert into public.kfc_chat_room_members(room_id,user_id,visible_after,read_through)
    select room,id,last_visible,last_visible from unnest(invitees) as invite(id) on conflict do nothing;
end;
$$;

create function public.kfc_chat_room_prefs(viewer bigint, room bigint, field text, enabled boolean, through bigint)
returns void language sql security invoker set search_path = ''
as $$
  update public.kfc_chat_room_members m set
    pinned = case when field = 'pinned' then enabled else m.pinned end,
    muted = case when field = 'muted' then enabled else m.muted end,
    read_through = case when field = 'read' then greatest(m.read_through,
      least(through, coalesce((select max(id) from public.kfc_desktop_messages where room_id = room),0))) else m.read_through end
  where m.room_id = room and m.user_id = viewer
$$;

create function public.kfc_chat_rooms_list(viewer bigint)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(item) order by item.pinned desc,item.last_id desc,item.id desc),'[]'::jsonb)
  from (
    select r.id,r.title,r.created_at,coalesce(r.owner_id, (select user_id from public.kfc_chat_room_members
      where room_id=r.id order by joined_at,user_id limit 1)) as owner_id,
      m.pinned,m.muted,coalesce(last.id,0) as last_id,coalesce(last.created_at,r.created_at) as updated_at,
      case when last.code_language is not null then '코드 메시지 · ' || last.code_language else last.content end as content,
      (select count(*) from public.kfc_chat_room_members p join public.users u on u.id=p.user_id and u.status='approved' where p.room_id=r.id) as member_count,
      (select count(*) from public.kfc_desktop_messages msg where msg.room_id=r.id and msg.sender_id<>viewer
        and msg.deleted_at is null and msg.id > greatest(m.read_through,m.visible_after)) as unread
    from public.kfc_chat_room_members m join public.kfc_chat_rooms r on r.id=m.room_id
    left join lateral (select id,created_at,content,code_language from public.kfc_desktop_messages
      where room_id=r.id and id>m.visible_after order by id desc limit 1) last on true
    where m.user_id=viewer
  ) item
$$;

create function public.kfc_chat_room_people(viewer bigint, room bigint)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.name) order by lower(u.name),u.id),'[]'::jsonb)
  from public.kfc_chat_room_members m join public.users u on u.id=m.user_id
  where m.room_id=room and u.status='approved'
    and exists(select 1 from public.kfc_chat_room_members where room_id=room and user_id=viewer)
$$;

revoke all on function public.kfc_chat_room_lock(bigint), public.kfc_chat_check_invite(bigint,bigint[]),
  public.kfc_chat_room_create(bigint,text,bigint[]), public.kfc_chat_room_members_update(bigint,bigint,bigint[],bigint,boolean),
  public.kfc_chat_room_prefs(bigint,bigint,text,boolean,bigint), public.kfc_chat_rooms_list(bigint),
  public.kfc_chat_room_people(bigint,bigint) from public, anon, authenticated;
grant execute on function public.kfc_chat_room_lock(bigint), public.kfc_chat_check_invite(bigint,bigint[]),
  public.kfc_chat_room_create(bigint,text,bigint[]), public.kfc_chat_room_members_update(bigint,bigint,bigint[],bigint,boolean),
  public.kfc_chat_room_prefs(bigint,bigint,text,boolean,bigint), public.kfc_chat_rooms_list(bigint),
  public.kfc_chat_room_people(bigint,bigint) to service_role;

create function public.kfc_chat_history_scope(viewer bigint, peer bigint, room_key bigint, before_id bigint, search_text text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  with viewer_scope as (
    select m.visible_after as cutoff
    from public.kfc_chat_room_members m where room_key is not null and m.room_id=room_key and m.user_id=viewer
    union all
    select coalesce((select p.hidden_through from public.kfc_chat_preferences p where p.user_id=viewer and p.peer_id=peer),0)
    where room_key is null and peer is not null
  ),
  page as (
    select m.*
    from public.kfc_desktop_messages m cross join viewer_scope s
    where ((room_key is not null and m.room_id=room_key) or (room_key is null and
        ((m.sender_id=viewer and m.recipient_id=peer) or (m.sender_id=peer and m.recipient_id=viewer))))
      and m.id > s.cutoff and (before_id is null or m.id < before_id)
      and (search_text is null or (m.deleted_at is null and
        strpos(lower(m.content || ' ' || coalesce(m.attachment_name,'')), lower(search_text)) > 0))
    order by m.id desc limit 51
  ),
  items as (
    select m.id,m.sender_id,u.name as sender_name,m.content,m.code_language,m.created_at,m.edited_at,m.deleted_at,
      m.attachment_name,m.attachment_size,
      case when ref.id is not null then jsonb_build_object('id',ref.id,'sender_id',ref.sender_id,'sender_name',quoted.name,'content',
        case when ref.deleted_at is not null then '삭제된 메시지입니다.'
             when ref.code_language is not null then '코드 메시지 · ' || ref.code_language
             else left(ref.content,140) end
      ) end as quote,
      coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'user_id',r.user_id) order by r.emoji,r.user_id)
        from public.kfc_chat_reactions r where r.message_id=m.id and m.deleted_at is null),'[]'::jsonb) as reactions
    from (select * from page order by id desc limit 50) m
    join public.users u on u.id=m.sender_id cross join viewer_scope s
    left join public.kfc_desktop_messages ref on ref.id=m.reply_to and (
      (room_key is not null and ref.room_id=room_key and ref.id>s.cutoff) or (room_key is null and
      ((ref.sender_id=viewer and ref.recipient_id=peer) or (ref.sender_id=peer and ref.recipient_id=viewer))))
    left join public.users quoted on quoted.id=ref.sender_id
  ),
  typing_people as (
    select u.name from public.kfc_chat_room_members m
    join public.kfc_chat_presence a on a.user_id=m.user_id
    join public.users u on u.id=m.user_id and u.status='approved'
    where room_key is not null and m.room_id=room_key and m.user_id<>viewer
      and a.mode='online' and a.typing_room=room_key and a.typing_until>now()
      and exists(select 1 from viewer_scope)
    order by a.typing_until desc limit 3
  )
  select jsonb_build_object(
    'messages',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from items i),'[]'::jsonb),
    'older',(select count(*) > 50 from page),
    'read_through',case when room_key is not null then
      coalesce((select min(m.read_through) from public.kfc_chat_room_members m join public.users u on u.id=m.user_id
        where m.room_id=room_key and m.user_id<>viewer and u.status='approved' and exists(select 1 from viewer_scope)),0)
      else coalesce((select p.read_through from public.kfc_chat_preferences p where p.user_id=peer and p.peer_id=viewer),0)
    end,
    'typing_people',coalesce((select jsonb_agg(name) from typing_people),'[]'::jsonb),
    'typing',room_key is null and peer is not null and exists(select 1 from public.kfc_chat_presence a
      where a.user_id=peer and a.mode='online' and a.typing_peer=viewer and a.typing_until>now())
      and not exists(select 1 from public.kfc_chat_preferences p where p.blocked and
        ((p.user_id=viewer and p.peer_id=peer) or (p.user_id=peer and p.peer_id=viewer)))
  )
$$;

create or replace function public.kfc_chat_history(viewer bigint, peer bigint, before_id bigint, search_text text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select public.kfc_chat_history_scope(viewer, peer, null, before_id, search_text)
$$;

revoke all on function public.kfc_chat_history_scope(bigint,bigint,bigint,bigint,text)
  from public, anon, authenticated;
grant execute on function public.kfc_chat_history_scope(bigint,bigint,bigint,bigint,text) to service_role;
