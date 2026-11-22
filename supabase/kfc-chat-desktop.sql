create table public.kfc_desktop_messages (
  id bigint generated always as identity primary key,
  sender_id bigint not null references public.users(id) on delete cascade,
  recipient_id bigint not null references public.users(id) on delete cascade,
  request_id uuid not null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (sender_id, request_id)
);

create index kfc_desktop_messages_sender_idx
  on public.kfc_desktop_messages (sender_id, id desc);
create index kfc_desktop_messages_recipient_idx
  on public.kfc_desktop_messages (recipient_id, id desc);
create index kfc_desktop_messages_pair_idx
  on public.kfc_desktop_messages (sender_id, recipient_id, id desc);

alter table public.kfc_desktop_messages enable row level security;
revoke all on public.kfc_desktop_messages from public, anon, authenticated;
grant select, insert on public.kfc_desktop_messages to service_role;
grant usage on sequence public.kfc_desktop_messages_id_seq to service_role;

create function public.kfc_desktop_threads(viewer bigint)
returns table (peer_id bigint, last_id bigint, content text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select distinct on (peer_id)
    case when m.sender_id = viewer then m.recipient_id else m.sender_id end as peer_id,
    m.id as last_id, m.content, m.created_at
  from public.kfc_desktop_messages m
  where m.sender_id = viewer or m.recipient_id = viewer
  order by peer_id, m.id desc
$$;

revoke all on function public.kfc_desktop_threads(bigint) from public, anon, authenticated;
grant execute on function public.kfc_desktop_threads(bigint) to service_role;
