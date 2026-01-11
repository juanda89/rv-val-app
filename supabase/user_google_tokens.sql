-- Create user_google_tokens table
create table if not exists user_google_tokens (
  user_id uuid references auth.users primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table user_google_tokens enable row level security;

-- RLS Policies
create policy "Users can view own tokens"
  on user_google_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own tokens"
  on user_google_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tokens"
  on user_google_tokens for update
  using (auth.uid() = user_id);
