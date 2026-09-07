import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const context = await getAuthContext();
  if (!context) redirect(`/?invitation=${encodeURIComponent(token)}`);

  const { error } = await context.supabase.rpc("accept_list_invitation", {
    invitation_token_hash: createHash("sha256").update(token).digest("hex"),
    accepting_user_id: context.user.id,
  });
  if (error?.message.includes("INVITATION_INVALID")) {
    return Response.json(
      { error: "Invitation is invalid or expired", code: "INVITATION_INVALID" },
      { status: 410 },
    );
  }
  if (error)
    return Response.json(
      { error: error.message, code: "INVITATION_ACCEPT_FAILED" },
      { status: 500 },
    );
  redirect("/");
}
