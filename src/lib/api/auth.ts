import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export function unauthorized() {
  return Response.json(
    { error: "Authentication required", code: "UNAUTHENTICATED" },
    { status: 401 },
  );
}

export async function getListAccess(listId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: list } = await supabase
    .from("lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();
  if (!list) return null;

  const { data: membership } = await supabase
    .from("list_members")
    .select("user_id")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .maybeSingle();

  return membership
    ? { supabase, list, isOwner: list.created_by === userId }
    : undefined;
}
