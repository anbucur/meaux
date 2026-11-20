-- =====================================================================
--  MEAUX ATELIER CMS — COMPLETE PRODUCTION SUPABASE SCHEMA (v2.0)
--  Run this whole file once in: Supabase Dashboard → SQL Editor → New query
--  100% IDEMPOTENT: safe to re-run on existing databases; it upgrades
--  existing tables with any missing columns, tables, indexes, and policies.
--
--  Tables included:
--   1. public.admins            — Authorized curator allow-list & roles
--   2. public.site_content      — Draft & published full site JSONB snapshots
--   3. public.site_revisions    — Version history snapshots for 1-click rollback
--   4. public.media_categories  — Custom picture categories & accent colors
--   5. public.media_items       — Asset vault (URLs, CDN, Base64 blobs, tags, categories, focal points)
--   6. public.pages             — Structured page registry, nav order, SEO & blocks
--   7. public.site_settings     — Global settings, SEO, announcement bar, theme & custom CSS
--   8. public.enquiries         — Client commission dossiers submitted from the Enquiries form
--   9. public.audit_log         — Futuristic curator activity & publish telemetry log
--  10. storage.buckets ('media')— Public-read, admin-write high-res media bucket
-- =====================================================================

-- Enable required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ADMINS (Allow-list & Roles)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  email         text primary key check (email = lower(email) and position('@' in email) > 1),
  role          text not null default 'curator' check (role in ('owner', 'curator', 'editor')),
  display_name  text,
  added_by      text,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Idempotent upgrades for existing installs
alter table public.admins add column if not exists role          text not null default 'curator';
alter table public.admins add column if not exists display_name  text;
alter table public.admins add column if not exists last_login_at timestamptz;

insert into public.admins (email, role, display_name, added_by)
values
  ('alexandru.n.bucur@gmail.com', 'owner', 'Alexandru Bucur', 'seed'),
  ('bucuralexandrunicolae@gmail.com', 'owner', 'Meaux Atelier Owner', 'seed')
on conflict (email) do update
  set role = coalesce(public.admins.role, excluded.role);

-- ---------------------------------------------------------------------
-- 2. SITE CONTENT (Draft & Published Snapshots)
-- ---------------------------------------------------------------------
create table if not exists public.site_content (
  key         text primary key check (key in ('draft', 'published')),
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Relax size constraint to 8MB for rich sites if old 4MB constraint exists
alter table public.site_content drop constraint if exists site_content_data_check;
alter table public.site_content add constraint site_content_data_check check (pg_column_size(data) < 8000000);

-- ---------------------------------------------------------------------
-- 3. SITE REVISIONS (Version History & Rollback)
-- ---------------------------------------------------------------------
create table if not exists public.site_revisions (
  id          bigint generated always as identity primary key,
  data        jsonb not null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  text
);

create index if not exists idx_site_revisions_created_at on public.site_revisions (created_at desc);

-- ---------------------------------------------------------------------
-- 4. MEDIA CATEGORIES (Custom Asset Organization)
-- ---------------------------------------------------------------------
create table if not exists public.media_categories (
  id          text primary key default gen_random_uuid()::text,
  slug        text unique not null,
  name        text not null,
  description text,
  color       text not null default '#38bdf8',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.media_categories (id, slug, name, description, color, sort_order)
values
  ('cat_photography', 'photography', 'Photography', 'Editorial & sculptural photographic works', '#38bdf8', 1),
  ('cat_avant_garde', 'avant-garde', 'Avant-Garde', 'High-contrast chiaroscuro & conceptual studies', '#a78bfa', 2),
  ('cat_campaigns',   'campaigns',   'Campaigns',   'Fashion house campaigns & lookbooks', '#f472b6', 3),
  ('cat_portraits',   'portraits',   'Portraits',   'Intimate studio portraits & beauty close-ups', '#fbbf24', 4),
  ('cat_location',    'location',    'Location & Bridal', 'Destination shoots, architecture & bridal', '#34d399', 5),
  ('cat_styling',     'styling',     'Styling',     'Silhouette architecture & wardrobe curation', '#fb923c', 6),
  ('cat_social',      'social-media','Social Media','Curated grid visuals, reels & highlights', '#60a5fa', 7),
  ('cat_editorial',   'editorial',   'Editorial',   'Print, press & archival editorial frames', '#c084fc', 8),
  ('cat_uncat',       'uncategorized','Uncategorized','General atelier assets', '#94a3b8', 99)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 5. MEDIA ITEMS (Full Asset Vault with Categories, Tags & Focal Points)
-- ---------------------------------------------------------------------
create table if not exists public.media_items (
  id          text primary key default gen_random_uuid()::text,
  filename    text not null,
  title       text,
  caption     text,
  alt_text    text,
  category    text not null default 'Uncategorized',
  tags        text[] not null default '{}',
  focal_point text not null default '50% 35%',
  permalink   text,
  credit      text,
  location    text,
  featured    boolean not null default false,
  sort_order  integer not null default 0,
  url         text,          -- Absolute or relative HTTP / CDN link
  blob_data   text,          -- Optional Base64 data URL for direct DB uploads
  source      text not null default 'catalog', -- 'catalog', 'blob', 'storage', 'link', 'upload'
  mime_type   text default 'image/jpeg',
  file_size   integer,
  width       integer,
  height      integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text
);

-- Idempotent column upgrades for existing media_items table
alter table public.media_items add column if not exists alt_text    text;
alter table public.media_items add column if not exists category    text not null default 'Uncategorized';
alter table public.media_items add column if not exists tags        text[] not null default '{}';
alter table public.media_items add column if not exists focal_point text not null default '50% 35%';
alter table public.media_items add column if not exists permalink   text;
alter table public.media_items add column if not exists credit      text;
alter table public.media_items add column if not exists location    text;
alter table public.media_items add column if not exists featured    boolean not null default false;
alter table public.media_items add column if not exists sort_order  integer not null default 0;
alter table public.media_items add column if not exists file_size   integer;
alter table public.media_items add column if not exists width       integer;
alter table public.media_items add column if not exists height      integer;
alter table public.media_items add column if not exists updated_at  timestamptz not null default now();

create index if not exists idx_media_items_category on public.media_items (category);
create index if not exists idx_media_items_tags     on public.media_items using gin (tags);
create index if not exists idx_media_items_featured on public.media_items (featured) where featured = true;

-- ---------------------------------------------------------------------
-- 6. PAGES (Structured Page Registry & Per-Page SEO)
-- ---------------------------------------------------------------------
create table if not exists public.pages (
  id                text primary key,
  slug              text unique not null,
  title             text not null,
  subtitle          text,
  nav_label         text,
  show_in_nav       boolean not null default true,
  is_system         boolean not null default false,
  sort_order        integer not null default 0,
  status            text not null default 'published' check (status in ('published', 'draft', 'hidden')),
  seo_title         text,
  seo_description   text,
  og_image          text,
  background_config jsonb default '{}'::jsonb,
  blocks            jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

insert into public.pages (id, slug, title, nav_label, show_in_nav, is_system, sort_order, status)
values
  ('atelier',      'atelier',      'Atelier',               'Atelier',               true, true, 0, 'published'),
  ('photography',  'photography',  'Photography',           'Photography',           true, true, 1, 'published'),
  ('styling',      'styling',      'Styling',               'Styling',               true, true, 2, 'published'),
  ('social-media', 'social-media', 'Social Media Curation', 'Social Media Curation', true, true, 3, 'published'),
  ('about',        'about',        'About Me',              'About Me',              true, true, 4, 'published'),
  ('enquiries',    'enquiries',    'Enquiries',             'Enquiries',             true, true, 5, 'published')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 7. SITE SETTINGS (Global Config, Theme, Announcement Bar & Custom CSS)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id               text primary key default 'default',
  site_title       text not null default 'MEAUX — Visual, Styling & Brand Atelier',
  meta_description text,
  og_image         text,
  favicon_url      text,
  contact_email    text default 'bucuralexandrunicolae@gmail.com',
  instagram_url    text default 'https://www.instagram.com/meauxsvision/',
  location         text default 'Amsterdam, The Netherlands',
  announcement_bar jsonb not null default '{}'::jsonb,
  theme_config     jsonb not null default '{}'::jsonb,
  vault_config     jsonb not null default '{}'::jsonb,
  custom_css       text,
  custom_head_html text,
  updated_at       timestamptz not null default now(),
  updated_by       text
);

insert into public.site_settings (id, site_title, meta_description, contact_email, instagram_url, location)
values (
  'default',
  'MEAUX — Visual, Styling & Brand Atelier',
  'Meaux — an independent creative practice in photography, styling, brand identity and social media.',
  'bucuralexandrunicolae@gmail.com',
  'https://www.instagram.com/meauxsvision/',
  'Amsterdam, The Netherlands'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 8. ENQUIRIES (Client Commission Dossiers Inbox)
-- ---------------------------------------------------------------------
create table if not exists public.enquiries (
  id           uuid primary key default gen_random_uuid(),
  client_name  text not null,
  client_email text not null,
  phone        text,
  timeline     text,
  disciplines  text[] not null default '{}',
  budget       text,
  brief        text not null,
  status       text not null default 'new' check (status in ('new', 'reviewed', 'replied', 'archived')),
  admin_notes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_enquiries_status_created on public.enquiries (status, created_at desc);

-- ---------------------------------------------------------------------
-- 9. AUDIT LOG (Admin Telemetry & Activity Trail)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_created_at on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------
-- 10. HELPER: is_admin()
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
alter table public.admins           enable row level security;
alter table public.site_content     enable row level security;
alter table public.site_revisions   enable row level security;
alter table public.media_categories enable row level security;
alter table public.media_items      enable row level security;
alter table public.pages            enable row level security;
alter table public.site_settings    enable row level security;
alter table public.enquiries        enable row level security;
alter table public.audit_log        enable row level security;

-- admins ---------------------------------------------------------------
drop policy if exists "admins: read"   on public.admins;
drop policy if exists "admins: insert" on public.admins;
drop policy if exists "admins: update" on public.admins;
drop policy if exists "admins: delete" on public.admins;

create policy "admins: read"   on public.admins for select to authenticated using (public.is_admin());
create policy "admins: insert" on public.admins for insert to authenticated with check (public.is_admin());
create policy "admins: update" on public.admins for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins: delete" on public.admins for delete to authenticated using (public.is_admin() and email <> lower(auth.jwt() ->> 'email'));

-- site_content ---------------------------------------------------------
drop policy if exists "content: public reads published" on public.site_content;
drop policy if exists "content: admin insert"           on public.site_content;
drop policy if exists "content: admin update"           on public.site_content;

create policy "content: public reads published" on public.site_content
  for select to anon, authenticated using (key = 'published' or public.is_admin());
create policy "content: admin insert" on public.site_content
  for insert to authenticated with check (public.is_admin());
create policy "content: admin update" on public.site_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_revisions -------------------------------------------------------
drop policy if exists "revisions: admin read" on public.site_revisions;
create policy "revisions: admin read" on public.site_revisions
  for select to authenticated using (public.is_admin());

-- media_categories -----------------------------------------------------
drop policy if exists "media_categories: public read"  on public.media_categories;
drop policy if exists "media_categories: admin insert" on public.media_categories;
drop policy if exists "media_categories: admin update" on public.media_categories;
drop policy if exists "media_categories: admin delete" on public.media_categories;

create policy "media_categories: public read"  on public.media_categories for select to anon, authenticated using (true);
create policy "media_categories: admin insert" on public.media_categories for insert to authenticated with check (public.is_admin());
create policy "media_categories: admin update" on public.media_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "media_categories: admin delete" on public.media_categories for delete to authenticated using (public.is_admin());

-- media_items ----------------------------------------------------------
drop policy if exists "media_items: public read"  on public.media_items;
drop policy if exists "media_items: admin insert" on public.media_items;
drop policy if exists "media_items: admin update" on public.media_items;
drop policy if exists "media_items: admin delete" on public.media_items;

create policy "media_items: public read"  on public.media_items for select to anon, authenticated using (true);
create policy "media_items: admin insert" on public.media_items for insert to authenticated with check (public.is_admin());
create policy "media_items: admin update" on public.media_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "media_items: admin delete" on public.media_items for delete to authenticated using (public.is_admin());

-- pages ----------------------------------------------------------------
drop policy if exists "pages: public read"  on public.pages;
drop policy if exists "pages: admin insert" on public.pages;
drop policy if exists "pages: admin update" on public.pages;
drop policy if exists "pages: admin delete" on public.pages;

create policy "pages: public read"  on public.pages for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "pages: admin insert" on public.pages for insert to authenticated with check (public.is_admin());
create policy "pages: admin update" on public.pages for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pages: admin delete" on public.pages for delete to authenticated using (public.is_admin() and is_system = false);

-- site_settings --------------------------------------------------------
drop policy if exists "site_settings: public read"  on public.site_settings;
drop policy if exists "site_settings: admin insert" on public.site_settings;
drop policy if exists "site_settings: admin update" on public.site_settings;

create policy "site_settings: public read"  on public.site_settings for select to anon, authenticated using (true);
create policy "site_settings: admin insert" on public.site_settings for insert to authenticated with check (public.is_admin());
create policy "site_settings: admin update" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- enquiries (Public can submit; only Admins can read/manage) -----------
drop policy if exists "enquiries: public submit" on public.enquiries;
drop policy if exists "enquiries: admin read"    on public.enquiries;
drop policy if exists "enquiries: admin update"  on public.enquiries;
drop policy if exists "enquiries: admin delete"  on public.enquiries;

create policy "enquiries: public submit" on public.enquiries for insert to anon, authenticated with check (length(trim(client_name)) > 0 and position('@' in client_email) > 1);
create policy "enquiries: admin read"    on public.enquiries for select to authenticated using (public.is_admin());
create policy "enquiries: admin update"  on public.enquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "enquiries: admin delete"  on public.enquiries for delete to authenticated using (public.is_admin());

-- audit_log ------------------------------------------------------------
drop policy if exists "audit_log: admin read"   on public.audit_log;
drop policy if exists "audit_log: admin insert" on public.audit_log;

create policy "audit_log: admin read"   on public.audit_log for select to authenticated using (public.is_admin());
create policy "audit_log: admin insert" on public.audit_log for insert to authenticated with check (public.is_admin());

-- Table grants (RLS enforces row-level authorization on top)
grant select on public.site_content, public.media_categories, public.media_items, public.pages, public.site_settings to anon, authenticated;
grant insert on public.enquiries to anon, authenticated;
grant insert, update, delete on public.admins, public.media_categories, public.media_items, public.pages, public.enquiries to authenticated;
grant insert, update on public.site_content, public.site_settings to authenticated;
grant select on public.admins, public.site_revisions, public.enquiries, public.audit_log to authenticated;
grant insert on public.audit_log to authenticated;

-- ---------------------------------------------------------------------
-- 12. ATOMIC PUBLISH & REVISION RESTORE RPCs
-- ---------------------------------------------------------------------
create or replace function public.publish_site(doc jsonb, note text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts  timestamptz := now();
  who text := lower(auth.jwt() ->> 'email');
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.site_content (key, data, updated_at, updated_by)
  values ('draft', doc, ts, who), ('published', doc, ts, who)
  on conflict (key) do update
    set data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  insert into public.site_revisions (data, note, created_by)
  values (doc, note, who);

  -- Keep 50 most recent snapshots
  delete from public.site_revisions
  where id not in (select id from public.site_revisions order by id desc limit 50);

  -- Sync structured site_settings row if settings exist in doc
  if doc ? 'settings' then
    insert into public.site_settings (
      id, site_title, meta_description, contact_email, instagram_url,
      announcement_bar, theme_config, vault_config, custom_css, updated_at, updated_by
    )
    values (
      'default',
      coalesce(doc -> 'settings' ->> 'siteTitle', 'MEAUX — Visual, Styling & Brand Atelier'),
      doc -> 'settings' ->> 'metaDescription',
      doc -> 'settings' ->> 'contactEmail',
      coalesce(doc -> 'footer' ->> 'instagramUrl', 'https://www.instagram.com/meauxsvision/'),
      coalesce(doc -> 'announcementBar', '{}'::jsonb),
      coalesce(doc -> 'theme', '{}'::jsonb),
      coalesce(doc -> 'vault', '{}'::jsonb),
      doc -> 'theme' ->> 'customCss',
      ts,
      who
    )
    on conflict (id) do update
      set site_title       = excluded.site_title,
          meta_description = excluded.meta_description,
          contact_email    = excluded.contact_email,
          instagram_url    = excluded.instagram_url,
          announcement_bar = excluded.announcement_bar,
          theme_config     = excluded.theme_config,
          vault_config     = excluded.vault_config,
          custom_css       = excluded.custom_css,
          updated_at       = excluded.updated_at,
          updated_by       = excluded.updated_by;
  end if;

  -- Record publish event in audit log
  insert into public.audit_log (actor_email, action, target_type, target_id, details)
  values (who, 'publish_site', 'site_content', 'published', jsonb_build_object('note', note, 'published_at', ts));

  return ts;
end;
$$;

revoke all on function public.publish_site(jsonb, text) from public, anon;
grant execute on function public.publish_site(jsonb, text) to authenticated;

create or replace function public.restore_revision(rev_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rev_doc jsonb;
  who     text := lower(auth.jwt() ->> 'email');
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select data into rev_doc from public.site_revisions where id = rev_id;
  if rev_doc is null then
    raise exception 'revision % not found', rev_id;
  end if;

  perform public.publish_site(rev_doc, 'Restored revision #' || rev_id::text);

  insert into public.audit_log (actor_email, action, target_type, target_id, details)
  values (who, 'restore_revision', 'site_revisions', rev_id::text, jsonb_build_object('rev_id', rev_id));

  return rev_doc;
end;
$$;

revoke all on function public.restore_revision(bigint) from public, anon;
grant execute on function public.restore_revision(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 13. IMAGE STORAGE BUCKET (Public read, Admin write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: public read"  on storage.objects;
drop policy if exists "media: admin list"   on storage.objects;
drop policy if exists "media: admin insert" on storage.objects;
drop policy if exists "media: admin update" on storage.objects;
drop policy if exists "media: admin delete" on storage.objects;

create policy "media: public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

create policy "media: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

create policy "media: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

create policy "media: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------
-- 14. OPTIONAL AUTH HOOK: refuse sign-ups from non-admin e-mails
-- ---------------------------------------------------------------------
create or replace function public.hook_admins_only(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.admins
    where email = lower(coalesce(event -> 'user' ->> 'email', ''))
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'This account is not allowed to sign in.')
  );
end;
$$;

revoke all on function public.hook_admins_only(jsonb) from public, anon, authenticated;
grant execute on function public.hook_admins_only(jsonb) to supabase_auth_admin;
grant select on public.admins to supabase_auth_admin;
