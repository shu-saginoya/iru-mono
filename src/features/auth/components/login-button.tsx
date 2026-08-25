"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginButton() {
  async function signIn() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
