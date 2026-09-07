import { getAuthContext, unauthorized } from "@/lib/api/auth";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return unauthorized();

  const { data, error } = await context.supabase
    .from("list_invitations")
    .select("id, email, expires_at, created_at, lists(name)")
    .eq("email", context.user.email?.toLowerCase() ?? "")
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error)
    return Response.json(
      { error: error.message, code: "INVITATIONS_READ_FAILED" },
      { status: 500 },
    );

  const invitations = (data ?? []).map((invitation) => {
    const list = Array.isArray(invitation.lists)
      ? invitation.lists[0]
      : invitation.lists;
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
      list: list ? { name: list.name } : null,
    };
  });

  return Response.json({ invitations });
}
