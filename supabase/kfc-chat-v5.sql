alter table public.kfc_desktop_messages
  add column sticker_key text,
  add constraint kfc_chat_sticker_check check (sticker_key is null or (
    sticker_key in ('wave','laugh','cheer','thumb','heart','build') and code_language is null and attachment_path is null
  ));

create or replace function public.kfc_chat_history_scope(viewer bigint, peer bigint, room_key bigint, before_id bigint, search_text text)
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
      m.attachment_name,m.attachment_size,m.sticker_key,
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

create or replace function public.kfc_chat_monitor_history(viewer bigint, low_user bigint, high_user bigint, room_key bigint,
  review uuid, before_id bigint, search_text text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare scope text;
begin
  perform public.kfc_chat_monitor_require_admin(viewer);
  if room_key is not null and low_user is null and high_user is null and
     exists(select 1 from public.kfc_chat_rooms where id=room_key) then
    scope := 'r:' || room_key;
  elsif room_key is null and low_user < high_user and exists (
    select 1 from public.kfc_desktop_messages m where
      ((m.sender_id=low_user and m.recipient_id=high_user) or (m.sender_id=high_user and m.recipient_id=low_user))
  ) then
    scope := 'd:' || low_user || ':' || high_user;
  else
    raise exception using errcode='P0001', message='CHAT_MONITOR_NOT_FOUND';
  end if;
  insert into public.kfc_chat_moderation_audit as log(admin_id,review_id,scope_key,operation)
    values(viewer,review,scope,'history')
    on conflict(admin_id,review_id,scope_key,operation,message_id) do update
      set last_access_at=now(),access_count=log.access_count+1;

  return (
    with page as (
      select m.*
      from public.kfc_desktop_messages m
      where ((room_key is not null and m.room_id=room_key) or (room_key is null and
        ((m.sender_id=low_user and m.recipient_id=high_user) or (m.sender_id=high_user and m.recipient_id=low_user))))
        and (before_id is null or m.id<before_id)
        and (search_text is null or (m.deleted_at is null and
          strpos(lower(m.content || ' ' || coalesce(m.attachment_name,'')),lower(search_text))>0))
      order by m.id desc limit 51
    ),
    items as (
      select m.id,m.sender_id,u.name as sender_name,m.content,m.code_language,m.created_at,m.edited_at,m.deleted_at,
        m.attachment_name,m.attachment_size,m.sticker_key,
        case when ref.id is not null then jsonb_build_object('id',ref.id,'sender_name',quoted.name,'content',
          case when ref.deleted_at is not null then '삭제된 메시지입니다.'
               when ref.code_language is not null then '코드 메시지 · ' || ref.code_language
               else left(ref.content,140) end
        ) end as quote
      from (select * from page order by id desc limit 50) m
      join public.users u on u.id=m.sender_id
      left join public.kfc_desktop_messages ref on ref.id=m.reply_to and
        ((room_key is not null and ref.room_id=room_key) or (room_key is null and
          ((ref.sender_id=low_user and ref.recipient_id=high_user) or (ref.sender_id=high_user and ref.recipient_id=low_user))))
      left join public.users quoted on quoted.id=ref.sender_id
    )
    select jsonb_build_object(
      'messages',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from items i),'[]'::jsonb),
      'older',(select count(*)>50 from page)
    )
  );
end;
$$;
