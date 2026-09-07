import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginButton } from "@/features/auth/components/login-button";
import { Dashboard } from "@/features/dashboard/components/dashboard";

type Props = { searchParams: Promise<{ invitation?: string }> };

export default async function Home({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { invitation } = await searchParams;

  if (!user) {
    return (
      <main className="login-shell">
        <p className="eyebrow">SHARED SHOPPING</p>
        <h1>IRU MONO</h1>
        <p className="login-copy">
          {invitation
            ? "招待を承認するには Google でログインしてください。"
            : "買うものを、ひとつの場所に。"}
        </p>
        <LoginButton invitationToken={invitation} />
      </main>
    );
  }

  return <Dashboard email={user.email ?? ""} userId={user.id} />;
}
