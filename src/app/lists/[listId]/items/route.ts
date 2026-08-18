import { z } from "zod";
import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

const itemSchema = z.object({
  title: z.string().trim().min(1).max(255),
  quantity: z.number().int().min(1).max(999).default(1),
});
const querySchema = z.object({
  status: z.enum(["pending", "completed", "all"]).default("pending"),
  sort: z.enum(["createdAt:desc", "updatedAt:desc"]).default("createdAt:desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
type Context = { params: Promise<{ listId: string }> };

export async function GET(request: Request, { params }: Context) {
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
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", code: "VALIDATION_ERROR" },
      { status: 422 },
    );
  const { status, sort, limit, offset } = query.data;
  let builder = access.supabase
    .from("items")
    .select("*", { count: "exact" })
    .eq("list_id", listId);
  if (status !== "all")
    builder = builder.eq("is_completed", status === "completed");
  const orderColumn = sort === "updatedAt:desc" ? "updated_at" : "created_at";
  const { data, count, error } = await builder
    .order(orderColumn, { ascending: false })
    .range(offset, offset + limit - 1);
  if (error)
    return Response.json(
      { error: error.message, code: "ITEMS_READ_FAILED" },
      { status: 500 },
    );
  return Response.json({
    items: data,
    pagination: { limit, offset, total: count ?? 0 },
  });
}

export async function POST(request: Request, { params }: Context) {
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
  const parsed = itemSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  const { data: item, error } = await access.supabase
    .from("items")
    .insert({ ...parsed.data, list_id: listId })
    .select()
    .single();
  if (error)
    return Response.json(
      { error: error.message, code: "ITEM_CREATE_FAILED" },
      { status: 500 },
    );
  return Response.json({ item }, { status: 201 });
}
