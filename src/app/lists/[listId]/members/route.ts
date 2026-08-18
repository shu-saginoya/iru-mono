import { z } from "zod";
import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";

const memberSchema = z.object({ userId: z.string().uuid() });
type Context = { params: Promise<{ listId: string }> };

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
  if (!access?.isOwner)
    return Response.json(
      { error: "Owner access required", code: "FORBIDDEN" },
      { status: 403 },
    );

  const parsed = memberSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  const { data: member, error } = await context.supabase
    .from("list_members")
    .insert({ list_id: listId, user_id: parsed.data.userId })
    .select()
    .single();
  if (error?.code === "23505")
    return Response.json(
      { error: "User is already a member", code: "MEMBER_ALREADY_EXISTS" },
      { status: 409 },
    );
  if (error)
    return Response.json(
      { error: error.message, code: "MEMBER_CREATE_FAILED" },
      { status: 500 },
    );
  return Response.json({ member }, { status: 201 });
}
