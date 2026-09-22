-- 同じリストのメンバー同士がお互いのプロフィールを閲覧できるようにする
create policy "list co-members can read profiles"
  on public.users for select using (
    exists (
      select 1 from public.list_members lm
      where lm.user_id = users.id
        and public.is_list_member(lm.list_id, auth.uid())
    )
  );

-- email 追加前に登録されたユーザーへ auth.users の値を補完する
update public.users u
set email = a.email
from auth.users a
where a.id = u.id and u.email is null;
