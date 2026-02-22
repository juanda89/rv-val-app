alter table if exists projects
  add column if not exists report_copy_spreadsheet_id text,
  add column if not exists report_copy_url text,
  add column if not exists report_copy_created_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'Users can update their own projects'
  ) then
    create policy "Users can update their own projects"
      on projects for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
