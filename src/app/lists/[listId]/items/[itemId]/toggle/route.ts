import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

type Context = { params: Promise<{ listId: string; itemId: string }> };

export async function PATCH(_request: Request, { params }: Context) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId, itemId } = await params;
  const access = await getListAccess(listId, context.user.id);
  if (access === null)
    return Response.json(
      { error: "List not found", code: "LIST_NOT_FOUND" },
      { status: 404 },
    );
  if (!access)
    return Response.json(
      { error: "Access denied", code: "FORBIDDEN" },
      { status: 403 },
    );
  const { data: item } = await access.supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .eq("list_id", listId)
    .maybeSingle();
  if (!item)
    return Response.json(
      { error: "Item not found", code: "ITEM_NOT_FOUND" },
      { status: 404 },
    );
  const isCompleted = !item.is_completed;
  const { data: updated, error } = await access.supabase
    .from("items")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select()
    .single();
  if (error)
    return Response.json(
      { error: error.message, code: "ITEM_TOGGLE_FAILED" },
      { status: 500 },
    );
  return Response.json({ item: updated });
}
