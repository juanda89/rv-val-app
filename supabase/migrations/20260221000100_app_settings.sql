create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "Authenticated users can read app settings" on app_settings;
create policy "Authenticated users can read app settings"
  on app_settings for select
  to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert app settings" on app_settings;
create policy "Authenticated users can insert app settings"
  on app_settings for insert
  to authenticated
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update app settings" on app_settings;
create policy "Authenticated users can update app settings"
  on app_settings for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

