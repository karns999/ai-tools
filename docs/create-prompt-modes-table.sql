-- Create prompt_modes table
create table prompt_modes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  role_prompt text not null default '',
  prompt_ids uuid[] not null default '{}',
  quick_selections jsonb not null default '[]',
  creator text not null,
  created_at timestamptz not null default now(),
  updater text,
  updated_at timestamptz
);

-- Enable Row Level Security
alter table prompt_modes enable row level security;

-- Allow authenticated users to read all prompt_modes
create policy "Authenticated users can read prompt_modes"
  on prompt_modes for select
  to authenticated
  using (true);

-- Allow authenticated users to insert prompt_modes
create policy "Authenticated users can insert prompt_modes"
  on prompt_modes for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update prompt_modes
create policy "Authenticated users can update prompt_modes"
  on prompt_modes for update
  to authenticated
  using (true);

-- Allow authenticated users to delete prompt_modes
create policy "Authenticated users can delete prompt_modes"
  on prompt_modes for delete
  to authenticated
  using (true);
