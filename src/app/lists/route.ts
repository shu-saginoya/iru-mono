import { z } from "zod";
import { getAuthContext, unauthorized } from "@/lib/api/auth";

const createListSchema = z.object({ name: z.string().trim().min(1).max(100) });

export async function GET() {
  const context = await getAuthContext();
  if (!context) return unauthorized();

  const { data, error } = await context.supabase
    .from("lists")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error)
    return Response.json(
      { error: error.message, code: "LISTS_READ_FAILED" },
      { status: 500 },
    );
  return Response.json({ lists: data });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return unauthorized();

  const parsed = createListSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );

  const { data: list, error: listError } = await context.supabase
    .from("lists")
    .insert({ name: parsed.data.name, created_by: context.user.id })
    .select()
    .single();
  if (listError)
    return Response.json(
      { error: listError.message, code: "LIST_CREATE_FAILED" },
      { status: 500 },
    );

  const { error: memberError } = await context.supabase
    .from("list_members")
    .insert({ list_id: list.id, user_id: context.user.id });
  if (memberError)
    return Response.json(
      { error: memberError.message, code: "MEMBERSHIP_CREATE_FAILED" },
      { status: 500 },
    );
  return Response.json({ list }, { status: 201 });
}
