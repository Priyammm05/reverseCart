-- ReverseCart user data. Run in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_prompt text not null,
  destination text not null,
  timing text not null,
  guests integer not null check (guests > 0),
  rooms integer not null check (rooms > 0),
  max_total_minor integer not null check (max_total_minor > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  required_constraints jsonb not null default '[]'::jsonb,
  preferred_constraints jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','open','closed','selected','payment_pending','completed','cancelled')),
  selected_offer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  merchant_id text not null,
  merchant_name text not null,
  total_minor integer not null check (total_minor > 0),
  benefits jsonb not null default '[]'::jsonb,
  cancellation text,
  distance_km numeric,
  score integer,
  selected boolean not null default false,
  source text not null default 'simulated',
  created_at timestamptz not null default now()
);
create unique index if not exists offers_request_merchant_unique on public.offers(request_id, merchant_id);

alter table public.purchase_requests drop constraint if exists purchase_requests_selected_offer_id_fkey;
alter table public.purchase_requests add constraint purchase_requests_selected_offer_id_fkey foreign key (selected_offer_id) references public.offers(id) on delete set null;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  booking_reference text,
  merchant_name text not null,
  amount_minor integer not null,
  status text not null check (status in ('pending_payment','confirmed','payment_failed','cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  provider text not null default 'prava',
  provider_session_id text,
  provider_transaction_id text,
  amount_minor integer not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.offers enable row level security;
alter table public.reservations enable row level security;
alter table public.payment_events enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "requests own rows" on public.purchase_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "offers through own request" on public.offers for all using (exists (select 1 from public.purchase_requests r where r.id = request_id and r.user_id = auth.uid())) with check (exists (select 1 from public.purchase_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy "reservations own rows" on public.reservations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payments own rows" on public.payment_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, avatar_url = excluded.avatar_url, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update on auth.users for each row execute procedure public.handle_new_user();
