alter table public.showroom_projects
  add column if not exists collaborator_ids bigint[] not null default '{}',
  add column if not exists progress_entries jsonb not null default '[]'::jsonb,
  add column if not exists project_phase text not null default 'in_progress';

alter table public.showroom_projects drop constraint if exists showroom_projects_phase_check;
alter table public.showroom_projects add constraint showroom_projects_phase_check
  check (project_phase in ('in_progress', 'completed'));

create index if not exists showroom_projects_collaborators_idx
  on public.showroom_projects using gin(collaborator_ids);
