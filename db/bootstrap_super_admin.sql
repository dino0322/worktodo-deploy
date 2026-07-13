-- Run this after:
-- 1. db/schema.sql has been executed.
-- 2. The first user has signed up through the app.
--
-- Replace the values below before running.

do $$
declare
  bootstrap_email text := 'admin@example.com';
  bootstrap_workspace_name text := 'Work To Do 제품팀';
  bootstrap_invite_code text := 'WTD-2026';
  bootstrap_user_id uuid;
  bootstrap_workspace_id uuid;
begin
  select id
    into bootstrap_user_id
  from auth.users
  where lower(email) = lower(bootstrap_email)
  limit 1;

  if bootstrap_user_id is null then
    raise exception 'No auth user found for %', bootstrap_email;
  end if;

  insert into public.profiles (id, email, full_name)
  select
    id,
    email,
    coalesce(raw_user_meta_data ->> 'full_name', email)
  from auth.users
  where id = bootstrap_user_id
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    updated_at = now();

  insert into public.workspaces (name, invite_code, owner_id)
  values (bootstrap_workspace_name, bootstrap_invite_code, bootstrap_user_id)
  on conflict (invite_code) do update set
    name = excluded.name,
    owner_id = excluded.owner_id,
    updated_at = now()
  returning id into bootstrap_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (bootstrap_workspace_id, bootstrap_user_id, 'super_admin', 'active')
  on conflict (workspace_id, user_id) do update set
    role = 'super_admin',
    status = 'active';

  insert into public.projects (workspace_id, name, color)
  values (bootstrap_workspace_id, '일반', '#2563eb')
  on conflict do nothing;
end $$;
