
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  country text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Game history
create table public.game_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result text not null check (result in ('win','loss','draw')),
  opponent text not null,
  mode text not null,
  played_at timestamptz not null default now()
);

alter table public.game_history enable row level security;

create policy "history_select_own" on public.game_history for select using (auth.uid() = user_id);
create policy "history_insert_own" on public.game_history for insert with check (auth.uid() = user_id);
create policy "history_delete_own" on public.game_history for delete using (auth.uid() = user_id);

create index game_history_user_played_idx on public.game_history(user_id, played_at desc);
