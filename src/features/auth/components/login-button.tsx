"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginButton({
  invitationToken,
}: {
  invitationToken?: string;
} = {}) {
  async function signIn() {
    const supabase = createSupabaseBrowserClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (invitationToken)
      callbackUrl.searchParams.set("invitation", invitationToken);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
  }

  return (
    <button
      className="primary-button login-button"
      type="button"
      onClick={signIn}
    >
      Googleでログイン
    </button>
  );
}
