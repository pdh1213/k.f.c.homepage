alter table public.showroom_projects
  add column if not exists related_project_ids bigint[] not null default '{}';

alter table public.showroom_competitions
  add column if not exists project_ids bigint[] not null default '{}';
