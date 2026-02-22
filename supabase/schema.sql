-- Create projects table
create table projects (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  name text not null,
  address text,
  spreadsheet_id text not null,
  report_copy_spreadsheet_id text,
  report_copy_url text,
  report_copy_created_at timestamp with time zone,
  status text default 'active'
);

-- RLS Policies (Optional but recommended)
alter table projects enable row level security;

create policy "Users can view their own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on projects for delete
  using (auth.uid() = user_id);

create policy "Users can update their own projects"
  on projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Global application settings
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table app_settings enable row level security;

create policy "Authenticated users can read app settings"
  on app_settings for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert app settings"
  on app_settings for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update app settings"
  on app_settings for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
