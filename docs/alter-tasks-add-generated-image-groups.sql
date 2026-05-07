-- Add grouped generated image results to tasks table
alter table tasks add column generated_image_groups jsonb not null default '[]';
