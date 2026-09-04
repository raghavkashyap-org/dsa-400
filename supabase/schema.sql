-- ═══════════════════════════════════════════════════════════════════════
-- prj-DSA · Supabase schema  (run in the SQL Editor of your prj-DSA project)
-- Replaces the old server.js: append-only ledger + permanent commitment +
-- per-user plan/progress/notes. RLS keeps every user to their own rows.
-- ═══════════════════════════════════════════════════════════════════════

-- ── profiles ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  created_at  timestamptz not null default now()
);

-- ── commitment · created once, immutable ────────────────────────────────
create table if not exists public.commitment (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  statement   text not null,
  hash        text not null unique,          -- sha512(statement + '::' + user_id)
  start_date  date not null,                 -- permanent Day-1 anchor
  end_date    date not null,                 -- start_date + 399
  created_at  timestamptz not null default now()
);

-- ── user's learning plan: what they chose to keep / drop ────────────────
create table if not exists public.excluded_days (
  user_id      uuid not null references auth.users(id) on delete cascade,
  day_id       int  not null check (day_id between 1 and 400),
  excluded_at  timestamptz not null default now(),
  primary key (user_id, day_id)
);

-- log of removed questions (so they can be re-added later)
create table if not exists public.removed_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_id      int  not null,
  item_idx    int  not null,
  title       text,
  lc_number   text,
  url         text,
  removed_at  timestamptz not null default now(),
  restored    boolean not null default false,
  unique (user_id, day_id, item_idx)
);

-- user-added questions (saved for later / scheduled onto a day)
create table if not exists public.extra_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  lc_number   text,
  title       text not null,
  url         text,
  target_day  int,                            -- null => "save for later" queue
  status      text not null default 'later' check (status in ('later','scheduled','done')),
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ── progress ────────────────────────────────────────────────────────────
create table if not exists public.day_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day_id     int  not null check (day_id between 1 and 400),
  is_sealed  boolean not null default false,
  sealed_at  timestamptz,
  primary key (user_id, day_id)
);

create table if not exists public.item_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day_id     int  not null,
  item_idx   int  not null,
  done       boolean not null default true,
  done_at    timestamptz not null default now(),
  kind       text not null default 'original' check (kind in ('original','extra')),
  extra_id   bigint,
  lc_number  text,
  title      text,
  primary key (user_id, day_id, item_idx)
);

-- ── pattern notes + edit timeline ───────────────────────────────────────
create table if not exists public.notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day_id     int  not null check (day_id between 1 and 400),
  text       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day_id)
);

create table if not exists public.note_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  day_id     int  not null,
  text       text not null,
  saved_at   timestamptz not null default now()
);

-- ── append-only event ledger (the new "/file" raw ledger) ───────────────
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ts         timestamptz not null default now(),
  type       text not null check (type in ('tick','untick','seal','unseal','note','commit','exclude','restore','add_extra','remove_item')),
  day        int,
  idx        int,
  text       text
);

-- ── streak snapshots (server-recorded, user cannot edit) ────────────────
create table if not exists public.streak_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  on_date    date not null,
  streak     int  not null,
  broken     boolean not null default false
);

-- ═══════════════════════════════════════════════════════════════════════
-- ENFORCEMENT: a day can never be sealed before its calendar date arrives.
-- The calendar derives from the permanent commitment.start_date.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.plan_date(p_user uuid, p_day int)
returns date language sql stable as $$
  select c.start_date + (p_day - 1)
  from public.commitment c where c.user_id = p_user;
$$;

create or replace function public.enforce_no_future_seal()
returns trigger language plpgsql as $$
declare d date;
begin
  if new.is_sealed then
    select public.plan_date(new.user_id, new.day_id) into d;
    if d is null then raise exception 'no commitment set'; end if;
    if d > current_date then
      raise exception 'cannot seal a future day (day % maps to %)', new.day_id, d;
    end if;
    new.sealed_at := coalesce(new.sealed_at, now());
  else
    new.sealed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_no_future_seal on public.day_progress;
create trigger trg_no_future_seal
  before insert or update on public.day_progress
  for each row execute function public.enforce_no_future_seal();

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════
alter table public.profiles        enable row level security;
alter table public.commitment      enable row level security;
alter table public.excluded_days    enable row level security;
alter table public.removed_items    enable row level security;
alter table public.extra_items      enable row level security;
alter table public.day_progress     enable row level security;
alter table public.item_progress    enable row level security;
alter table public.notes            enable row level security;
alter table public.note_history     enable row level security;
alter table public.events           enable row level security;
alter table public.streak_log       enable row level security;

-- Policies are dropped-then-created so this script is safe to re-run
-- (Postgres has no `create policy if not exists`).

drop policy if exists "own profiles"     on public.profiles;
create policy "own profiles"    on public.profiles     for all using (auth.uid() = id);

drop policy if exists "own commitment"   on public.commitment;
create policy "own commitment"  on public.commitment   for select using (auth.uid() = user_id);
drop policy if exists "insert commitment" on public.commitment;
create policy "insert commitment" on public.commitment for insert with check (auth.uid() = user_id);
-- note: no UPDATE policy on commitment → start_date & hash are permanent

drop policy if exists "own excluded"     on public.excluded_days;
create policy "own excluded"    on public.excluded_days for all using (auth.uid() = user_id);

drop policy if exists "own removed"      on public.removed_items;
create policy "own removed"     on public.removed_items for all using (auth.uid() = user_id);

drop policy if exists "own extras"       on public.extra_items;
create policy "own extras"      on public.extra_items   for all using (auth.uid() = user_id);

drop policy if exists "own day_prog"     on public.day_progress;
create policy "own day_prog"    on public.day_progress  for all using (auth.uid() = user_id);

drop policy if exists "own item_prog"    on public.item_progress;
create policy "own item_prog"   on public.item_progress for all using (auth.uid() = user_id);

drop policy if exists "own notes"        on public.notes;
create policy "own notes"       on public.notes         for all using (auth.uid() = user_id);

drop policy if exists "own note_hist"    on public.note_history;
create policy "own note_hist"   on public.note_history  for select using (auth.uid() = user_id);
drop policy if exists "insert note_hist" on public.note_history;
create policy "insert note_hist" on public.note_history for insert with check (auth.uid() = user_id);

drop policy if exists "own events sel"   on public.events;
create policy "own events sel"  on public.events        for select using (auth.uid() = user_id);
drop policy if exists "own events ins"   on public.events;
create policy "own events ins"  on public.events        for insert with check (auth.uid() = user_id);
-- events & streak_log are append-only: no UPDATE/DELETE policies

drop policy if exists "own streak sel"   on public.streak_log;
create policy "own streak sel"  on public.streak_log    for select using (auth.uid() = user_id);
drop policy if exists "own streak ins"   on public.streak_log;
create policy "own streak ins"  on public.streak_log    for insert with check (auth.uid() = user_id);

-- ── auto-create a profile row on signup (email AND OAuth providers) ────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'user_name',          -- GitHub login
      new.raw_user_meta_data->>'preferred_username', -- other OAuth providers
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email,'user'),'@',1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════
-- v2 additions: commitment id + platform tag + public verification
-- ═══════════════════════════════════════════════════════════════════════
alter table public.commitment add column if not exists commit_id text;
create unique index if not exists commitment_commit_id_uq on public.commitment(commit_id) where commit_id is not null;

alter table public.extra_items add column if not exists platform text;

-- SECURITY DEFINER: returns only what a visitor is allowed to see.
-- The statement is included ONLY for the owner; everyone else gets
-- just the progress/consistency numbers (never the commit message).
create or replace function public.get_commitment_verification(p_hash text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select (
    select json_build_object(
      'found', true,
      'commit_id', c.commit_id,
      'username', coalesce(p.username, ''),
      'start_date', c.start_date,
      'end_date', c.end_date,
      'hash', c.hash,
      'is_owner', (auth.uid() = c.user_id),
      'statement', case when auth.uid() = c.user_id then c.statement else null end,
      'stats', (
        select json_build_object(
          'sealed', (select count(*)::int from public.day_progress dp
                     where dp.user_id = c.user_id and dp.is_sealed
                       and not exists (select 1 from public.excluded_days ed
                                       where ed.user_id = c.user_id and ed.day_id = dp.day_id)),
          'solved', (select count(*)::int from public.item_progress ip where ip.user_id = c.user_id),
          'streak', coalesce((select streak from public.streak_log sl
                              where sl.user_id = c.user_id order by sl.id desc limit 1), 0),
          'best', coalesce((select max(streak) from public.streak_log sl2 where sl2.user_id = c.user_id), 0),
          'active_days', 400 - (select count(*)::int from public.excluded_days ed2 where ed2.user_id = c.user_id)
        )
      )
    )
    from public.commitment c
    left join public.profiles p on p.id = c.user_id
    where c.hash = p_hash
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- v6 additions: published Daily Coding Articles (public read, owner write)
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.articles (
  slug             text primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  title            text not null,
  date             date not null default current_date,
  day_streak       int  not null default 0,
  tags             jsonb not null default '[]'::jsonb,
  video_url        text,
  content_markdown text not null default '',
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.articles enable row level security;

drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles
  for select using (is_published);

drop policy if exists "articles owner write" on public.articles;
create policy "articles owner write" on public.articles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- v7 additions: schema versioning + GitHub source for articles
-- ═══════════════════════════════════════════════════════════════════════
alter table public.articles add column if not exists schema_version int not null default 1;
alter table public.articles add column if not exists github_url text;

-- v8: structured article blocks (example / complexity / mistakes / pattern)
alter table public.articles add column if not exists blocks jsonb;
