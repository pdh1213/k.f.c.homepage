grant select on public.executive_meetings,public.executive_notes,public.executive_credentials to authenticated;
create policy executive_meetings_officer_read on public.executive_meetings for select to authenticated using ((select private.is_officer()));
create policy executive_notes_officer_read on public.executive_notes for select to authenticated using ((select private.is_officer()));
create policy executive_credentials_officer_read on public.executive_credentials for select to authenticated using ((select private.is_officer()));

