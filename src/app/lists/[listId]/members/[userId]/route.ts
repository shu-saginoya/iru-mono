import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

type Context = { params: Promise<{ listId: string; userId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId, userId } = await params;
  const access = await getListAccess(listId, context.user.id);
  if (access === null)
    return Response.json(
      { error: "List not found", code: "LIST_NOT_FOUND" },
      { status: 404 },
    );
  if (!access?.isOwner)
    return Response.json(
      { error: "Owner access required", code: "FORBIDDEN" },
      { status: 403 },
    );
  if (userId === access.list.created_by)
    return Response.json(
      {
        error: "The list owner cannot be removed",
        code: "OWNER_CANNOT_BE_REMOVED",
      },
      { status: 409 },
    );
  const { error } = await context.supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", userId);
  if (error)
    return Response.json(
      { error: error.message, code: "MEMBER_DELETE_FAILED" },
      { status: 500 },
    );
  return new Response(null, { status: 204 });
}
