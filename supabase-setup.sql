-- West-Coast Gota Plant – Tool Access: Supabase setup
-- Run this once in Supabase > SQL Editor, then set storage: "supabase" in config.js

create table if not exists public.portal_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.portal_state enable row level security;

drop policy if exists "portal read"   on public.portal_state;
drop policy if exists "portal insert" on public.portal_state;
drop policy if exists "portal update" on public.portal_state;

create policy "portal read"   on public.portal_state for select to anon using (id = 'gota');
create policy "portal insert" on public.portal_state for insert to anon with check (id = 'gota');
create policy "portal update" on public.portal_state for update to anon using (id = 'gota') with check (id = 'gota');

-- Starting data: admin.gota / WCGota@2026 and bhargavi.patel / Bhargavi@2026 (change after first sign-in)
insert into public.portal_state (id, data) values ('gota', '{
  "plant": {"name": "Gota Plant", "location": "West-Coast Pharmaceutical Works Ltd."},
  "tools": [
    {"id": "bmr", "code": "BMR", "name": "BMR Tool", "desc": "Batch Manufacturing Record preparation", "url": ""},
    {"id": "pv",  "code": "PV",  "name": "PV Documentation Studio", "desc": "Process validation protocol and report generator", "url": "https://wcpv.vercel.app"},
    {"id": "cdp", "code": "CDP", "name": "CDP Tool", "desc": "CDP documentation tool", "url": ""}
  ],
  "users": [
    {"uid": "admin.gota", "name": "Gota Plant Admin", "role": "admin", "active": true, "salt": "wcg-a1", "hash": "d4be2c11a7b71a3fb8cbc0caf03af9476648ac58fad5e0a33739cd93c417f374", "tools": ["bmr","pv","cdp"]},
    {"uid": "bhargavi.patel", "name": "Bhargavi Patel", "role": "user", "active": true, "salt": "wcg-b1", "hash": "22c832b58b357485629e3f47bb2fda2bc02b4e35bbbfcee125ed0cb5d90f79d3", "tools": ["bmr","pv","cdp"]}
  ]
}'::jsonb)
on conflict (id) do nothing;
