import { z } from "zod";
import { getAuthContext, getListAccess, unauthorized } from "@/lib/api/auth";
import { createInvitationToken } from "@/lib/api/invitations";

const memberSchema = z.object({ email: z.string().trim().email().max(320) });
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
  const { token, tokenHash } = createInvitationToken();
  const { data: invitation, error } = await context.supabase
    .from("list_invitations")
    .insert({
      list_id: listId,
      invited_by: context.user.id,
      email: parsed.data.email.toLowerCase(),
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error?.code === "23505")
    return Response.json(
      {
        error: "An invitation is already pending",
        code: "INVITATION_ALREADY_EXISTS",
      },
      { status: 409 },
    );
  if (error)
    return Response.json(
      { error: error.message, code: "INVITATION_CREATE_FAILED" },
      { status: 500 },
    );
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
  const invitationUrl = new URL(`/invitations/${token}`, appUrl).toString();
  return Response.json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expires_at,
        url: invitationUrl,
      },
    },
    { status: 201 },
  );
}
