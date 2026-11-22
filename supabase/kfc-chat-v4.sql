create table public.kfc_chat_moderation_audit (
  id bigint generated always as identity primary key,
  admin_id bigint references public.users(id) on delete set null,
  review_id uuid not null,
  scope_key text not null,
  operation text not null check (operation in ('history','attachment')),
  message_id bigint not null default 0 check (message_id >= 0),
  first_access_at timestamptz not null default now(),
  last_access_at timestamptz not null default now(),
  access_count integer not null default 1,
  unique (admin_id, review_id, scope_key, operation, message_id)
);
alter table public.kfc_chat_moderation_audit enable row level security;
revoke all on public.kfc_chat_moderation_audit from public, anon, authenticated;
grant select, insert, update on public.kfc_chat_moderation_audit to service_role;
grant usage on sequence public.kfc_chat_moderation_audit_id_seq to service_role;

create function public.kfc_chat_monitor_require_admin(viewer bigint)
returns void language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.users
    where id=viewer and role='admin' and status='approved' and not must_change_password) then
    raise exception using errcode='42501', message='CHAT_MONITOR_FORBIDDEN';
  end if;
end;
$$;

create function public.kfc_chat_monitor_catalog(viewer bigint, search_text text, page_offset integer)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
begin
  perform public.kfc_chat_monitor_require_admin(viewer);
  return (
    with direct_pairs as (
      select least(m.sender_id,m.recipient_id) as first_id, greatest(m.sender_id,m.recipient_id) as second_id,
        max(m.created_at) as updated_at
      from public.kfc_desktop_messages m where m.room_id is null
      group by 1,2
    ),
    catalog as (
      select 'direct'::text as kind, 'd:' || pair.first_id || ':' || pair.second_id as key,
        u.name || ' · ' || v.name as title, pair.updated_at
      from direct_pairs pair join public.users u on u.id=pair.first_id join public.users v on v.id=pair.second_id
      union all
      select 'room','r:' || r.id,r.title, coalesce(latest.created_at,r.created_at)
      from public.kfc_chat_rooms r left join lateral (
        select created_at from public.kfc_desktop_messages m where m.room_id=r.id order by id desc limit 1
      ) latest on true
    ),
    page as (
      select * from catalog
      where search_text is null or strpos(lower(title),lower(search_text)) > 0
      order by updated_at desc, key
      limit 41 offset greatest(0,coalesce(page_offset,0))
    )
    select jsonb_build_object(
      'entries',coalesce((select jsonb_agg(to_jsonb(row) order by row.updated_at desc,row.key)
        from (select * from page order by updated_at desc,key limit 40) row),'[]'::jsonb),
      'more',(select count(*)>40 from page)
    )
  );
end;
$$;

create function public.kfc_chat_monitor_history(viewer bigint, low_user bigint, high_user bigint, room_key bigint,
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
        m.attachment_name,m.attachment_size,
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

create function public.kfc_chat_monitor_file(viewer bigint, low_user bigint, high_user bigint, room_key bigint, review uuid, target_id bigint)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare file_record record; scope text;
begin
  perform public.kfc_chat_monitor_require_admin(viewer);
  select m.attachment_path,m.attachment_name into file_record
  from public.kfc_desktop_messages m
  where m.id=target_id and m.deleted_at is null and m.attachment_path is not null
    and ((room_key is not null and low_user is null and high_user is null and m.room_id=room_key) or
      (room_key is null and low_user<high_user and
       ((m.sender_id=low_user and m.recipient_id=high_user) or (m.sender_id=high_user and m.recipient_id=low_user))));
  if not found then raise exception using errcode='P0001', message='CHAT_MONITOR_NOT_FOUND'; end if;
  scope := case when room_key is not null then 'r:' || room_key else 'd:' || low_user || ':' || high_user end;
  insert into public.kfc_chat_moderation_audit as log(admin_id,review_id,scope_key,operation,message_id)
    values(viewer,review,scope,'attachment',target_id)
    on conflict(admin_id,review_id,scope_key,operation,message_id) do update
      set last_access_at=now(),access_count=log.access_count+1;
  return jsonb_build_object('path',file_record.attachment_path,'name',file_record.attachment_name);
end;
$$;

revoke all on function public.kfc_chat_monitor_require_admin(bigint), public.kfc_chat_monitor_catalog(bigint,text,integer),
  public.kfc_chat_monitor_history(bigint,bigint,bigint,bigint,uuid,bigint,text),
  public.kfc_chat_monitor_file(bigint,bigint,bigint,bigint,uuid,bigint) from public, anon, authenticated;
grant execute on function public.kfc_chat_monitor_require_admin(bigint), public.kfc_chat_monitor_catalog(bigint,text,integer),
  public.kfc_chat_monitor_history(bigint,bigint,bigint,bigint,uuid,bigint,text),
  public.kfc_chat_monitor_file(bigint,bigint,bigint,bigint,uuid,bigint) to service_role;
