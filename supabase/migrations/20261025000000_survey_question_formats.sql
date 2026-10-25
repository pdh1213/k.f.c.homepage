alter table public.polls
  add column if not exists description text not null default '';

alter table public.poll_votes
  add column if not exists responses_json jsonb;

alter table public.poll_votes
  alter column option_index drop not null;

