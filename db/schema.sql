create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager', 'admin', 'guest')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  visibility text not null default 'team' check (visibility in ('private', 'team', 'assignees')),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  visibility text not null default 'team' check (visibility in ('team', 'private_to_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  importance text not null default 'normal' check (importance in ('normal', 'important')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'answered')),
  replies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_private boolean not null default false,
  replies jsonb not null default '[]'::jsonb,
  read_by jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.messages add column if not exists read_by jsonb not null default '[]'::jsonb;

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists tasks_workspace_idx on public.tasks(workspace_id);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id);
create index if not exists task_comments_task_idx on public.task_comments(task_id);
create index if not exists notices_workspace_idx on public.notices(workspace_id);
create index if not exists questions_workspace_idx on public.questions(workspace_id);
create index if not exists messages_workspace_idx on public.messages(workspace_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.notices enable row level security;
alter table public.questions enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_workspace_manager(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('admin', 'manager')
      and status = 'active'
  );
$$;

drop policy if exists "profiles read workspace peers" on public.profiles;
create policy "profiles read workspace peers"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members peer on peer.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and peer.user_id = profiles.id
      and mine.status = 'active'
      and peer.status = 'active'
  )
);

drop policy if exists "profiles upsert self" on public.profiles;
create policy "profiles upsert self"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "workspaces read members" on public.workspaces;
create policy "workspaces read members"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id) or owner_id = auth.uid());

drop policy if exists "workspaces create owner" on public.workspaces;
create policy "workspaces create owner"
on public.workspaces for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "workspaces update managers" on public.workspaces;
create policy "workspaces update managers"
on public.workspaces for update
to authenticated
using (public.is_workspace_manager(id) or owner_id = auth.uid())
with check (public.is_workspace_manager(id) or owner_id = auth.uid());

drop policy if exists "members read same workspace" on public.workspace_members;
create policy "members read same workspace"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists "members create self owner bootstrap" on public.workspace_members;
create policy "members create self owner bootstrap"
on public.workspace_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_workspace_manager(workspace_id)
);

drop policy if exists "members update managers" on public.workspace_members;
create policy "members update managers"
on public.workspace_members for update
to authenticated
using (public.is_workspace_manager(workspace_id))
with check (public.is_workspace_manager(workspace_id));

drop policy if exists "projects read members" on public.projects;
create policy "projects read members"
on public.projects for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "projects write managers" on public.projects;
create policy "projects write managers"
on public.projects for all
to authenticated
using (public.is_workspace_manager(workspace_id))
with check (public.is_workspace_manager(workspace_id));

drop policy if exists "tasks read visible" on public.tasks;
create policy "tasks read visible"
on public.tasks for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    visibility = 'team'
    or creator_id = auth.uid()
    or assignee_id = auth.uid()
    or public.is_workspace_manager(workspace_id)
  )
);

drop policy if exists "tasks create members" on public.tasks;
create policy "tasks create members"
on public.tasks for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and creator_id = auth.uid()
);

drop policy if exists "tasks update collaborators" on public.tasks;
create policy "tasks update collaborators"
on public.tasks for update
to authenticated
using (
  public.is_workspace_manager(workspace_id)
  or creator_id = auth.uid()
  or assignee_id = auth.uid()
)
with check (
  public.is_workspace_manager(workspace_id)
  or creator_id = auth.uid()
  or assignee_id = auth.uid()
);

drop policy if exists "comments read visible tasks" on public.task_comments;
create policy "comments read visible tasks"
on public.task_comments for select
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_comments.task_id
      and public.is_workspace_member(tasks.workspace_id)
      and (
        task_comments.visibility = 'team'
        or task_comments.author_id = auth.uid()
        or public.is_workspace_manager(tasks.workspace_id)
      )
  )
);

drop policy if exists "comments create members" on public.task_comments;
create policy "comments create members"
on public.task_comments for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.tasks
    where tasks.id = task_comments.task_id
      and public.is_workspace_member(tasks.workspace_id)
  )
);

drop policy if exists "notices read members" on public.notices;
create policy "notices read members"
on public.notices for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "notices write managers" on public.notices;
create policy "notices write managers"
on public.notices for all
to authenticated
using (public.is_workspace_manager(workspace_id))
with check (public.is_workspace_manager(workspace_id));

drop policy if exists "questions read members" on public.questions;
create policy "questions read members"
on public.questions for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "questions create members" on public.questions;
create policy "questions create members"
on public.questions for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and author_id = auth.uid()
);

drop policy if exists "questions update managers" on public.questions;
create policy "questions update managers"
on public.questions for update
to authenticated
using (public.is_workspace_manager(workspace_id))
with check (public.is_workspace_manager(workspace_id));

drop policy if exists "messages read visible" on public.messages;
create policy "messages read visible"
on public.messages for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    sender_id = auth.uid()
    or public.is_workspace_manager(workspace_id)
    or is_private = false
  )
);

drop policy if exists "messages create members" on public.messages;
create policy "messages create members"
on public.messages for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and sender_id = auth.uid()
);

drop policy if exists "messages update managers" on public.messages;
drop policy if exists "messages update visible participants" on public.messages;
create policy "messages update visible participants"
on public.messages for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    sender_id = auth.uid()
    or public.is_workspace_manager(workspace_id)
    or is_private = false
  )
)
with check (
  public.is_workspace_member(workspace_id)
  and (
    sender_id = auth.uid()
    or public.is_workspace_manager(workspace_id)
    or is_private = false
  )
);
