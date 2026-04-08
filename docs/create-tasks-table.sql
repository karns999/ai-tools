-- Create tasks table
create table tasks (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  prompt_mode_id uuid not null references prompt_modes(id),
  status text not null default 'pending',
  creator text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Enable Row Level Security
alter table tasks enable row level security;

-- Allow authenticated users to read all tasks
create policy "Authenticated users can read tasks"
  on tasks for select
  to authenticated
  using (true);

-- Allow authenticated users to insert tasks
create policy "Authenticated users can insert tasks"
  on tasks for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update tasks
create policy "Authenticated users can update tasks"
  on tasks for update
  to authenticated
  using (true);

-- Allow authenticated users to delete tasks
create policy "Authenticated users can delete tasks"
  on tasks for delete
  to authenticated
  using (true);
