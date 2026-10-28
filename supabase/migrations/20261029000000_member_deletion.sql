-- Preserve shared records while allowing a member account to be removed.
-- Direct messages, group messages, votes, memberships and direct rooms already cascade.
do $$
declare item record;
begin
  for item in
    select c.conrelid::regclass as relation_name, c.conname as constraint_name,
           a.attname as column_name
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.users'::regclass
      and cardinality(c.conkey) = 1
      and a.attname in ('created_by', 'updated_by')
      and c.confdeltype = 'a'
  loop
    execute format('alter table %s alter column %I drop not null', item.relation_name, item.column_name);
    execute format('alter table %s drop constraint %I', item.relation_name, item.constraint_name);
    execute format('alter table %s add constraint %I foreign key (%I) references public.users(id) on delete set null',
      item.relation_name, item.constraint_name, item.column_name);
  end loop;
end $$;

