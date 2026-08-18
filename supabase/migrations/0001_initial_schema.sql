create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  quantity integer not null default 1 check (quantity between 1 and 999),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_completed = false and completed_at is null)
    or (is_completed = true and completed_at is not null))
);

create index list_members_user_id_idx on public.list_members(user_id);
create index items_list_id_idx on public.items(list_id);
create index items_created_at_idx on public.items(created_at);

alter table public.users enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.items enable row level security;

create or replace function public.is_list_member(target_list_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.list_members
    where list_id = target_list_id and user_id = target_user_id
  );
$$;

create or replace function public.is_list_owner(target_list_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.lists
    where id = target_list_id and created_by = target_user_id
  );
$$;

create policy "users can read their profile"
  on public.users for select using (id = auth.uid());
create policy "users can create their profile"
  on public.users for insert with check (id = auth.uid());
create policy "users can update their profile"
  on public.users for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members can read lists"
  on public.lists for select using (
    public.is_list_member(id, auth.uid()) or created_by = auth.uid()
  );
create policy "users can create lists"
  on public.lists for insert with check (created_by = auth.uid());
create policy "owners can update lists"
  on public.lists for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "owners can delete lists"
  on public.lists for delete using (created_by = auth.uid());

create policy "members can read memberships"
  on public.list_members for select using (
    public.is_list_member(list_id, auth.uid())
  );
create policy "owners can add memberships"
  on public.list_members for insert with check (
    public.is_list_owner(list_id, auth.uid())
  );
create policy "owners or self can leave memberships"
  on public.list_members for delete using (
    user_id = auth.uid() or public.is_list_owner(list_id, auth.uid())
  );

create policy "members can read items"
  on public.items for select using (
    public.is_list_member(items.list_id, auth.uid())
  );
create policy "members can create items"
  on public.items for insert with check (
    public.is_list_member(items.list_id, auth.uid())
  );
create policy "members can update items"
  on public.items for update using (
    public.is_list_member(items.list_id, auth.uid())
  );
create policy "members can delete items"
  on public.items for delete using (
    public.is_list_member(items.list_id, auth.uid())
  );
