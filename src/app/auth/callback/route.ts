import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await supabase.from("users").upsert({
        id: data.user.id,
        display_name:
          data.user.user_metadata.full_name ??
          data.user.user_metadata.name ??
          null,
        avatar_url: data.user.user_metadata.avatar_url ?? null,
      });
    }
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
