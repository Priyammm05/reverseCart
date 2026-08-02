-- Run after 001_reversecart.sql to move identity ownership from Supabase Auth
-- UUIDs to Clerk's string user IDs. Existing UUID ownership values are retained
-- as text, so this migration is non-destructive.

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "requests own rows" on public.purchase_requests;
drop policy if exists "offers through own request" on public.offers;
drop policy if exists "reservations own rows" on public.reservations;
drop policy if exists "payments own rows" on public.payment_events;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.purchase_requests drop constraint if exists purchase_requests_user_id_fkey;
alter table public.reservations drop constraint if exists reservations_user_id_fkey;
alter table public.payment_events drop constraint if exists payment_events_user_id_fkey;

alter table public.profiles alter column id type text using id::text;
alter table public.purchase_requests alter column user_id type text using user_id::text;
alter table public.reservations alter column user_id type text using user_id::text;
alter table public.payment_events alter column user_id type text using user_id::text;

create policy "profiles own rows" on public.profiles
  for all to authenticated
  using ((select auth.jwt()->>'sub') = id)
  with check ((select auth.jwt()->>'sub') = id);

create policy "requests own rows" on public.purchase_requests
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "offers through own request" on public.offers
  for all to authenticated
  using (exists (
    select 1 from public.purchase_requests r
    where r.id = request_id and r.user_id = (select auth.jwt()->>'sub')
  ))
  with check (exists (
    select 1 from public.purchase_requests r
    where r.id = request_id and r.user_id = (select auth.jwt()->>'sub')
  ));

create policy "reservations own rows" on public.reservations
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "payments own rows" on public.payment_events
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);
