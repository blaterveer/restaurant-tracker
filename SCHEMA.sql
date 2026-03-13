-- SC Culinary Restaurant Project Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor to create all required tables.

-- ============================================================
-- LOOKUP TABLES
-- ============================================================

create table if not exists restaurants (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0
);

create table if not exists categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0
);

create table if not exists types (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0
);

create table if not exists owners (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0
);

-- ============================================================
-- PROJECTS
-- ============================================================

create table if not exists projects (
  id          text primary key,          -- keeps existing uid() format
  restaurant  text not null,
  title       text not null,
  category    text,
  type        text,
  description text,
  owner       text,
  priority    text check (priority in ('High', 'Medium', 'Low')),
  weeks       integer,
  date_added  date,
  complete    boolean not null default false,
  link        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute procedure set_updated_at();

-- ============================================================
-- NOTES
-- ============================================================

create table if not exists notes (
  id         uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  note_date  date not null,
  text       text not null,
  author     text,
  created_at timestamptz not null default now()
);

create index if not exists notes_project_id_idx on notes(project_id);

-- ============================================================
-- INBOX REQUESTS (restaurant → admin communication)
-- ============================================================

create table if not exists inbox_requests (
  id              uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  title           text not null,
  description     text,
  category        text,
  status          text not null default 'submitted'
                    check (status in ('submitted', 'added', 'agenda', 'converted', 'cleared')),
  created_at      timestamptz not null default now()
);

create index if not exists inbox_requests_restaurant_idx on inbox_requests(restaurant_name);
create index if not exists inbox_requests_status_idx     on inbox_requests(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- (Enable RLS + allow anon read/write for the dashboard.
--  Tighten these policies if you add auth later.)
-- ============================================================

alter table restaurants  enable row level security;
alter table categories   enable row level security;
alter table types        enable row level security;
alter table owners       enable row level security;
alter table projects     enable row level security;
alter table notes           enable row level security;
alter table inbox_requests  enable row level security;

-- Allow full access via anon key (public dashboard, no auth)
create policy "anon all" on restaurants  for all using (true) with check (true);
create policy "anon all" on categories   for all using (true) with check (true);
create policy "anon all" on types        for all using (true) with check (true);
create policy "anon all" on owners       for all using (true) with check (true);
create policy "anon all" on projects     for all using (true) with check (true);
create policy "anon all" on notes           for all using (true) with check (true);
create policy "anon all" on inbox_requests  for all using (true) with check (true);

-- ============================================================
-- SEED DATA (matches the original in-memory defaults)
-- ============================================================

insert into restaurants (name, sort_order) values
  ('Americano',   0),
  ('Leola',       1),
  ('Cellaio',     2),
  ('The Kitchen', 3),
  ('Ponte',       4)
on conflict (name) do nothing;

insert into categories (name, sort_order) values
  ('Culinary',        0),
  ('Beverage',        1),
  ('Administrative',  2),
  ('Collateral/Menu', 3),
  ('Dining Room',     4)
on conflict (name) do nothing;

insert into types (name, sort_order) values
  ('Editable Doc',         0),
  ('Events/Activations',   1),
  ('New Menus',            2),
  ('Change to Service',    3)
on conflict (name) do nothing;

insert into owners (name, sort_order) values
  ('Justin Grannell',   0),
  ('Scott LoBianco',    1),
  ('Brandon Laterveer', 2),
  ('Brandon',           3)
on conflict (name) do nothing;
