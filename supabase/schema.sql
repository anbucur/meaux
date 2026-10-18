-- =====================================================================
--  MEAUX CMS — Supabase schema
--  Run this whole file once in: Supabase Dashboard → SQL Editor → New query
--  It is idempotent: running it again is safe (it updates functions/policies).
--
--  Security model
--   • Visitors (anon key) can ONLY read the row key='published'.
--   • Everything else (draft, revisions, admins list, uploads) requires a
--     signed-in Google account whose e-mail is present in public.admins.
--   • All checks run inside Postgres (Row Level Security), so they cannot be
--     bypassed from the browser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  email       text primary key check (email = lower(email) and position('@' in email) > 1),
  added_by    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.site_content (
  key         text primary key check (key in ('draft', 'published')),
  data        jsonb not null check (pg_column_size(data) < 4000000),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.site_revisions (
  id          bigint generated always as identity primary key,
  data        jsonb not null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  text
);

-- Initial administrator (add more later from the admin panel → Settings → Admins)
insert into public.admins (email, added_by)
values ('alexandru.n.bucur@gmail.com', 'seed')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- 2. Helper: is the current request made by an allow-listed Google user?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- must have authenticated through Google (blocks e-mail/password look-alikes)
    (auth.jwt() -> 'app_metadata' -> 'providers') ? 'google'
    and exists (
      select 1 from public.admins a
      where a.email = lower(auth.jwt() ->> 'email')
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
alter table public.admins          enable row level security;
alter table public.site_content    enable row level security;
alter table public.site_revisions  enable row level security;

-- admins ---------------------------------------------------------------
drop policy if exists "admins: read"   on public.admins;
drop policy if exists "admins: insert" on public.admins;
drop policy if exists "admins: delete" on public.admins;

create policy "admins: read" on public.admins
  for select to authenticated using (public.is_admin());

create policy "admins: insert" on public.admins
  for insert to authenticated with check (public.is_admin());

-- an admin can remove others, never themselves (prevents locking everyone out)
create policy "admins: delete" on public.admins
  for delete to authenticated
  using (public.is_admin() and email <> lower(auth.jwt() ->> 'email'));

-- site_content -----------------------------------------------------------
drop policy if exists "content: public reads published" on public.site_content;
drop policy if exists "content: admin insert"           on public.site_content;
drop policy if exists "content: admin update"           on public.site_content;

create policy "content: public reads published" on public.site_content
  for select to anon, authenticated
  using (key = 'published' or public.is_admin());

create policy "content: admin insert" on public.site_content
  for insert to authenticated with check (public.is_admin());

create policy "content: admin update" on public.site_content
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- site_revisions ---------------------------------------------------------
drop policy if exists "revisions: admin read" on public.site_revisions;
create policy "revisions: admin read" on public.site_revisions
  for select to authenticated using (public.is_admin());
-- (inserts happen only through publish_site(), below)

-- Table privileges (RLS still applies on top of these)
grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;
grant select, insert, delete on public.admins to authenticated;
grant select on public.site_revisions to authenticated;

-- ---------------------------------------------------------------------
-- 4. Atomic publish: draft + published + revision snapshot
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

  insert into public.site_revisions (data, note, created_by) values (doc, note, who);

  -- keep the 40 most recent snapshots
  delete from public.site_revisions
  where id not in (select id from public.site_revisions order by id desc limit 40);

  return ts;
end;
$$;

revoke all on function public.publish_site(jsonb, text) from public, anon;
grant execute on function public.publish_site(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Image storage bucket (public read, admin write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: admin list"   on storage.objects;
drop policy if exists "media: admin insert" on storage.objects;
drop policy if exists "media: admin update" on storage.objects;
drop policy if exists "media: admin delete" on storage.objects;

create policy "media: admin list" on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.is_admin());

create policy "media: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

create policy "media: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

create policy "media: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------
-- 6. OPTIONAL hardening: refuse sign-ups from non-admin e-mails entirely.
--    Enable in Dashboard → Authentication → Hooks → "Before User Created"
--    → Postgres function → public.hook_admins_only
--    (Without it, strangers can create an empty auth account but still
--     have zero access — RLS above already protects all data.)
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
