create unique index list_invitations_pending_unique_idx
  on public.list_invitations(list_id, lower(email))
  where accepted_at is null;
