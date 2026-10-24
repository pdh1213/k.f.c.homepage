create or replace function public.consume_admin_bootstrap_token(token_sha256 text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed boolean := false;
begin
  if exists (select 1 from public.users where role = 'admin') then
    return false;
  end if;
  delete from private.admin_bootstrap_tokens
  where id = true and token_hash = token_sha256;
  consumed := found;
  return consumed;
end;
$$;
revoke all on function public.consume_admin_bootstrap_token(text) from public, anon, authenticated;
grant execute on function public.consume_admin_bootstrap_token(text) to service_role;
