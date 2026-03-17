-- Create prompts table
create table prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  creator text not null,
  created_at timestamptz not null default now(),
  updater text,
  updated_at timestamptz
);

-- Enable Row Level Security
alter table prompts enable row level security;

-- Allow authenticated users to read all prompts
create policy "Authenticated users can read prompts"
  on prompts for select
  to authenticated
  using (true);

-- Allow authenticated users to insert prompts
create policy "Authenticated users can insert prompts"
  on prompts for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update prompts
create policy "Authenticated users can update prompts"
  on prompts for update
  to authenticated
  using (true);

-- Allow authenticated users to delete prompts
create policy "Authenticated users can delete prompts"
  on prompts for delete
  to authenticated
  using (true);
