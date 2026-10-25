create table public.site_settings (
  id boolean primary key default true check (id),
  demo_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, demo_enabled) values (true, false);

alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;
grant select, update on public.site_settings to service_role;

comment on table public.site_settings is 'Server-managed site switches. Demo content is static and never stored here.';

