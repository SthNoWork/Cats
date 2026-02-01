Try to use minimal tokens

DO NOT MODIFY THE CONFIGURATIONS VARIABLES KEEP IT AS IT IS

HERE IS THE TABLE SCHEMA
create table public.cats (
  id uuid not null default gen_random_uuid (),
  title text not null,
  image_urls text[] not null,
  description text null,
  admin_notes text null,
  categories text[] null,
  is_featured boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint cats_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_cats_categories on public.cats using gin (categories) TABLESPACE pg_default;

create index IF not exists idx_cats_created_at on public.cats using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_cats_featured on public.cats using btree (is_featured) TABLESPACE pg_default
where
  (is_featured = true);

TODO:
In admin.js

Upadting the product using and removing photoes, it is unable to delete the cloudinary photoes only from the supabase.

Also now instead of creating 

In index related

Each "product " it should show the category under the title. and not only when u click on them. also add a (added at) as an info customers can see
 
also rename stuff to cats etc.


use the reference folder called Shop

it is able to delete stuff from cloudinary but this one cant for some reason?

