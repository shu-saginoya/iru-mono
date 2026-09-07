create table public.list_invitations (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index list_invitations_email_idx on public.list_invitations(lower(email));
create index list_invitations_list_id_idx on public.list_invitations(list_id);

alter table public.list_invitations enable row level security;

create policy "owners can create invitations"
  on public.list_invitations for insert with check (
    public.is_list_owner(list_id, auth.uid()) and invited_by = auth.uid()
  );
create policy "owners can read invitations"
  on public.list_invitations for select using (
    public.is_list_owner(list_id, auth.uid())
  );
create policy "invitees can read their invitations"
  on public.list_invitations for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "owners can delete invitations"
  on public.list_invitations for delete using (
    public.is_list_owner(list_id, auth.uid())
  );

create or replace function public.accept_list_invitation(
  invitation_token_hash text,
  accepting_user_id uuid
)
returns public.list_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.list_invitations;
  accepted_member public.list_members;
begin
  if auth.uid() is null or auth.uid() <> accepting_user_id then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';
  end if;

  select * into invitation
  from public.list_invitations
  where token_hash = invitation_token_hash
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  for update;

  if not found then
    raise exception 'INVITATION_INVALID' using errcode = 'P0002';
  end if;

  insert into public.list_members (list_id, user_id)
  values (invitation.list_id, accepting_user_id)
  on conflict (list_id, user_id) do update set user_id = excluded.user_id
  returning * into accepted_member;

  update public.list_invitations
  set accepted_at = now()
  where id = invitation.id;

  return accepted_member;
end;
$$;

revoke all on function public.accept_list_invitation(text, uuid) from public;
grant execute on function public.accept_list_invitation(text, uuid) to authenticated;