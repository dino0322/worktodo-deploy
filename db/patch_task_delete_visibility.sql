drop policy if exists "tasks update collaborators" on public.tasks;
drop policy if exists "tasks update authors" on public.tasks;
create policy "tasks update authors"
on public.tasks for update
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or (
    creator_id = auth.uid()
    and (
      visibility <> 'team'
      or public.is_workspace_admin(workspace_id)
    )
  )
)
with check (
  public.is_workspace_admin(workspace_id)
  or (
    creator_id = auth.uid()
    and (
      visibility <> 'team'
      or public.is_workspace_admin(workspace_id)
    )
  )
);

-- Optional: if a personal task was accidentally saved as a team task,
-- update that exact row by title after confirming it is truly personal.
--
-- update public.tasks
-- set visibility = 'private',
--     assignee_id = creator_id,
--     updated_at = now()
-- where title = '업무 제목을 여기에 입력'
--   and visibility = 'team';
