import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

type Context = { params: Promise<{ listId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId } = await params;
  const access = await getListAccess(listId, context.user.id);
  if (access === null)
    return Response.json(
      { error: "List not found", code: "LIST_NOT_FOUND" },
      { status: 404 },
    );
  if (!access)
    return Response.json(
      { error: "Membership not found", code: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 },
    );
  if (access.isOwner)
    return Response.json(
      { error: "Owner cannot leave this list", code: "OWNER_CANNOT_LEAVE" },
      { status: 409 },
    );
  const { error } = await access.supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", context.user.id);
  if (error)
    return Response.json(
      { error: error.message, code: "MEMBERSHIP_DELETE_FAILED" },
      { status: 500 },
    );
  return new Response(null, { status: 204 });
}
