-- Add reference_urls, scene_suggestions and generated_images columns to tasks table
alter table tasks add column reference_urls text[] not null default '{}';
alter table tasks add column scene_suggestions text[] not null default '{}';
alter table tasks add column generated_images text[] not null default '{}';
