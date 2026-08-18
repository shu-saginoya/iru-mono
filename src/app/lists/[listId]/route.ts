import { z } from "zod";
import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

const updateListSchema = z.object({ name: z.string().trim().min(1).max(100) });

type ListRouteContext = { params: Promise<{ listId: string }> };

export async function GET(_request: Request, { params }: ListRouteContext) {
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
      { error: "Access denied", code: "FORBIDDEN" },
      { status: 403 },
    );

  const { data: members, error } = await access.supabase
    .from("list_members")
    .select("user_id, joined_at, users(id, display_name, avatar_url)")
    .eq("list_id", listId);
  if (error)
    return Response.json(
      { error: error.message, code: "MEMBERS_READ_FAILED" },
      { status: 500 },
    );
  return Response.json({ list: access.list, members });
}

export async function PUT(request: Request, { params }: ListRouteContext) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId } = await params;
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

  const parsed = updateListSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  const { data: list, error } = await context.supabase
    .from("lists")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("id", listId)
    .select()
    .single();
  if (error)
    return Response.json(
      { error: error.message, code: "LIST_UPDATE_FAILED" },
      { status: 500 },
    );
  return Response.json({ list });
}

export async function DELETE(_request: Request, { params }: ListRouteContext) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId } = await params;
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
  const { error } = await context.supabase
    .from("lists")
    .delete()
    .eq("id", listId);
  if (error)
    return Response.json(
      { error: error.message, code: "LIST_DELETE_FAILED" },
      { status: 500 },
    );
  return new Response(null, { status: 204 });
}
