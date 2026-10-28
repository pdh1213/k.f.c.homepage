-- Service-role-only lookup so the Edge Function can remove a member's Storage files
-- through the Storage API before deleting the Auth user.
create or replace function public.member_owned_storage_objects(target_auth_user uuid)
returns table(bucket_id text, object_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.owner = target_auth_user or o.owner_id = target_auth_user::text
  order by o.bucket_id, o.name
$$;
revoke all on function public.member_owned_storage_objects(uuid) from public, anon, authenticated;
grant execute on function public.member_owned_storage_objects(uuid) to service_role;

