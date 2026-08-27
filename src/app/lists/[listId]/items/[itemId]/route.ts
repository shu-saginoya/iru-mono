import { z } from "zod";
import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  quantity: z.number().int().min(1).max(999),
});
type Context = { params: Promise<{ listId: string; itemId: string }> };

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

async function getItem(
  context: Awaited<ReturnType<typeof getAuthContext>>,
  listId: string,
  itemId: string,
) {
  if (!context) return null;
  const access = await getListAccess(listId, context.user.id);
  if (!access) return access;
  const { data: item } = await access.supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .eq("list_id", listId)
    .maybeSingle();
  return item ? { ...access, item } : undefined;
}

export async function PUT(request: Request, { params }: Context) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId, itemId } = await params;
  const target = await getItem(context, listId, itemId);
  if (target === null)
    return Response.json(
      { error: "List not found", code: "LIST_NOT_FOUND" },
      { status: 404 },
    );
  if (!target)
    return Response.json(
      { error: "Item not found", code: "ITEM_NOT_FOUND" },
      { status: 404 },
    );
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  const { data: item, error } = await target.supabase
    .from("items")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .select()
    .single();
  if (error)
    return Response.json(
      { error: error.message, code: "ITEM_UPDATE_FAILED" },
      { status: 500 },
    );
  return Response.json({ item });
}

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getAuthContext();
  if (!context) return unauthorized();
  const { listId, itemId } = await params;
  const target = await getItem(context, listId, itemId);
  if (target === null)
    return Response.json(
      { error: "List not found", code: "LIST_NOT_FOUND" },
      { status: 404 },
    );
  if (!target)
    return Response.json(
      { error: "Item not found", code: "ITEM_NOT_FOUND" },
      { status: 404 },
    );
  if (target.item.is_completed)
    return Response.json(
      {
        error: "Completed items cannot be deleted",
        code: "COMPLETED_ITEM_CANNOT_BE_DELETED",
      },
      { status: 409 },
    );
  const { error } = await target.supabase
    .from("items")
    .delete()
    .eq("id", itemId);
  if (error)
    return Response.json(
      { error: error.message, code: "ITEM_DELETE_FAILED" },
      { status: 500 },
    );
  return new Response(null, { status: 204 });
}
