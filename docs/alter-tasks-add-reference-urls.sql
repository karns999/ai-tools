-- Add reference_urls, scene_suggestions, generated_images and selected_suggestions columns to tasks table
alter table tasks add column reference_urls text[] not null default '{}';
alter table tasks add column scene_suggestions text[] not null default '{}';
alter table tasks add column generated_images text[] not null default '{}';
alter table tasks add column selected_suggestions int[] not null default '{}';
